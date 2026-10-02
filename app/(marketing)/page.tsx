import Link from "next/link";
import { Button } from "@/components/ui/button";

// Placeholder landing page; the full version lands in Phase 5.
export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Break your voice agent before your customers do.
      </h1>
      <Button asChild size="lg">
        <Link href="/login">Open demo</Link>
      </Button>
    </main>
  );
}
