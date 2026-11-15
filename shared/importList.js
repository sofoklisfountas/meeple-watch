// Parse a BGG collection CSV export, or a plain list (one game per line).

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Returns [{ name, bggId?, year?, priority? }]. Skips "Don't buy this" (priority 5). */
export function parseImportFile(text) {
  text = String(text).replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0].toLowerCase();
  if (firstLine.includes('objectname')) {
    const rows = parseCsv(text);
    const h = rows[0].map((x) => x.trim().toLowerCase());
    const col = (n) => h.indexOf(n);
    const [name, id, wl, pr, yr] = ['objectname', 'objectid', 'wishlist', 'wishlistpriority', 'yearpublished'].map(col);
    const hasStats = col('average') >= 0;
    const num = (r, c, round = false) => {
      const v = Number(r[col(c)]);
      return Number.isFinite(v) && v > 0 ? (round ? Math.round(v) : v) : null;
    };
    const list = (r, c) => [...String(r[col(c)] ?? '').matchAll(/\d+/g)].map((m) => Number(m[0]));
    return rows
      .slice(1)
      .filter((r) => r[name]?.trim() && (wl < 0 || r[wl] === '1') && (pr < 0 || r[pr] !== '5'))
      .map((r) => ({
        name: r[name].trim(),
        bggId: id >= 0 && r[id] ? r[id].trim() : null,
        year: yr >= 0 && r[yr] && r[yr] !== '0' ? r[yr].trim() : null,
        priority: pr >= 0 ? Number(r[pr]) || null : null,
        ...(hasStats && {
          stats: {
            rating: num(r, 'average') && Math.round(num(r, 'average') * 100) / 100,
            weight: num(r, 'avgweight') && Math.round(num(r, 'avgweight') * 100) / 100,
            bgg_rank: num(r, 'rank', true),
            min_players: num(r, 'minplayers', true),
            max_players: num(r, 'maxplayers', true),
            best_players: list(r, 'bggbestplayers'),
            rec_players: list(r, 'bggrecplayers'),
            min_time: num(r, 'minplaytime', true) ?? num(r, 'playingtime', true),
            max_time: num(r, 'maxplaytime', true) ?? num(r, 'playingtime', true),
            owned: num(r, 'numowned', true),
          },
        }),
      }));
  }
  return text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^["']|["']$/g, '').trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

export const PRIORITY_LABEL = { 1: 'Must have', 2: 'Love to have', 3: 'Like to have', 4: 'Thinking about it' };
