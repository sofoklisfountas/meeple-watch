// Facebook URL helpers.

const FB = 'https://www.facebook.com';

/** Accepts a group link (any facebook.com variant) or a bare group id/slug. */
export function parseGroupInput(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  let id = null;
  const m = s.match(/facebook\.com\/groups\/([^/?#\s]+)/i);
  if (m) id = m[1];
  else if (/^[\w.-]+$/.test(s) && !/facebook/i.test(s)) id = s;
  if (!id) return null;
  return { fbId: id, url: `${FB}/groups/${id}/` };
}

/** Find the post's own link among the links inside a feed item. */
export function resolvePost(links, groupId) {
  const tryRe = (re, build) => {
    for (const l of links) {
      const m = String(l).match(re);
      if (m) return build(m);
    }
    return null;
  };
  const post = (id, gid = groupId) => ({ key: `post:${id}`, url: `${FB}/groups/${gid}/posts/${id}/` });
  return (
    tryRe(/facebook\.com\/groups\/([^/?#]+)\/(?:posts|permalink)\/(\d+)/, (m) => post(m[2], m[1])) ||
    tryRe(/[?&]multi_permalinks=(\d+)/, (m) => post(m[1])) ||
    tryRe(/[?&]set=(?:pcb|gm)\.(\d+)/, (m) => post(m[1])) ||
    tryRe(/[?&]story_fbid=(\d+)/, (m) => post(m[1])) ||
    tryRe(/\/commerce\/listing\/(\d+)/, (m) => ({ key: `listing:${m[1]}`, url: `${FB}/commerce/listing/${m[1]}/` })) ||
    tryRe(/\/marketplace\/item\/(\d+)/, (m) => ({ key: `listing:${m[1]}`, url: `${FB}/marketplace/item/${m[1]}/` }))
  );
}

/**
 * Real post times from Facebook's own page data (JSON in <script> tags and API responses).
 * Returns { times: { postId: unixSeconds }, listings: { listingId: postId } }.
 * Listings ("for sale" posts) are linked to their post through story_id = base64("S:_I<user>:VK:<postId>").
 * Self-contained on purpose: it is also injected into the Facebook page (scan.js).
 */
export function extractPostTimes(text, out = { times: {}, listings: {} }) {
  const s = String(text || '');
  if (!s.includes('creation_time') && !s.includes('GroupCommerceProductItem')) return out;
  for (const m of s.matchAll(/"post_id":"(\d+)","creation_time":(\d{9,11})/g)) out.times[m[1]] = Number(m[2]);
  for (const m of s.matchAll(/"target":\{"id":"(\d+)","__typename":"GroupCommerceProductItem"/g)) {
    const sid = s.slice(m.index, m.index + 20000).match(/"story_id":"([A-Za-z0-9+/=_-]+)"/);
    if (!sid) continue;
    try {
      const post = atob(sid[1].replace(/-/g, '+').replace(/_/g, '/')).match(/:(\d+)$/);
      if (post) out.listings[m[1]] = post[1];
    } catch {}
  }
  return out;
}

/** The real post time (ISO) for a post key from resolvePost(), or null. */
export function postedAtFor(key, found) {
  if (!key || !found) return null;
  const [kind, id] = String(key).split(':');
  const postId = kind === 'post' ? id : kind === 'listing' ? found.listings[id] : null;
  const t = postId && found.times[postId];
  return t ? new Date(t * 1000).toISOString() : null;
}
