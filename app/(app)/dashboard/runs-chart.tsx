"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Categorical slots for agents, validated (dataviz validator) against the dark card surface.
export const AGENT_COLORS = ["#1d9fc2", "#9768ec", "#c9782c", "#c8579a"];
const OTHER_COLOR = "#7d766f";

export type ChartRun = {
  id: string;
  agentId: string;
  agentName: string;
  label: string;
  passRate: number;
  passed: number;
  completed: number;
};

export function RunsChart({ runs, agentOrder }: { runs: ChartRun[]; agentOrder: string[] }) {
  const router = useRouter();
  const colorFor = (agentId: string) => {
    const i = agentOrder.indexOf(agentId);
    return i >= 0 && i < AGENT_COLORS.length ? AGENT_COLORS[i] : OTHER_COLOR;
  };
  const agents = [...new Map(runs.map((r) => [r.agentId, r.agentName])).entries()];
  const data = runs.map((r) => ({ ...r, pct: Math.round(r.passRate * 100) }));

  return (
    <div className="flex flex-col gap-3">
      {agents.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {agents.map(([id, name]) => (
            <li key={id} className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0" style={{ background: colorFor(id) }} />
              {name}
            </li>
          ))}
        </ul>
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: -12 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 80, 100]}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
              width={44}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.35 }}
              content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload;
                if (!p) return null;
                return (
                  <div className="border bg-popover px-3 py-2 text-xs shadow-md">
                    <div className="font-medium">{p.agentName}</div>
                    <div className="font-mono text-muted-foreground">{p.label}</div>
                    <div className="mt-1 font-mono">
                      {p.pct}% · {p.passed}/{p.completed} calls passed
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="pct"
              radius={[4, 4, 0, 0]}
              maxBarSize={44}
              className="cursor-pointer"
              onClick={(d: { payload?: ChartRun }) => d.payload && router.push(`/runs/${d.payload.id}`)}
            >
              {data.map((r) => (
                <Cell key={r.id} fill={colorFor(r.agentId)} />
              ))}
              {data.length <= 10 && (
                <LabelList
                  dataKey="pct"
                  position="top"
                  formatter={(v: unknown) => `${v}%`}
                  style={{ fill: "var(--foreground)", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-mono">table view</summary>
        <table className="mt-2 w-full font-mono">
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-1 pr-2">
                  <Link href={`/runs/${r.id}`} className="hover:text-brand">
                    {r.agentName}
                  </Link>
                </td>
                <td className="py-1 pr-2">{r.label}</td>
                <td className="py-1 text-right text-foreground">{r.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
