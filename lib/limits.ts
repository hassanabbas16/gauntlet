import { and, count, eq, gte } from "drizzle-orm";
import { config } from "@/lib/config";
import { db, schema } from "@/lib/db";

// Demo accounts are shared by every reviewer, so they get daily caps to protect the LLM quota.

const DEMO_MAX_PERSONAS_PER_DAY = 40;

function startOfTodayUtc() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

type User = { id: string; isDemo: boolean };

export type LimitStatus = { allowed: boolean; used: number; max: number; message?: string };

export async function runLimitStatus(user: User): Promise<LimitStatus> {
  const max = config.limits.demoMaxRunsPerDay;
  if (!user.isDemo) return { allowed: true, used: 0, max: Infinity };
  const [row] = await db
    .select({ n: count() })
    .from(schema.runs)
    .where(and(eq(schema.runs.userId, user.id), gte(schema.runs.createdAt, startOfTodayUtc())));
  const used = row?.n ?? 0;
  return {
    allowed: used < max,
    used,
    max,
    message:
      used >= max
        ? `The demo account is limited to ${max} new runs per day, and today's are used up. The seeded runs are still there to explore, and the limit resets at midnight UTC.`
        : undefined,
  };
}

export async function personaLimitStatus(user: User, requested: number): Promise<LimitStatus> {
  if (!user.isDemo) return { allowed: true, used: 0, max: Infinity };
  const [row] = await db
    .select({ n: count() })
    .from(schema.personas)
    .innerJoin(schema.suites, eq(schema.personas.suiteId, schema.suites.id))
    .where(and(eq(schema.suites.userId, user.id), gte(schema.personas.createdAt, startOfTodayUtc())));
  const used = row?.n ?? 0;
  const allowed = used + requested <= DEMO_MAX_PERSONAS_PER_DAY;
  return {
    allowed,
    used,
    max: DEMO_MAX_PERSONAS_PER_DAY,
    message: allowed
      ? undefined
      : `The demo account can generate ${DEMO_MAX_PERSONAS_PER_DAY} personas per day (${used} used today). Try fewer, or come back tomorrow.`,
  };
}
