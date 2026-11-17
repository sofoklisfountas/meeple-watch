// Meeple Watch checker: runs in the background on your PC.
import fs from 'node:fs';
import os from 'node:os';
import { makeDb, q } from './db.js';
import { scanGroups } from './scan.js';
import { fetchWishlist } from './bgg.js';
import { migrate } from './migrate.js';
import { loadCatalog, lineGames } from './lines.js';
import { enrichFromApi } from './enrich.js';
import { refreshPrices } from './prices.js';
import { env, log, sleep, SCROLLS, PID_FILE, LOGIN_LOCK } from './config.js';
import { buildIndex, findMatches, snippet, textKey, normalize } from '../../shared/match.js';
import { resolvePost, postedAtFor } from '../../shared/facebook.js';

const ONCE = process.argv.includes('--once');
const DEEP = process.argv.includes('--deep'); // one-off: scroll every group deep (fill in older posts)
const TICK_MS = 10_000;
const ERRORS = {
  LOGIN: 'Facebook logged out. Run "connect-facebook" on your PC.',
  NO_FEED: 'No posts visible. Are you a member of this group?',
  TIMEOUT: 'Timed out loading the group.',
  FAILED: 'Could not open the group.',
};

const db = makeDb();
let status = {};
let nextScanAt = Date.now() + 20_000;

// ---------- single instance ----------
function ensureSingleInstance() {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf8'));
    if (pid && pid !== process.pid) {
      process.kill(pid, 0); // throws if not running
      log(`Checker already running (pid ${pid}). Exiting.`);
      process.exit(0);
    }
  } catch {}
  fs.writeFileSync(PID_FILE, String(process.pid));
  const cleanup = () => { try { if (fs.readFileSync(PID_FILE, 'utf8') === String(process.pid)) fs.unlinkSync(PID_FILE); } catch {} };
  process.on('exit', cleanup);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

async function pushStatus(patch = {}) {
  Object.assign(status, patch, { heartbeatAt: new Date().toISOString(), pc: os.hostname() });
  await q(db.from('settings').update({ checker_status: status }).eq('id', 1));
}

// ---------- scanning ----------
async function runScan(settings) {
  const startedAt = new Date().toISOString();
  const [groups, games, recent, known] = await Promise.all([
    q(db.from('groups').select('*').eq('enabled', true).order('created_at')),
    q(db.from('games').select('*')),
    q(db.from('matches').select('id,game_id,snippet').gte('found_at', new Date(Date.now() - 45 * 864e5).toISOString()).limit(10000)),
    q(db.from('posts').select('group_id').gte('found_at', new Date(Date.now() - 7 * 864e5).toISOString()).limit(10000)),
  ]);
  const hasPosts = new Set(known.map((p) => p.group_id));
  if (!groups.length) return pushStatus({ lastScanStartedAt: startedAt, lastError: 'Add a Facebook group first.' });
  const index = buildIndex(games);
  if (!index.length) return pushStatus({ lastScanStartedAt: startedAt, lastError: 'Your wishlist is empty.' });

  const seenIds = new Set(recent.map((m) => m.id));
  const seenSnips = new Set(recent.map((m) => `${m.game_id}|${m.snippet}`));
  let posts = 0, found = 0, loggedOut = false;

  log(`Scan started: ${groups.length} groups, ${index.length} games`);
  await pushStatus({ state: 'scanning', lastScanStartedAt: startedAt, lastError: null, progress: { done: 0, total: groups.length } });

  await scanGroups(groups, {
    // Groups with no posts saved this week get one deep scroll, to fill in the last days.
    scrolls: (g) => (!DEEP && hasPosts.has(g.id) ? SCROLLS[settings.scan_depth] || SCROLLS.normal : SCROLLS.deep),
    onStart: (g, i) => pushStatus({ progress: { done: i, total: groups.length, current: g.name || g.fb_id } }),
    onResult: async (g, res) => {
      const patch = { last_checked_at: new Date().toISOString() };
      if (res.title && !/^facebook$/i.test(res.title)) patch.name = res.title;
      if (res.error) {
        patch.last_error = ERRORS[res.error] || res.error;
        patch.last_post_count = 0;
        log(`  ${g.fb_id}: ${res.error} ${res.detail || ''}`);
      } else {
        patch.last_error = null;
        patch.last_post_count = res.posts.length;
        posts += res.posts.length;
        const rows = [];
        const updMatches = new Map();
        const postRows = new Map();
        const statRows = new Map();
        const catalog = loadCatalog();
        const seenAt = Date.now();
        res.posts.forEach((p, i) => {
          const ref = resolvePost(p.links, g.fb_id);
          const key = ref ? ref.key : `text:${textKey(p.text)}`;
          const lg = lineGames(p.text.slice(0, 4000), catalog, index);
          lg.rows.forEach((r) => statRows.set(r.bgg_id, r));
          const base = {
            group_id: g.id, group_name: patch.name || g.name || 'Facebook group',
            url: ref ? ref.url : g.url, exact_link: !!ref,
            post_text: p.text.slice(0, 4000), images: p.images || [], line_games: lg.lineGames,
          };
          // Every post is saved, and refreshed on every check (like a feed: latest text, photos, SOLD, post time).
          // found_at = first seen (1 s steps keep feed order); only set when the post is new.
          const posted_at = postedAtFor(key, res.found);
          if (!postRows.has(key)) postRows.set(key, { id: key, ...base, posted_at, found_at: new Date(seenAt - i * 1000).toISOString() });
          for (const { game, term } of findMatches([p.text, ...p.alts].join('\n'), index)) {
            const id = `${key}|${game.id}`;
            const snip = snippet(p.text, term);
            const row = { id, game_id: game.id, game_name: game.name, thumbnail: game.thumbnail, snippet: snip, ...base };
            if (seenIds.has(id)) { updMatches.set(id, row); continue; } // known: refresh it
            if (seenSnips.has(`${game.id}|${snip}`)) continue; // same text already matched under another post
            seenIds.add(id);
            seenSnips.add(`${game.id}|${snip}`);
            rows.push(row);
          }
        });
        let updated = 0, added = 0;
        if (postRows.size) {
          const all = [...postRows.values()];
          const existing = new Set((await q(db.from('posts').select('id').in('id', all.map((r) => r.id)))).map((r) => r.id));
          const fresh = all.filter((r) => !existing.has(r.id));
          if (fresh.length) await q(db.from('posts').upsert(fresh, { onConflict: 'id', ignoreDuplicates: true }));
          // Saved posts: replace content with the latest version. Keep found_at and dismissed;
          // keep the old post time if Facebook didn't give one this time.
          const old = all.filter((r) => existing.has(r.id)).map(({ found_at, ...r }) => r);
          const withTime = old.filter((r) => r.posted_at);
          const noTime = old.filter((r) => !r.posted_at).map(({ posted_at, ...r }) => r);
          if (withTime.length) await q(db.from('posts').upsert(withTime, { onConflict: 'id' }));
          if (noTime.length) await q(db.from('posts').upsert(noTime, { onConflict: 'id' }));
          updated = old.length;
          added = fresh.length;
        }
        const timed = [...postRows.values()].filter((r) => r.posted_at).length;
        if (statRows.size) await q(db.from('bgg_games').upsert([...statRows.values()], { onConflict: 'bgg_id' }));
        if (rows.length) {
          await q(db.from('matches').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }));
          found += rows.length;
        }
        // Known wishlist hits: latest text/photos too. read, dismissed and found_at are not sent, so they stay.
        if (updMatches.size) await q(db.from('matches').upsert([...updMatches.values()], { onConflict: 'id' }));
        log(`  ${g.name || g.fb_id}: ${res.posts.length} posts (${added} new, ${updated} refreshed), ${rows.length} new matches, ${timed} with post time`);
      }
      await q(db.from('groups').update(patch).eq('id', g.id));
      if (res.error === 'LOGIN') { loggedOut = true; return 'stop'; }
    },
  });

  log(`Scan done: ${posts} posts, ${found} new matches`);
  await q(db.from('posts').delete().lt('found_at', new Date(Date.now() - 30 * 864e5).toISOString())).catch((e) => log(e.message));
  await enrichFromApi(db).catch((e) => log(`BGG API: ${e.message}`));
  await refreshPrices(db).catch((e) => log(`Prices: ${e.message}`));
  await pushStatus({
    state: 'idle', progress: null, fbConnected: !loggedOut,
    lastScanAt: new Date().toISOString(),
    lastSummary: { groups: groups.length, posts, found },
    lastError: loggedOut ? ERRORS.LOGIN : null,
  });
}

// ---------- BGG sync ----------
async function syncBgg(settings) {
  const at = new Date().toISOString();
  let result;
  try {
    if (!settings.bgg_username) throw new Error('Set your BGG username first.');
    log(`BGG sync for ${settings.bgg_username}`);
    const fetched = await fetchWishlist(settings.bgg_username, env.bggToken);
    const existing = await q(db.from('games').select('id,bgg_id,name,source'));

    // Link games you added by hand to their BGG entry instead of duplicating them.
    for (const f of fetched) {
      const manual = existing.find((e) => !e.bgg_id && normalize(e.name) === normalize(f.name));
      if (manual && !existing.some((e) => e.bgg_id === f.bggId)) {
        await q(db.from('games').update({ bgg_id: f.bggId }).eq('id', manual.id));
        manual.bgg_id = f.bggId;
      }
    }
    const known = new Set(existing.map((e) => e.bgg_id).filter(Boolean));
    const rows = fetched.map((f) => ({
      bgg_id: f.bggId, name: f.name, year: f.year, thumbnail: f.thumbnail, priority: f.priority, source: 'bgg',
    }));
    if (rows.length) await q(db.from('games').upsert(rows, { onConflict: 'bgg_id' }));
    const keep = new Set(fetched.map((f) => f.bggId));
    const gone = existing.filter((e) => e.source === 'bgg' && e.bgg_id && !keep.has(e.bgg_id));
    if (gone.length) await q(db.from('games').delete().in('id', gone.map((g) => g.id)));
    const added = fetched.filter((f) => !known.has(f.bggId)).length;
    result = { at, ok: true, message: `Synced ${fetched.length} games (${added} new, ${gone.length} removed).` };
  } catch (e) {
    result = { at, ok: false, message: e.message };
  }
  log(`BGG: ${result.message}`);
  await q(db.from('settings').update({ bgg_sync_result: JSON.stringify(result) }).eq('id', 1));
}

// ---------- main loop ----------
function jittered(minutes) {
  return Math.round(minutes * 60_000 * (0.85 + Math.random() * 0.3));
}

async function tick() {
  const settings = await q(db.from('settings').select('*').eq('id', 1).single());
  const lastBgg = (() => { try { return JSON.parse(settings.bgg_sync_result || '{}').at; } catch { return null; } })();
  if (settings.bgg_sync_requested_at && (!lastBgg || settings.bgg_sync_requested_at > lastBgg)) await syncBgg(settings);

  const now = Date.now();
  const manual = settings.check_requested_at &&
    (!status.lastScanStartedAt || new Date(settings.check_requested_at) > new Date(status.lastScanStartedAt));
  const maxNext = now + settings.interval_minutes * 60_000 * 1.15;
  if (nextScanAt > maxNext) nextScanAt = now + jittered(settings.interval_minutes); // interval was shortened

  const due = !settings.paused && now >= nextScanAt;
  if ((due || manual) && !fs.existsSync(LOGIN_LOCK)) {
    try {
      await runScan(settings);
    } catch (e) {
      log(`Scan failed: ${e.message}`);
      await pushStatus({ state: 'idle', progress: null, lastError: `Scan failed: ${e.message}`, lastScanStartedAt: new Date().toISOString() });
    }
    nextScanAt = Date.now() + jittered(settings.interval_minutes);
    if (ONCE) process.exit(0);
  }
  await pushStatus({ state: 'idle', nextScanAt: settings.paused ? null : new Date(nextScanAt).toISOString() });
}

async function main() {
  ensureSingleInstance();
  log(`Checker started (pid ${process.pid})`);
  await migrate(db).catch((e) => log(e.message));
  const s = await q(db.from('settings').select('checker_status').eq('id', 1).single());
  status = { ...(s.checker_status || {}), state: 'idle', progress: null };
  if (ONCE) nextScanAt = 0;
  for (;;) {
    try {
      await tick();
    } catch (e) {
      log(`Error: ${e.message}`);
    }
    await sleep(TICK_MS);
  }
}

main();
