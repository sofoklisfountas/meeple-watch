import type { FeedPost, Match } from './types';

export const FEED_DAYS = 7;

/** One card per Facebook post: every post seen, plus the wishlist games it mentions (if any). */
export interface Post {
  key: string;
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
      key: p.id, keys: [p.id], url: p.url, exactLink: p.exact_link, groupName: p.group_name, text: p.post_text,
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
      key, keys: [key], url: first.url, exactLink: first.exact_link, groupName: first.group_name,
      text: first.post_text ?? (ms.some((m) => m.snippet) ? `\n${ms.map((m) => m.snippet).filter(Boolean).join('\n')}` : null),
      images: first.images || [], lineGames: first.line_games || {}, matches: ms, ids: ms.map((m) => m.id),
      read: ms.every((m) => m.read), foundAt: ms.map((m) => m.found_at).sort()[0], postedAt: null, time: '',
    });
  }
  // Facebook shows the same post as a "post" and as a "listing" (different keys, same text): one card.
  const byText = new Map<string, Post>();
  for (const p of out.values()) {
    const t = (p.text || '').replace(/\s+/g, ' ').trim();
    if (t.length < 20) { byText.set(p.key, p); continue; }
    const k = `${p.groupName}|${t}`;
    const prev = byText.get(k);
    if (!prev) { byText.set(k, p); continue; }
    const [keep, drop] = prev.matches.length >= p.matches.length ? [prev, p] : [p, prev];
    const names = new Set(keep.matches.map((m) => m.game_id));
    const extra = drop.matches.filter((m) => !names.has(m.game_id));
    byText.set(k, {
      ...keep,
      keys: [...keep.keys, ...drop.keys],
      matches: [...keep.matches, ...extra], ids: [...keep.ids, ...drop.ids],
      read: keep.read && drop.read,
      images: keep.images.length ? keep.images : drop.images,
      lineGames: { ...drop.lineGames, ...keep.lineGames },
      foundAt: [keep.foundAt, drop.foundAt].sort()[0],
      postedAt: [keep.postedAt, drop.postedAt].filter(Boolean).sort()[0] ?? null,
    });
  }
  const since = Date.now() - days * 864e5;
  const ms = (iso: string) => new Date(iso).getTime();
  return [...byText.values()]
    .map((p) => ({ ...p, time: p.postedAt || p.foundAt }))
    .filter((p) => ms(p.time) >= since)
    // Real post time first (Facebook's order). Posts with unknown time go last: they are older
    // posts we only saw once, so their first-seen time says nothing about when they were posted.
    .sort((a, b) => Number(!a.postedAt) - Number(!b.postedAt) || ms(b.time) - ms(a.time));
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
