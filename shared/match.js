// Game-name matching. Used by the checker (and by the website for de-duplication).

/** Lowercase, strip accents/punctuation, collapse spaces. Works for Greek too. */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Extra names we match automatically, e.g. "Twilight Imperium: Fourth Edition" -> "Twilight Imperium". */
export function autoAliases(name) {
  const out = [];
  const base = String(name).split(/[:–—]| - /)[0].trim();
  if (base && base !== name && base.split(/\s+/).length >= 2) out.push(base);
  const noParens = String(name).replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (noParens && noParens !== name) out.push(noParens);
  return out;
}

export function termsFor(game) {
  const set = new Set();
  for (const t of [game.name, ...autoAliases(game.name), ...(game.aliases || [])]) {
    const n = normalize(t);
    if (n.length >= 3) set.add(n);
  }
  return [...set];
}

export function buildIndex(games) {
  return games.filter((g) => g.enabled !== false).map((game) => ({ game, terms: termsFor(game) }));
}

/** Returns [{ game, term }] for every watched game mentioned in the text (whole words only). */
export function findMatches(text, index) {
  const hay = ` ${normalize(text)} `;
  const hits = [];
  for (const { game, terms } of index) {
    const term = terms.find((t) => hay.includes(` ${t} `));
    if (term) hits.push({ game, term });
  }
  return hits;
}

/** Short piece of the post around the line that mentions the game. */
export function snippet(text, term, max = 240) {
  const lines = String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const i = lines.findIndex((l) => ` ${normalize(l)} `.includes(` ${term} `));
  const start = Math.max(0, i - 1);
  let s = (i < 0 ? lines : lines.slice(start, start + 3)).join(' · ');
  if (s.length > max) s = s.slice(0, max - 1).trimEnd() + '…';
  return s;
}

/** Stable key for a post without a link: hash of its longer lines (skips "2h"-style timestamps). */
export function textKey(text) {
  const body = String(text).split(/\n+/).filter((l) => l.trim().length >= 25).join('\n') || String(text);
  const n = normalize(body).slice(0, 600);
  let h = 0x811c9dc5;
  for (let i = 0; i < n.length; i++) {
    h ^= n.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}
