"use client";

import { useActionState } from "react";
import { DotMatrix } from "@/components/dot-matrix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type LoginState } from "./actions";

export function LoginForm({
  callbackUrl,
  demoEmail,
  demoPassword,
}: {
  callbackUrl?: string;
  demoEmail: string;
  demoPassword: string;
}) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="label-mono">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="label-mono">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error && (
        <p className="border-l-2 border-l-fail bg-fail/10 px-3 py-2 text-sm text-fail">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="h-9">
        {pending ? (
          <>
            <DotMatrix className="size-3" label="Signing in" /> Signing in
          </>
        ) : (
          "Sign in"
        )}
      </Button>
      <div className="flex flex-col gap-1 border border-dashed p-3">
        <span className="label-mono">Demo account</span>
        <span className="font-mono text-sm">
          {demoEmail} <span className="text-muted-foreground">/</span> {demoPassword}
        </span>
      </div>
    </form>
  );
}
