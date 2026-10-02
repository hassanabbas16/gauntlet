import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Suites" };

export default function SuitesPage() {
  return (
    <>
      <PageHeader eyebrow="suites" title="Suites" description="Scenarios, rubrics and personas." />
      <EmptyState title="No suites yet." />
    </>
  );
}
