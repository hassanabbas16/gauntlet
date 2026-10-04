"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DotMatrix } from "@/components/dot-matrix";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  agents: { id: string; name: string; model: string }[];
  suites: { id: string; name: string; personaCount: number }[];
  defaultAgentId?: string;
  defaultSuiteId?: string;
  limit: { allowed: boolean; message?: string; remaining: number | null };
};

export function NewRunForm({ agents, suites, defaultAgentId, defaultSuiteId, limit }: Props) {
  const router = useRouter();
  const [agentId, setAgentId] = useState(defaultAgentId ?? "");
  const [suiteId, setSuiteId] = useState(defaultSuiteId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suite = suites.find((s) => s.id === suiteId);
  const noPersonas = suite !== undefined && suite.personaCount === 0;

  if (agents.length === 0 || suites.length === 0) {
    return (
      <div className="border border-dashed p-6 text-sm text-muted-foreground">
        You need at least one{" "}
        {agents.length === 0 ? (
          <Link href="/agents" className="text-brand underline-offset-4 hover:underline">
            agent
          </Link>
        ) : (
          "agent"
        )}{" "}
        and one{" "}
        {suites.length === 0 ? (
          <Link href="/suites" className="text-brand underline-offset-4 hover:underline">
            suite
          </Link>
        ) : (
          "suite"
        )}{" "}
        to start a run.
      </div>
    );
  }

  async function start() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, suiteId }),
      });
      const data = (await res.json().catch(() => ({}))) as { runId?: string; error?: string };
      if (!res.ok || !data.runId) throw new Error(data.error ?? `Request failed (${res.status})`);
      router.push(`/runs/${data.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the run.");
      setPending(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-5 border border-l-2 border-l-brand bg-card p-5">
      <Field label="Agent under test">
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick an agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} <span className="hidden font-mono text-xs text-muted-foreground sm:inline">· {a.model}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Suite"
        hint={suite ? `${suite.personaCount} callers will phone the agent.` : undefined}
      >
        <Select value={suiteId} onValueChange={setSuiteId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick a suite" />
          </SelectTrigger>
          <SelectContent>
            {suites.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} <span className="hidden font-mono text-xs text-muted-foreground sm:inline">· {s.personaCount} personas</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {!limit.allowed && (
        <p className="border-l-2 border-l-warn bg-warn/10 px-3 py-2 text-sm">{limit.message}</p>
      )}
      {noPersonas && (
        <p className="border-l-2 border-l-warn bg-warn/10 px-3 py-2 text-sm">
          This suite has no personas yet.{" "}
          <Link href={`/suites/${suiteId}`} className="text-brand underline-offset-4 hover:underline">
            Generate some
          </Link>{" "}
          first.
        </p>
      )}
      {error && <p className="border-l-2 border-l-fail bg-fail/10 px-3 py-2 text-sm text-fail">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={start} disabled={pending || !limit.allowed || noPersonas || !agentId || !suiteId}>
          {pending ? <DotMatrix className="size-3" label="Starting" /> : <Play />}
          {pending ? "Starting…" : "Run Gauntlet"}
        </Button>
        {limit.remaining !== null && limit.allowed && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {limit.remaining} demo run{limit.remaining === 1 ? "" : "s"} left today
          </span>
        )}
      </div>
    </div>
  );
}
