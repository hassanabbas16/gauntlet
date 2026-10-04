import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
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
