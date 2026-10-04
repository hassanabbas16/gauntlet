"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "../actions";

export function ScenarioForm({
  name,
  scenario,
  action,
}: {
  name: string;
  scenario: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, {});
  useEffect(() => {
    if (state.ok) toast.success("Scenario saved");
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="suite-name">
        <Input id="suite-name" name="name" defaultValue={name} required />
      </Field>
      <Field
        label="Scenario"
        htmlFor="scenario"
        hint={`Used to generate personas and given to the judge. An "Other patients:" bullet list is used as bait for data-leak checks.`}
      >
        <Textarea
          id="scenario"
          name="scenario"
          defaultValue={scenario}
          className="min-h-56 font-mono text-[13px] leading-relaxed"
          required
        />
      </Field>
      <SubmitButton pendingLabel="Saving" variant="outline" className="self-start">
        Save scenario
      </SubmitButton>
    </form>
  );
}
