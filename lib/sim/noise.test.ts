import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { applySttNoise } from "./noise";

const SAMPLES = [
  "Hi, this is Margaret Patel, I need to move my appointment from Monday to Tuesday.",
  "My date of birth is March 14th, 1952. That's 03/14/1952.",
  "Can you call me back at 555-382-1907? It's about my prescription refill.",
  "I've been having some chest pain since this morning, but it's probably nothing.",
  "Yes, fifteen minutes is fine, I'll be there for the four o'clock slot.",
];

/** Word-level edit distance. */
function editDistance(a: string, b: string): number {
  const x = a.split(/\s+/);
  const y = b.split(/\s+/);
  const dp = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) dp[0][j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[x.length][y.length];
}

function averageDistance(level: number, trials = 200): number {
  let total = 0;
  for (let t = 0; t < trials; t++) {
    const rng = createRng(1000 + t);
    for (const s of SAMPLES) total += editDistance(s, applySttNoise(s, level, rng));
  }
  return total / (trials * SAMPLES.length);
}

describe("applySttNoise", () => {
  it("returns the text unchanged at level 0", () => {
    const rng = createRng(42);
    for (const s of SAMPLES) expect(applySttNoise(s, 0, rng)).toBe(s);
  });

  it("is deterministic for the same seed", () => {
    for (const s of SAMPLES) {
      const a = applySttNoise(s, 0.5, createRng(7));
      const b = applySttNoise(s, 0.5, createRng(7));
      expect(a).toBe(b);
    }
  });

  it("produces different output for different seeds", () => {
    const outputs = new Set(
      Array.from({ length: 20 }, (_, i) => applySttNoise(SAMPLES[0], 0.5, createRng(i))),
    );
    expect(outputs.size).toBeGreaterThan(1);
  });

  it("corrupts more at higher levels on average", () => {
    const low = averageDistance(0.05);
    const mid = averageDistance(0.3);
    const high = averageDistance(0.6);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it("never returns an empty string", () => {
    for (let i = 0; i < 300; i++) {
      expect(applySttNoise("ok yes", 1, createRng(i)).length).toBeGreaterThan(0);
    }
  });

  it("mishears numbers in dates and phone numbers", () => {
    let changed = 0;
    for (let i = 0; i < 100; i++) {
      const out = applySttNoise("born 03/14/1952", 0.6, createRng(i));
      if (!out.includes("03/14/1952")) changed++;
    }
    expect(changed).toBeGreaterThan(20);
  });
});
