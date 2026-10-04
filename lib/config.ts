// Central place for env-driven settings. Read lazily so scripts can load .env.local first.

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  get models() {
    return {
      caller: process.env.MODEL_CALLER ?? "qwen-3.8-27b",
      agentDefault: process.env.MODEL_AGENT_DEFAULT ?? "qwen-3.8-27b",
      judge: process.env.MODEL_JUDGE ?? "gpt-oss-120b",
      personaGen: process.env.MODEL_PERSONA_GEN ?? "gpt-oss-120b",
    };
  },
  get limits() {
    return {
      demoMaxRunsPerDay: num("DEMO_MAX_RUNS_PER_DAY", 5),
      maxPersonasPerRun: num("MAX_PERSONAS_PER_RUN", 10),
      maxTurnsPerConversation: num("MAX_TURNS_PER_CONVERSATION", 20),
      llmConcurrency: num("LLM_CONCURRENCY", 3),
    };
  },
};

/** Models offered in the agent editor. The first entry is the default agent model. */
export function availableAgentModels(): string[] {
  const { agentDefault, caller, judge } = config.models;
  return [...new Set([agentDefault, caller, judge])];
}
