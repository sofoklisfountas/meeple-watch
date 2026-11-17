// New (shop) prices from boardgameprices.eu, saved in `prices` (one row per game).
// Only games seen in posts or on the wishlist; each one asked at most every 30 days.
import { log, sleep } from './config.js';
import { q } from './db.js';
import { priceUrl, pickPrice } from '../../shared/prices.js';

const FRESH_DAYS = 30;

export async function refreshPrices(db, { max = 60 } = {}) {
  const ids = new Set();
  const [posts, matches, games, known] = await Promise.all([
    q(db.from('posts').select('line_games').limit(10000)),
    q(db.from('matches').select('line_games').eq('dismissed', false).limit(10000)),
    q(db.from('games').select('bgg_id').not('bgg_id', 'is', null)),
    q(db.from('prices').select('bgg_id,checked_at').limit(50000)),
  ]);
  for (const r of [...posts, ...matches]) Object.values(r.line_games || {}).forEach((id) => id && ids.add(String(id)));
  for (const g of games) ids.add(String(g.bgg_id));

  const stale = Date.now() - FRESH_DAYS * 864e5;
  const fresh = new Set(known.filter((r) => new Date(r.checked_at).getTime() > stale).map((r) => r.bgg_id));
  const todo = [...ids].filter((id) => !fresh.has(id)).slice(0, max);
  if (!todo.length) return;

  let found = 0;
  for (const id of todo) {
    try {
      const res = await fetch(priceUrl(id), { headers: { 'User-Agent': 'MeepleWatch/1.0 (personal use)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const row = pickPrice(id, await res.json());
      await q(db.from('prices').upsert({ ...row, checked_at: new Date().toISOString() }, { onConflict: 'bgg_id' }));
      if (row.price != null) found++;
    } catch (e) {
      log(`  price ${id}: ${e.message}`); // not saved → tried again next time
    }
    await sleep(1500); // be gentle
  }
  log(`Prices: checked ${todo.length} games, ${found} with a shop price`);
}
