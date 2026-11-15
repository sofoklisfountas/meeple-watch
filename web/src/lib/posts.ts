import type { FeedPost, Match } from './types';

export const FEED_DAYS = 7;

/** One card per Facebook post: every post seen, plus the wishlist games it mentions (if any). */
export interface Post {
  key: string;
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
}

const keyOf = (m: Match) => m.id.split('|')[0];

/** All posts from the last week, newest first. */
export function buildFeed(posts: FeedPost[], matches: Match[], days = FEED_DAYS): Post[] {
  const byKey = new Map<string, Match[]>();
  for (const m of matches) byKey.set(keyOf(m), [...(byKey.get(keyOf(m)) || []), m]);

  const out = new Map<string, Post>();
  for (const p of posts) {
    const ms = byKey.get(p.id) || [];
    out.set(p.id, {
      key: p.id, url: p.url, exactLink: p.exact_link, groupName: p.group_name, text: p.post_text,
      images: p.images || [], lineGames: p.line_games || {}, matches: ms, ids: ms.map((m) => m.id),
      read: ms.every((m) => m.read),
      // A wishlist hit may be older than the post row (saved before all posts were kept).
      foundAt: [p.found_at, ...ms.map((m) => m.found_at)].sort()[0],
    });
  }
  // Wishlist hits whose post isn't in the posts table.
  for (const [key, ms] of byKey) {
    if (out.has(key)) continue;
    const first = ms.find((m) => m.post_text) || ms[0];
    out.set(key, {
      key, url: first.url, exactLink: first.exact_link, groupName: first.group_name,
      text: first.post_text ?? (ms.some((m) => m.snippet) ? `\n${ms.map((m) => m.snippet).filter(Boolean).join('\n')}` : null),
      images: first.images || [], lineGames: first.line_games || {}, matches: ms, ids: ms.map((m) => m.id),
      read: ms.every((m) => m.read), foundAt: ms.map((m) => m.found_at).sort()[0],
    });
  }
  const since = new Date(Date.now() - days * 864e5).toISOString();
  return [...out.values()].filter((p) => p.foundAt >= since).sort((a, b) => b.foundAt.localeCompare(a.foundAt));
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
