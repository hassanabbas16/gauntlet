export type DiffPart = { type: "same" | "removed" | "added"; text: string };

/** Compare words ignoring case and punctuation, which STT output mangles anyway. */
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Word-level diff of what the caller said vs what the agent heard (LCS).
 * "removed" = said but not heard, "added" = heard but not said. Unchanged words keep the
 * heard spelling so lowercasing/punctuation loss stays visible without being flagged.
 */
export function wordDiff(said: string, heard: string): DiffPart[] {
  const a = said.split(/\s+/).filter(Boolean);
  const b = heard.split(/\s+/).filter(Boolean);
  const na = a.map(norm);
  const nb = b.map(norm);

  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = na[i] === nb[j] && na[i] !== "" ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += ` ${text}`;
    else parts.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (na[i] === nb[j] && na[i] !== "") {
      push("same", b[j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("removed", a[i++]);
    } else {
      push("added", b[j++]);
    }
  }
  while (i < a.length) push("removed", a[i++]);
  while (j < b.length) push("added", b[j++]);
  return parts;
}

/** Count of words that changed between said and heard. */
export function changedWords(parts: DiffPart[]): number {
  return parts
    .filter((p) => p.type !== "same")
    .reduce((n, p) => n + p.text.split(/\s+/).length, 0);
}
