import type { Metadata } from "next";
import Link from "next/link";
import { CreateDialog } from "@/components/create-dialog";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { listAgents } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { formatRelative } from "@/lib/format";
import { createAgent } from "./actions";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsPage() {
  const user = await requireUser();
  const agents = await listAgents(user.id);

  return (
    <>
      <PageHeader eyebrow="agents" title="Agents" description="The voice agents you put through the gauntlet.">
        <NewAgent />
      </PageHeader>
      {agents.length === 0 ? (
        <EmptyState title="No agents yet.">Create an agent by pasting its system prompt.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {agents.map((a) => (
            <Link
              key={a.id}
              href={`/agents/${a.id}`}
              className="group flex flex-col gap-3 border bg-card p-4 transition-colors hover:border-brand/50"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-medium group-hover:text-brand">{a.name}</h2>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {formatRelative(a.updatedAt)}
                </span>
              </div>
              {a.description && <p className="line-clamp-2 text-sm text-muted-foreground">{a.description}</p>}
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
                <span>
                  model <span className="text-foreground">{a.model}</span>
                </span>
                <span>
                  temp <span className="text-foreground">{a.temperature.toFixed(1)}</span>
                </span>
                <span>
                  prompt <span className="text-foreground">{a.systemPrompt.split(/\s+/).length} words</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function NewAgent() {
  return (
    <CreateDialog
      label="New agent"
      title="New agent"
      description="You'll paste the system prompt and pick a model on the next screen."
      action={createAgent}
    >
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" placeholder="e.g. Clinic receptionist" required autoFocus />
      </Field>
    </CreateDialog>
  );
}
