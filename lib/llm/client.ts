import OpenAI from "openai";
import pLimit from "p-limit";
import { config } from "@/lib/config";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider for a JSON object response. */
  json?: boolean;
  /** Override the per-model default (see defaultReasoningEffort). */
  reasoningEffort?: "none" | "low" | "medium" | "high";
  /** Tried after the primary model fails on every provider (e.g. it's rate-limited). */
  fallbackModel?: string;
};

export type ChatResult = {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
  usage: { prompt: number; completion: number };
};

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly provider?: string,
    /** True for transient problems worth retrying (e.g. an empty completion). */
    readonly retryable = false,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

type Provider = { name: string; client: OpenAI; modelMap: Record<string, string> };

let providers: Provider[] | null = null;

function hostName(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** "a=b,c=d" -> { a: "b", c: "d" }: maps primary model IDs to the fallback provider's IDs. */
function parseModelMap(raw: string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const pair of (raw ?? "").split(",")) {
    const [from, to] = pair.split("=").map((s) => s.trim());
    if (from && to) map[from] = to;
  }
  return map;
}

function getProviders(): Provider[] {
  if (providers) return providers;
  const list: Provider[] = [];
  const { LLM_BASE_URL, LLM_API_KEY, LLM_FALLBACK_BASE_URL, LLM_FALLBACK_API_KEY } = process.env;
  if (!LLM_BASE_URL || !LLM_API_KEY) {
    throw new LlmError("LLM_BASE_URL and LLM_API_KEY must be set");
  }
  // maxRetries: 0 because we do our own backoff + fallback below.
  list.push({
    name: hostName(LLM_BASE_URL),
    client: new OpenAI({ baseURL: LLM_BASE_URL, apiKey: LLM_API_KEY, maxRetries: 0, timeout: 45_000 }),
    modelMap: {},
  });
  if (LLM_FALLBACK_BASE_URL && LLM_FALLBACK_API_KEY) {
    list.push({
      name: hostName(LLM_FALLBACK_BASE_URL),
      client: new OpenAI({
        baseURL: LLM_FALLBACK_BASE_URL,
        apiKey: LLM_FALLBACK_API_KEY,
        maxRetries: 0,
        timeout: 45_000,
      }),
      modelMap: parseModelMap(process.env.LLM_FALLBACK_MODEL_MAP),
    });
  }
  providers = list;
  return list;
}

// One limiter per server instance, shared by every LLM call.
const limit = pLimit(config.limits.llmConcurrency);

/**
 * Reasoning models spend hidden tokens before answering. Keep that small by default:
 * Qwen can turn it off entirely; gpt-oss only goes down to "low".
 */
export function defaultReasoningEffort(model: string): ChatOptions["reasoningEffort"] {
  if (model.startsWith("qwen")) return "none";
  if (model.startsWith("gpt-oss")) return "low";
  return undefined;
}

const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err: unknown): boolean {
  if (err instanceof LlmError) return err.retryable;
  if (err instanceof OpenAI.APIConnectionError) return true;
  if (err instanceof OpenAI.APIError) {
    return err.status === 429 || (err.status !== undefined && err.status >= 500);
  }
  return false;
}

/**
 * Delay before retry `attempt` (0-based). Honour retry-after if sent. Rate limits (429) are
 * per-minute windows, so back off in seconds (4s/8s/16s); other errors use 1s/2s/4s. Jittered.
 */
function backoffMs(err: unknown, attempt: number): number {
  if (err instanceof OpenAI.APIError && err.headers) {
    const retryAfter = Number(err.headers.get("retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 20_000);
  }
  const base = err instanceof OpenAI.APIError && err.status === 429 ? 4000 : 1000;
  return base * 2 ** attempt + Math.random() * 500;
}

/** Strip <think> blocks some models leak into content, and surrounding whitespace. */
function cleanContent(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

async function callProvider(provider: Provider, opts: ChatOptions): Promise<ChatResult> {
  const model = provider.modelMap[opts.model] ?? opts.model;
  const effort = opts.reasoningEffort ?? defaultReasoningEffort(model);
  const started = Date.now();
  const res = await provider.client.chat.completions.create({
    model,
    messages: opts.messages,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
    ...(effort ? { reasoning_effort: effort } : {}),
  });
  const latencyMs = Date.now() - started;
  const choice = res.choices[0];
  const text = cleanContent(choice?.message?.content ?? "");
  const usage = { prompt: res.usage?.prompt_tokens ?? 0, completion: res.usage?.completion_tokens ?? 0 };

  console.log(
    `[llm] ${provider.name} ${model} ${latencyMs}ms in=${usage.prompt} out=${usage.completion}` +
      (choice?.finish_reason && choice.finish_reason !== "stop" ? ` finish=${choice.finish_reason}` : ""),
  );

  if (!text) {
    // Usually the reasoning ate the whole token budget.
    throw new LlmError(
      `Empty response from ${model} (finish_reason=${choice?.finish_reason ?? "unknown"})`,
      undefined,
      provider.name,
      true,
    );
  }
  return { text, provider: provider.name, model, latencyMs, usage };
}

/**
 * Chat completion with a concurrency limit, retry/backoff on 429/5xx, then the fallback
 * provider, then (if given) a fallback model. The limiter slot is released while backing off.
 */
export async function chat(opts: ChatOptions): Promise<ChatResult> {
  let lastErr: unknown;
  const models = [opts.model, ...(opts.fallbackModel ? [opts.fallbackModel] : [])];

  for (const model of models) {
    for (const provider of getProviders()) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          return await limit(() => callProvider(provider, { ...opts, model }));
        } catch (err) {
          lastErr = err;
          if (!isRetryable(err) || attempt === MAX_RETRIES) break;
          const wait = backoffMs(err, attempt);
          console.warn(`[llm] ${provider.name} ${model} retry ${attempt + 1} in ${Math.round(wait)}ms`);
          await sleep(wait);
        }
      }
      console.warn(`[llm] ${provider.name} ${model} failed: ${describe(lastErr)}`);
    }
  }
  if (lastErr instanceof LlmError) throw lastErr;
  const status = lastErr instanceof OpenAI.APIError ? lastErr.status : undefined;
  throw new LlmError(`LLM request failed: ${describe(lastErr)}`, status);
}

function describe(err: unknown): string {
  if (err instanceof OpenAI.APIError) return `${err.status ?? "network"} ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
