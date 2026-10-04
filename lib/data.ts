import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { personaSchema, type Persona } from "@/lib/sim/personas";

const { agents, suites, rubricItems, personas, runs, conversations } = schema;

// Every read is scoped to the owner. Returning undefined for someone else's row means pages 404.

export async function listAgents(userId: string) {
  return db.select().from(agents).where(eq(agents.userId, userId)).orderBy(desc(agents.updatedAt));
}

export async function getAgent(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)));
  return row;
}

export async function listSuites(userId: string) {
  const rows = await db.select().from(suites).where(eq(suites.userId, userId)).orderBy(desc(suites.createdAt));
  if (rows.length === 0) return [];
  const ids = rows.map((s) => s.id);
  const [personaCounts, rubricCounts] = await Promise.all([
    db
      .select({ suiteId: personas.suiteId, n: count() })
      .from(personas)
      .where(inArray(personas.suiteId, ids))
      .groupBy(personas.suiteId),
    db
      .select({ suiteId: rubricItems.suiteId, n: count() })
      .from(rubricItems)
      .where(inArray(rubricItems.suiteId, ids))
      .groupBy(rubricItems.suiteId),
  ]);
  const pc = new Map(personaCounts.map((r) => [r.suiteId, r.n]));
  const rc = new Map(rubricCounts.map((r) => [r.suiteId, r.n]));
  return rows.map((s) => ({ ...s, personaCount: pc.get(s.id) ?? 0, rubricCount: rc.get(s.id) ?? 0 }));
}

export async function getSuite(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(suites)
    .where(and(eq(suites.id, id), eq(suites.userId, userId)));
  return row;
}

export async function getRubric(suiteId: string) {
  return db
    .select()
    .from(rubricItems)
    .where(eq(rubricItems.suiteId, suiteId))
    .orderBy(asc(rubricItems.order), asc(rubricItems.createdAt));
}

export type PersonaWithId = Persona & { id: string };

/** Personas for a suite, parsed. Rows whose JSON no longer validates are skipped. */
export async function getPersonas(suiteId: string): Promise<PersonaWithId[]> {
  const rows = await db
    .select()
    .from(personas)
    .where(eq(personas.suiteId, suiteId))
    .orderBy(asc(personas.createdAt));
  return rows.flatMap((r) => {
    const parsed = personaSchema.safeParse(r.data);
    return parsed.success ? [{ ...parsed.data, noiseLevel: r.noiseLevel, id: r.id }] : [];
  });
}

export function parsePersona(data: unknown, noiseLevel?: number): Persona {
  const p = personaSchema.parse(data);
  return noiseLevel === undefined ? p : { ...p, noiseLevel };
}

export async function countRunsForAgent(agentId: string) {
  const [row] = await db.select({ n: count() }).from(runs).where(eq(runs.agentId, agentId));
  return row?.n ?? 0;
}

export async function countConversations(runIds: string[]) {
  if (runIds.length === 0) return 0;
  const [row] = await db
    .select({ n: count() })
    .from(conversations)
    .where(inArray(conversations.runId, runIds));
  return row?.n ?? 0;
}

export type RunListItem = Awaited<ReturnType<typeof listRuns>>[number];

/** Runs newest first, with conversation pass/fail counts. */
export async function listRuns(userId: string, limit = 100) {
  const rows = await db
    .select({ run: runs, suiteName: suites.name })
    .from(runs)
    .innerJoin(suites, eq(runs.suiteId, suites.id))
    .where(eq(runs.userId, userId))
    .orderBy(desc(runs.createdAt))
    .limit(limit);
  if (rows.length === 0) return [];

  const stats = await db
    .select({
      runId: conversations.runId,
      total: count(),
      completed: sql<number>`count(*) filter (where ${conversations.status} = 'completed')::int`,
      passed: sql<number>`count(*) filter (where ${conversations.verdict} = 'pass')::int`,
      errored: sql<number>`count(*) filter (where ${conversations.status} = 'failed')::int`,
    })
    .from(conversations)
    .where(inArray(conversations.runId, rows.map((r) => r.run.id)))
    .groupBy(conversations.runId);
  const byRun = new Map(stats.map((s) => [s.runId, s]));

  return rows.map(({ run, suiteName }) => {
    const s = byRun.get(run.id);
    const completed = s?.completed ?? 0;
    return {
      id: run.id,
      status: run.status,
      createdAt: run.createdAt,
      agentId: run.agentId,
      agentName: run.agentSnapshot.name,
      model: run.agentSnapshot.model,
      suiteName,
      total: s?.total ?? 0,
      completed,
      passed: s?.passed ?? 0,
      errored: s?.errored ?? 0,
      passRate: completed ? (s?.passed ?? 0) / completed : null,
    };
  });
}

/** Totals and the most-failed rubric item across all of a user's runs. */
export async function dashboardStats(userId: string) {
  const runList = await listRuns(userId, 200);
  const runIds = runList.map((r) => r.id);
  const completed = runList.reduce((n, r) => n + r.completed, 0);
  const passed = runList.reduce((n, r) => n + r.passed, 0);

  let mostFailed: { key: string; count: number; severity: string } | null = null;
  if (runIds.length) {
    const [row] = await db
      .select({ key: rubricItems.key, severity: rubricItems.severity, n: sql<number>`count(*)::int` })
      .from(schema.scores)
      .innerJoin(conversations, eq(schema.scores.conversationId, conversations.id))
      .innerJoin(rubricItems, eq(schema.scores.rubricItemId, rubricItems.id))
      .where(and(inArray(conversations.runId, runIds), eq(schema.scores.passed, false)))
      .groupBy(rubricItems.key, rubricItems.severity)
      .orderBy(desc(sql`count(*)`))
      .limit(1);
    if (row) mostFailed = { key: row.key, count: row.n, severity: row.severity };
  }

  // Agents in creation order, so each keeps the same chart colour.
  const agentOrder = (
    await db.select({ id: agents.id }).from(agents).where(eq(agents.userId, userId)).orderBy(asc(agents.createdAt))
  ).map((a) => a.id);

  return {
    runs: runList,
    totalRuns: runList.length,
    conversations: completed,
    passRate: completed ? passed / completed : null,
    mostFailed,
    agentOrder,
  };
}
