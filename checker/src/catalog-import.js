// Load BGG's ranks file (.zip or .csv), then tag the lines of existing matches with their games.
// Usage: node src/catalog-import.js <bg_ranks.zip | boardgames_ranks.csv>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeDb, q } from './db.js';
import { RANKS_FILE, loadCatalog, lineGames } from './lines.js';
import { buildIndex } from '../../shared/match.js';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.log('Usage: node src/catalog-import.js <bg_ranks.zip or .csv>');
  process.exit(1);
}

let csv = src;
if (src.toLowerCase().endsWith('.zip')) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bggranks-'));
  const r = spawnSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${src}' -DestinationPath '${out}' -Force`]);
  if (r.status !== 0) throw new Error('Could not unzip the file');
  csv = fs.readdirSync(out).map((f) => path.join(out, f)).find((f) => f.endsWith('.csv'));
  if (!csv) throw new Error('No .csv inside the zip');
}
fs.copyFileSync(csv, RANKS_FILE);
const catalog = loadCatalog();
console.log(`Saved BGG catalog: ${catalog.byId.size} games`);

const db = makeDb();
const games = await q(db.from('games').select('*'));
const index = buildIndex(games);
const matches = await q(db.from('matches').select('id,post_text').not('post_text', 'is', null));
const stats = new Map();
let tagged = 0;
for (const m of matches) {
  const lg = lineGames(m.post_text, catalog, index);
  lg.rows.forEach((r) => stats.set(r.bgg_id, r));
  await q(db.from('matches').update({ line_games: lg.lineGames }).eq('id', m.id));
  tagged += Object.keys(lg.lineGames).length;
}
// Wishlist games get catalog stats too (votes etc.).
for (const g of games.filter((g) => g.bgg_id && !stats.has(g.bgg_id))) {
  const r = catalog.byId.get(g.bgg_id);
  if (r) stats.set(r.id, { bgg_id: r.id, name: r.name, year: r.year, bgg_rank: r.rank, rating: r.rating, votes: r.votes });
}
const rows = [...stats.values()];
for (let i = 0; i < rows.length; i += 500) await q(db.from('bgg_games').upsert(rows.slice(i, i + 500), { onConflict: 'bgg_id' }));
console.log(`Recognized ${tagged} game lines in ${matches.length} matches; saved stats for ${rows.length} games.`);
