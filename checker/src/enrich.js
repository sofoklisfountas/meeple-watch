// Fills complexity / players / play time / votes from the BGG API. Only runs when BGG_TOKEN is set.
// Cheap: 20 games per request, each game refreshed at most once every 30 days.
import { env, log, sleep } from './config.js';
import { q } from './db.js';
import { fetchThings } from './bgg.js';

export async function enrichFromApi(db, { max = 200 } = {}) {
  if (!env.bggToken) return;

  // Make sure wishlist games have a stats row too.
  const games = await q(db.from('games').select('bgg_id,name,year').not('bgg_id', 'is', null));
  const known = new Set((await q(db.from('bgg_games').select('bgg_id'))).map((r) => r.bgg_id));
  const missing = games.filter((g) => !known.has(g.bgg_id)).map((g) => ({ bgg_id: g.bgg_id, name: g.name, year: g.year }));
  if (missing.length) await q(db.from('bgg_games').upsert(missing, { onConflict: 'bgg_id', ignoreDuplicates: true }));

  const stale = new Date(Date.now() - 30 * 864e5).toISOString();
  const todo = await q(
    db.from('bgg_games').select('bgg_id').or(`api_updated_at.is.null,api_updated_at.lt.${stale}`).limit(max),
  );
  if (!todo.length) return;

  let done = 0;
  for (let i = 0; i < todo.length; i += 20) {
    const ids = todo.slice(i, i + 20).map((r) => r.bgg_id);
    const rows = await fetchThings(ids, env.bggToken);
    if (rows.length) await q(db.from('bgg_games').upsert(rows, { onConflict: 'bgg_id' }));
    done += rows.length;
    await sleep(5000); // BGG asks for ~5 s between requests
  }
  log(`BGG API: updated ${done} games`);
}
