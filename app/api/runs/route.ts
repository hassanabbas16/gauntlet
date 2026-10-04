import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { runLimitStatus } from "@/lib/limits";
import { createRun, RunError } from "@/lib/runs";

const bodySchema = z.object({ agentId: z.uuid(), suiteId: z.uuid() });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Pick an agent and a suite." }, { status: 400 });

  const limit = await runLimitStatus(user);
  if (!limit.allowed) return NextResponse.json({ error: limit.message }, { status: 429 });

  try {
    const result = await createRun(user.id, body.data.agentId, body.data.suiteId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof RunError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[runs] create failed", err);
    return NextResponse.json({ error: "Couldn't create the run." }, { status: 500 });
  }
}
