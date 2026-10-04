"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { CODE_CHECK_NAMES } from "@/lib/judge/codeChecks";
import { requireUser } from "@/lib/session";

export type FormState = { error?: string; ok?: boolean };

async function ownSuite(userId: string, suiteId: string) {
  const [row] = await db
    .select({ id: schema.suites.id })
    .from(schema.suites)
    .where(and(eq(schema.suites.id, suiteId), eq(schema.suites.userId, userId)));
  return row;
}

const DEFAULT_RUBRIC = [
  {
    key: "achieved_goal",
    question: "Did the agent correctly handle what the caller was calling about?",
    severity: "critical" as const,
    kind: "llm" as const,
  },
  {
    key: "handles_mishearing",
    question:
      "When the speech-to-text transcript was garbled or incomplete, did the agent ask for clarification instead of guessing?",
    severity: "major" as const,
    kind: "llm" as const,
  },
  {
    key: "ended_cleanly",
    question: "Did the call end cleanly instead of hitting the turn limit?",
    severity: "minor" as const,
    kind: "code" as const,
    codeCheck: "ended_cleanly",
  },
  {
    key: "reasonable_length",
    question: "Did the agent keep its turns short enough for a phone call?",
    severity: "minor" as const,
    kind: "code" as const,
    codeCheck: "reasonable_length",
  },
];

export async function createSuite(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Give the suite a name.").max(120),
      scenario: z.string().trim().min(20, "Describe the scenario in a sentence or two.").max(10_000),
    })
    .safeParse({ name: formData.get("name"), scenario: formData.get("scenario") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const [suite] = await db
    .insert(schema.suites)
    .values({ userId: user.id, ...parsed.data })
    .returning({ id: schema.suites.id });
  // Start every suite with a small sensible rubric the user can edit.
  await db
    .insert(schema.rubricItems)
    .values(DEFAULT_RUBRIC.map((r, i) => ({ ...r, suiteId: suite.id, order: i })));

  revalidatePath("/suites");
  redirect(`/suites/${suite.id}`);
}

export async function updateScenario(suiteId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      scenario: z.string().trim().min(20, "The scenario is too short.").max(10_000),
    })
    .safeParse({ name: formData.get("name"), scenario: formData.get("scenario") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const updated = await db
    .update(schema.suites)
    .set(parsed.data)
    .where(and(eq(schema.suites.id, suiteId), eq(schema.suites.userId, user.id)))
    .returning({ id: schema.suites.id });
  if (updated.length === 0) return { error: "Suite not found." };
  revalidatePath(`/suites/${suiteId}`);
  return { ok: true };
}

export async function deleteSuite(suiteId: string): Promise<{ error?: string }> {
  const user = await requireUser();
  await db.delete(schema.suites).where(and(eq(schema.suites.id, suiteId), eq(schema.suites.userId, user.id)));
  revalidatePath("/suites");
  redirect("/suites");
}

const rubricSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1, "Key is required")
      .max(60)
      .transform((k) =>
        k
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, ""),
      ),
    question: z.string().trim().min(5, "Write the yes/no question.").max(1000),
    severity: z.enum(["critical", "major", "minor"]),
    kind: z.enum(["llm", "code"]),
    codeCheck: z.string().optional(),
    archetypes: z.string().optional(),
  })
  .refine((v) => v.kind === "llm" || (v.codeCheck && CODE_CHECK_NAMES.includes(v.codeCheck)), {
    message: "Pick a code check.",
  });

export async function saveRubricItem(
  suiteId: string,
  itemId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!(await ownSuite(user.id, suiteId))) return { error: "Suite not found." };

  const parsed = rubricSchema.safeParse({
    key: formData.get("key"),
    question: formData.get("question"),
    severity: formData.get("severity"),
    kind: formData.get("kind"),
    codeCheck: formData.get("codeCheck") || undefined,
    archetypes: formData.get("archetypes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { archetypes, ...item } = parsed.data;

  const values = {
    key: item.key,
    question: item.question,
    severity: item.severity,
    kind: item.kind,
    codeCheck: item.kind === "code" ? (item.codeCheck ?? null) : null,
    config:
      item.kind === "code" && item.codeCheck === "escalated_when_required" && archetypes
        ? {
            archetypes: archetypes
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          }
        : null,
  };

  if (itemId) {
    await db
      .update(schema.rubricItems)
      .set(values)
      .where(and(eq(schema.rubricItems.id, itemId), eq(schema.rubricItems.suiteId, suiteId)));
  } else {
    const [row] = await db
      .select({ n: max(schema.rubricItems.order) })
      .from(schema.rubricItems)
      .where(eq(schema.rubricItems.suiteId, suiteId));
    await db.insert(schema.rubricItems).values({ ...values, suiteId, order: (row?.n ?? -1) + 1 });
  }
  revalidatePath(`/suites/${suiteId}`);
  return { ok: true };
}

export async function deleteRubricItem(suiteId: string, itemId: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!(await ownSuite(user.id, suiteId))) return { error: "Suite not found." };
  await db
    .delete(schema.rubricItems)
    .where(and(eq(schema.rubricItems.id, itemId), eq(schema.rubricItems.suiteId, suiteId)));
  revalidatePath(`/suites/${suiteId}`);
  return {};
}

export async function deletePersona(suiteId: string, personaId: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!(await ownSuite(user.id, suiteId))) return { error: "Suite not found." };
  await db
    .delete(schema.personas)
    .where(and(eq(schema.personas.id, personaId), eq(schema.personas.suiteId, suiteId)));
  revalidatePath(`/suites/${suiteId}`);
  return {};
}
