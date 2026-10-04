"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DotMatrix } from "@/components/dot-matrix";
import { PageHeader } from "@/components/page-header";
import { endReasonLabel, PassBar, StatusTag, VerdictTag } from "@/components/status";
import { NoiseMeter, SEVERITY_TONE, Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatPercent } from "@/lib/format";
import type { RunStatus } from "@/lib/runs";
import { cn } from "@/lib/utils";

const CONCURRENCY = 3;
const POLL_MS = 2000;

type Status = NonNullable<RunStatus>;

export function RunResults({ initial }: { initial: Status }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [requestError, setRequestError] = useState<string | null>(null);
  const started = useRef(false);
  const runId = initial.run.id;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
      if (res.ok) setData((await res.json()) as Status);
    } catch {
      // transient; the next poll will catch up
    }
  }, [runId]);

  const execute = useCallback(
    async (conversationId: string) => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/execute`, { method: "POST" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setRequestError(body.error ?? `A call failed to start (${res.status}).`);
        }
      } catch {
        setRequestError("Lost connection while a call was running. Its result will appear when it finishes.");
      }
      await refresh();
    },
    [refresh],
  );

  // Drive execution from the browser: one request per conversation, CONCURRENCY at a time.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const queue = initial.conversations.filter((c) => c.status === "pending").map((c) => c.id);
    if (queue.length === 0) return;
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) await execute(id);
    };
    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  }, [initial.conversations, execute]);

  // Poll while anything is still open, so turn counts tick up live.
  const open = data.conversations.some((c) => c.status === "pending" || c.status === "running");
  useEffect(() => {
    if (!open) return;
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [open, refresh]);

  const { run, aggregates: agg } = data;
  const done = agg.completed + agg.errored;
  const maxFailures = Math.max(1, ...agg.failuresByItem.map((f) => f.count));

  return (
    <>
      <PageHeader
        eyebrow={`run · ${formatDateTime(run.createdAt)}`}
        title={run.agentName}
        description={`${run.suiteName} · ${run.model}`}
      >
        <StatusTag status={run.status} />
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col justify-between gap-4 border border-l-2 border-l-brand bg-card p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="label-mono">Pass rate</div>
              <div className="font-dot text-6xl leading-none font-black text-brand">
                {formatPercent(agg.passRate)}
              </div>
            </div>
            <div className="text-right font-mono text-xs leading-6">
              <div>
                <span className="text-pass">{agg.passed}</span> passed
              </div>
              <div>
                <span className="text-fail">{agg.failed}</span> failed
              </div>
              {agg.errored > 0 && (
                <div>
                  <span className="text-warn">{agg.errored}</span> errored
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <PassBar rate={agg.passRate} />
            <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>
                {done}/{agg.total} calls finished
              </span>
              {open && (
                <span className="flex items-center gap-1.5 text-brand">
                  <DotMatrix className="size-3" label="Running" /> live
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border bg-card p-5">
          <div className="label-mono">Failures by rubric item</div>
          {agg.failuresByItem.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {agg.completed === 0 ? "Waiting for the first results…" : "No rubric failures so far."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {agg.failuresByItem.map((f) => (
                <li key={f.key} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
                  <span className="truncate font-mono text-xs">{f.key}</span>
                  <div className="h-2 bg-muted">
                    <div
                      className={cn("h-full", f.severity === "critical" ? "bg-fail" : f.severity === "major" ? "bg-warn" : "bg-muted-foreground")}
                      style={{ width: `${(f.count / maxFailures) * 100}%` }}
                    />
                  </div>
                  <span className="flex items-center gap-2 font-mono text-xs">
                    {f.count}
                    <Tag tone={SEVERITY_TONE[f.severity]} className="hidden sm:inline-flex">
                      {f.severity}
                    </Tag>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {requestError && (
        <p className="border-l-2 border-l-warn bg-warn/10 px-3 py-2 text-sm">{requestError}</p>
      )}

      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="label-mono">Caller</TableHead>
              <TableHead className="label-mono">Noise</TableHead>
              <TableHead className="label-mono">Status</TableHead>
              <TableHead className="label-mono">Ended</TableHead>
              <TableHead className="label-mono text-right">Turns</TableHead>
              <TableHead className="label-mono">Verdict</TableHead>
              <TableHead className="label-mono text-right">Score</TableHead>
              <TableHead className="label-mono min-w-72">Judge summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.conversations.map((c) => {
              const href = `/runs/${run.id}/c/${c.id}`;
              const clickable = c.status === "completed" || c.turns > 0;
              return (
                <TableRow
                  key={c.id}
                  onClick={() => clickable && router.push(href)}
                  className={cn("group", clickable && "cursor-pointer", c.status === "running" && "bg-brand-wash/40")}
                >
                  <TableCell>
                    <Link href={href} className="font-medium group-hover:text-brand" onClick={(e) => e.stopPropagation()}>
                      {c.personaName}
                    </Link>
                    <div className="font-mono text-[11px] text-muted-foreground">{c.archetype}</div>
                  </TableCell>
                  <TableCell>
                    <NoiseMeter level={c.noiseLevel} />
                  </TableCell>
                  <TableCell>
                    <StatusTag status={c.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{endReasonLabel(c.endReason)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{c.turns || "—"}</TableCell>
                  <TableCell>
                    <VerdictTag verdict={c.verdict} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {c.score === null ? "—" : c.score.toFixed(2)}
                  </TableCell>
                  <TableCell className="max-w-md text-[13px] whitespace-normal">
                    {c.status === "failed" ? (
                      <div className="flex items-start gap-2">
                        <span className="text-fail">{c.error ?? "This call failed."}</span>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            void execute(c.id);
                            setData((d) => ({
                              ...d,
                              conversations: d.conversations.map((x) =>
                                x.id === c.id ? { ...x, status: "running", error: null } : x,
                              ),
                            }));
                          }}
                        >
                          <RotateCcw /> Retry
                        </Button>
                      </div>
                    ) : c.status === "completed" ? (
                      <span className="text-muted-foreground">{c.summary}</span>
                    ) : c.status === "running" ? (
                      <span className="text-brand">Simulating the call…</span>
                    ) : (
                      <span className="text-muted-foreground">Queued</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
