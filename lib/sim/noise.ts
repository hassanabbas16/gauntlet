import type { RNG } from "@/lib/rng";

// Simulates what a speech-to-text engine does to a caller's words before the agent "hears" them.
// Pure and deterministic for a given rng. level 0 = perfect transcript, 1 = very noisy line.

/** Near-sound swaps. Applied in both directions where it makes sense. */
const HOMOPHONES: Record<string, string> = {
  their: "there",
  there: "their",
  "they're": "there",
  to: "two",
  two: "to",
  too: "to",
  for: "four",
  four: "for",
  write: "right",
  right: "write",
  know: "no",
  no: "know",
  hear: "here",
  here: "hear",
  by: "buy",
  weight: "wait",
  wait: "weight",
  week: "weak",
  hour: "our",
  our: "hour",
  new: "knew",
  see: "sea",
  son: "sun",
  would: "wood",
  patel: "pastel",
  monday: "money",
  tuesday: "two's day",
  thursday: "thirsty",
  friday: "fried egg",
  appointment: "a point meant",
  doctor: "doctrine",
  prescription: "subscription",
  refill: "refile",
  insurance: "assurance",
  medicare: "medic air",
  medicaid: "medic aid",
  cardiology: "card ecology",
  dermatology: "dermatologist",
  pharmacy: "farm sea",
  birth: "berth",
  date: "eight",
  cancel: "council",
  reschedule: "schedule",
  confirm: "conform",
  chest: "just",
  pain: "pane",
  allergy: "a leggy",
  nurse: "purse",
  callback: "call back",
  account: "a count",
  member: "remember",
  johnson: "jonson",
  nguyen: "win",
  garcia: "gracia",
  smith: "smyth",
  okay: "ok",
};

const NUMBER_WORDS: Record<string, string> = {
  thirteen: "thirty",
  thirty: "thirteen",
  fourteen: "forty",
  forty: "fourteen",
  fifteen: "fifty",
  fifty: "fifteen",
  sixteen: "sixty",
  sixty: "sixteen",
  seventeen: "seventy",
  seventy: "seventeen",
  eighteen: "eighty",
  eighty: "eighteen",
  nineteen: "ninety",
  ninety: "nineteen",
  oh: "0",
  eight: "a",
  four: "for",
  two: "to",
};

/** Digits that STT commonly confuses inside dates, phone numbers and IDs. */
const DIGIT_SWAPS: Record<string, string> = {
  "3": "8",
  "8": "3",
  "5": "9",
  "9": "5",
  "1": "7",
  "7": "1",
  "6": "0",
  "0": "6",
};

const FILLERS = ["uh", "um", "uh", "like", "erm"];

function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase() && original.length > 1) return replacement.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** "14" <-> "40", otherwise flip one confusable digit. */
function mishearDigits(core: string, rng: RNG): string {
  const teen = core.match(/^1([3-9])$/);
  if (teen) return `${teen[1]}0`;
  const tens = core.match(/^([3-9])0$/);
  if (tens) return `1${tens[1]}`;
  if (core === "0") return "oh";
  const positions = [...core].flatMap((ch, i) => (DIGIT_SWAPS[ch] ? [i] : []));
  if (positions.length === 0) return core;
  const i = rng.pick(positions);
  return core.slice(0, i) + DIGIT_SWAPS[core[i]] + core.slice(i + 1);
}

function mishearNumber(core: string, rng: RNG): string | null {
  if (/\d/.test(core)) return mishearDigits(core, rng);
  const swap = NUMBER_WORDS[core.toLowerCase()];
  return swap ? matchCase(core, swap) : null;
}

function stutter(core: string): string {
  const m = core.match(/^[^aeiou]*[aeiou]?/i);
  const head = m && m[0].length > 0 && m[0].length < core.length ? m[0] : core[0];
  return `${head}-${core}`;
}

/** Split a token into leading punctuation, word, trailing punctuation. */
function splitToken(token: string): [string, string, string] {
  const m = token.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
  return m ? [m[1], m[2], m[3]] : ["", token, ""];
}

export function applySttNoise(text: string, level: number, rng: RNG): string {
  const lvl = Math.max(0, Math.min(1, level));
  if (lvl === 0 || text.trim() === "") return text;

  // Very rarely on bad lines, nothing usable comes through at all.
  if (lvl >= 0.3 && rng.chance(0.04 * lvl)) return "[inaudible]";

  const out: string[] = [];
  let inaudibleLeft = 0;

  for (const token of text.split(/\s+/).filter(Boolean)) {
    if (inaudibleLeft > 0) {
      inaudibleLeft--;
      continue;
    }
    const [pre, core, post] = splitToken(token);
    if (!core) {
      out.push(token);
      continue;
    }

    // Inaudible span (1-3 words) on noisy lines.
    if (lvl >= 0.3 && rng.chance(0.06 * lvl)) {
      out.push("[inaudible]");
      inaudibleLeft = rng.int(3);
      continue;
    }
    // Word drop.
    if (rng.chance(0.08 * lvl)) continue;
    // Filler before the word.
    if (rng.chance(0.06 * lvl)) out.push(rng.pick(FILLERS));

    let word = core;
    const lower = core.toLowerCase();
    const number = /\d/.test(core) || lower in NUMBER_WORDS;
    if (number && rng.chance(0.6 * lvl)) {
      word = mishearNumber(core, rng) ?? core;
    } else if (HOMOPHONES[lower] && rng.chance(0.35 * lvl)) {
      word = matchCase(core, HOMOPHONES[lower]);
    } else if (core.length > 2 && /^\p{L}/u.test(core) && rng.chance(0.04 * lvl)) {
      word = stutter(core);
    }
    out.push(pre + word + post);
  }

  let words = out;
  // Cut off mid-sentence (dropped audio / caller talked over).
  if (words.length > 4 && rng.chance(0.25 * lvl)) {
    const keep = Math.max(2, Math.floor(words.length * (0.5 + rng.next() * 0.4)));
    words = [...words.slice(0, keep), "—"];
  }

  let result = words.join(" ").replace(/ —$/, "—");

  // STT output is often lowercased with patchy punctuation.
  if (rng.chance(Math.min(1, lvl * 3))) result = result.toLowerCase();
  const stripP = Math.min(0.9, lvl * 2);
  result = result.replace(/[.,!?;]/g, (ch) => (rng.chance(stripP) ? "" : ch));

  return result.trim() || "[inaudible]";
}
