// Shows the original post as a clean list: one row per line, price on the right,
// sold items crossed out, your games highlighted. Fixed rules only (no AI).
import { useState } from 'react';
import { ChevronDown, Heart } from 'lucide-react';
import { cx } from './ui';
import { GameInfo } from './GameInfo';
import type { GameStats, NewPrice } from '../lib/types';
import { saving } from '../../../shared/prices.js';
import { normalize } from '../../../shared/match.js';
import { isBareMode, parseLine } from '../lib/postFormat';

const PREVIEW = 8;

/** Lines of the post body (first line = seller). */
export function splitPost(text: string) {
  const [first = '', ...rest] = text.split('\n').map((l) => l.trim());
  return { author: first, body: rest.filter(Boolean) };
}

export function PostBody({ body, terms, lineGames, stats, priceOf, full }: {
  body: string[];
  /** Show every line (no "N more lines"). */
  full?: boolean;
  terms: string[];
  lineGames?: Record<string, string>;
  stats?: (bggId: string) => GameStats | undefined;
  /** New shop price for a BGG id. */
  priceOf?: (bggId: string) => NewPrice | undefined;
}) {
  const [open, setOpen] = useState(false);
  if (!body.length) return null;
  const bare = isBareMode(body);
  const rows = body.map((l) => {
    const game = lineGames?.[l] ? stats?.(lineGames[l]) : undefined;
    const names = [...terms, ...(game ? [normalize(game.name), normalize(game.name.split(':')[0])] : [])];
    const r = parseLine(l, terms, names, bare);
    const np = lineGames?.[l] ? priceOf?.(lineGames[l]) : undefined;
    return { ...r, game, np: np?.price ? np : undefined, item: !!(r.price || game || r.mine || r.sold) };
  });
  // Collapsed: first lines + any line with your game, so hits are never hidden.
  const long = !full && rows.length > PREVIEW + 2;
  const shown = rows.map((r, i) => ({ r, i })).filter(({ r, i }) => open || !long || i < PREVIEW || r.mine);
  const hidden = rows.length - shown.length;

  return (
    <div className="mt-3">
      <ul className="select-text">
        {shown.map(({ r, i }, k) => {
          const gap = k > 0 && shown[k - 1].i !== i - 1; // lines skipped above
          const name = r.game ? (
            <GameInfo game={r.game} className="decoration-zinc-300 decoration-dotted underline-offset-4 hover:underline dark:decoration-zinc-600">
              {r.text}
            </GameInfo>
          ) : r.text;

          if (!r.item)
            return (
              <li key={i} className={cx('py-1 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400', gap && 'mt-2 border-t border-dashed border-zinc-200 pt-2 dark:border-zinc-800')}>
                {r.text}
              </li>
            );

          return (
            <li
              key={i}
              className={cx(
                'flex items-baseline gap-3 py-1.5 text-[14px]',
                gap && 'mt-2 border-t border-dashed border-zinc-200 pt-2 dark:border-zinc-800',
                r.mine && '-mx-2.5 rounded-lg bg-indigo-50 px-2.5 dark:bg-indigo-500/10',
              )}
            >
              {r.mine && <Heart size={13} className="shrink-0 translate-y-[1px] fill-indigo-500 text-indigo-500" />}
              <span
                className={cx(
                  'min-w-0 flex-1 break-words',
                  r.sold ? 'text-zinc-400 line-through dark:text-zinc-600' : r.mine ? 'font-semibold text-indigo-950 dark:text-indigo-100' : 'text-zinc-800 dark:text-zinc-200',
                )}
              >
                {name}
              </span>
              {r.sold && <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-zinc-400">Sold</span>}
              {(r.price || r.np) && (
                <span className="flex shrink-0 flex-col items-end">
                  {r.price && (
                    <span className={cx('font-semibold tabular-nums', r.sold ? 'text-zinc-300 line-through dark:text-zinc-600' : r.mine ? 'text-indigo-600 dark:text-indigo-300' : 'text-zinc-900 dark:text-zinc-100')}>
                      {r.price}
                    </span>
                  )}
                  {r.np && !r.sold && <NewPriceTag np={r.np} used={r.price} />}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {long && (
        <button
          onClick={() => setOpen(!open)}
          className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {open ? 'Show less' : `${hidden} more line${hidden === 1 ? '' : 's'}`}
          <ChevronDown size={14} className={cx('transition', open && 'rotate-180')} />
        </button>
      )}
    </div>
  );
}

const euro = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')}€`;

/** "new 36€ · −25%" under the used price. Green = good deal, red = dearer than new. */
function NewPriceTag({ np, used }: { np: NewPrice; used: string | null }) {
  const u = used ? Number(used.replace('€', '').replace(',', '.')) : 0;
  const s = saving(u, np.price);
  const pct = s == null ? null : Math.round(s * 100);
  const where = np.country && np.country !== 'GR' ? ` · ${np.country}` : '';
  const tip = `New price: ${euro(np.price!)} at ${np.country === 'GR' ? 'a Greek shop' : `a shop in ${np.country || '?'}`}${np.in_stock ? '' : ' (out of stock)'}, without shipping. From boardgameprices.eu`;
  const Tag = np.url ? 'a' : 'span';
  return (
    <Tag
      {...(np.url ? { href: np.url, target: '_blank', rel: 'noreferrer' } : {})}
      title={tip}
      className="mt-0.5 whitespace-nowrap text-[11px] tabular-nums text-zinc-500 hover:text-zinc-300"
    >
      new {euro(np.price!)}{where}
      {pct != null && pct !== 0 && (
        <span className={cx('ml-1 rounded px-1 py-px font-semibold', pct >= 30 ? 'bg-emerald-500/15 text-emerald-300' : pct > 0 ? 'text-zinc-300' : 'bg-rose-500/15 text-rose-300')}>
          {pct > 0 ? `−${pct}%` : `+${-pct}%`}
        </span>
      )}
    </Tag>
  );
}
