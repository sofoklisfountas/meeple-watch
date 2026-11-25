import type { FeedPost, Match } from './types';

export const FEED_DAYS = 7;

/** One card per Facebook post: every post seen, plus the wishlist games it mentions (if any). */
export interface Post {
  key: string;
  /** Groups this ad appears in (cross-posted copies are one card). */
  groups: { name: string | null; url: string; exactLink: boolean }[];
  /** All saved copies of this post (same post seen as "post" and "listing"). */
  keys: string[];
  url: string;
  exactLink: boolean;
  groupName: string | null;
  text: string | null;
  images: string[];
  lineGames: Record<string, string>;
  matches: Match[];
  /** Match ids (for read / dismiss). */
  ids: string[];
  /** Only wishlist hits can be unread. */
  read: boolean;
  foundAt: string;
  /** When it was posted on Facebook (null = unknown, then foundAt is used). */
  postedAt: string | null;
  /** Time to show and sort by: posted time, else first-seen time. */
  time: string;
}

const keyOf = (m: Match) => m.id.split('|')[0];

/** All posts from the last week, newest first by their real Facebook post time. */
export function buildFeed(posts: FeedPost[], matches: Match[], days = FEED_DAYS): Post[] {
  const byKey = new Map<string, Match[]>();
  for (const m of matches) byKey.set(keyOf(m), [...(byKey.get(keyOf(m)) || []), m]);

  const out = new Map<string, Post>();
  for (const p of posts) {
    const ms = byKey.get(p.id) || [];
    out.set(p.id, {
      key: p.id, keys: [p.id], groups: [{ name: p.group_name, url: p.url, exactLink: p.exact_link }], url: p.url, exactLink: p.exact_link, groupName: p.group_name, text: p.post_text,
      images: p.images || [], lineGames: p.line_games || {}, matches: ms, ids: ms.map((m) => m.id),
      read: ms.every((m) => m.read),
      // A wishlist hit may be older than the post row (saved before all posts were kept).
      foundAt: [p.found_at, ...ms.map((m) => m.found_at)].sort()[0],
      postedAt: p.posted_at ?? null,
      time: '',
    });
  }
  // Wishlist hits whose post isn't in the posts table.
  for (const [key, ms] of byKey) {
    if (out.has(key)) continue;
    const first = ms.find((m) => m.post_text) || ms[0];
    out.set(key, {
      key, keys: [key], groups: [{ name: first.group_name, url: first.url, exactLink: first.exact_link }], url: first.url, exactLink: first.exact_link, groupName: first.group_name,
      text: first.post_text ?? (ms.some((m) => m.snippet) ? `\n${ms.map((m) => m.snippet).filter(Boolean).join('\n')}` : null),
      images: first.images || [], lineGames: first.line_games || {}, matches: ms, ids: ms.map((m) => m.id),
      read: ms.every((m) => m.read), foundAt: ms.map((m) => m.found_at).sort()[0], postedAt: null, time: '',
    });
  }
  const since = Date.now() - days * 864e5;
  const ms = (iso: string) => new Date(iso).getTime();
  return mergeCopies([...out.values()])
    .map((p) => ({ ...p, time: p.postedAt || p.foundAt }))
    .filter((p) => ms(p.time) >= since)
    // Real post time first (Facebook's order). Posts with unknown time go last: they are older
    // posts we only saw once, so their first-seen time says nothing about when they were posted.
    .sort((a, b) => Number(!a.postedAt) - Number(!b.postedAt) || ms(b.time) - ms(a.time));
}

/** Facebook photo file name ("925846404_3300139220177911_..._n.jpg"): same file = same uploaded photo. */
const photoId = (url: string) => (url.match(/\/([^/?]+\.(?:jpe?g|png|webp))/i) || [])[1] || null;

/**
 * One card per ad. Copies = the same post saved twice ("post" + "listing" key) or cross-posted to
 * several groups. Two posts are copies when they have the same seller AND share a photo (Facebook
 * reuses the uploaded files, so this survives badges, comments, SOLD marks and cut-off text),
 * or, for posts without photos, the same text signature.
 */
export function mergeCopies(posts: Post[]): Post[] {
  const parent = posts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const seen = new Map<string, number>();
  const link = (key: string, i: number) => {
    const j = seen.get(key);
    if (j === undefined) seen.set(key, i);
    else parent[find(i)] = find(j);
  };
  posts.forEach((p, i) => {
    const seller = (p.text || '').split('\n')[0].trim().toLowerCase();
    for (const id of new Set(p.images.map(photoId))) if (id && seller) link(`img|${seller}|${id}`, i);
    const sig = adSignature(p.text);
    if (sig.length >= 40) link(`txt|${sig}`, i);
  });
  const sets = new Map<number, Post[]>();
  posts.forEach((p, i) => sets.set(find(i), [...(sets.get(find(i)) || []), p]));

  return [...sets.values()].map((copies) => {
    if (copies.length === 1) return copies[0];
    // Show the copy with most wishlist hits, then the cleanest text (shortest: no comments appended).
    const [keep] = [...copies].sort((a, b) => b.matches.length - a.matches.length || (a.text || '').length - (b.text || '').length);
    const games = new Set<string | null>();
    const matches = copies.flatMap((c) => c.matches).filter((m) => !games.has(m.game_id) && !!games.add(m.game_id));
    const groups: Post['groups'] = [];
    for (const g of copies.flatMap((c) => c.groups)) if (!groups.some((x) => x.name === g.name)) groups.push(g);
    return {
      ...keep,
      keys: copies.flatMap((c) => c.keys),
      groups,
      matches,
      ids: copies.flatMap((c) => c.ids),
      read: copies.every((c) => c.read),
      images: keep.images.length ? keep.images : copies.find((c) => c.images.length)?.images || [],
      lineGames: Object.assign({}, ...copies.map((c) => c.lineGames)),
      foundAt: copies.map((c) => c.foundAt).sort()[0],
      postedAt: copies.map((c) => c.postedAt).filter(Boolean).sort()[0] ?? null,
    };
  });
}

/**
 * Same ad = same seller + same start of the item lines, in any group. Comments at the end may differ,
 * and Facebook adds per-group badge lines under the name ("Top voice", "Admin", "Rising contributor"),
 * so short lines without numbers (1–3 words) are ignored.
 */
export function adSignature(text: string | null): string {
  const lines = (text || '').toLowerCase()
    .replace(/\b(see less|see more)\b/g, '')
    // A copy may be marked sold in one group only.
    .replace(/[([]?\s*(sold|reserved|πουλ[ηή]θηκε|πωλ[ηή]θηκε|κρατημένο)\s*[)\]]?/gu, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const [seller = '', ...rest] = lines;
  const body = rest.filter((l) => /\d/.test(l) || l.split(' ').length > 3).join(' ');
  return `${seller} ${body}`.slice(0, 200).trim();
}

/** "Today", "Yesterday", "Thursday 12 Nov". */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}
