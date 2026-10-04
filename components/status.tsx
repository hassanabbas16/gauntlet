import { DotMatrix } from "@/components/dot-matrix";
import { Tag, type Tone } from "@/components/tag";

type Status = "pending" | "running" | "completed" | "failed";

const STATUS: Record<Status, { tone: Tone; label: string }> = {
  pending: { tone: "neutral", label: "queued" },
  running: { tone: "brand", label: "running" },
  completed: { tone: "neutral", label: "done" },
  failed: { tone: "fail", label: "error" },
};

export function StatusTag({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <Tag tone={s.tone}>
      {status === "running" && <DotMatrix className="size-2.5" label="Running" />}
      {s.label}
    </Tag>
  );
}

export function VerdictTag({ verdict }: { verdict: "pass" | "fail" | null }) {
  if (!verdict) return <span className="font-mono text-xs text-muted-foreground">—</span>;
  return <Tag tone={verdict === "pass" ? "pass" : "fail"}>{verdict}</Tag>;
}

const END_REASON: Record<string, string> = {
  caller_ended: "caller hung up",
  agent_transferred: "transferred",
  max_turns: "turn limit",
  error: "error",
};

export function endReasonLabel(reason: string | null) {
  return reason ? (END_REASON[reason] ?? reason) : "—";
}

/** Thin horizontal bar: pass rate with a coloured fill. */
export function PassBar({ rate, className }: { rate: number | null; className?: string }) {
  const pct = rate === null ? 0 : Math.round(rate * 100);
  const color = rate === null ? "bg-muted" : rate >= 0.8 ? "bg-pass" : rate >= 0.5 ? "bg-warn" : "bg-fail";
  return (
    <div className={`h-1.5 w-full bg-muted ${className ?? ""}`}>
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
