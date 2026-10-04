"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-start gap-4 border border-l-2 border-l-fail bg-card p-6">
      <div>
        <div className="label-mono text-fail">error</div>
        <h1 className="text-lg font-semibold">This page couldn&apos;t load.</h1>
        <p className="text-sm text-muted-foreground">
          {error.message && !error.message.includes("Server Components")
            ? error.message
            : "Something went wrong talking to the server. It's usually temporary."}
        </p>
        {error.digest && <p className="mt-1 font-mono text-[11px] text-muted-foreground">ref {error.digest}</p>}
      </div>
      <Button variant="outline" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
