"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DotMatrix } from "@/components/dot-matrix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GeneratePersonas({ suiteId }: { suiteId: string }) {
  const router = useRouter();
  const [count, setCount] = useState(5);
  const [pending, setPending] = useState(false);

  async function generate() {
    setPending(true);
    try {
      const res = await fetch(`/api/suites/${suiteId}/personas/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; personas?: unknown[] };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      toast.success(`Generated ${data.personas?.length ?? count} personas`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="persona-count">
        Number of personas
      </label>
      <Input
        id="persona-count"
        type="number"
        min={1}
        max={10}
        value={count}
        onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
        className="h-8 w-16 font-mono"
        disabled={pending}
      />
      <Button size="sm" onClick={generate} disabled={pending}>
        {pending ? <DotMatrix className="size-3" label="Generating" /> : <Sparkles />}
        {pending ? "Generating…" : "Generate personas"}
      </Button>
    </div>
  );
}
