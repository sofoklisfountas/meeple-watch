import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BellRing, Check, CheckCheck, Heart, Monitor, Users, X } from 'lucide-react';
import { GameInfo } from '../components/GameInfo';
import { Button, Card, Empty, PageHeader, Segmented, cx } from '../components/ui';
import { backend } from '../lib/backend';
import { checkerView } from '../lib/status';
import { timeAgo } from '../lib/time';
import { buildFeed, dayLabel, FEED_DAYS, type Post } from '../lib/posts';
import { mergeStats, type Data, type NewPrice } from '../lib/types';
import type { Run } from '../lib/useData';
import type { Page } from '../App';
import { PostBody, splitPost } from '../components/PostBody';
import { Photos } from '../components/Photos';
import { normalize, termsFor } from '../../../shared/match.js';

export function Matches({ data, run, go }: { data: Data; run: Run; go: (p: Page) => void }) {
  const posts = useMemo(() => buildFeed(data.posts, data.matches), [data.posts, data.matches]);
  const hits = posts.filter((p) => p.matches.length);
  const unread = hits.filter((p) => !p.read);
  const [filter, setFilter] = useState<'all' | 'wishlist'>('all');
  const list = filter === 'wishlist' ? hits : posts;
  const online = checkerView(data.settings).online;
  const needsSetup = !data.groups.length || !data.games.length || !data.settings.checker_status?.lastScanAt;
  const mobile = useMobile();

  // Group the feed by day: Today, Yesterday, ...
  const days = useMemo(() => {
    const out: { label: string; posts: Post[] }[] = [];
    for (const p of list) {
      const label = p.postedAt ? dayLabel(p.postedAt) : 'Time unknown';
      if (out.at(-1)?.label === label) out.at(-1)!.posts.push(p);
      else out.push({ label, posts: [p] });
    }
    return out;
  }, [list]);

  // Every name of every matched game in the post, so all of them get highlighted.
  const termsOf = (p: Post): string[] =>
    p.matches.flatMap((m) => {
      const g = data.games.find((x) => x.id === m.game_id);
      return g ? termsFor(g) : [normalize(m.game_name)];
    });
  const wishStats = (gameId: string | null) => {
    const g = data.games.find((x) => x.id === gameId);
    return g && mergeStats(data.bgg[g.bgg_id || ''], g);
  };
  const statsOf = (bggId: string) => {
    const g = data.games.find((x) => x.bgg_id === bggId);
    return g ? mergeStats(data.bgg[bggId], g) : data.bgg[bggId];
  };

  const priceOf = (bggId: string) => data.prices?.[bggId];

  const markRead = (ids: string[]) =>
    run(() => backend.update('matches', ids, { read: true }), (d) => ({
      ...d, matches: d.matches.map((m) => (ids.includes(m.id) ? { ...m, read: true } : m)),
    }));

  const open = (p: Post) => {
    window.open(p.url, '_blank', 'noopener');
    if (!p.read) markRead(p.ids);
  };

  const dismiss = (p: Post) =>
    run(
      async () => {
        await backend.update('posts', p.keys, { dismissed: true });
        if (p.ids.length) await backend.update('matches', p.ids, { dismissed: true });
      },
      (d) => ({ ...d, posts: d.posts.filter((x) => !p.keys.includes(x.id)), matches: d.matches.filter((x) => !p.ids.includes(x.id)) }),
    );

  const card = (p: Post, reel = false) => (
    <PostCard
      key={p.key}
      p={p}
      reel={reel}
      terms={termsOf(p)}
      wishStats={wishStats}
      statsOf={statsOf}
      priceOf={priceOf}
      onOpen={() => open(p)}
      onRead={() => markRead(p.ids)}
      onDismiss={() => dismiss(p)}
    />
  );

  // Phone: reels-style feed, one post per screen.
  if (mobile && !needsSetup && posts.length > 0)
    return (
      <Reels>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-zinc-950 via-zinc-950/80 to-transparent px-4 pb-4 pt-2">
          <div className="pointer-events-auto">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `All ${posts.length}` },
                { value: 'wishlist', label: `Wishlist ${hits.length}` },
              ]}
            />
          </div>
          {unread.length > 0 && (
            <button onClick={() => markRead(unread.flatMap((p) => p.ids))} className="pointer-events-auto inline-flex items-center gap-1 text-[13px] font-medium text-zinc-400">
              <CheckCheck size={15} /> Read all
            </button>
          )}
        </div>
        {list.length === 0 ? (
          <div className="grid h-full snap-start place-items-center px-8 text-center text-sm text-zinc-500">No wishlist games this week.</div>
        ) : (
          list.map((p) => (
            <div key={p.key} className="h-full snap-start snap-always">
              {card(p, true)}
            </div>
          ))
        )}
      </Reels>
    );

  return (
    <>
      <PageHeader
        title="Posts"
        subtitle={`Last ${FEED_DAYS} days · newest first`}
        actions={
          posts.length > 0 && (
            <>
              {unread.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => markRead(unread.flatMap((p) => p.ids))}>
                  <CheckCheck size={16} /> Mark read
                </Button>
              )}
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: `All ${posts.length}` },
                  { value: 'wishlist', label: `Wishlist ${hits.length}` },
                ]}
              />
            </>
          )
        }
      />

      {needsSetup && (
        <Card className="mb-6 p-5">
          <h3 className="font-semibold">Get started</h3>
          <div className="mt-3 space-y-1">
            <Step done={data.groups.length > 0} icon={<Users size={16} />} text="Add your Facebook groups" onClick={() => go('groups')} />
            <Step done={data.games.length > 0} icon={<Heart size={16} />} text="Add your wishlist games" onClick={() => go('wishlist')} />
            <Step done={online} icon={<Monitor size={16} />} text="Start the checker on your PC" onClick={() => go('settings')} />
          </div>
        </Card>
      )}

      {list.length === 0 ? (
        <Card>
          <Empty
            icon={<BellRing size={22} />}
            title={filter === 'wishlist' ? 'No wishlist games this week' : 'No posts yet'}
            text={filter === 'wishlist' ? 'Posts with your games show up here.' : 'Posts from your groups show up here after the next check.'}
            action={filter === 'wishlist' && posts.length > 0 && <Button size="sm" onClick={() => setFilter('all')}>Show all posts</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {days.map((day) => (
            <section key={day.label}>
              <h2 className="sticky top-[calc(env(safe-area-inset-top)+3.25rem)] z-10 -mx-1 mb-3 bg-zinc-50/90 px-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 backdrop-blur md:top-0 dark:bg-zinc-950/90 dark:text-zinc-500">
                {day.label} <span className="font-normal normal-case tracking-normal">· {day.posts.length}</span>
              </h2>
              <div className="space-y-4">
                {day.posts.map((p) => card(p))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/** Phone only: fills the space between the top bar and the tab bar; posts snap one per screen. */
function Reels({ children }: { children: React.ReactNode }) {
  const [box, setBox] = useState({ top: 0, bottom: 0 });
  useEffect(() => {
    const measure = () =>
      setBox({
        top: document.getElementById('mw-topbar')?.getBoundingClientRect().bottom ?? 0,
        bottom: document.getElementById('mw-tabbar')?.offsetHeight ?? 0,
      });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return (
    <div className="fixed inset-x-0 z-20 bg-zinc-950" style={{ top: box.top, bottom: box.bottom }}>
      <div className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
    </div>
  );
}

function useMobile() {
  const q = '(max-width: 767px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

function PostCard({ p, reel, terms, wishStats, statsOf, priceOf, onOpen, onRead, onDismiss }: {
  p: Post;
  reel?: boolean;
  terms: string[];
  wishStats: (gameId: string | null) => ReturnType<typeof mergeStats>;
  statsOf: (bggId: string) => ReturnType<typeof mergeStats>;
  priceOf: (bggId: string) => NewPrice | undefined;
  onOpen: () => void;
  onRead: () => void;
  onDismiss: () => void;
}) {
  const { author, body } = splitPost(p.text || '');
  const hit = p.matches.length > 0;
  const unread = hit && !p.read;

  return (
    <article
      className={cx(
        reel
          ? 'flex h-full flex-col px-4 pb-3 pt-14'
          : 'group/card relative rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 transition sm:p-5 dark:bg-zinc-900',
        !reel && (hit ? 'ring-indigo-200 dark:ring-indigo-500/30' : 'ring-zinc-200/70 dark:ring-zinc-800'),
      )}
    >
      {/* Header */}
      <header className="flex items-center gap-3">
        <Avatar name={author || p.groupName || '?'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold">{author || 'Facebook post'}</span>
            {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" title="New" />}
          </div>
          <div className="truncate text-xs text-zinc-500">{p.groupName} · <span title={new Date(p.time).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}>{p.postedAt ? timeAgo(p.postedAt) : `seen ${timeAgo(p.foundAt)}`}</span></div>
        </div>
        <button
          onClick={onDismiss}
          title="Hide post"
          aria-label="Hide post"
          className="-mr-1 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 md:opacity-0 md:group-hover/card:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X size={16} />
        </button>
      </header>

      {/* Your wishlist games */}
      {hit && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.matches.map((m) => (
            <GameInfo key={m.id} game={wishStats(m.game_id)}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 py-1 pl-2 pr-2.5 text-xs font-semibold text-accent-fg shadow-sm">
                <Heart size={11} className="fill-current" /> {m.game_name}
              </span>
            </GameInfo>
          ))}
        </div>
      )}

      <Photos images={p.images} fill={reel} />

      {reel ? (
        // Text scrolls inside the post; at its end the swipe moves to the next post.
        <div className={cx('-mx-2.5 min-h-0 overflow-y-auto px-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', p.images.length ? 'max-h-[42%] shrink-0' : 'flex-1')}>
          <PostBody body={body} terms={terms} lineGames={p.lineGames} stats={statsOf} priceOf={priceOf} full />
        </div>
      ) : (
        <PostBody body={body} terms={terms} lineGames={p.lineGames} stats={statsOf} priceOf={priceOf} />
      )}

      {/* Footer */}
      <footer className={cx('flex items-center gap-1 border-t border-zinc-100 dark:border-zinc-800', reel ? 'mt-2 shrink-0 pt-2' : 'mt-4 pt-3')}>
        <button
          onClick={onOpen}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 -ml-2 text-[13px] font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
        >
          {p.exactLink ? 'Open post' : 'Open group'} <ArrowUpRight size={15} />
        </button>
        {unread && (
          <button onClick={onRead} className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
            <Check size={15} /> Mark read
          </button>
        )}
      </footer>
    </article>
  );
}

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
];

function Avatar({ name }: { name: string }) {
  const initials = name.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const color = AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return <div className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold', color)}>{initials || '?'}</div>;
}

function Step({ done, icon, text, onClick }: { done: boolean; icon: React.ReactNode; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
      <span className={cx('grid h-7 w-7 place-items-center rounded-full', done ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800')}>
        {done ? <Check size={15} /> : icon}
      </span>
      <span className={cx(done && 'text-zinc-400 line-through')}>{text}</span>
    </button>
  );
}
