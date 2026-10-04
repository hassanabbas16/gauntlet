import type { z } from "zod";
import { chat, LlmError, type ChatOptions } from "./client";

/** Pull the JSON object out of a reply that may be wrapped in a code fence or prose. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  if (start === -1 || end < start) throw new Error("No JSON object found in response");
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Call the LLM, parse + validate JSON against `schema`. On failure, retry once with the
 * validation error appended so the model can fix its output. Throws LlmError after that.
 */
export async function chatJson<T extends z.ZodType>(
  schema: T,
  opts: Omit<ChatOptions, "json">,
): Promise<z.infer<T>> {
  let messages = opts.messages;
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await chat({ ...opts, messages, json: true });
    try {
      const parsed = schema.safeParse(extractJson(res.text));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    messages = [
      ...opts.messages,
      { role: "assistant", content: res.text },
      {
        role: "user",
        content: `Your previous reply was not valid. Problems: ${lastError}\nReply again with ONLY the corrected JSON object.`,
      },
    ];
  }
  throw new LlmError(`Model returned invalid JSON twice: ${lastError}`);
}
