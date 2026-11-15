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
