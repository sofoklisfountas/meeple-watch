import { XMLParser } from 'fast-xml-parser';
import { sleep } from './config.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
  isArray: (name) => name === 'item' || name === 'error',
});

export function parseCollectionXml(xml) {
  const doc = parser.parse(xml);
  if (doc.errors) throw new Error(`BGG: ${doc.errors.error?.[0]?.message || 'unknown error'}`);
  const items = doc.items?.item || [];
  return items
    .map((it) => {
      let thumb = it.thumbnail ? String(it.thumbnail).trim() : null;
      if (thumb?.startsWith('//')) thumb = 'https:' + thumb;
      return {
        bggId: String(it.objectid),
        name: String(typeof it.name === 'object' ? it.name.text : it.name ?? '').trim(),
        year: it.yearpublished ? String(it.yearpublished) : null,
        thumbnail: thumb,
        priority: Number(it.status?.wishlistpriority) || null,
      };
    })
    .filter((g) => g.name);
}

async function fetchCollection(url, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 202 || res.status === 429 || res.status >= 500) {
      await sleep(Math.min(2500 * (attempt + 1), 10_000)); // BGG is preparing the data
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('BGG needs an API token. Add BGG_TOKEN to checker/.env, or import a CSV instead.');
    }
    if (!res.ok) throw new Error(`BGG returned HTTP ${res.status}`);
    return parseCollectionXml(await res.text());
  }
  throw new Error('BGG is busy. Try again in a minute.');
}

// ---------- game details (/thing) ----------

const thingParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  isArray: (name, _path, _leaf, isAttribute) => !isAttribute && ['item', 'name', 'poll', 'results', 'result', 'rank', 'link'].includes(name),
});

const val = (x) => (x && x.value !== undefined ? x.value : undefined);
const int = (x) => (Number.isFinite(Number(val(x))) && Number(val(x)) > 0 ? Math.round(Number(val(x))) : null);

/** Parse /xmlapi2/thing?stats=1 into bgg_games rows. */
export function parseThingXml(xml) {
  const doc = thingParser.parse(xml);
  return (doc.items?.item || []).map((it) => {
    const r = it.statistics?.ratings || {};
    const rank = (r.ranks?.rank || []).find((k) => k.name === 'boardgame');
    const { best, rec } = playerPoll(it.poll?.find((p) => p.name === 'suggested_numplayers'));
    const avg = Number(val(r.average));
    const w = Number(val(r.averageweight));
    return {
      bgg_id: String(it.id),
      name: it.name?.find((n) => n.type === 'primary')?.value ?? it.name?.[0]?.value,
      year: val(it.yearpublished) && String(val(it.yearpublished)) !== '0' ? String(val(it.yearpublished)) : null,
      bgg_rank: rank && Number(rank.value) ? Number(rank.value) : null,
      rating: avg ? Math.round(avg * 100) / 100 : null,
      votes: int(r.usersrated),
      weight: w ? Math.round(w * 100) / 100 : null,
      min_players: int(it.minplayers),
      max_players: int(it.maxplayers),
      best_players: best,
      rec_players: rec,
      min_time: int(it.minplaytime) ?? int(it.playingtime),
      max_time: int(it.maxplaytime) ?? int(it.playingtime),
      owned: int(r.owned),
      api_updated_at: new Date().toISOString(),
    };
  });
}

/** From the community poll: best = top "Best" vote counts; recommended = Best+Recommended beat Not Recommended. */
export function playerPoll(poll) {
  const counts = (poll?.results || [])
    .filter((r) => /^\d+$/.test(String(r.numplayers)))
    .map((r) => {
      const v = (name) => Number(r.result?.find((x) => x.value === name)?.numvotes || 0);
      return { n: Number(r.numplayers), best: v('Best'), rec: v('Recommended'), not: v('Not Recommended') };
    })
    .filter((c) => c.best + c.rec + c.not > 0);
  const top = Math.max(0, ...counts.map((c) => c.best));
  return {
    best: top ? counts.filter((c) => c.best >= top * 0.9 && c.best > c.not).map((c) => c.n) : [],
    rec: counts.filter((c) => c.best + c.rec > c.not).map((c) => c.n),
  };
}

export async function fetchThings(ids, token) {
  const url = `https://boardgamegeek.com/xmlapi2/thing?stats=1&id=${ids.join(',')}`;
  const headers = { Authorization: `Bearer ${token}` };
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 202 || res.status === 429 || res.status >= 500) { await sleep(3000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`BGG returned HTTP ${res.status}`);
    return parseThingXml(await res.text());
  }
  throw new Error('BGG is busy');
}

/** Every game in your BGG collection, whatever its status (wishlist, want to buy/play, own...). */
export async function fetchWishlist(username, token) {
  const all = new Map();
  const base = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}`;
  for (const subtype of ['boardgame', 'boardgameexpansion']) {
    for (const g of await fetchCollection(`${base}&subtype=${subtype}`, token)) all.set(g.bggId, g);
  }
  return [...all.values()];
}
