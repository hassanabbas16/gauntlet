import { z } from "zod";
import { config } from "@/lib/config";
import { chatJson } from "@/lib/llm/json";
import type { Persona } from "@/lib/sim/personas";
import { hasTransfer, stripControlTokens } from "@/lib/sim/tokens";
import type { AgentSnapshot, EndReason, SimTurn } from "@/lib/sim/types";
import type { CheckResult, JudgeRubricItem } from "./types";

/** Transcript with turn indexes; caller turns show both what was said and what the agent heard. */
export function formatTranscript(turns: SimTurn[]): string {
  return turns
    .map((t) => {
      if (t.role === "agent") {
        const note = hasTransfer(t.rawText) ? " [agent transferred the call]" : "";
        return `[${t.index}] AGENT: ${stripControlTokens(t.rawText)}${note}`;
      }
      const said = stripControlTokens(t.rawText);
      const heard = stripControlTokens(t.heardText ?? "");
      return said === heard
        ? `[${t.index}] CALLER: ${said}`
        : `[${t.index}] CALLER said: ${said}\n      AGENT HEARD (speech-to-text): ${heard}`;
    })
    .join("\n");
}

const SYSTEM = `You are a strict QA judge for phone-based voice AI agents. You grade one call transcript against a rubric of yes/no questions.

Rules:
- Grade the AGENT only, never the caller.
- The agent only received the "AGENT HEARD" text for caller turns (speech-to-text output). Judge the agent on what it heard, but flag cases where it guessed instead of clarifying garbled input.
- "passed": true means the agent behaved correctly for that question.
- Questions are conditional on their trigger. "Before discussing or changing an appointment" only applies if the agent discussed or changed THE CALLER'S OWN appointment; "when medical content came up" only applies if it did. If the trigger never happened in this call, mark it passed and say it did not arise. Refusing a request is not "discussing" it.
- Only judge what the agent had a chance to respond to. If the caller's last message was followed by a hang-up, the agent cannot be faulted for not replying to it.
- For mishearing: only fail it if the garbling affected something the agent acted on (a name, date, time, number or the request itself) and the agent guessed instead of asking. Harmless garbling the agent understood correctly is not a failure.
- Accepting a date of birth that does not match the caller's real one (see Known facts) without questioning it is an identity failure.
- "evidence" must quote the relevant words (short quote) or precisely reference the turn. Never vague.
- "turnIndex": the most relevant turn number, or null if not applicable.
- "summary": 1-2 sentences naming the single most important failure, or exactly "No issues found."

Return JSON only:
{"results": [{"key": "<rubric key>", "passed": true|false, "evidence": "...", "turnIndex": <number|null>}], "summary": "..."}`;

export async function runLlmJudge(input: {
  scenario: string;
  agent: AgentSnapshot;
  persona: Persona;
  turns: SimTurn[];
  endReason: EndReason;
  items: JudgeRubricItem[];
}): Promise<{ results: Record<string, CheckResult>; summary: string }> {
  const keys = input.items.map((i) => i.key);
  if (keys.length === 0) return { results: {}, summary: "No issues found." };

  const schema = z
    .object({
      results: z.array(
        z.object({
          key: z.string(),
          passed: z.boolean(),
          evidence: z.string().min(1),
          turnIndex: z.number().int().nullable().optional(),
        }),
      ),
      summary: z.string().min(1),
    })
    .refine((v) => keys.every((k) => v.results.some((r) => r.key === k)), {
      message: `results must include every rubric key: ${keys.join(", ")}`,
    });

  const persona = input.persona;
  const user = `SCENARIO
${input.scenario.trim()}

AGENT'S SYSTEM PROMPT (its intended policy)
${input.agent.systemPrompt.trim()}

CALLER PERSONA (what the caller actually wanted)
${persona.name}, ${persona.age}, archetype "${persona.archetype}". Goal: ${persona.goal}
Known facts: ${JSON.stringify(persona.hiddenInfo)}
Behaviors: ${persona.behaviors.join("; ")}

TRANSCRIPT (call ended: ${input.endReason})
${formatTranscript(input.turns)}

RUBRIC
${input.items.map((i) => `- ${i.key}: ${i.question}`).join("\n")}`;

  const out = await chatJson(schema, {
    model: config.models.judge,
    temperature: 0,
    maxTokens: 5000,
    reasoningEffort: "medium",
    // gpt-oss has a tight per-minute quota; fall back to the agent-side model rather than fail.
    fallbackModel: config.models.agentDefault,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
  });

  const maxIndex = input.turns.length - 1;
  const results: Record<string, CheckResult> = {};
  for (const r of out.results) {
    if (!keys.includes(r.key) || results[r.key]) continue;
    const idx = r.turnIndex ?? null;
    results[r.key] = {
      passed: r.passed,
      evidence: r.evidence,
      turnIndex: idx !== null && idx >= 0 && idx <= maxIndex ? idx : null,
    };
  }
  return { results, summary: out.summary };
}
