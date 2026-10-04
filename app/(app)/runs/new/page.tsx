import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { listAgents, listSuites } from "@/lib/data";
import { runLimitStatus } from "@/lib/limits";
import { requireUser } from "@/lib/session";
import { NewRunForm } from "./new-run-form";

export const metadata: Metadata = { title: "New run" };

export default async function NewRunPage({ searchParams }: PageProps<"/runs/new">) {
  const user = await requireUser();
  const { agentId, suiteId } = await searchParams;
  const [agents, suites, limit] = await Promise.all([
    listAgents(user.id),
    listSuites(user.id),
    runLimitStatus(user),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="new run"
        title="Run the gauntlet"
        description="Every persona in the suite calls the agent once. Calls run three at a time and fill in live."
      />
      <NewRunForm
        agents={agents.map((a) => ({ id: a.id, name: a.name, model: a.model }))}
        suites={suites.map((s) => ({ id: s.id, name: s.name, personaCount: s.personaCount }))}
        defaultAgentId={typeof agentId === "string" ? agentId : agents[0]?.id}
        defaultSuiteId={typeof suiteId === "string" ? suiteId : suites[0]?.id}
        limit={{
          allowed: limit.allowed,
          message: limit.message,
          remaining: Number.isFinite(limit.max) ? limit.max - limit.used : null,
        }}
      />
    </>
  );
}
