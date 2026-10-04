// Runs the real engine locally (no DB) for the demo agents and writes scripts/fixtures/demo-run.json,
// which scripts/seed.ts loads. This way the demo shows real model output without depending on the
// LLM provider being up when reviewers log in.
// Usage: pnpm tsx scripts/generate-demo-run.ts
import "./env";
import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "@/lib/config";
import { DEMO_AGENT_V1, DEMO_AGENT_V2, DEMO_PERSONAS, DEMO_RUBRIC, DEMO_SCENARIO } from "@/lib/demo/data";
import type { DemoFixture, DemoFixtureConversation, DemoFixtureRun } from "@/lib/demo/fixture";
import { judgeConversation } from "@/lib/judge";
import { createRng, hashSeed } from "@/lib/rng";
import { runConversation } from "@/lib/sim/loop";

const OUT = "scripts/fixtures/demo-run.json";
// Seeded runs sit on earlier days so they never count against today's demo run limit.
const RUNS: { agent: "v1" | "v2"; seed: number; minutesAgo: number }[] = [
  { agent: "v1", seed: 1101, minutesAgo: 3 * 24 * 60 + 35 },
  { agent: "v1", seed: 1202, minutesAgo: 2 * 24 * 60 + 10 },
  { agent: "v2", seed: 2101, minutesAgo: 30 * 60 },
  { agent: "v2", seed: 2202, minutesAgo: 25 * 60 + 20 },
];
// gpt-oss (the judge) allows ~5 requests/minute on this account, so judge calls are spaced out.
const JUDGE_SPACING_MS = 13_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let judgeChain: Promise<unknown> = Promise.resolve();
function judgeSerially<T>(fn: () => Promise<T>): Promise<T> {
  const next = judgeChain.then(async () => {
    const started = Date.now();
    try {
      return await fn();
    } finally {
      const wait = JUDGE_SPACING_MS - (Date.now() - started);
      if (wait > 0) await sleep(wait);
    }
  });
  judgeChain = next.catch(() => undefined);
  return next;
}

async function simulate(
  version: "v1" | "v2",
  seed: number,
  personaIndex: number,
): Promise<DemoFixtureConversation> {
  const prompt = version === "v1" ? DEMO_AGENT_V1 : DEMO_AGENT_V2;
  const agent = { name: prompt.name, systemPrompt: prompt.systemPrompt, model: config.models.agentDefault, temperature: 0.3 };
  const persona = DEMO_PERSONAS[personaIndex];
  const tag = `${version}/${seed} ${persona.name}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { turns, endReason } = await runConversation({
        agent,
        persona,
        rng: createRng(hashSeed(seed, persona.name, attempt)),
        maxTurns: config.limits.maxTurnsPerConversation,
      });
      const judged = await judgeSerially(() =>
        judgeConversation({ scenario: DEMO_SCENARIO, agent, persona, turns, endReason, rubric: DEMO_RUBRIC }),
      );
      console.log(`${tag}: ${judged.verdict} ${judged.score.toFixed(2)} (${turns.length} turns, ${endReason})`);
      return {
        personaName: persona.name,
        status: "completed",
        endReason,
        verdict: judged.verdict,
        score: judged.score,
        summary: judged.summary,
        error: null,
        turns,
        scores: judged.results.map((r) => ({
          key: r.key,
          passed: r.passed,
          evidence: r.evidence,
          turnIndex: r.turnIndex,
          source: r.source,
        })),
      };
    } catch (err) {
      console.warn(`${tag}: attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  throw new Error(`${tag}: failed 3 times`);
}

async function main() {
  console.log(`models: caller=${config.models.caller} agent=${config.models.agentDefault} judge=${config.models.judge}`);
  const runs: DemoFixtureRun[] = await Promise.all(
    RUNS.map(async (r) => ({
      ...r,
      conversations: await Promise.all(DEMO_PERSONAS.map((_, i) => simulate(r.agent, r.seed, i))),
    })),
  );

  for (const r of runs) {
    const passed = r.conversations.filter((c) => c.verdict === "pass").length;
    console.log(`run ${r.agent}/${r.seed}: ${passed}/${r.conversations.length} passed`);
  }

  const fixture: DemoFixture = {
    generatedAt: new Date().toISOString(),
    models: { caller: config.models.caller, agent: config.models.agentDefault, judge: config.models.judge },
    runs,
  };
  mkdirSync("scripts/fixtures", { recursive: true });
  writeFileSync(OUT, JSON.stringify(fixture, null, 2));
  console.log(`wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
