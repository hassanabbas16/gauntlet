import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

declare module "next-auth" {
  interface Session {
    user: { id: string; isDemo: boolean } & DefaultSession["user"];
  }
  interface User {
    isDemo?: boolean;
  }
}

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        // Imported lazily so the proxy (which only reads the JWT) doesn't pull in the DB driver.
        const [{ db, schema }, { eq }, bcrypt] = await Promise.all([
          import("@/lib/db"),
          import("drizzle-orm"),
          import("bcryptjs"),
        ]);

        const email = parsed.data.email.toLowerCase();
        const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
        if (!user) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name, isDemo: user.isDemo };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.isDemo = user.isDemo ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.isDemo = token.isDemo === true;
      return session;
    },
  },
});

/** For server components / route handlers: returns the session user or null. */
export async function getSessionUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}
