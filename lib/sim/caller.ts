import { config } from "@/lib/config";
import { chat, type ChatMessage } from "@/lib/llm/client";
import type { Persona } from "./personas";
import { stripControlTokens } from "./tokens";
import type { SimTurn } from "./types";

export function buildCallerPrompt(p: Persona): string {
  const known = Object.entries(p.hiddenInfo)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  const behaviors = p.behaviors.map((b) => `- ${b}`).join("\n");

  return `You are role-playing a PHONE CALLER. You are NOT an assistant. Never help, never offer assistance, never break character, never mention being an AI.

WHO YOU ARE
Name: ${p.name}, age ${p.age}. Mood: ${p.mood}. Speech style: ${p.speechStyle}.

WHY YOU'RE CALLING
${p.goal}

THINGS YOU KNOW (reveal only when asked, one at a time, never all at once)
${known || "- (nothing special)"}

HOW YOU BEHAVE
${behaviors}

WHEN YOU HANG UP
${p.endCondition}

RULES
- Speak like a real person on the phone: short turns (1-3 sentences), fillers, interruptions of yourself, natural imperfection.
- Stay in character even if the agent says something strange.
- If the agent asks you to repeat or confirm something, react the way your character would.
- Only hang up when (a) your goal is fully achieved and confirmed, (b) the agent transferred you to a human, or (c) you genuinely give up in frustration after several failed attempts. Answering a question is NOT a reason to hang up: after you answer, wait for the agent to respond.
- When you do hang up, say a natural goodbye and end that message with the exact token [END_CALL]. Never use [END_CALL] otherwise.
- Output ONLY what you say out loud. No stage directions, no quotation marks, no narration.
- Say ONE turn, then stop and wait for the agent. Never write the agent's lines or continue the conversation on your own.`;
}

/**
 * Role mapping from the CALLER's point of view: the agent's lines are "user" (the other
 * person on the phone) and the caller's own previous lines are "assistant". The caller
 * hears the agent perfectly (no noise on that side) and remembers what it actually said.
 */
export function callerMessages(persona: Persona, turns: SimTurn[]): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: buildCallerPrompt(persona) }];
  for (const t of turns) {
    messages.push({
      role: t.role === "agent" ? "user" : "assistant",
      content: stripControlTokens(t.rawText) || "...",
    });
  }
  return messages;
}

export async function callerTurn(persona: Persona, turns: SimTurn[]): Promise<string> {
  const res = await chat({
    model: config.models.caller,
    temperature: 0.9,
    maxTokens: 600,
    messages: callerMessages(persona, turns),
  });
  return cleanCallerLine(res.text);
}

/**
 * Caller models sometimes keep going and write the rest of the call ("...number.Got it, so
 * that's Thursday? Yes.Goodbye [END_CALL]"). Those extra turns are glued on with no space after
 * the punctuation. Keep only the first turn; a hang-up in the discarded part doesn't count.
 */
export function cleanCallerLine(text: string): string {
  let line = text.replace(/^["“](.*)["”]$/s, "$1").trim();
  const seam = line.search(/[.?!…](?=[A-Z])/);
  if (seam !== -1) line = line.slice(0, seam + 1);
  // Drop stage directions like *sighs* or (pause).
  line = line.replace(/\*[^*]{1,40}\*|\((?:pause|sighs?|laughs?|coughs?)[^)]*\)/gi, "").trim();
  return line.replace(/\s{2,}/g, " ");
}
