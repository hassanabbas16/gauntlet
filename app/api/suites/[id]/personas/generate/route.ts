import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { getSuite } from "@/lib/data";
import { db, schema } from "@/lib/db";
import { personaLimitStatus } from "@/lib/limits";
import { LlmError } from "@/lib/llm/client";
import { generatePersonas } from "@/lib/sim/personas";

export const maxDuration = 120;

const bodySchema = z.object({
  count: z.coerce.number().int().min(1).max(10),
  mix: z.string().max(500).optional(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/suites/[id]/personas/generate">) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await ctx.params;
  const suite = await getSuite(user.id, id);
  if (!suite) return NextResponse.json({ error: "Suite not found." }, { status: 404 });

  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "count must be between 1 and 10." }, { status: 400 });
  const count = Math.min(body.data.count, config.limits.maxPersonasPerRun);

  const limit = await personaLimitStatus(user, count);
  if (!limit.allowed) return NextResponse.json({ error: limit.message }, { status: 429 });

  try {
    const personas = await generatePersonas({ scenario: suite.scenario, count, mix: body.data.mix });
    const rows = await db
      .insert(schema.personas)
      .values(personas.map((p) => ({ suiteId: suite.id, name: p.name, data: p, noiseLevel: p.noiseLevel })))
      .returning();
    return NextResponse.json({ personas: rows });
  } catch (err) {
    console.error("[personas] generation failed", err);
    const message =
      err instanceof LlmError
        ? `The model couldn't generate personas right now (${err.message}). Try again in a minute.`
        : "Persona generation failed. Try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
