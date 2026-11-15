import { useMemo, useRef, useState } from 'react';
import { FileUp, Heart, Info, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { GameInfo } from '../components/GameInfo';
import { Button, Card, Dialog, Empty, Input, PageHeader, Switch, Thumb, cx, toast } from '../components/ui';
import { backend } from '../lib/backend';
import { checkerView } from '../lib/status';
import { timeAgo } from '../lib/time';
import { mergeStats, type Data, type Game } from '../lib/types';
import type { Run } from '../lib/useData';
import { normalize } from '../../../shared/match.js';
import { parseImportFile, PRIORITY_LABEL } from '../../../shared/importList.js';

type Item = { name: string; bggId?: string | null; year?: string | null; priority?: number | null; stats?: Partial<Game> };

export function Wishlist({ data, run }: { data: Data; run: Run }) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<Game | null>(null);

  const games = useMemo(() => {
    const q = normalize(query);
    return data.games
      .filter((g) => !q || normalize([g.name, ...g.aliases].join(' ')).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.games, query]);
  const watching = data.games.filter((g) => g.enabled).length;

  const patch = (g: Game, p: Partial<Game>) =>
    run(() => backend.update('games', [g.id], p), (d) => ({ ...d, games: d.games.map((x) => (x.id === g.id ? { ...x, ...p } : x)) }));
  const remove = (g: Game) =>
    run(() => backend.remove('games', [g.id]), (d) => ({ ...d, games: d.games.filter((x) => x.id !== g.id) }));

  return (
    <>
      <PageHeader
        title="Wishlist"
        subtitle={data.games.length ? `Watching ${watching} of ${data.games.length} games` : 'Games to look for.'}
        actions={
          <>
            <Button size="sm" onClick={() => setSyncing(true)}><RefreshCw size={15} /> BGG sync</Button>
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}><Plus size={16} /> Add games</Button>
          </>
        }
      />

      {data.games.length > 6 && (
        <div className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input className="pl-9" placeholder="Search games" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}

      <Card>
        {data.games.length === 0 ? (
          <Empty
            icon={<Heart size={22} />}
            title="No games yet"
            text="Sync your BoardGameGeek wishlist, import a file, or type game names."
            action={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} /> Add games</Button>}
          />
        ) : games.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500">No games match “{query}”.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {games.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setEditing(g)} title="Edit" className={cx('flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left', !g.enabled && 'opacity-50')}>
                <Thumb src={g.thumbnail} name={g.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {g.name} {g.year && <span className="font-normal text-zinc-400">({g.year})</span>}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {[g.priority && PRIORITY_LABEL[g.priority as keyof typeof PRIORITY_LABEL], g.aliases.length > 0 && `Also: ${g.aliases.join(', ')}`]
                      .filter(Boolean).join(' · ') || (g.source === 'bgg' ? 'From BGG' : 'Added by you')}
                  </div>
                </div>
                </button>
                <GameInfo game={mergeStats(data.bgg[g.bgg_id || ''], g)}>
                  <span className="grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-indigo-600 dark:hover:bg-zinc-800" aria-label="Game info">
                    <Info size={18} />
                  </span>
                </GameInfo>
                <Switch checked={g.enabled} onChange={(v) => patch(g, { enabled: v })} label={g.enabled ? 'Watching' : 'Not watching'} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AddDialog open={adding} onClose={() => setAdding(false)} data={data} run={run} />
      <BggDialog open={syncing} onClose={() => setSyncing(false)} data={data} run={run} />
      {editing && (
        <AliasDialog
          game={editing}
          onClose={() => setEditing(null)}
          onSave={(aliases) => { patch(editing, { aliases }); setEditing(null); }}
          onRemove={() => { remove(editing); setEditing(null); toast(`Removed ${editing.name}`); }}
        />
      )}
    </>
  );
}

function AddDialog({ open, onClose, data, run }: { open: boolean; onClose: () => void; data: Data; run: Run }) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const items = (text.trim() ? parseImportFile(text) : []) as Item[];

  const save = () => {
    const names = new Set(data.games.map((g) => normalize(g.name)));
    const ids = new Set(data.games.map((g) => g.bgg_id).filter(Boolean));
    const rows: Partial<Game>[] = [];
    for (const it of items) {
      if ((it.bggId && ids.has(it.bggId)) || names.has(normalize(it.name))) continue;
      names.add(normalize(it.name));
      rows.push({ name: it.name, bgg_id: it.bggId ?? null, year: it.year ?? null, priority: it.priority ?? null, source: it.bggId ? 'import' : 'manual', ...(it.stats || {}) });
    }
    if (!rows.length) return toast('Those games are already on your list.');
    run(() => backend.insert('games', rows));
    toast(`Added ${rows.length} game${rows.length > 1 ? 's' : ''}`);
    setText('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add games"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!items.length} onClick={save}>
            Add {items.length || ''} {items.length === 1 ? 'game' : 'games'}
          </Button>
        </>
      }
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'One game per line\n\nBrass: Birmingham\nArk Nova\nSpirit Island'}
        className="h-44 w-full resize-none rounded-lg bg-white p-3 text-sm ring-1 ring-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-950 dark:ring-zinc-800"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={() => fileRef.current?.click()}><FileUp size={15} /> Import BGG CSV</Button>
        <span className="text-xs text-zinc-500">BGG › Collection › Export</span>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setText(await f.text());
            e.target.value = '';
          }}
        />
      </div>
    </Dialog>
  );
}

function BggDialog({ open, onClose, data, run }: { open: boolean; onClose: () => void; data: Data; run: Run }) {
  const s = data.settings;
  const [user, setUser] = useState(s.bgg_username || '');
  const result = (() => { try { return s.bgg_sync_result ? JSON.parse(s.bgg_sync_result) as { at: string; ok: boolean; message: string } : null; } catch { return null; } })();
  const waiting = !!s.bgg_sync_requested_at && (!result || s.bgg_sync_requested_at > result.at);
  const online = checkerView(s).online;

  const sync = () => {
    const now = new Date().toISOString();
    run(() => backend.updateSettings({ bgg_username: user.trim(), bgg_sync_requested_at: now }), (d) => ({
      ...d, settings: { ...d.settings, bgg_username: user.trim(), bgg_sync_requested_at: now },
    }));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Sync from BoardGameGeek"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" disabled={!user.trim() || waiting} onClick={sync}><RefreshCw size={15} className={cx(waiting && 'animate-spin')} /> Sync</Button>
        </>
      }
    >
      <label className="text-sm font-medium">BGG username</label>
      <Input className="mt-1.5" value={user} onChange={(e) => setUser(e.target.value)} placeholder="your-bgg-name" autoFocus />
      <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50">
        {waiting ? (
          online ? 'Syncing on your PC…' : 'Waiting for your PC. It syncs when the checker is on.'
        ) : result ? (
          <span className={result.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}>
            {result.message} <span className="text-zinc-400">· {timeAgo(result.at)}</span>
          </span>
        ) : (
          <span className="text-zinc-500">Adds your wishlist games. Keeps your own games and other names.</span>
        )}
      </div>
    </Dialog>
  );
}

function AliasDialog({ game, onClose, onSave, onRemove }: {
  game: Game; onClose: () => void; onSave: (a: string[]) => void; onRemove: () => void;
}) {
  const [text, setText] = useState(game.aliases.join('\n'));
  const aliases = text.split('\n').map((s) => s.trim()).filter(Boolean);
  return (
    <Dialog
      open
      onClose={onClose}
      title={game.name}
      footer={
        <>
          <Button variant="danger" className="mr-auto" onClick={onRemove}><Trash2 size={15} /> Remove</Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave(aliases)}>Save</Button>
        </>
      }
    >
      <p className="mb-2 text-sm text-zinc-500">Also look for these names. One per line. E.g. Greek title or short name.</p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Brass Birmingham\nΜπρας'}
        className="h-32 w-full resize-none rounded-lg bg-white p-3 text-sm ring-1 ring-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-950 dark:ring-zinc-800"
      />
    </Dialog>
  );
}
