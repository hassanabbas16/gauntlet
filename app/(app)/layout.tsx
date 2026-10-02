import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getSessionUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // The proxy already redirects, but double-check here so pages can rely on a user.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <SidebarProvider>
      <AppSidebar user={{ name: user.name, email: user.email }} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          {user.isDemo && (
            <span className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              demo
            </span>
          )}
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
