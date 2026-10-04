import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { config } from "@/lib/config";
import { getPersonas, getRubric } from "@/lib/data";
import { db, schema } from "@/lib/db";
import { judgeConversation } from "@/lib/judge";
import { personaSchema } from "@/lib/sim/personas";
import { createRng, hashSeed } from "@/lib/rng";
import { LoopError, runConversation } from "@/lib/sim/loop";
import type { SimTurn } from "@/lib/sim/types";

const { runs, conversations, turns, scores, agents, suites, personas, rubricItems } = schema;

/** A conversation stuck in "running" this long is assumed dead (function timed out) and can be retried. */
const STALE_RUNNING_MS = 6 * 60 * 1000;

export class RunError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export async function createRun(userId: string, agentId: string, suiteId: string) {
  const [[agent], [suite]] = await Promise.all([
    db.select().from(agents).where(and(eq(agents.id, agentId), eq(agents.userId, userId))),
    db.select().from(suites).where(and(eq(suites.id, suiteId), eq(suites.userId, userId))),
  ]);
  if (!agent) throw new RunError("Agent not found.", 404);
  if (!suite) throw new RunError("Suite not found.", 404);

  const suitePersonas = (await getPersonas(suite.id)).slice(0, config.limits.maxPersonasPerRun);
  if (suitePersonas.length === 0) throw new RunError("This suite has no personas yet. Generate some first.");
  const rubric = await getRubric(suite.id);
  if (rubric.length === 0) throw new RunError("This suite has no rubric items yet.");

  const [run] = await db
    .insert(runs)
    .values({
      userId,
      agentId: agent.id,
      suiteId: suite.id,
      status: "pending",
      // Snapshot so later edits to the agent don't change this run's results.
      agentSnapshot: {
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        temperature: agent.temperature,
      },
      seed: Math.floor(Math.random() * 2 ** 31),
    })
    .returning();

  const convs = await db
    .insert(conversations)
    .values(suitePersonas.map((p) => ({ runId: run.id, personaId: p.id, status: "pending" as const })))
    .returning({ id: conversations.id });

  return { runId: run.id, conversationIds: convs.map((c) => c.id) };
}

/** Marks the run completed (or failed if nothing succeeded) once no conversation is still open. */
async function refreshRunStatus(runId: string) {
  const rows = await db
    .select({ status: conversations.status })
    .from(conversations)
    .where(eq(conversations.runId, runId));
  const open = rows.some((r) => r.status === "pending" || r.status === "running");
  if (open) {
    await db.update(runs).set({ status: "running" }).where(and(eq(runs.id, runId), eq(runs.status, "pending")));
    return;
  }
  const anyCompleted = rows.some((r) => r.status === "completed");
  await db
    .update(runs)
    .set({ status: anyCompleted ? "completed" : "failed", completedAt: new Date() })
    .where(eq(runs.id, runId));
}

type ExecuteResult = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  verdict: "pass" | "fail" | null;
  score: number | null;
  error: string | null;
};

/**
 * Simulate + judge one conversation. Idempotent: a completed conversation is returned as is,
 * and only one request at a time can claim a pending/failed/stale one.
 */
export async function executeConversation(userId: string, conversationId: string): Promise<ExecuteResult> {
  const [row] = await db
    .select({ conv: conversations, run: runs })
    .from(conversations)
    .innerJoin(runs, eq(conversations.runId, runs.id))
    .where(and(eq(conversations.id, conversationId), eq(runs.userId, userId)));
  if (!row) throw new RunError("Conversation not found.", 404);
  const { conv, run } = row;

  if (conv.status === "completed") return pick(conv);

  // Claim it atomically.
  const staleBefore = new Date(Date.now() - STALE_RUNNING_MS);
  const claimed = await db
    .update(conversations)
    .set({ status: "running", startedAt: new Date(), error: null, endReason: null, verdict: null, score: null, summary: null })
    .where(
      and(
        eq(conversations.id, conv.id),
        or(
          eq(conversations.status, "pending"),
          eq(conversations.status, "failed"),
          and(eq(conversations.status, "running"), lt(conversations.startedAt, staleBefore)),
        ),
      ),
    )
    .returning();
  if (claimed.length === 0) return pick(conv); // someone else is running it
  await db.update(runs).set({ status: "running" }).where(and(eq(runs.id, run.id), eq(runs.status, "pending")));

  // Start clean in case this is a retry.
  await db.delete(turns).where(eq(turns.conversationId, conv.id));
  await db.delete(scores).where(eq(scores.conversationId, conv.id));

  try {
    const [personaRow] = await db.select().from(personas).where(eq(personas.id, conv.personaId));
    if (!personaRow) throw new Error("Persona was deleted.");
    const persona = { ...personaSchema.parse(personaRow.data), noiseLevel: personaRow.noiseLevel };
    const [suite] = await db.select().from(suites).where(eq(suites.id, run.suiteId));
    const rubric = await db
      .select()
      .from(rubricItems)
      .where(eq(rubricItems.suiteId, run.suiteId))
      .orderBy(asc(rubricItems.order));

    let simTurns: SimTurn[];
    let endReason;
    try {
      const result = await runConversation({
        agent: run.agentSnapshot,
        persona,
        rng: createRng(hashSeed(run.seed, conv.id)),
        maxTurns: config.limits.maxTurnsPerConversation,
        onTurn: async (t) => {
          await db.insert(turns).values({ conversationId: conv.id, ...t });
        },
      });
      simTurns = result.turns;
      endReason = result.endReason;
    } catch (err) {
      if (err instanceof LoopError) {
        throw new Error(`Simulation stopped after ${err.turns.length} turns: ${err.message}`);
      }
      throw err;
    }

    const judged = await judgeConversation({
      scenario: suite?.scenario ?? "",
      agent: run.agentSnapshot,
      persona,
      turns: simTurns,
      endReason,
      rubric,
    });

    const byKey = new Map(rubric.map((r) => [r.key, r.id]));
    const scoreRows = judged.results.flatMap((r) => {
      const rubricItemId = byKey.get(r.key);
      return rubricItemId
        ? [{ conversationId: conv.id, rubricItemId, passed: r.passed, evidence: r.evidence, turnIndex: r.turnIndex, source: r.source }]
        : [];
    });
    if (scoreRows.length) await db.insert(scores).values(scoreRows);

    const [done] = await db
      .update(conversations)
      .set({
        status: "completed",
        endReason,
        verdict: judged.verdict,
        score: judged.score,
        summary: judged.summary,
        completedAt: new Date(),
      })
      .where(eq(conversations.id, conv.id))
      .returning();
    return pick(done);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[execute] conversation ${conv.id} failed:`, message);
    const [failed] = await db
      .update(conversations)
      .set({ status: "failed", endReason: "error", error: message.slice(0, 1000), completedAt: new Date() })
      .where(eq(conversations.id, conv.id))
      .returning();
    return pick(failed);
  } finally {
    await refreshRunStatus(run.id);
  }
}

function pick(c: typeof conversations.$inferSelect): ExecuteResult {
  return { id: c.id, status: c.status, verdict: c.verdict, score: c.score, error: c.error };
}

export type RunStatus = Awaited<ReturnType<typeof getRunStatus>>;

export async function getRunStatus(userId: string, runId: string) {
  const [row] = await db
    .select({ run: runs, suiteName: suites.name })
    .from(runs)
    .innerJoin(suites, eq(runs.suiteId, suites.id))
    .where(and(eq(runs.id, runId), eq(runs.userId, userId)));
  if (!row) return null;

  const convRows = await db
    .select({ conv: conversations, persona: personas })
    .from(conversations)
    .innerJoin(personas, eq(conversations.personaId, personas.id))
    .where(eq(conversations.runId, runId))
    .orderBy(asc(personas.createdAt));

  const ids = convRows.map((r) => r.conv.id);
  const [turnCounts, failedScores] = ids.length
    ? await Promise.all([
        db
          .select({ conversationId: turns.conversationId, n: sql<number>`count(*)::int` })
          .from(turns)
          .where(inArray(turns.conversationId, ids))
          .groupBy(turns.conversationId),
        db
          .select({ key: rubricItems.key, severity: rubricItems.severity, n: sql<number>`count(*)::int` })
          .from(scores)
          .innerJoin(rubricItems, eq(scores.rubricItemId, rubricItems.id))
          .where(and(inArray(scores.conversationId, ids), eq(scores.passed, false)))
          .groupBy(rubricItems.key, rubricItems.severity),
      ])
    : [[], []];
  const tc = new Map(turnCounts.map((t) => [t.conversationId, t.n]));

  const convs = convRows.map(({ conv, persona }) => {
    const data = personaSchema.safeParse(persona.data);
    return {
      id: conv.id,
      personaName: persona.name,
      archetype: data.success ? data.data.archetype : "",
      noiseLevel: persona.noiseLevel,
      status: conv.status,
      endReason: conv.endReason,
      verdict: conv.verdict,
      score: conv.score,
      summary: conv.summary,
      error: conv.error,
      turns: tc.get(conv.id) ?? 0,
    };
  });

  const completed = convs.filter((c) => c.status === "completed");
  const passed = completed.filter((c) => c.verdict === "pass").length;
  const severityRank = { critical: 0, major: 1, minor: 2 } as const;

  return {
    run: {
      id: row.run.id,
      status: row.run.status,
      createdAt: row.run.createdAt.toISOString(),
      completedAt: row.run.completedAt?.toISOString() ?? null,
      agentId: row.run.agentId,
      agentName: row.run.agentSnapshot.name,
      model: row.run.agentSnapshot.model,
      suiteId: row.run.suiteId,
      suiteName: row.suiteName,
    },
    conversations: convs,
    aggregates: {
      total: convs.length,
      completed: completed.length,
      passed,
      failed: completed.length - passed,
      errored: convs.filter((c) => c.status === "failed").length,
      passRate: completed.length ? passed / completed.length : null,
      failuresByItem: failedScores
        .map((f) => ({ key: f.key, severity: f.severity, count: f.n }))
        .sort((a, b) => b.count - a.count || severityRank[a.severity] - severityRank[b.severity]),
    },
  };
}
