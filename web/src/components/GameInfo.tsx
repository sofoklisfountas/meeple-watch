// BGG stats card. Desktop: shows on hover. Phone: tap opens it as a bottom sheet.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ExternalLink, Star, Trophy, Users, X } from 'lucide-react';
import { cx } from './ui';
import type { GameStats as Game } from '../lib/types';

const canHover = () => window.matchMedia('(hover: hover)').matches;

export function GameInfo({ game, children, className }: { game: Game | undefined; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [sheet, setSheet] = useState(false);
  const timer = useRef<number>(undefined);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => ref.current && setRect(ref.current.getBoundingClientRect()), 250);
  };
  const hide = () => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRect(null), 120);
  };
  useEffect(() => {
    if (!rect) return;
    const close = () => setRect(null);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [rect]);

  if (!game) return <span className={className}>{children}</span>;

  return (
    <>
      <span
        ref={ref}
        className={cx('cursor-help', className)}
        onMouseEnter={() => canHover() && show()}
        onMouseLeave={() => canHover() && hide()}
        onClick={(e) => {
          if (canHover()) return;
          e.stopPropagation();
          setSheet(true);
        }}
      >
        {children}
      </span>

      {rect &&
        createPortal(
          <div
            onMouseEnter={() => clearTimeout(timer.current)}
            onMouseLeave={hide}
            style={position(rect)}
            className="fixed z-[70] w-80 animate-[fadeIn_.12s_ease-out]"
          >
            <StatsCard game={game} />
          </div>,
          document.body,
        )}

      {sheet &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-end bg-zinc-950/40 backdrop-blur-[2px]" onClick={() => setSheet(false)}>
            <div className="w-full pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
              <StatsCard game={game} onClose={() => setSheet(false)} sheet />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function position(r: DOMRect): React.CSSProperties {
  const W = 320, H = 360, gap = 8;
  const left = Math.min(Math.max(8, r.left), window.innerWidth - W - 8);
  const below = r.bottom + gap + H < window.innerHeight;
  return below ? { left, top: r.bottom + gap } : { left, bottom: window.innerHeight - r.top + gap };
}

// ---------- the card ----------

function ratingColor(r: number) {
  if (r >= 8) return 'from-emerald-500 to-emerald-600';
  if (r >= 7) return 'from-green-400 to-green-500';
  if (r >= 6) return 'from-sky-400 to-sky-500';
  if (r >= 5) return 'from-violet-400 to-violet-500';
  return 'from-rose-400 to-rose-500';
}
function weightLabel(w: number) {
  if (w < 1.5) return 'Light';
  if (w < 2.25) return 'Medium-light';
  if (w < 3) return 'Medium';
  if (w < 3.75) return 'Medium-heavy';
  return 'Heavy';
}
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

function StatsCard({ game, onClose, sheet }: { game: Game; onClose?: () => void; sheet?: boolean }) {
  // Database numbers can arrive as text; make sure they're numbers.
  const n = (v: unknown) => (v == null || v === '' ? null : Number(v));
  const g = { ...game, rating: n(game.rating), weight: n(game.weight) };
  const hasStats = g.rating != null || g.weight != null || g.min_players != null;
  const time = g.min_time && g.max_time && g.min_time !== g.max_time ? `${g.min_time}–${g.max_time}` : g.max_time || g.min_time;
  const maxShown = Math.min(Math.max(g.max_players || 0, ...(g.rec_players || []), ...(g.best_players || [])), 8);
  const players = Array.from({ length: maxShown }, (_, i) => i + 1).filter((n) => !g.min_players || n >= g.min_players);

  return (
    <div className={cx('overflow-hidden bg-white shadow-2xl ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800', sheet ? 'rounded-t-2xl' : 'rounded-2xl')}>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-snug">{g.name}</div>
          {g.year && <div className="text-xs text-zinc-500">{g.year}</div>}
        </div>
        {g.bgg_rank && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
            <Trophy size={12} /> #{g.bgg_rank.toLocaleString()}
          </span>
        )}
        {onClose && (
          <button onClick={onClose} className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
            <X size={16} />
          </button>
        )}
      </div>

      {!hasStats ? (
        <p className="px-4 pb-4 text-sm text-zinc-500">No BGG data for this game yet.</p>
      ) : (
        <>
          {/* Big numbers */}
          <div className="grid grid-cols-3 gap-2 px-4">
            <Tile label="Rating">
              {g.rating != null ? (
                <div className={cx('grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-b text-[15px] font-bold text-white shadow-sm', ratingColor(g.rating))}>
                  {g.rating.toFixed(1)}
                </div>
              ) : '—'}
            </Tile>
            <Tile label={g.weight != null ? weightLabel(g.weight) : 'Votes'}>
              {g.weight != null ? (
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[15px] font-bold tabular-nums">{g.weight.toFixed(1)}<span className="text-xs font-medium text-zinc-400">/5</span></span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i} className={cx('h-1.5 w-3.5 rounded-full', g.weight! >= i - 0.5 ? 'bg-indigo-500' : 'bg-zinc-200 dark:bg-zinc-700')} />
                    ))}
                  </div>
                </div>
              ) : (
                <span className="text-[15px] font-bold tabular-nums">{g.votes != null ? compact(g.votes) : '—'}</span>
              )}
            </Tile>
            <Tile label="Minutes">
              <span className="flex items-center gap-1 text-[15px] font-bold tabular-nums">
                <Clock size={14} className="text-zinc-400" /> {time || '—'}
              </span>
            </Tile>
          </div>
          {g.weight == null && !players.length && (
            <p className="mt-3 px-4 text-[11px] text-zinc-400">Complexity and player counts appear once a BGG API token is added.</p>
          )}

          {/* Players */}
          {players.length > 0 && (
            <div className="mt-3 px-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                <Users size={13} /> Players
                <span className="ml-auto font-normal">{g.min_players === g.max_players ? g.min_players : `${g.min_players}–${g.max_players}`}{(g.max_players || 0) > 8 ? '+' : ''}</span>
              </div>
              <div className="flex gap-1">
                {players.map((n) => {
                  const best = g.best_players?.includes(n);
                  const rec = g.rec_players?.includes(n);
                  return (
                    <span
                      key={n}
                      className={cx(
                        'relative grid h-9 flex-1 place-items-center rounded-lg text-sm font-semibold tabular-nums',
                        best ? 'bg-indigo-600 text-accent-fg shadow-sm' : rec ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-900' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800',
                      )}
                    >
                      {n}
                      {best && <Star size={9} className="absolute right-1 top-1 fill-current" />}
                    </span>
                  );
                })}
              </div>
              <div className="mt-1.5 flex gap-3 text-[11px] text-zinc-500">
                <Legend className="bg-indigo-600" text="Best" />
                <Legend className="bg-indigo-100 ring-1 ring-indigo-300 dark:bg-indigo-900" text="Recommended" />
                <Legend className="bg-zinc-200 dark:bg-zinc-700" text="Possible" />
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center gap-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/30">
        {g.owned != null && <span>Owned by <b className="font-semibold text-zinc-700 dark:text-zinc-300">{compact(g.owned)}</b></span>}
        {g.votes != null && g.weight != null && <span><b className="font-semibold text-zinc-700 dark:text-zinc-300">{compact(g.votes)}</b> votes</span>}
        {g.bgg_id && (
          <a href={`https://boardgamegeek.com/boardgame/${g.bgg_id}`} target="_blank" rel="noopener" className="ml-auto flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            BGG <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-[88px] flex-col items-center justify-between rounded-xl bg-zinc-50 px-2 py-2.5 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-800">
      <div className="flex flex-1 items-center">{children}</div>
      <div className="text-[11px] font-medium text-zinc-500">{label}</div>
    </div>
  );
}

function Legend({ className, text }: { className: string; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cx('h-2 w-2 rounded-sm', className)} /> {text}
    </span>
  );
}
