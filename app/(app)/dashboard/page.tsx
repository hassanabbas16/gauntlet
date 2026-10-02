import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Overview of your runs." />
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-12 text-sm text-muted-foreground">
        Nothing here yet.
      </div>
    </>
  );
}
