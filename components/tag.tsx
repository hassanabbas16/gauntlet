import { cn } from "@/lib/utils";

export type Tone = "neutral" | "brand" | "pass" | "fail" | "warn" | "said" | "heard";

const TONES: Record<Tone, string> = {
  neutral: "border-border text-muted-foreground",
  brand: "border-brand/40 bg-brand-wash text-brand",
  pass: "border-pass/40 bg-pass/10 text-pass",
  fail: "border-fail/40 bg-fail/10 text-fail",
  warn: "border-warn/40 bg-warn/10 text-warn",
  said: "border-said/40 bg-said/10 text-said",
  heard: "border-heard/40 bg-heard/10 text-heard",
};

/** Small square mono label: statuses, severities, verdicts. */
export function Tag({
  tone = "neutral",
  className,
  children,
  title,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 border px-1.5 font-mono text-[10px] tracking-wider whitespace-nowrap uppercase",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const SEVERITY_TONE: Record<string, Tone> = {
  critical: "fail",
  major: "warn",
  minor: "neutral",
};

/** Five dots showing STT noise intensity: lit dots scale with level. */
export function NoiseMeter({ level, className }: { level: number; className?: string }) {
  const lit = Math.round(Math.min(1, Math.max(0, level)) * 10);
  const tone = level >= 0.35 ? "bg-said" : level >= 0.15 ? "bg-warn" : "bg-heard";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 font-mono text-[11px]", className)}
      title={`STT noise ${level.toFixed(2)}`}
    >
      <span className="inline-flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn("size-1.5 rounded-full", i * 2 < lit ? tone : "bg-muted-foreground/25")}
          />
        ))}
      </span>
      <span className="text-muted-foreground">{level.toFixed(2)}</span>
    </span>
  );
}
