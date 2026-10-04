import { chat, type ChatMessage } from "@/lib/llm/client";
import { stripControlTokens } from "./tokens";
import type { AgentSnapshot, SimTurn } from "./types";

export const HARNESS_NOTE =
  "You are on a live phone call. The caller's words come from speech-to-text and may contain errors. " +
  "If you transfer the caller to a human, include the exact token [TRANSFER] in your reply. " +
  "If you end the call, include [END_CALL].";

const CALL_CONNECTED =
  "[The call has just connected. The caller hasn't said anything yet. Open the call.]";

/**
 * Role mapping from the AGENT's point of view: caller lines are "user" and its own lines are
 * "assistant". The agent only ever sees heardText (the STT-noised version), never rawText.
 * A synthetic first user message prompts the greeting, since the agent speaks first.
 */
export function agentMessages(agent: AgentSnapshot, turns: SimTurn[]): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", content: `${agent.systemPrompt.trim()}\n\n${HARNESS_NOTE}` },
    { role: "user", content: CALL_CONNECTED },
  ];
  for (const t of turns) {
    if (t.role === "agent") {
      messages.push({ role: "assistant", content: t.rawText });
    } else {
      messages.push({ role: "user", content: stripControlTokens(t.heardText ?? "") || "[inaudible]" });
    }
  }
  return messages;
}

export async function agentTurn(agent: AgentSnapshot, turns: SimTurn[]): Promise<string> {
  const res = await chat({
    model: agent.model,
    temperature: agent.temperature,
    maxTokens: 600,
    messages: agentMessages(agent, turns),
  });
  return res.text;
}
