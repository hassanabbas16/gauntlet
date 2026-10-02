import { DotMatrix } from "@/components/dot-matrix";

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="bg-dots flex flex-1 flex-col items-center justify-center gap-3 border border-dashed p-12 text-center">
      <DotMatrix live={false} className="size-6 text-muted-foreground" label={title} />
      <p className="font-mono text-sm">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
