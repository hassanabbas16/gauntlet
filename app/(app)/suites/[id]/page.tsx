import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Play } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PersonaCard } from "@/components/persona-card";
import { Section } from "@/components/section";
import { SEVERITY_TONE, Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";
import { getPersonas, getRubric, getSuite } from "@/lib/data";
import { CODE_CHECKS } from "@/lib/judge/codeChecks";
import { requireUser } from "@/lib/session";
import { deletePersona, deleteRubricItem, deleteSuite, saveRubricItem, updateScenario } from "../actions";
import { GeneratePersonas } from "./generate-personas";
import { RubricDialog } from "./rubric-dialog";
import { ScenarioForm } from "./scenario-form";

export const metadata: Metadata = { title: "Suite" };

const codeCheckOptions = Object.entries(CODE_CHECKS).map(([name, c]) => ({ name, label: c.label }));

export default async function SuitePage({ params }: PageProps<"/suites/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const suite = await getSuite(user.id, id);
  if (!suite) notFound();
  const [rubric, personas] = await Promise.all([getRubric(suite.id), getPersonas(suite.id)]);

  return (
    <>
      <PageHeader
        eyebrow="suite"
        title={suite.name}
        description={`${personas.length} personas · ${rubric.length} rubric items`}
      >
        <Button asChild>
          <Link href={`/runs/new?suiteId=${suite.id}`}>
            <Play /> Run Gauntlet
          </Link>
        </Button>
        <ConfirmDelete
          title="Delete this suite?"
          description="This deletes its rubric, personas and every run that used it. This can't be undone."
          action={deleteSuite.bind(null, suite.id)}
        />
      </PageHeader>

      <Section
        label="callers"
        title="Personas"
        description="Synthetic callers generated from the scenario. Each run calls the agent once per persona."
        actions={<GeneratePersonas suiteId={suite.id} />}
      >
        {personas.length === 0 ? (
          <EmptyState title="No personas yet.">
            Generate a mix of callers: happy path, hostile, mumbler, adversarial and confused.
          </EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {personas.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                action={
                  <ConfirmDelete
                    title={`Delete ${p.name}?`}
                    description="Past runs keep their results; future runs won't include this caller."
                    action={deletePersona.bind(null, suite.id, p.id)}
                  />
                }
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        label="rubric"
        title="Rubric"
        description="Yes/no checks scored on every call. Any failed critical item fails the call; otherwise it passes at a weighted score of 80%."
        actions={<RubricDialog codeChecks={codeCheckOptions} action={saveRubricItem.bind(null, suite.id, null)} />}
      >
        {rubric.length === 0 ? (
          <EmptyState title="No rubric items." />
        ) : (
          <div className="divide-y border">
            {rubric.map((item) => {
              const archetypes = Array.isArray(item.config?.archetypes) ? item.config.archetypes.join(", ") : "";
              return (
                <div key={item.id} className="flex items-start gap-3 p-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px]">{item.key}</span>
                      <Tag tone={SEVERITY_TONE[item.severity]}>{item.severity}</Tag>
                      <Tag tone={item.kind === "llm" ? "heard" : "neutral"}>
                        {item.kind === "llm" ? "llm judge" : `code · ${item.codeCheck}`}
                      </Tag>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.question}</p>
                  </div>
                  <div className="flex shrink-0">
                    <RubricDialog
                      codeChecks={codeCheckOptions}
                      item={{
                        key: item.key,
                        question: item.question,
                        severity: item.severity,
                        kind: item.kind,
                        codeCheck: item.codeCheck,
                        archetypes,
                      }}
                      action={saveRubricItem.bind(null, suite.id, item.id)}
                    />
                    <ConfirmDelete
                      title={`Delete "${item.key}"?`}
                      description="Past runs keep their scores for this item."
                      action={deleteRubricItem.bind(null, suite.id, item.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section label="scenario" title="Scenario">
        <ScenarioForm
          name={suite.name}
          scenario={suite.scenario}
          action={updateScenario.bind(null, suite.id)}
        />
      </Section>
    </>
  );
}
