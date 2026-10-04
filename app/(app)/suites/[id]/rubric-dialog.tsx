"use client";

import { Pencil, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "../actions";

export type RubricItemInput = {
  key: string;
  question: string;
  severity: "critical" | "major" | "minor";
  kind: "llm" | "code";
  codeCheck: string | null;
  archetypes: string;
};

const EMPTY: RubricItemInput = {
  key: "",
  question: "",
  severity: "major",
  kind: "llm",
  codeCheck: null,
  archetypes: "",
};

export function RubricDialog({
  item,
  codeChecks,
  action,
}: {
  item?: RubricItemInput;
  codeChecks: { name: string; label: string }[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const initial = item ?? EMPTY;
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const res = await action(prev, formData);
    if (res.ok) {
      toast.success(item ? "Rubric item updated" : "Rubric item added");
      setOpen(false);
    }
    return res;
  }, {});
  const [severity, setSeverity] = useState(initial.severity);
  const [kind, setKind] = useState(initial.kind);
  const [codeCheck, setCodeCheck] = useState(initial.codeCheck ?? codeChecks[0]?.name ?? "");


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="icon-sm" aria-label="Edit rubric item">
            <Pencil />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus /> Add item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit rubric item" : "New rubric item"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="severity" value={severity} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="codeCheck" value={kind === "code" ? codeCheck : ""} />
          <Field label="Key" htmlFor="key" hint="A short slug, e.g. verify_identity.">
            <Input id="key" name="key" defaultValue={initial.key} className="font-mono" required />
          </Field>
          <Field label="Yes/no question" htmlFor="question">
            <Textarea id="question" name="question" defaultValue={initial.question} rows={3} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Severity">
              <Select value={severity} onValueChange={(v) => setSeverity(v as RubricItemInput["severity"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical (fails the call)</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Checked by">
              <Select value={kind} onValueChange={(v) => setKind(v as RubricItemInput["kind"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llm">LLM judge</SelectItem>
                  <SelectItem value="code">Code check</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {kind === "code" && (
            <Field label="Code check">
              <Select value={codeCheck} onValueChange={setCodeCheck}>
                <SelectTrigger className="w-full font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {codeChecks.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      <span className="font-mono">{c.name}</span>
                      <span className="text-muted-foreground"> · {c.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {kind === "code" && codeCheck === "escalated_when_required" && (
            <Field
              label="Archetypes that must be escalated"
              htmlFor="archetypes"
              hint="Comma-separated. A persona matches if its archetype contains any of these."
            >
              <Input id="archetypes" name="archetypes" defaultValue={initial.archetypes} placeholder="hostile, chest pain" />
            </Field>
          )}
          {state.error && <p className="text-sm text-fail">{state.error}</p>}
          <DialogFooter>
            <SubmitButton pendingLabel="Saving">{item ? "Save" : "Add item"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
