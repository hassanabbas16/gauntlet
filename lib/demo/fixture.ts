import type { EndReason, SimTurn } from "@/lib/sim/types";

/** Shape of scripts/fixtures/demo-run.json, produced by scripts/generate-demo-run.ts. */
export type DemoFixture = {
  generatedAt: string;
  models: { caller: string; agent: string; judge: string };
  runs: DemoFixtureRun[];
};

export type DemoFixtureRun = {
  agent: "v1" | "v2";
  seed: number;
  /** Minutes before seeding time, so runs appear in a believable order. */
  minutesAgo: number;
  conversations: DemoFixtureConversation[];
};

export type DemoFixtureConversation = {
  personaName: string;
  status: "completed" | "failed";
  endReason: EndReason;
  verdict: "pass" | "fail" | null;
  score: number | null;
  summary: string | null;
  error: string | null;
  turns: SimTurn[];
  scores: { key: string; passed: boolean; evidence: string; turnIndex: number | null; source: "llm" | "code" }[];
};
