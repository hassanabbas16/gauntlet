# Notes

Running log of decisions and things to know.

## Phase 1 — Scaffold & infra

- **Next.js 16.3** (latest stable). Middleware is now called **Proxy** → auth gate lives in `proxy.ts`.
- **pnpm 10.34.6** via corepack. Corepack's bundled default (pnpm 12.8.1) fails to start on this machine, so `packageManager` pins 10.x. The `pnpm` shim was installed into the user npm dir (`corepack enable pnpm --install-directory %APPDATA%\npm`) because `C:\Program Files\nodejs` needs admin.
- **shadcn/ui** (`radix-nova` preset, Radix base). It uses shadcn's own `cn` package for class merging.
- Dark-mode-first: `<html class="dark">` is hardcoded; there's no theme toggle. The Sonner toaster is pinned to dark.
- **DB driver**: `drizzle-orm/neon-http` (stateless HTTP, good on serverless). It has no interactive transactions; if one turns out to be necessary later, switch to `neon-serverless` Pool.
- Status/enum columns are Postgres enums. `conversations` gets an extra `createdAt` column (the spec says "createdAt everywhere"); `endReason`/`verdict`/`score`/`summary` are nullable until a conversation finishes.
- **Auth**: Auth.js v5 beta, Credentials + JWT. `session.user.id` and `session.user.isDemo` come from the token. The DB is imported lazily inside `authorize` so the proxy stays light.
- Commit messages are plain conventional commits.
- `.gitignore` ignores `.env*` but allows `.env.example`.
- Scripts load `.env.local` through `scripts/env.ts` (import it first).
