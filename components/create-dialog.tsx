"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type State = { error?: string; ok?: boolean };

/** "New X" button + dialog wrapping a server-action form. Fields are passed as children. */
export function CreateDialog({
  label,
  title,
  description,
  action,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  action: (prev: State, formData: FormData) => Promise<State>;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {children}
          {state.error && <p className="text-sm text-fail">{state.error}</p>}
          <DialogFooter>
            <SubmitButton pendingLabel="Creating">Create</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
