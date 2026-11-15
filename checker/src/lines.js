// Per-line game recognition for posts + the BGG ranks file on disk.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, log } from './config.js';
import { parseRanksCsv, buildCatalog, findInLine, bodyLines } from '../../shared/catalog.js';
import { findMatches } from '../../shared/match.js';

export const RANKS_FILE = path.join(DATA_DIR, 'bgg_ranks.csv');

let cached = null;
/** The BGG catalog, loaded once. null if the ranks file isn't imported yet. */
export function loadCatalog() {
  if (cached) return cached;
  if (!fs.existsSync(RANKS_FILE)) return null;
  const rows = parseRanksCsv(fs.readFileSync(RANKS_FILE, 'utf8'));
  cached = { ...buildCatalog(rows), byId: new Map(rows.map((r) => [r.id, r])) };
  log(`BGG catalog loaded: ${rows.length} games`);
  return cached;
}

/**
 * For each line of the post, which BGG game it is.
 * Your wishlist wins over the catalog (so your own spellings/aliases count).
 * Returns { lineGames: { line: bggId }, rows: [bgg_games rows to save] }.
 */
export function lineGames(text, catalog, wishlistIndex) {
  const out = {};
  const rows = new Map();
  for (const line of bodyLines(text)) {
    const wish = findMatches(line, wishlistIndex).find((h) => h.game.bgg_id);
    if (wish) {
      out[line] = wish.game.bgg_id;
      const r = catalog?.byId.get(wish.game.bgg_id);
      rows.set(wish.game.bgg_id, toRow(r) || { bgg_id: wish.game.bgg_id, name: wish.game.name, year: wish.game.year });
      continue;
    }
    const r = catalog && findInLine(line, catalog);
    if (r) {
      out[line] = r.id;
      rows.set(r.id, toRow(r));
    }
  }
  return { lineGames: out, rows: [...rows.values()] };
}

function toRow(r) {
  return r && { bgg_id: r.id, name: r.name, year: r.year, bgg_rank: r.rank, rating: r.rating, votes: r.votes };
}
