import type { Metadata } from "next";
import Link from "next/link";
import { Play } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { PassBar, StatusTag } from "@/components/status";
import { SEVERITY_TONE, Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";
import { dashboardStats } from "@/lib/data";
import { formatPercent, formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { RunsChart, type ChartRun } from "./runs-chart";

export const metadata: Metadata = { title: "Dashboard" };

function shortDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const user = await requireUser();
  const stats = await dashboardStats(user.id);

  const chartRuns: ChartRun[] = stats.runs
    .filter((r) => r.passRate !== null)
    .slice(0, 12)
    .reverse()
    .map((r) => ({
      id: r.id,
      agentId: r.agentId,
      agentName: r.agentName,
      label: `${r.agentName.match(/\((v\d+)\)/)?.[1] ?? r.agentName.slice(0, 10)} · ${shortDate(r.createdAt)}`,
      passRate: r.passRate ?? 0,
      passed: r.passed,
      completed: r.completed,
    }));

  return (
    <>
      <PageHeader eyebrow="dashboard" title="Dashboard" description="How your agents are holding up.">
        <Button asChild>
          <Link href="/runs/new">
            <Play /> New run
          </Link>
        </Button>
      </PageHeader>

      {stats.totalRuns === 0 ? (
        <EmptyState title="No runs yet.">
          Create an agent and a suite, then run the gauntlet to see pass rates here.
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Runs" value={String(stats.totalRuns)} />
            <StatTile label="Overall pass rate" value={formatPercent(stats.passRate)} accent />
            <StatTile label="Calls simulated" value={String(stats.conversations)} />
            <div className="col-span-2 flex flex-col justify-between gap-2 border bg-card p-4 lg:col-span-1">
              <span className="label-mono">Most-failed check</span>
              {stats.mostFailed ? (
                <div className="flex flex-col gap-1.5">
                  <span className="truncate font-mono text-lg">{stats.mostFailed.key}</span>
                  <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    <Tag tone={SEVERITY_TONE[stats.mostFailed.severity]}>{stats.mostFailed.severity}</Tag>
                    failed {stats.mostFailed.count}×
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Nothing has failed yet.</span>
              )}
            </div>
          </div>

          <Section
            label="trend"
            title="Pass rate per run"
            description="Rerun the gauntlet after every prompt change. The bar should go up."
            className="border bg-card p-4 md:p-5"
          >
            {chartRuns.length ? (
              <RunsChart runs={chartRuns} agentOrder={stats.agentOrder} />
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for the first completed run.</p>
            )}
          </Section>

          <Section
            label="recent"
            title="Recent runs"
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href="/runs">All runs</Link>
              </Button>
            }
          >
            <ul className="flex flex-col divide-y border bg-card">
              {stats.runs.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/runs/${r.id}`}
                    className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_4rem_6rem]"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium group-hover:text-brand">{r.agentName}</div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                        {r.suiteName} · {formatRelative(r.createdAt)}
                      </div>
                    </div>
                    <PassBar rate={r.passRate} className="hidden sm:block" />
                    <span className="text-right font-mono text-sm">{formatPercent(r.passRate)}</span>
                    <span className="hidden justify-self-end sm:block">
                      <StatusTag status={r.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col justify-between gap-3 border bg-card p-4 ${accent ? "border-l-2 border-l-brand" : ""}`}>
      <span className="label-mono">{label}</span>
      <span className={`font-dot text-4xl leading-none font-black ${accent ? "text-brand" : ""}`}>{value}</span>
    </div>
  );
}
