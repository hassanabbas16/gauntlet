import Link from "next/link";
import { GauntletMark } from "@/components/dot-matrix";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="bg-dots flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center">
      <GauntletMark className="size-10 text-muted-foreground" />
      <div>
        <div className="font-dot text-6xl font-black text-brand">404</div>
        <p className="mt-2 text-muted-foreground">[inaudible]: we couldn&apos;t find that page.</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard">Back to the dashboard</Link>
      </Button>
    </main>
  );
}
