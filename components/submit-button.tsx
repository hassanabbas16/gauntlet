"use client";

import { useFormStatus } from "react-dom";
import { DotMatrix } from "@/components/dot-matrix";
import { Button } from "@/components/ui/button";

/** Submit button that shows a dot-matrix loader while its form's action is pending. */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? (
        <>
          <DotMatrix className="size-3" label={pendingLabel ?? "Saving"} />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
