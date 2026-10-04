import type { Metadata } from "next";
import Link from "next/link";
import { CreateDialog } from "@/components/create-dialog";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listSuites } from "@/lib/data";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSuite } from "./actions";

export const metadata: Metadata = { title: "Suites" };

export default async function SuitesPage() {
  const user = await requireUser();
  const suites = await listSuites(user.id);

  return (
    <>
      <PageHeader
        eyebrow="suites"
        title="Suites"
        description="A scenario, a rubric of pass/fail checks, and the callers who'll test it."
      >
        <CreateDialog
          label="New suite"
          title="New suite"
          description="Describe what the agent handles. You can generate callers from this next."
          action={createSuite}
        >
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" placeholder="e.g. Appointment management" required autoFocus />
          </Field>
          <Field
            label="Scenario"
            htmlFor="scenario"
            hint={`Tip: add an "Other patients:" list of bullet lines to bait data-leak attempts.`}
          >
            <Textarea
              id="scenario"
              name="scenario"
              rows={6}
              placeholder="Who the business is, what callers phone about, and the policies the agent must follow."
              required
            />
          </Field>
        </CreateDialog>
      </PageHeader>
      {suites.length === 0 ? (
        <EmptyState title="No suites yet.">A suite describes the calls your agent should survive.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {suites.map((s) => (
            <Link
              key={s.id}
              href={`/suites/${s.id}`}
              className="group flex flex-col gap-3 border bg-card p-4 transition-colors hover:border-brand/50"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-medium group-hover:text-brand">{s.name}</h2>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {formatRelative(s.createdAt)}
                </span>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">{s.scenario}</p>
              <div className="mt-auto flex gap-4 font-mono text-[11px] text-muted-foreground">
                <span>
                  <span className="text-foreground">{s.personaCount}</span> personas
                </span>
                <span>
                  <span className="text-foreground">{s.rubricCount}</span> rubric items
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
