import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Runs" };

export default function RunsPage() {
  return (
    <>
      <PageHeader eyebrow="runs" title="Runs" description="Every Gauntlet run." />
      <EmptyState title="No runs yet." />
    </>
  );
}
