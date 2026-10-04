// Resets the demo account: demo user, v1 + v2 agents, the demo suite (rubric + personas), and
// the pre-generated runs from scripts/fixtures/demo-run.json if it exists.
// Usage: pnpm seed
import "./env";
import { existsSync, readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { config } from "@/lib/config";
import { closeDb, db, schema } from "@/lib/db";
import { DEMO_AGENT_V1, DEMO_AGENT_V2, DEMO_PERSONAS, DEMO_RUBRIC, DEMO_SCENARIO, DEMO_SUITE_NAME } from "@/lib/demo/data";
import type { DemoFixture } from "@/lib/demo/fixture";

const FIXTURE_PATH = "scripts/fixtures/demo-run.json";

async function seedDemoUser() {
  const email = (process.env.DEMO_EMAIL ?? "demo@gauntlet.ai").toLowerCase();
  const password = process.env.DEMO_PASSWORD ?? "demo1234";
  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash, name: "Demo User", isDemo: true })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { passwordHash, isDemo: true },
    })
    .returning();

  console.log(`demo user ready: ${user.email}`);
  return user;
}

async function main() {
  const user = await seedDemoUser();

  // Start from a clean slate. Cascades remove rubric, personas, runs, conversations, turns, scores.
  await db.delete(schema.suites).where(eq(schema.suites.userId, user.id));
  await db.delete(schema.agents).where(eq(schema.agents.userId, user.id));

  const fixture: DemoFixture | null = existsSync(FIXTURE_PATH)
    ? (JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as DemoFixture)
    : null;
  const agentModel = fixture?.models.agent ?? config.models.agentDefault;

  const now = Date.now();
  const [v1, v2] = await db
    .insert(schema.agents)
    .values([
      { userId: user.id, ...DEMO_AGENT_V1, model: agentModel, temperature: 0.3, createdAt: new Date(now - 3 * 864e5), updatedAt: new Date(now - 3 * 864e5) },
      { userId: user.id, ...DEMO_AGENT_V2, model: agentModel, temperature: 0.3, createdAt: new Date(now - 1 * 864e5), updatedAt: new Date(now - 1 * 864e5) },
    ])
    .returning();

  const [suite] = await db
    .insert(schema.suites)
    .values({ userId: user.id, name: DEMO_SUITE_NAME, scenario: DEMO_SCENARIO, createdAt: new Date(now - 3 * 864e5) })
    .returning();

  const rubric = await db
    .insert(schema.rubricItems)
    .values(
      DEMO_RUBRIC.map((r, i) => ({
        suiteId: suite.id,
        key: r.key,
        question: r.question,
        severity: r.severity,
        kind: r.kind,
        codeCheck: r.codeCheck ?? null,
        config: r.config ?? null,
        order: i,
      })),
    )
    .returning();

  // Stagger createdAt so personas keep their listed order.
  const personaRows = await db
    .insert(schema.personas)
    .values(
      DEMO_PERSONAS.map((p, i) => ({
        suiteId: suite.id,
        name: p.name,
        data: p,
        noiseLevel: p.noiseLevel,
        createdAt: new Date(now - 3 * 864e5 + i * 1000),
      })),
    )
    .returning();
  console.log(`agents v1/v2, suite "${suite.name}" with ${rubric.length} rubric items and ${personaRows.length} personas`);

  if (!fixture) {
    console.log(`no fixture at ${FIXTURE_PATH}; skipping demo runs (run scripts/generate-demo-run.ts first)`);
    return;
  }

  const personaByName = new Map(personaRows.map((p) => [p.name, p.id]));
  const rubricByKey = new Map(rubric.map((r) => [r.key, r.id]));

  for (const fr of fixture.runs) {
    const agent = fr.agent === "v1" ? v1 : v2;
    const prompt = fr.agent === "v1" ? DEMO_AGENT_V1 : DEMO_AGENT_V2;
    const createdAt = new Date(now - fr.minutesAgo * 60_000);
    const [run] = await db
      .insert(schema.runs)
      .values({
        userId: user.id,
        agentId: agent.id,
        suiteId: suite.id,
        status: "completed",
        agentSnapshot: { name: prompt.name, systemPrompt: prompt.systemPrompt, model: agentModel, temperature: 0.3 },
        seed: fr.seed,
        createdAt,
        completedAt: new Date(createdAt.getTime() + 3 * 60_000),
      })
      .returning();

    for (const fc of fr.conversations) {
      const personaId = personaByName.get(fc.personaName);
      if (!personaId) continue;
      const [conv] = await db
        .insert(schema.conversations)
        .values({
          runId: run.id,
          personaId,
          status: fc.status,
          endReason: fc.endReason,
          verdict: fc.verdict,
          score: fc.score,
          summary: fc.summary,
          error: fc.error,
          createdAt,
          startedAt: createdAt,
          completedAt: new Date(createdAt.getTime() + 60_000),
        })
        .returning();
      if (fc.turns.length) {
        await db.insert(schema.turns).values(fc.turns.map((t) => ({ conversationId: conv.id, ...t })));
      }
      const scoreRows = fc.scores.flatMap((s) => {
        const rubricItemId = rubricByKey.get(s.key);
        return rubricItemId ? [{ conversationId: conv.id, rubricItemId, ...s }] : [];
      });
      if (scoreRows.length) await db.insert(schema.scores).values(scoreRows);
    }
    const passed = fr.conversations.filter((c) => c.verdict === "pass").length;
    console.log(`run ${fr.agent} (seed ${fr.seed}): ${passed}/${fr.conversations.length} passed`);
  }
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error(err);
    await closeDb();
    process.exit(1);
  });
