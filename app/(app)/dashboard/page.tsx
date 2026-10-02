import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader eyebrow="dashboard" title="Dashboard" description="Overview of your runs." />
      <EmptyState title="No runs yet." />
    </>
  );
}
