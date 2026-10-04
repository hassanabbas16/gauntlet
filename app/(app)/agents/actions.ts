"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { config } from "@/lib/config";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/session";

export type FormState = { error?: string; ok?: boolean };

const agentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).default(""),
  model: z.string().trim().min(1, "Pick a model").max(100),
  temperature: z.coerce.number().min(0).max(1.5),
  systemPrompt: z.string().trim().min(20, "System prompt is too short").max(20_000),
});

function readAgentForm(formData: FormData) {
  return agentSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    model: formData.get("model"),
    temperature: formData.get("temperature") ?? 0.3,
    systemPrompt: formData.get("systemPrompt"),
  });
}

const STARTER_PROMPT = `You are a friendly phone receptionist for <business>.

What you can do:
- ...

Rules:
- Keep replies short: one to three sentences.
- Transfer to a human for anything you can't handle.`;

export async function createAgent(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = z.string().trim().min(1).max(120).safeParse(formData.get("name"));
  if (!name.success) return { error: "Give the agent a name." };

  const [row] = await db
    .insert(schema.agents)
    .values({
      userId: user.id,
      name: name.data,
      description: "",
      systemPrompt: STARTER_PROMPT,
      model: config.models.agentDefault,
      temperature: 0.3,
    })
    .returning({ id: schema.agents.id });
  revalidatePath("/agents");
  redirect(`/agents/${row.id}`);
}

export async function updateAgent(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = readAgentForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const updated = await db
    .update(schema.agents)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(schema.agents.id, id), eq(schema.agents.userId, user.id)))
    .returning({ id: schema.agents.id });
  if (updated.length === 0) return { error: "Agent not found." };

  revalidatePath("/agents");
  revalidatePath(`/agents/${id}`);
  return { ok: true };
}

export async function deleteAgent(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  await db.delete(schema.agents).where(and(eq(schema.agents.id, id), eq(schema.agents.userId, user.id)));
  revalidatePath("/agents");
  redirect("/agents");
}
