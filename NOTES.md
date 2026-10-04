# Notes

Running log of decisions and things to know.

## Status (2026-10-04)

All seven phases are built. Production: see "Deploy" below for the URL and how it was deployed.

**Your follow-ups (none block the demo):**
1. **Auto-deploys from GitHub:** install the Vercel GitHub app on your personal account (https://github.com/apps/vercel → Install → hassanabbas16 → the `gauntlet` repo), then run `vercel git connect` in this folder. Until then, deploy with `vercel deploy --prod`.
2. Optional: re-run `pnpm seed` any time to reset the demo account (it wipes reviewer-created agents/suites/runs and reloads the fixture).

## Phase 1: Scaffold & infra

- **Next.js 16.3** (latest stable). Middleware is now called **Proxy**, so the auth gate lives in `proxy.ts`. The error boundary prop is `retry()` (not `reset()`).
- **pnpm 10.34.6** via corepack. Corepack's bundled default (pnpm 12.8.1) fails to start on this machine, so `packageManager` pins 10.x. The `pnpm` shim was installed into the user npm dir because `C:\Program Files\nodejs` needs admin.
- **shadcn/ui** (`radix-nova` preset, Radix base). It uses shadcn's own `cn` package for class merging.
- Dark-mode-first: `<html class="dark">` is hardcoded; there's no theme toggle.
- Status/enum columns are Postgres enums. `conversations` has an extra `createdAt`; `endReason`/`verdict`/`score`/`summary` are nullable until a conversation finishes.
- `rubric_items.config` (jsonb, nullable) was added beyond the spec: `escalated_when_required` needs its "should escalate" archetype list stored on the rubric item ("configurable on rubric item" in the spec).
- **Auth**: Auth.js v5 beta, Credentials + JWT. `session.user.id` and `session.user.isDemo` come from the token.
- This repo's local git config pins user.name/email to the personal account.
- Scripts load `.env.local` through `scripts/env.ts` (import it first).

## Database: Supabase instead of Neon (user decision, 2026-10-02)

- Postgres on **Supabase** (free tier, `aws-0-us-east-1`). Only the Postgres database is used: no Supabase Auth, no supabase-js, no anon/service keys.
- Driver: `postgres` (postgres.js) + `drizzle-orm/postgres-js`.
- `DATABASE_URL` = **transaction pooler** (port 6543) for runtime; `prepare: false` because the transaction pooler doesn't support prepared statements. Pool size is 1 on Vercel, 5 locally.
- `DATABASE_URL_DIRECT` = **session pooler** (port 5432) for drizzle-kit. Supabase's direct connection is IPv6-only on the free tier.
- **RLS is enabled on every table with no policies**, which blocks Supabase's public Data API. The app connects as `postgres`, which bypasses RLS.
- Locally each page load is ~1.5s because every query crosses to us-east. On Vercel (iad1, same region) it's fast.

## LLM provider: Cerebras instead of Groq (2026-10-04)

- Groq sign-up didn't work for the user, so the provider is **Cerebras** (free, OpenAI-compatible, open-weight models). OpenRouter is dropped. Env vars are provider-neutral (`LLM_BASE_URL`, `LLM_API_KEY`, optional `LLM_FALLBACK_*`).
- This account serves two models: `qwen-3.8-27b` and `gpt-oss-120b`, with **very different rate limits** (from response headers):
  - `qwen-3.8-27b`: 450 req/min, 150K tokens/min, 216M tokens/day.
  - `gpt-oss-120b`: **5 req/min**, 150 req/hour, 1M tokens/day.
- So the model roles are:
  - caller → **qwen** (one call is ~8 caller requests)
  - default agent under test → **qwen**
  - judge → **gpt-oss** (one request per call; a different family from the default agent)
  - persona generator → **gpt-oss** (rare)
- The judge and persona generator fall back to qwen if gpt-oss stays rate-limited after backoff (4s/8s/16s). In a live 8-call run, a few judge calls may land on the fallback; this is logged as `[llm] ... retry` / `failed` in the function logs.
- Both models emit hidden reasoning tokens. The client sends `reasoning_effort: "none"` for qwen (turns it off) and `"low"` for gpt-oss (the minimum it accepts); the judge uses `"medium"`.
- Engine robustness fixes found while testing:
  - the caller model sometimes writes several turns in one message (glued with no space after the period), so `cleanCallerLine` keeps the first turn only
  - the caller sometimes hangs up in its first line, so `[END_CALL]` is ignored before the agent has replied once
  - empty completions are retried

## Demo data

- `lib/demo/data.ts` holds the clinic scenario, v1/v2 prompts, rubric and 8 hand-written personas covering the spec's mix.
- **Both prompts include the clinic's patient records** (a real deployment would use a lookup tool). Without records the agent can't verify anyone: v2 then correctly refuses everyone and scored *below* v1, which broke the story. With records, v2's explicit DOB-mismatch handling and read-backs show up as real improvements.
- v1's deliberate weaknesses: "If the date of birth doesn't match, use your judgement.", no read-back rule, and a common "be efficient, don't make callers confirm things twice" line. v2 drops the efficiency line and adds explicit mismatch handling and read-backs. The first attempt (without the efficiency line) only showed a small, noisy improvement, because Qwen often reads details back unprompted.
- `scripts/generate-demo-run.ts` runs the real engine (no DB) for v1 and v2, two seeds each (4 runs × 8 calls), and writes `scripts/fixtures/demo-run.json`. Judge calls are spaced 13s apart for gpt-oss's 5 req/min. It takes ~8 minutes.
- `pnpm seed` resets the demo account and loads the fixture.

## Design language

- Borrowed **concepts** from the karing-outreach console: square corners, warm stone OKLCH neutrals, cyan brand, mono for data and labels, coloured left-edge status cards, a dot-matrix loader. Everything is re-implemented; **no files were copied**, because Gauntlet is public and those repos are private.
- Gauntlet's own touches: a dot-matrix "G" mark and favicon, the **Doto** display face (OFL) for the wordmark and big numbers, a dot-grid backdrop, and semantic tokens `said`/`heard`/`pass`/`fail`/`warn`.
- Dashboard chart colours (agents, in creation order) were validated with the dataviz palette validator against the dark card surface (lightness band, CVD separation, contrast: all pass).
- karing-voice-ops has no UI; only its domain lessons informed the engine. No client names or data are used.

## Runs & execution

- One HTTP request = one conversation (`POST /api/conversations/:id/execute`), with `maxDuration = 300`. Vercel Hobby with Fluid compute allows up to 300s. Most calls take 10-40s; the headroom covers rate-limit backoff. The spec said 60s; with gpt-oss's 5 req/min judge, 60s risked timeouts.
- Execute is idempotent. It atomically claims `pending`/`failed`/stale (>6 min) `running` conversations, so duplicate browser requests are harmless, and failed rows have a **Retry** button.
- The browser drives execution (3 at a time) and polls every 2s, so turn counts tick up live.
- `MAX_TURNS_PER_CONVERSATION` is 20 (spec default 16): slow elderly callers kept hitting 16 before finishing.
- Demo limits: 5 new runs/day and 40 generated personas/day per demo account (UTC day).

## Deploy

- **GitHub:** https://github.com/hassanabbas16/gauntlet (public). Pushed with the personal account (`hassanabbas16`). The GitHub CLI's active account stays `hassann-karing`. This repo's local git config has a credential helper for github.com that returns `gh auth token --user hassanabbas16`, so `git push` here always uses the personal account and nothing else is affected.
- **Vercel:** project `gauntlet` under the personal Vercel account (`hassanabbas16`), linked with `vercel link`. Env vars were uploaded with the CLI from `.env.local` (production): `DATABASE_URL`, `LLM_BASE_URL`, `LLM_API_KEY`, `AUTH_SECRET` (these four as sensitive), `DEMO_*`, `MODEL_*` and the limits. `AUTH_URL` is set to the production URL.
- The DB is shared between local and production (one Supabase project), so `pnpm db:push` and `pnpm seed` from this machine update production too.
- Redeploy: `vercel deploy --prod` (until the GitHub app is installed, see follow-ups).

## Smoke test checklist

- [ ] Incognito: `/` loads; `/dashboard` redirects to `/login`.
- [ ] Log in with `demo@gauntlet.ai` / `demo1234` and land on the dashboard with 4 seeded runs and the v1 → v2 improvement visible in the chart.
- [ ] Open a seeded run, then a failed conversation: said → heard diff, rubric evidence, jump-to-turn.
- [ ] Start a new live run (v2 × Appointment management): rows go queued → running → done, and the pass rate fills in.
- [ ] Mobile width: dashboard, run table (scrolls horizontally), conversation page.
- [ ] After 5 runs in a day, the new-run page shows the friendly limit message and the button is disabled.
- [ ] Error state: in a **preview** deployment with `LLM_API_KEY` set to an invalid value, a run's rows show a readable error and a Retry button (don't do this in prod).
