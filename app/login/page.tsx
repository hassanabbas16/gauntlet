import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { callbackUrl } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Link href="/" className="mb-2 font-mono text-sm font-semibold tracking-tight">
            gauntlet
          </Link>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use the demo account to explore seeded results.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm
            callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined}
            demoEmail={process.env.DEMO_EMAIL ?? "demo@gauntlet.ai"}
            demoPassword={process.env.DEMO_PASSWORD ?? "demo1234"}
          />
        </CardContent>
      </Card>
    </main>
  );
}
