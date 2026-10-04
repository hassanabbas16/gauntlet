import type { Persona } from "@/lib/sim/personas";
import type { AgentSnapshot, EndReason, SimTurn } from "@/lib/sim/types";
import { runCodeCheck } from "./codeChecks";
import { runLlmJudge } from "./llmJudge";
import type { ItemResult, JudgeResult, JudgeRubricItem, Severity } from "./types";

export * from "./types";

const WEIGHT: Record<Severity, number> = { critical: 3, major: 2, minor: 1 };

/** Any failed critical item fails the call; otherwise pass if the weighted score is >= 0.8. */
export function computeVerdict(results: ItemResult[]): { verdict: "pass" | "fail"; score: number } {
  const total = results.reduce((s, r) => s + WEIGHT[r.severity], 0);
  const earned = results.reduce((s, r) => s + (r.passed ? WEIGHT[r.severity] : 0), 0);
  const score = total === 0 ? 1 : earned / total;
  const criticalFail = results.some((r) => r.severity === "critical" && !r.passed);
  return { verdict: !criticalFail && score >= 0.8 ? "pass" : "fail", score };
}

export async function judgeConversation(input: {
  scenario: string;
  agent: AgentSnapshot;
  persona: Persona;
  turns: SimTurn[];
  endReason: EndReason;
  rubric: JudgeRubricItem[];
}): Promise<JudgeResult> {
  const llmItems = input.rubric.filter((i) => i.kind === "llm");
  const codeItems = input.rubric.filter((i) => i.kind === "code");

  const llm = await runLlmJudge({ ...input, items: llmItems });

  const results: ItemResult[] = input.rubric.map((item) => {
    if (item.kind === "code") {
      const r = runCodeCheck(item.codeCheck ?? item.key, {
        turns: input.turns,
        persona: input.persona,
        endReason: input.endReason,
        scenario: input.scenario,
        config: item.config ?? {},
      });
      return { ...r, key: item.key, severity: item.severity, source: "code" };
    }
    const r = llm.results[item.key] ?? {
      passed: false,
      evidence: "The judge returned no result for this item.",
      turnIndex: null,
    };
    return { ...r, key: item.key, severity: item.severity, source: "llm" };
  });

  const { verdict, score } = computeVerdict(results);

  // Prefer the LLM's narrative summary; fall back to the first failed code check.
  let summary = llm.summary;
  if (llmItems.length === 0 || /^no issues found/i.test(summary)) {
    const failed = results.find((r) => !r.passed && codeItems.some((c) => c.key === r.key));
    if (failed) summary = failed.evidence;
  }
  return { verdict, score, summary, results };
}
