"use client";

import { Check, CornerDownRight, PhoneForwarded, PhoneOff, X } from "lucide-react";
import { useState } from "react";
import { PersonaCard } from "@/components/persona-card";
import { SEVERITY_TONE, Tag } from "@/components/tag";
import { changedWords, wordDiff, type DiffPart } from "@/lib/diff";
import type { Persona } from "@/lib/sim/personas";
import { hasEndCall, hasTransfer, stripControlTokens } from "@/lib/sim/tokens";
import { cn } from "@/lib/utils";

type Turn = { index: number; role: "caller" | "agent"; rawText: string; heardText: string | null };
type Result = {
  key: string;
  question: string;
  severity: "critical" | "major" | "minor";
  source: "llm" | "code";
  passed: boolean;
  evidence: string;
  turnIndex: number | null;
};

type Mode = "diff" | "heard" | "said";

const MODES: { value: Mode; label: string }[] = [
  { value: "diff", label: "said → heard" },
  { value: "heard", label: "agent heard" },
  { value: "said", label: "caller said" },
];

export function ConversationView({ turns, persona, results }: { turns: Turn[]; persona: Persona; results: Result[] }) {
  const [mode, setMode] = useState<Mode>("diff");
  const [highlight, setHighlight] = useState<number | null>(null);

  const flagged = new Map<number, Result[]>();
  for (const r of results) {
    if (!r.passed && r.turnIndex !== null) flagged.set(r.turnIndex, [...(flagged.get(r.turnIndex) ?? []), r]);
  }

  function jumpTo(index: number) {
    setHighlight(index);
    document.getElementById(`turn-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const failed = results.filter((r) => !r.passed).length;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="label-mono">Transcript</div>
          <div className="flex border" role="tablist" aria-label="Transcript view">
            {MODES.map((m) => (
              <button
                key={m.value}
                role="tab"
                aria-selected={mode === m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  "px-3 py-1.5 font-mono text-[11px] tracking-wide",
                  mode === m.value ? "bg-brand-wash text-brand" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {mode === "diff" && (
          <div className="flex flex-wrap gap-4 font-mono text-[11px] text-muted-foreground">
            <span>
              <span className="bg-fail/15 text-fail line-through decoration-fail/60">struck</span> said, not heard
            </span>
            <span>
              <span className="bg-pass/15 text-pass">green</span> heard, not said
            </span>
          </div>
        )}

        {turns.length === 0 ? (
          <p className="border border-dashed p-6 text-sm text-muted-foreground">No turns recorded yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {turns.map((t) => (
              <TurnBubble
                key={t.index}
                turn={t}
                mode={mode}
                highlighted={highlight === t.index}
                flags={flagged.get(t.index) ?? []}
              />
            ))}
          </ol>
        )}
      </section>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-4">
        <div className="flex flex-col gap-2">
          <div className="label-mono">
            Rubric · {results.length - failed}/{results.length} passed
          </div>
          {results.length === 0 ? (
            <p className="border border-dashed p-4 text-sm text-muted-foreground">Not judged yet.</p>
          ) : (
            <ul className="flex flex-col divide-y border bg-card">
              {results.map((r) => (
                <li key={r.key} className="flex flex-col gap-1.5 p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center",
                        r.passed ? "bg-pass/15 text-pass" : "bg-fail/15 text-fail",
                      )}
                    >
                      {r.passed ? <Check className="size-3" /> : <X className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px]" title={r.question}>
                      {r.key}
                    </span>
                    <Tag tone={SEVERITY_TONE[r.severity]}>{r.severity}</Tag>
                    <Tag tone={r.source === "llm" ? "heard" : "neutral"}>{r.source}</Tag>
                  </div>
                  <p className="text-[13px] text-muted-foreground">{r.evidence}</p>
                  {r.turnIndex !== null && (
                    <button
                      onClick={() => jumpTo(r.turnIndex!)}
                      className="flex items-center gap-1 self-start font-mono text-[11px] text-brand hover:underline"
                    >
                      <CornerDownRight className="size-3" /> jump to turn {r.turnIndex}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="label-mono">Caller</div>
          <PersonaCard persona={persona} />
        </div>
      </aside>
    </div>
  );
}

function TurnBubble({
  turn,
  mode,
  highlighted,
  flags,
}: {
  turn: Turn;
  mode: Mode;
  highlighted: boolean;
  flags: Result[];
}) {
  const isAgent = turn.role === "agent";
  const said = stripControlTokens(turn.rawText);
  const heard = stripControlTokens(turn.heardText ?? said);
  const diff = !isAgent ? wordDiff(said, heard) : [];
  const changes = !isAgent ? changedWords(diff) : 0;
  const transferred = isAgent && hasTransfer(turn.rawText);
  const hungUp = hasEndCall(turn.rawText);

  return (
    <li
      id={`turn-${turn.index}`}
      className={cn("flex scroll-mt-24 flex-col gap-1", isAgent ? "items-start" : "items-end")}
    >
      <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
        <span>
          {turn.index} · {isAgent ? "agent" : "caller"}
        </span>
        {!isAgent && changes > 0 && <span className="text-said">{changes} words misheard</span>}
        {flags.map((f) => (
          <Tag key={f.key} tone="fail">
            ✗ {f.key}
          </Tag>
        ))}
      </div>
      <div
        className={cn(
          "max-w-[min(85%,640px)] border px-3.5 py-2.5 text-sm leading-relaxed transition-shadow",
          isAgent ? "border-l-2 border-l-brand bg-card" : "border-r-2 border-r-said bg-secondary/40",
          highlighted && "ring-2 ring-warn ring-offset-2 ring-offset-background",
          flags.length > 0 && !highlighted && "border-fail/50",
        )}
      >
        {isAgent ? (
          said || <span className="text-muted-foreground italic">(no words)</span>
        ) : mode === "diff" ? (
          <DiffText parts={diff} />
        ) : mode === "heard" ? (
          heard
        ) : (
          said
        )}
        {!isAgent && mode === "heard" && changes > 0 && (
          <div className="mt-2 border-t pt-2 text-[12px] text-muted-foreground">
            <span className="font-mono text-[10px] tracking-wider uppercase">Caller said:</span> {said}
          </div>
        )}
      </div>
      {(transferred || hungUp) && (
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          {transferred ? <PhoneForwarded className="size-3" /> : <PhoneOff className="size-3" />}
          {transferred ? "transferred to a human" : `${isAgent ? "agent" : "caller"} hung up`}
        </div>
      )}
    </li>
  );
}

function DiffText({ parts }: { parts: DiffPart[] }) {
  return (
    <span>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && " "}
          {p.type === "same" ? (
            p.text
          ) : p.type === "removed" ? (
            <span className="bg-fail/15 text-fail line-through decoration-fail/60">{p.text}</span>
          ) : (
            <span className="bg-pass/15 text-pass">{p.text}</span>
          )}
        </span>
      ))}
    </span>
  );
}
