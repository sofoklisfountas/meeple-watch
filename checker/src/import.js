// Import a BGG collection CSV (wishlist games only) or a plain list into the database.
// Adds new games and refreshes BGG stats for games already on the list.
// Usage: node src/import.js <file>
import fs from 'node:fs';
import { makeDb, q } from './db.js';
import { parseImportFile } from '../../shared/importList.js';
import { normalize } from '../../shared/match.js';

const file = process.argv[2];
if (!file) {
  console.log('Usage: node src/import.js <collection.csv>');
  process.exit(1);
}
const db = makeDb();
const items = parseImportFile(fs.readFileSync(file, 'utf8'));
const existing = await q(db.from('games').select('id,name,bgg_id'));
const byId = new Map(existing.filter((g) => g.bgg_id).map((g) => [g.bgg_id, g]));
const byName = new Map(existing.map((g) => [normalize(g.name), g]));

const rows = [];
let updated = 0;
for (const it of items) {
  const found = (it.bggId && byId.get(it.bggId)) || byName.get(normalize(it.name));
  if (found) {
    if (it.stats) {
      await q(db.from('games').update({ ...it.stats, ...(it.bggId && !found.bgg_id && { bgg_id: it.bggId }) }).eq('id', found.id));
      updated++;
    }
    continue;
  }
  byName.set(normalize(it.name), it);
  rows.push({
    name: it.name, bgg_id: it.bggId ?? null, year: it.year ?? null, priority: it.priority ?? null,
    source: it.bggId ? 'import' : 'manual', ...(it.stats || {}),
  });
}
if (rows.length) await q(db.from('games').insert(rows));
console.log(`Found ${items.length} games: ${rows.length} new, ${updated} updated with BGG stats.`);
