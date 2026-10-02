import "./env";
import bcrypt from "bcryptjs";
import { closeDb, db, schema } from "@/lib/db";

async function seedDemoUser() {
  const email = (process.env.DEMO_EMAIL ?? "demo@gauntlet.ai").toLowerCase();
  const password = process.env.DEMO_PASSWORD ?? "demo1234";
  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash, name: "Demo User", isDemo: true })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { passwordHash, isDemo: true },
    })
    .returning();

  console.log(`demo user ready: ${user.email} (${user.id})`);
  return user;
}

async function main() {
  await seedDemoUser();
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
