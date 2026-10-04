import type { RNG } from "@/lib/rng";
import { agentTurn } from "./agent";
import { callerTurn } from "./caller";
import { applySttNoise } from "./noise";
import type { Persona } from "./personas";
import { hasEndCall, hasTransfer, stripControlTokens } from "./tokens";
import type { AgentSnapshot, EndReason, SimTurn } from "./types";

export type LoopInput = {
  agent: AgentSnapshot;
  persona: Persona;
  rng: RNG;
  maxTurns: number;
  /** Called after each turn so callers can persist partial transcripts. */
  onTurn?: (turn: SimTurn) => Promise<void> | void;
};

export type LoopResult = { turns: SimTurn[]; endReason: EndReason };

export class LoopError extends Error {
  constructor(
    message: string,
    readonly turns: SimTurn[],
  ) {
    super(message);
    this.name = "LoopError";
  }
}

/**
 * agent greets -> (caller speaks -> noise -> agent replies) until someone ends the call,
 * the agent transfers, or we hit maxTurns.
 */
export async function runConversation(input: LoopInput): Promise<LoopResult> {
  const { agent, persona, rng, maxTurns, onTurn } = input;
  const turns: SimTurn[] = [];

  const push = async (turn: Omit<SimTurn, "index">) => {
    const full = { ...turn, index: turns.length };
    turns.push(full);
    await onTurn?.(full);
    return full;
  };

  try {
    const greeting = await agentTurn(agent, turns);
    await push({ role: "agent", rawText: greeting, heardText: null });
    if (hasTransfer(greeting)) return { turns, endReason: "agent_transferred" };
    if (hasEndCall(greeting)) return { turns, endReason: "caller_ended" };

    while (true) {
      let raw = await callerTurn(persona, turns);
      // Caller models sometimes hang up in their opening line, before the agent can respond.
      // Ignore that: a call needs at least one agent reply to the caller.
      if (hasEndCall(raw) && turns.length < 3) raw = stripControlTokens(raw);
      const heard = applySttNoise(stripControlTokens(raw), persona.noiseLevel, rng);
      await push({ role: "caller", rawText: raw, heardText: heard });
      if (hasEndCall(raw)) return { turns, endReason: "caller_ended" };

      const reply = await agentTurn(agent, turns);
      await push({ role: "agent", rawText: reply, heardText: null });
      if (hasTransfer(reply)) return { turns, endReason: "agent_transferred" };
      // The agent hung up. The spec files this under caller_ended too.
      if (hasEndCall(reply)) return { turns, endReason: "caller_ended" };
      if (turns.length >= maxTurns) return { turns, endReason: "max_turns" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new LoopError(message, turns);
  }
}
