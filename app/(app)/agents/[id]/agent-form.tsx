"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "../actions";

type Agent = {
  name: string;
  description: string;
  model: string;
  temperature: number;
  systemPrompt: string;
};

export function AgentForm({
  agent,
  models,
  action,
}: {
  agent: Agent;
  models: string[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, {});
  const [model, setModel] = useState(agent.model);
  const [temperature, setTemperature] = useState(agent.temperature);
  const options = models.includes(agent.model) ? models : [agent.model, ...models];

  useEffect(() => {
    if (state.ok) toast.success("Agent saved");
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-2">
        <Field
          label="System prompt"
          htmlFor="systemPrompt"
          hint="Exactly what your production agent gets. Gauntlet appends a short note about speech-to-text and the [TRANSFER] / [END_CALL] tokens."
        >
          <Textarea
            id="systemPrompt"
            name="systemPrompt"
            defaultValue={agent.systemPrompt}
            className="min-h-[420px] font-mono text-[13px] leading-relaxed"
            spellCheck={false}
            required
          />
        </Field>
      </div>

      <div className="flex flex-col gap-5 lg:border-l lg:pl-6">
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" defaultValue={agent.name} required />
        </Field>
        <Field label="Description" htmlFor="description">
          <Textarea id="description" name="description" defaultValue={agent.description} rows={3} />
        </Field>
        <Field label="Model" hint="Open-weight models served through the configured provider.">
          <input type="hidden" name="model" value={model} />
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-full font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((m) => (
                <SelectItem key={m} value={m} className="font-mono">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={`Temperature · ${temperature.toFixed(2)}`}>
          <input type="hidden" name="temperature" value={temperature} />
          <Slider
            min={0}
            max={1.5}
            step={0.05}
            value={[temperature]}
            onValueChange={(v) => setTemperature(v[0] ?? 0)}
          />
        </Field>
        <SubmitButton pendingLabel="Saving" className="self-start">
          Save agent
        </SubmitButton>
      </div>
    </form>
  );
}
