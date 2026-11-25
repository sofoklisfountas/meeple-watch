// Saved posts vs the current game list: adds hits for games added after the post was first seen
// (e.g. after a BGG import). Added as already read, so old posts don't flood the unread badge.
import { pathToFileURL } from 'node:url';
import { makeDb, q } from './db.js';
import { log } from './config.js';
import { buildIndex, findMatches, snippet } from '../../shared/match.js';

export async function rematchSaved(db, { days = 7 } = {}) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const [games, posts] = await Promise.all([
    q(db.from('games').select('*')),
    q(db.from('posts').select('id,group_id,group_name,url,exact_link,post_text,images,line_games').eq('dismissed', false).gte('found_at', since).limit(5000)),
  ]);
  const index = buildIndex(games);
  if (!index.length || !posts.length) return 0;

  const known = new Set();
  for (let i = 0; i < posts.length; i += 100) {
    const keys = posts.slice(i, i + 100).map((p) => p.id);
    const rows = await q(db.from('matches').select('id').or(keys.map((k) => `id.like.${k}|*`).join(',')));
    rows.forEach((r) => known.add(r.id));
  }

  const add = new Map();
  for (const p of posts) {
    if (!p.post_text) continue;
    for (const { game, term } of findMatches(p.post_text, index)) {
      const id = `${p.id}|${game.id}`;
      if (known.has(id) || add.has(id)) continue;
      const { id: _, ...base } = p;
      add.set(id, { ...base, id, game_id: game.id, game_name: game.name, thumbnail: game.thumbnail, snippet: snippet(p.post_text, term), read: true });
    }
  }
  const rows = [...add.values()];
  for (let i = 0; i < rows.length; i += 200) {
    await q(db.from('matches').upsert(rows.slice(i, i + 200), { onConflict: 'id', ignoreDuplicates: true }));
  }
  if (rows.length) log(`Re-match: ${rows.length} hits on saved posts`);
  return rows.length;
}

// By hand: node src/rematch.js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = await rematchSaved(makeDb());
  console.log(`Added ${n} hits on saved posts.`);
  process.exit(0);
}
