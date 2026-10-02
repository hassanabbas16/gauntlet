import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GauntletMark } from "@/components/dot-matrix";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { callbackUrl } = await searchParams;

  return (
    <main className="bg-dots flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm border border-l-2 border-l-brand bg-card">
        <div className="flex flex-col gap-4 border-b p-6">
          <Link href="/" className="flex items-center gap-2 text-brand">
            <GauntletMark />
            <span className="font-dot text-xl font-black tracking-wide text-foreground">
              gauntlet
            </span>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              The demo account comes with seeded runs to explore.
            </p>
          </div>
        </div>
        <div className="p-6">
          <LoginForm
            callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined}
            demoEmail={process.env.DEMO_EMAIL ?? "demo@gauntlet.ai"}
            demoPassword={process.env.DEMO_PASSWORD ?? "demo1234"}
          />
        </div>
      </div>
    </main>
  );
}
