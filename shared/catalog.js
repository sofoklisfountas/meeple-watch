// Recognize which BGG game a line of a post is about, using BGG's ranks file. Plain code, no AI.
import { normalize } from './match.js';
import { parseCsv } from './importList.js';

// Single words that are game titles but mostly appear as ordinary words in posts.
const STOP = new Set(
  ('new sold game games box set free play sale deluxe edition expansion expansions sealed condition english greek ' +
    'german french card cards pack base core one two three four first last city war time life space king kings ' +
    'dice top mint shipping price offer trade swap bundle lot collection board kickstarter promo promos sleeves ' +
    'insert inserts complete rules mini minis miniatures used like near great good best only all more').split(' '),
);

/** Parse BGG's boardgames_ranks.csv into compact rows. */
export function parseRanksCsv(text) {
  const rows = parseCsv(String(text).replace(/^﻿/, ''));
  const h = rows[0].map((x) => x.trim().toLowerCase());
  const c = (n) => h.indexOf(n);
  const [id, name, year, rank, avg, votes, exp] = ['id', 'name', 'yearpublished', 'rank', 'average', 'usersrated', 'is_expansion'].map(c);
  return rows.slice(1).map((r) => ({
    id: r[id],
    name: r[name],
    year: r[year] && r[year] !== '0' ? r[year] : null,
    rank: Number(r[rank]) || null,
    rating: Number(r[avg]) ? Math.round(Number(r[avg]) * 100) / 100 : null,
    votes: Number(r[votes]) || null,
    isExpansion: r[exp] === '1',
  }));
}

/** Better = base game over expansion, then ranked over unranked, then better rank, then more votes. */
function better(a, b) {
  if (a.isExpansion !== b.isExpansion) return !a.isExpansion;
  const ra = a.rank || Infinity, rb = b.rank || Infinity;
  if (ra !== rb) return ra < rb;
  return (a.votes || 0) > (b.votes || 0);
}

export function buildCatalog(rows) {
  const map = new Map();
  let maxWords = 1;
  for (const r of rows) {
    const n = normalize(r.name);
    if (!n) continue;
    const words = n.split(' ');
    // Single-word titles are risky: keep only well-known ones, not common words.
    if (words.length === 1 && (n.length < 4 || STOP.has(n) || !r.rank || r.rank > 3000)) continue;
    if (words.length > 1 && (r.votes || 0) < 30) continue; // obscure entries cause false matches
    const cur = map.get(n);
    if (!cur || better(r, cur)) map.set(n, r);
    if (words.length > maxWords) maxWords = Math.min(words.length, 10);
    // People often write only the part before ":" ("Flash Point" for "Flash Point: Fire Rescue").
    if (r.name.includes(':')) {
      const base = normalize(r.name.split(':')[0]);
      if (base.split(' ').length >= 2 && !STOP.has(base)) {
        const b = map.get(base);
        if (!b || better(r, b)) map.set(base, r);
      }
    }
  }
  return { map, maxWords };
}

/** Longest catalog title found in the line, or null. */
export function findInLine(line, catalog) {
  const words = normalize(line).split(' ').filter(Boolean);
  let best = null, bestLen = 0;
  for (let i = 0; i < words.length; i++) {
    for (let n = Math.min(catalog.maxWords, words.length - i); n > bestLen; n--) {
      const r = catalog.map.get(words.slice(i, i + n).join(' '));
      if (r) { best = r; bestLen = n; break; }
    }
  }
  return best;
}

/** The lines shown on a card: post text minus the first line (the seller's name). */
export function bodyLines(text) {
  return String(text).split('\n').map((l) => l.trim()).filter(Boolean).slice(1);
}
