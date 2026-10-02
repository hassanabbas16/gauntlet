"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Mono path in the header: `gauntlet / runs / 3f2a…`. Long ids are shortened. */
export function HeaderCrumbs() {
  const parts = (usePathname() ?? "/").split("/").filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
      <span className="hidden text-muted-foreground sm:inline">gauntlet</span>
      {parts.map((part, i) => {
        const href = `/${parts.slice(0, i + 1).join("/")}`;
        const last = i === parts.length - 1;
        const label = part.length > 12 ? `${part.slice(0, 8)}…` : part;
        return (
          <span key={href} className="flex min-w-0 items-center gap-1.5">
            <span className={i === 0 ? "hidden text-muted-foreground/50 sm:inline" : "text-muted-foreground/50"}>/</span>
            {last ? (
              <span className="truncate text-foreground">{label}</span>
            ) : (
              <Link href={href} className="text-muted-foreground hover:text-brand">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
