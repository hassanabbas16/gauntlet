import type { Metadata } from "next";
import Link from "next/link";
import { Play } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PassBar, StatusTag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listRuns } from "@/lib/data";
import { formatPercent, formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Runs" };

export default async function RunsPage() {
  const user = await requireUser();
  const runs = await listRuns(user.id);

  return (
    <>
      <PageHeader eyebrow="runs" title="Runs" description="Every time an agent ran the gauntlet.">
        <Button asChild>
          <Link href="/runs/new">
            <Play /> New run
          </Link>
        </Button>
      </PageHeader>
      {runs.length === 0 ? (
        <EmptyState title="No runs yet.">Pick an agent and a suite to start your first run.</EmptyState>
      ) : (
        <div className="border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="label-mono">Agent</TableHead>
                <TableHead className="label-mono">Suite</TableHead>
                <TableHead className="label-mono">Status</TableHead>
                <TableHead className="label-mono w-48">Pass rate</TableHead>
                <TableHead className="label-mono text-right">Calls</TableHead>
                <TableHead className="label-mono text-right">Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id} className="group">
                  <TableCell className="max-w-72">
                    <Link href={`/runs/${r.id}`} className="block truncate font-medium group-hover:text-brand">
                      {r.agentName}
                    </Link>
                    <span className="font-mono text-[11px] text-muted-foreground">{r.model}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.suiteName}</TableCell>
                  <TableCell>
                    <StatusTag status={r.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <PassBar rate={r.passRate} className="w-24" />
                      <span className="font-mono text-xs">{formatPercent(r.passRate)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {r.passed}/{r.total}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {formatRelative(r.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
