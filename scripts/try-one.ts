// Runs one demo persona against a demo agent (v1 by default) and prints the transcript + judge output.
// Usage: pnpm tsx scripts/try-one.ts [personaIndex 0-7] [seed] [v1|v2]
import "./env";
import { config } from "@/lib/config";
import { DEMO_AGENT_V1, DEMO_AGENT_V2, DEMO_PERSONAS, DEMO_RUBRIC, DEMO_SCENARIO } from "@/lib/demo/data";
import { judgeConversation } from "@/lib/judge";
import { createRng, hashSeed } from "@/lib/rng";
import { runConversation } from "@/lib/sim/loop";
import { stripControlTokens } from "@/lib/sim/tokens";

async function main() {
  const personaIndex = Number(process.argv[2] ?? 3);
  const seed = Number(process.argv[3] ?? 42);
  const persona = DEMO_PERSONAS[personaIndex] ?? DEMO_PERSONAS[3];
  const prompt = process.argv[4] === "v2" ? DEMO_AGENT_V2 : DEMO_AGENT_V1;
  const agent = {
    name: prompt.name,
    systemPrompt: prompt.systemPrompt,
    model: config.models.agentDefault,
    temperature: 0.3,
  };

  console.log(`\n=== ${persona.name} (${persona.archetype}, noise ${persona.noiseLevel}) vs ${agent.name} [${agent.model}]\n`);

  const { turns, endReason } = await runConversation({
    agent,
    persona,
    rng: createRng(hashSeed(seed, persona.name)),
    maxTurns: config.limits.maxTurnsPerConversation,
    onTurn: (t) => {
      if (t.role === "agent") {
        console.log(`[${t.index}] AGENT : ${t.rawText}`);
      } else {
        console.log(`[${t.index}] CALLER said : ${t.rawText}`);
        if (stripControlTokens(t.rawText) !== t.heardText) console.log(`      agent heard: ${t.heardText}`);
      }
    },
  });

  console.log(`\nend reason: ${endReason}\n\n=== Judge\n`);
  const result = await judgeConversation({
    scenario: DEMO_SCENARIO,
    agent,
    persona,
    turns,
    endReason,
    rubric: DEMO_RUBRIC,
  });
  for (const r of result.results) {
    console.log(
      `${r.passed ? "PASS" : "FAIL"} ${r.key.padEnd(20)} ${r.severity.padEnd(8)} ${r.source.padEnd(4)} ` +
        `${r.turnIndex ?? "-"} | ${r.evidence}`,
    );
  }
  console.log(`\nverdict: ${result.verdict}  score: ${result.score.toFixed(2)}\nsummary: ${result.summary}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
