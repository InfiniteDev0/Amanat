// How the search finds things, as Manasik's (and ClickUp's): every word typed
// has to be somewhere in the record — whole, the start of a word, inside one,
// or a slip away ("meetig" still finds Meeting) — and the closer the match,
// and the more of it in the title, the higher it comes.

/** Lower case, accents off — "Ahmed" and "ahméd" are the same to the search. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** The words in a text: split on spaces and the marks between them, but "inv-0012" kept whole too. */
export function tokensOf(text: string): string[] {
  const plain = normalize(text);
  const words = plain.split(/[\s,·/()|–—]+/).filter(Boolean);
  // "INV-0012" as itself, and as "inv0012" and "0012", so any of them finds it.
  const parts = words.flatMap((word) => (/[-_.:+]/.test(word) ? [word.replace(/[-_.:+]/g, ''), ...word.split(/[-_.:+]+/)] : []));
  return [...new Set([...words, ...parts].filter(Boolean))];
}

/**
 * A phone number as it might be typed: its digits, and the local way with a 0
 * in place of the dial code — so "0712 345 678" finds "+254 712 345678".
 */
export function phoneForms(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return [];
  const local = phone.trim().startsWith('+') ? phone.replace(/^\s*\+\d{1,3}/, '').replace(/\D/g, '') : '';
  return [digits, ...(local ? [local, `0${local}`] : [])];
}

/** How many single-letter changes turn one word into the other — a swap of two counts as one. */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push([i]);
  }
  for (let j = 1; j <= b.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, rows[i - 2]![j - 2]! + 1);
      }
      rows[i]![j] = value;
      best = Math.min(best, value);
    }
    // Every way on is already too far.
    if (best > limit) return limit + 1;
  }
  return rows[a.length]![b.length]!;
}

/** How many slips a typed word may have: none while short, one from four letters, two from eight. */
function slipsAllowed(word: string): number {
  if (/^\d+$/.test(word)) return 0;
  return word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0;
}

/**
 * How well one typed word matches one word of the record, 0 for not at all:
 * the same word, its start, inside it, or the start of it with a slip.
 */
function wordScore(typed: string, token: string): number {
  if (token === typed) return 100;
  if (token.startsWith(typed)) return 80 - Math.min(10, token.length - typed.length);
  if (typed.length >= 2 && token.includes(typed)) return 55;
  const slips = slipsAllowed(typed);
  if (slips === 0 || token.length < 3) return 0;
  // The start of the word the same length as what's typed, give or take a letter.
  let closest = slips + 1;
  // A letter short only from five letters on — "cawl" isn't "cal…".
  for (let length = typed.length - (typed.length >= 5 ? 1 : 0); length <= typed.length + 1; length++) {
    if (length < 3 || length > token.length) continue;
    closest = Math.min(closest, editDistance(typed, token.slice(0, length), slips));
  }
  return closest <= slips ? 40 - closest * 10 : 0;
}

/** Below this, a record was only found with a slip in the spelling. */
export const SLIP_SCORE = 45;

/** A record made ready to be searched once, not on every key. */
export interface Searchable {
  /** The words of its title. */
  title: string[];
  /** The words of everything else it can be found by. */
  rest: string[];
}

export function searchable(title: string, rest: (string | number | null | undefined)[]): Searchable {
  const titleTokens = tokensOf(title);
  const restTokens = rest
    .filter((value): value is string | number => value !== null && value !== undefined && value !== '')
    .flatMap((value) => tokensOf(String(value)));
  return { title: titleTokens, rest: [...new Set(restTokens)] };
}

/** The typed words, ready to match. */
export function queryWords(query: string): string[] {
  return [...new Set(normalize(query).split(/[\s,]+/).filter(Boolean))];
}

/**
 * How well a record matches what's typed — 0 when any word is nowhere in it.
 * A word found in the title counts in full; elsewhere, a little less.
 */
export function matchScore(record: Searchable, words: string[]): number {
  if (words.length === 0) return 0;
  let total = 0;
  for (const word of words) {
    let best = 0;
    for (const token of record.title) best = Math.max(best, wordScore(word, token));
    for (const token of record.rest) {
      if (best >= 100) break;
      best = Math.max(best, wordScore(word, token) * 0.7);
    }
    if (best === 0) return 0;
    total += best;
  }
  return total / words.length;
}

/**
 * Where the typed words are in a title — [start, end) — to underline them, as
 * ClickUp does. A word matched with a slip underlines the word it matched.
 */
export function matchRanges(title: string, words: string[]): [number, number][] {
  if (words.length === 0) return [];
  const plain = normalize(title);
  const ranges: [number, number][] = [];
  // Each word of the title, with where it starts.
  const parts = [...plain.matchAll(/[^\s,·/()|–—]+/g)].map((match) => ({ text: match[0], start: match.index ?? 0 }));
  for (const word of words) {
    const at = plain.indexOf(word);
    if (at >= 0) {
      ranges.push([at, at + word.length]);
      continue;
    }
    const slipped = parts.find((part) => wordScore(word, part.text) > 0);
    if (slipped) ranges.push([slipped.start, slipped.start + Math.min(slipped.text.length, word.length + 1)]);
  }
  // In order, the overlapping ones joined.
  ranges.sort((a, b) => a[0] - b[0]);
  const joined: [number, number][] = [];
  for (const range of ranges) {
    const last = joined[joined.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else joined.push([...range]);
  }
  return joined;
}
