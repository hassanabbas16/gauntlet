import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Play } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { availableAgentModels } from "@/lib/config";
import { countRunsForAgent, getAgent } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { deleteAgent, updateAgent } from "../actions";
import { AgentForm } from "./agent-form";

export const metadata: Metadata = { title: "Agent" };

export default async function AgentPage({ params }: PageProps<"/agents/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const agent = await getAgent(user.id, id);
  if (!agent) notFound();
  const runCount = await countRunsForAgent(agent.id);

  return (
    <>
      <PageHeader
        eyebrow="agent"
        title={agent.name}
        description={`${runCount} run${runCount === 1 ? "" : "s"} · edits apply to future runs only; past runs keep a snapshot.`}
      >
        <Button asChild variant="outline">
          <Link href={`/runs/new?agentId=${agent.id}`}>
            <Play /> Run Gauntlet
          </Link>
        </Button>
        <ConfirmDelete
          title="Delete this agent?"
          description="This also deletes every run made with it. This can't be undone."
          action={deleteAgent.bind(null, agent.id)}
        />
      </PageHeader>
      <AgentForm
        agent={agent}
        models={availableAgentModels()}
        action={updateAgent.bind(null, agent.id)}
      />
    </>
  );
}
