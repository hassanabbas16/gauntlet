// Control tokens the caller and agent emit to end a call. They stay in stored rawText
// (so we keep the signal) and are stripped wherever text is shown or "heard".

export const END_CALL = "[END_CALL]";
export const TRANSFER = "[TRANSFER]";

const TOKEN_RE = /\[(END_CALL|TRANSFER)\]/gi;

export function hasEndCall(text: string) {
  return /\[END_CALL\]/i.test(text);
}

export function hasTransfer(text: string) {
  return /\[TRANSFER\]/i.test(text);
}

export function stripControlTokens(text: string): string {
  return text.replace(TOKEN_RE, "").replace(/\s{2,}/g, " ").trim();
}
