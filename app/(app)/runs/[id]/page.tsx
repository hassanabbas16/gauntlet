import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRunStatus } from "@/lib/runs";
import { requireUser } from "@/lib/session";
import { RunResults } from "./run-results";

export const metadata: Metadata = { title: "Run" };

export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const status = await getRunStatus(user.id, id);
  if (!status) notFound();
  return <RunResults initial={status} />;
}
