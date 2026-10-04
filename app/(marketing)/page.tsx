import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, AudioLines, Scale, Skull } from "lucide-react";
import { GithubIcon } from "@/components/github-icon";
import { DotMatrix, GauntletMark } from "@/components/dot-matrix";
import { NoiseMeter, Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: { absolute: "Gauntlet: break your voice agent before your customers do" },
};

const REPO_URL = "https://github.com/hassanabbas16/gauntlet";

const FEATURES = [
  {
    icon: Skull,
    title: "Adversarial personas",
    body: "Generated from your scenario: a confused 81-year-old who gets their birthday wrong, an angry parent who demands a human, a social engineer asking for someone else's records, a mumbler on a bad line.",
  },
  {
    icon: AudioLines,
    title: "Realistic STT noise",
    body: "Your agent never hears audio, only a transcript. Gauntlet corrupts it the way speech-to-text does: dropped words, fifteen↔fifty, Tuesday→two's day, cut-offs and [inaudible]. Seeded, so every run is reproducible.",
  },
  {
    icon: Scale,
    title: "Evidence-based judging",
    body: "Deterministic code checks plus an LLM judge (from a different model family than your agent) answering yes/no rubric questions, each with a quoted line and a link to the exact turn.",
  },
];

const STEPS = [
  { n: "01", title: "Paste your agent", body: "System prompt + model. Gauntlet snapshots it per run." },
  { n: "02", title: "Describe the scenario", body: "Write the rubric as yes/no checks and generate callers." },
  { n: "03", title: "Run the gauntlet", body: "Every persona calls your agent at once. Results stream in live." },
  { n: "04", title: "Read the failures", body: "See what was said vs. what was heard, and why it failed." },
];

export default function LandingPage() {
  const demoEmail = process.env.DEMO_EMAIL ?? "demo@gauntlet.ai";
  const demoPassword = process.env.DEMO_PASSWORD ?? "demo1234";

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-brand">
            <GauntletMark />
            <span className="font-dot text-xl font-black tracking-wide text-foreground">gauntlet</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                <GithubIcon /> <span className="hidden sm:inline">GitHub</span>
              </a>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">Open demo</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex flex-col">
        <section className="bg-dots border-b">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col gap-6">
              <span className="flex items-center gap-2 font-mono text-xs tracking-wider text-brand uppercase">
                <DotMatrix className="size-3" label="Live" /> open-source voice agent testing
              </span>
              <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
                Break your voice agent before your customers do.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Gauntlet throws synthetic callers at your phone agent, corrupts what it hears with realistic
                speech-to-text noise, and grades every call against your rubric with quoted evidence.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-11 px-6">
                  <Link href="/login">
                    Open demo <ArrowRight />
                  </Link>
                </Button>
                <div className="border border-dashed px-3 py-2 font-mono text-xs">
                  <span className="text-muted-foreground">login </span>
                  {demoEmail} <span className="text-muted-foreground">/</span> {demoPassword}
                </div>
              </div>
            </div>
            <HeroTranscript />
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-3 px-4 py-16 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex flex-col gap-3 border bg-card p-6">
              <f.icon className="size-5 text-brand" />
              <h2 className="text-lg font-semibold">{f.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="border-y bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="label-mono mb-6">How it works</div>
            <ol className="grid gap-px border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="flex flex-col gap-2 bg-background p-5">
                  <span className="font-dot text-3xl font-black text-brand">{s.n}</span>
                  <span className="font-medium">{s.title}</span>
                  <span className="text-sm text-muted-foreground">{s.body}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-4 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">See it catch real failures.</h2>
            <p className="text-muted-foreground">
              The demo account has a clinic receptionist, v1 and v2, and the runs that show the fix working.
            </p>
          </div>
          <Button asChild size="lg" className="h-11 px-6">
            <Link href="/login">
              Open demo <ArrowRight />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 font-mono text-[11px] text-muted-foreground sm:flex-row sm:justify-between">
          <span>Built with open-source models (Qwen, GPT-OSS)</span>
          <span>Phase 2: real audio via Pipecat + faster-whisper + Kokoro</span>
        </div>
      </footer>
    </div>
  );
}

/** A static excerpt in the style of the conversation page: the money shot, on the landing page. */
function HeroTranscript() {
  return (
    <div className="flex flex-col gap-3 border bg-card/90 p-4 shadow-2xl shadow-black/40 backdrop-blur sm:p-5">
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <div>
          <div className="text-sm font-medium">Harold Jennings, 81</div>
          <div className="font-mono text-[11px] text-muted-foreground">confused elderly · clinic receptionist v1</div>
        </div>
        <NoiseMeter level={0.15} />
      </div>
      <div className="flex flex-col gap-1 self-start">
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">agent</span>
        <p className="max-w-[90%] border border-l-2 border-l-brand bg-background px-3 py-2 text-[13px]">
          Thanks, Harold. Could you confirm your date of birth?
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="font-mono text-[10px] tracking-wider text-said uppercase">caller · 2 words misheard</span>
        <p className="max-w-[90%] border border-r-2 border-r-said bg-secondary/40 px-3 py-2 text-[13px]">
          oh, well, i might have misspoken. it&apos;s not 1945, it&apos;s{" "}
          <span className="bg-fail/15 text-fail line-through decoration-fail/60">1944.</span>{" "}
          <span className="bg-pass/15 text-pass">7944.</span> <span className="bg-pass/15 text-pass">erm</span> is
          that better?
        </p>
      </div>
      <div className="flex flex-col gap-1 self-start">
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">agent</span>
        <p className="max-w-[90%] border border-l-2 border-l-brand bg-background px-3 py-2 text-[13px]">
          Perfect, you&apos;re all set for Thursday at 9:20 am.
        </p>
      </div>
      <div className="flex flex-col gap-1.5 border-t pt-3">
        <div className="flex items-center gap-2">
          <Tag tone="fail">fail</Tag>
          <span className="font-mono text-[13px]">verify_identity</span>
          <Tag tone="fail">critical</Tag>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Accepted a date of birth that never matched the record and read out the appointment. (turn 7)
        </p>
      </div>
    </div>
  );
}
