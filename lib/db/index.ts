import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

// Supabase's transaction pooler (port 6543) doesn't support prepared statements.
// Reuse the client across dev hot reloads so we don't leak connections.
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };
const client =
  globalForDb.pgClient ?? postgres(url, { prepare: false, max: process.env.VERCEL ? 1 : 5 });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export { schema };

/** For scripts: close the pool so the process can exit. */
export async function closeDb() {
  await client.end();
}
