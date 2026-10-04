export type Severity = "critical" | "major" | "minor";

/** A rubric item as the judge sees it (DB row shape minus storage fields). */
export type JudgeRubricItem = {
  id?: string;
  key: string;
  question: string;
  severity: Severity;
  kind: "llm" | "code";
  codeCheck?: string | null;
  config?: Record<string, unknown> | null;
};

export type CheckResult = {
  passed: boolean;
  evidence: string;
  turnIndex: number | null;
};

export type ItemResult = CheckResult & {
  key: string;
  severity: Severity;
  source: "llm" | "code";
};

export type JudgeResult = {
  verdict: "pass" | "fail";
  score: number;
  summary: string;
  results: ItemResult[];
};
