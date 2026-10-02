import Link from "next/link";
import { GauntletMark } from "@/components/dot-matrix";
import { Button } from "@/components/ui/button";

// Placeholder landing page; the full version lands in Phase 5.
export default function LandingPage() {
  return (
    <main className="bg-dots flex flex-1 flex-col items-center justify-center gap-8 px-4 py-24 text-center">
      <GauntletMark className="size-12 text-brand" />
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
        Break your voice agent before your customers do.
      </h1>
      <p className="max-w-xl text-muted-foreground">
        Synthetic callers, realistic speech-to-text noise, and a judge that quotes its evidence.
      </p>
      <Button asChild size="lg" className="h-10 px-6">
        <Link href="/login">Open demo</Link>
      </Button>
    </main>
  );
}
