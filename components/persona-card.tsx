import { NoiseMeter, Tag } from "@/components/tag";
import type { Persona } from "@/lib/sim/personas";
import { cn } from "@/lib/utils";

export function PersonaCard({
  persona,
  action,
  compact = false,
  className,
}: {
  persona: Persona;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 border bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">{persona.name}</div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {persona.age} · {persona.mood}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tag tone="brand">{persona.archetype}</Tag>
          {action}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{persona.goal}</p>
      {!compact && (
        <ul className="flex flex-col gap-1 text-[13px]">
          {persona.behaviors.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-brand" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <span className="font-mono text-[11px] text-muted-foreground">
          speech: <span className="text-foreground">{persona.speechStyle}</span>
        </span>
        <NoiseMeter level={persona.noiseLevel} />
      </div>
      {!compact && Object.keys(persona.hiddenInfo).length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[11px]">
          {Object.entries(persona.hiddenInfo).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
