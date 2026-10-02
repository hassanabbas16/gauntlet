# Gauntlet

**Break your voice agent before your customers do.**

Gauntlet is an open-source testing platform for voice AI agents. It generates synthetic caller personas, runs simulated phone conversations against your agent with realistic speech-to-text noise injected into what the agent "hears", and scores every call with a hybrid judge: deterministic code checks plus LLM rubric checks that quote their evidence.

> Work in progress. Architecture, roadmap and full docs are coming.

## Running locally

```bash
pnpm install
cp .env.example .env.local   # fill in the two Supabase URLs and GROQ_API_KEY; generate AUTH_SECRET
git config core.hooksPath .githooks
pnpm db:push
pnpm seed
pnpm dev
```

Then sign in at http://localhost:3000/login with the demo credentials from `.env.local`.
