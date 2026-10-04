import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { endReasonLabel, StatusTag, VerdictTag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { parsePersona } from "@/lib/data";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ConversationView } from "./conversation-view";

export const metadata: Metadata = { title: "Conversation" };

const SEVERITY_ORDER = { critical: 0, major: 1, minor: 2 } as const;

export default async function ConversationPage({ params }: PageProps<"/runs/[id]/c/[cid]">) {
  const { id, cid } = await params;
  const user = await requireUser();
  const { conversations, runs, personas, turns, scores, rubricItems } = schema;

  const [row] = await db
    .select({ conv: conversations, run: runs, persona: personas })
    .from(conversations)
    .innerJoin(runs, eq(conversations.runId, runs.id))
    .innerJoin(personas, eq(conversations.personaId, personas.id))
    .where(and(eq(conversations.id, cid), eq(runs.id, id), eq(runs.userId, user.id)));
  if (!row) notFound();
  const { conv, run } = row;

  const [turnRows, scoreRows] = await Promise.all([
    db.select().from(turns).where(eq(turns.conversationId, conv.id)).orderBy(asc(turns.index)),
    db
      .select({ score: scores, item: rubricItems })
      .from(scores)
      .innerJoin(rubricItems, eq(scores.rubricItemId, rubricItems.id))
      .where(eq(scores.conversationId, conv.id)),
  ]);

  const persona = parsePersona(row.persona.data, row.persona.noiseLevel);
  const results = scoreRows
    .map(({ score, item }) => ({
      key: item.key,
      question: item.question,
      severity: item.severity,
      source: score.source,
      passed: score.passed,
      evidence: score.evidence,
      turnIndex: score.turnIndex,
    }))
    // Failures first, then by severity.
    .sort((a, b) => Number(a.passed) - Number(b.passed) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const tone = conv.verdict === "pass" ? "border-l-pass" : conv.verdict === "fail" ? "border-l-fail" : "border-l-warn";

  return (
    <>
      <PageHeader
        eyebrow={`${run.agentSnapshot.name} · ${persona.archetype}`}
        title={persona.name}
        description={`${turnRows.length} turns · ${endReasonLabel(conv.endReason)}`}
      >
        <Button asChild variant="outline">
          <Link href={`/runs/${run.id}`}>
            <ArrowLeft /> Back to run
          </Link>
        </Button>
      </PageHeader>

      <div className={cn("flex flex-col gap-3 border border-l-2 bg-card p-4 sm:flex-row sm:items-center", tone)}>
        <div className="flex shrink-0 items-center gap-4">
          {conv.status === "completed" ? <VerdictTag verdict={conv.verdict} /> : <StatusTag status={conv.status} />}
          {conv.score !== null && (
            <span className="font-dot text-3xl leading-none font-black">{Math.round(conv.score * 100)}</span>
          )}
        </div>
        <p className="text-sm">
          {conv.status === "failed" ? (
            <span className="text-fail">{conv.error}</span>
          ) : conv.summary ? (
            conv.summary
          ) : (
            <span className="text-muted-foreground">This call is still running. Refresh to see new turns.</span>
          )}
        </p>
      </div>

      <ConversationView
        turns={turnRows.map((t) => ({ index: t.index, role: t.role, rawText: t.rawText, heardText: t.heardText }))}
        persona={persona}
        results={results}
      />
    </>
  );
}
