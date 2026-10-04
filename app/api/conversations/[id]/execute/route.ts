import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { executeConversation, RunError } from "@/lib/runs";

// One request simulates + judges exactly one conversation. Most finish in 15-40s; the extra
// headroom covers rate-limit backoff. Vercel Hobby with Fluid compute allows up to 300s.
export const maxDuration = 300;

export async function POST(_req: Request, ctx: RouteContext<"/api/conversations/[id]/execute">) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const result = await executeConversation(user.id, id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RunError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[execute] unexpected", err);
    return NextResponse.json({ error: "Execution failed unexpectedly." }, { status: 500 });
  }
}
