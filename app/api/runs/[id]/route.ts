import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRunStatus } from "@/lib/runs";

export async function GET(_req: Request, ctx: RouteContext<"/api/runs/[id]">) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await ctx.params;
  const status = await getRunStatus(user.id, id);
  if (!status) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
