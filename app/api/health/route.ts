import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database connectivity. No auth, no data. */
export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: "up", ms: Date.now() - started });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
