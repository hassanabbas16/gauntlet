# Notes

Running log of decisions and things to know.

## Phase 1 — Scaffold & infra

- **Next.js 16.3** (latest stable). Middleware is now called **Proxy** → auth gate lives in `proxy.ts`.
- **pnpm 10.34.6** via corepack. Corepack's bundled default (pnpm 12.8.1) fails to start on this machine, so `packageManager` pins 10.x. The `pnpm` shim was installed into the user npm dir (`corepack enable pnpm --install-directory %APPDATA%\npm`) because `C:\Program Files\nodejs` needs admin.
- **shadcn/ui** (`radix-nova` preset, Radix base). It uses shadcn's own `cn` package for class merging.
- Dark-mode-first: `<html class="dark">` is hardcoded; there's no theme toggle. The Sonner toaster is pinned to dark.
- Status/enum columns are Postgres enums. `conversations` gets an extra `createdAt` column (the spec says "createdAt everywhere"); `endReason`/`verdict`/`score`/`summary` are nullable until a conversation finishes.
- **Auth**: Auth.js v5 beta, Credentials + JWT. `session.user.id` and `session.user.isDemo` come from the token. The DB is imported lazily inside `authorize` so the proxy stays light.
- Commit messages are plain conventional commits.
- `.gitignore` ignores `.env*` but allows `.env.example`.
- Scripts load `.env.local` through `scripts/env.ts` (import it first).

## Database: Supabase instead of Neon (user decision, 2026-10-02)

- Postgres on **Supabase** (free tier) instead of Neon. Only the Postgres database is used: no Supabase Auth, no supabase-js, no anon/service keys. Auth stays Auth.js.
- Driver: `postgres` (postgres.js) + `drizzle-orm/postgres-js` in place of `@neondatabase/serverless`.
- `DATABASE_URL` = **transaction pooler** (Supavisor, port 6543): right for Vercel serverless. Prepared statements are off (`prepare: false`) because the transaction pooler doesn't support them. Pool size is 1 on Vercel and 5 locally.
- `DATABASE_URL_DIRECT` = **session pooler** (port 5432) for drizzle-kit. Supabase's true direct connection is IPv6-only on the free tier, and the session pooler works over IPv4.
- **RLS is enabled on every table with no policies.** Supabase exposes the `public` schema through its Data API (PostgREST) to anyone holding the anon key, and this blocks that. The app connects as `postgres`, which bypasses RLS, so app queries are unaffected.

## Design language

- Borrowed **concepts** from the karing-outreach console (which derives from nebula-app-v3): square corners (`--radius: 0`), warm stone OKLCH neutrals, cyan brand in dark mode, mono for data and labels, coloured left-edge status cards, a dot-matrix loader. All of it is re-implemented here; **no files were copied**, because Gauntlet is public and those repos are private.
- Gauntlet's own touches:
  - a dot-matrix "G" mark (`components/dot-matrix.tsx`)
  - the **Doto** display face (Google Fonts, OFL) for the wordmark and big numbers
  - a dot-grid backdrop (`.bg-dots`)
  - semantic tokens `said` (rose), `heard` (cyan), `pass`, `fail`, `warn` for the transcript diff and verdicts
- Fonts are Geist / Geist Mono / Doto, all open-license. The outreach console's Nimbus Sans L and KH Interference weren't copied: KH Interference's license is unclear for a public repo.
- karing-voice-ops has no UI. It's ops/backend for production voice agents, so only its domain lessons inform the engine: spelled names and DOBs are the top transcription failures for identity checks, transfers matter, and callers get frustrated. No client names or data.

## LLM provider: Cerebras instead of Groq (2026-10-04)

- Groq sign-up didn't work for the user, so the primary provider is **Cerebras** (free, OpenAI-compatible, open-weight models). OpenRouter is dropped.
- Env vars are provider-neutral: `LLM_BASE_URL` / `LLM_API_KEY`, plus optional `LLM_FALLBACK_BASE_URL` / `LLM_FALLBACK_API_KEY` (e.g. NVIDIA build.nvidia.com). Any OpenAI-compatible provider can be dropped in through env alone.
- Measured limits on this account (response headers, 2026-10-04): 450 req/min, 150K tokens/min, 216M tokens/day, far above the advertised free tier. `DEMO_MAX_RUNS_PER_DAY` stays at the spec value of 5. Tokens-per-minute is the real ceiling, so `LLM_CONCURRENCY` stays at 3.
- Cerebras only serves two models on this account (checked via `/models`, 2026-10-04): `qwen-3.8-27b` and `gpt-oss-120b`, with no Llama. Caller, persona gen and judge use `gpt-oss-120b`; the default agent under test uses `qwen-3.8-27b`, so the judge is a different family from the default agent. Both are open-weight. Both emit reasoning tokens (~50-80 per short reply), which count against the daily cap. The landing footer and README diagram must say "Qwen, GPT-OSS" instead of "Llama, Qwen" (Phase 5/6).
