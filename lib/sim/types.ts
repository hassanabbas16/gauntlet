import type { AgentSnapshot } from "@/lib/db/schema";

export type { AgentSnapshot };

export type EndReason = "caller_ended" | "agent_transferred" | "max_turns" | "error";

/** One utterance in a simulated call. heardText is only set for caller turns. */
export type SimTurn = {
  index: number;
  role: "caller" | "agent";
  /** What was actually said, including any control token. */
  rawText: string;
  /** What the agent heard after STT noise (caller turns only). */
  heardText: string | null;
};
