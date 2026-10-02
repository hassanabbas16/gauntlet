import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Agents" };

export default function AgentsPage() {
  return (
    <>
      <PageHeader eyebrow="agents" title="Agents" description="Voice agents under test." />
      <EmptyState title="No agents yet." />
    </>
  );
}
