import { cn } from "@/lib/utils";

// 5x5 "G" glyph, row by row. 1 = lit.
const MARK = ["01110", "10000", "10111", "10001", "01110"];

/** Gauntlet's mark: a dot-matrix G. Lit dots use currentColor, unlit dots are a faint ghost. */
export function GauntletMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 25 25" aria-hidden className={cn("size-5 shrink-0", className)}>
      {MARK.flatMap((row, y) =>
        [...row].map((cell, x) => (
          <circle
            key={`${x}-${y}`}
            cx={x * 5 + 2.5}
            cy={y * 5 + 2.5}
            r={1.9}
            fill="currentColor"
            opacity={cell === "1" ? 1 : 0.14}
          />
        )),
      )}
    </svg>
  );
}

/**
 * Dot-matrix loader. With `live`, dots pulse outward from the centre; otherwise it rests dim.
 * Used for anything in flight (a conversation being simulated, a judge call).
 */
export function DotMatrix({
  live = true,
  className,
  label = "Loading",
}: {
  live?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-grid size-3.5 grid-cols-5 gap-px", live && "dmx-live", className)}
    >
      {Array.from({ length: 25 }, (_, i) => {
        const ring = Math.max(Math.abs((i % 5) - 2), Math.abs(Math.floor(i / 5) - 2));
        return (
          <span
            key={i}
            className="dmx-dot block aspect-square rounded-full bg-current"
            style={{ "--ring": ring } as React.CSSProperties}
          />
        );
      })}
    </span>
  );
}
