import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Data, Settings, Table } from './types';
import { demoData } from './demo';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isDemo = !URL || !KEY;
export const supabase: SupabaseClient | null = isDemo ? null : createClient(URL!, KEY!);

export interface Backend {
  load(): Promise<Data>;
  insert(table: Table, rows: object[]): Promise<void>;
  update(table: Table, ids: string[], patch: object): Promise<void>;
  remove(table: Table, ids: string[]): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  subscribe(onChange: () => void, onSettings: (s: Settings) => void): () => void;
}

async function ok<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

function supabaseBackend(sb: SupabaseClient): Backend {
  return {
    async load() {
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      const [groups, games, matches, posts, settings] = await Promise.all([
        ok(sb.from('groups').select('*').order('created_at')),
        ok(sb.from('games').select('*').order('name')),
        ok(sb.from('matches').select('*').eq('dismissed', false).order('found_at', { ascending: false }).limit(300)),
        ok(sb.from('posts').select('*').eq('dismissed', false).gte('found_at', weekAgo).order('found_at', { ascending: false }).limit(1500)),
        ok(sb.from('settings').select('*').eq('id', 1).single()),
      ]);
      // Stats for every game mentioned in the shown posts + the wishlist.
      const ids = new Set<string>();
      for (const m of [...(matches || []), ...(posts || [])] as { line_games?: Record<string, string> }[]) Object.values(m.line_games || {}).forEach((id) => ids.add(id));
      for (const g of games as { bgg_id: string | null }[]) if (g.bgg_id) ids.add(g.bgg_id);
      const list = [...ids];
      const bgg: Record<string, unknown> = {};
      const prices: Record<string, unknown> = {};
      for (let i = 0; i < list.length; i += 200) {
        const rows = await ok(sb.from('bgg_games').select('*').in('bgg_id', list.slice(i, i + 200)));
        for (const r of rows as { bgg_id: string }[]) bgg[r.bgg_id] = r;
        const pr = await ok(sb.from('prices').select('*').in('bgg_id', list.slice(i, i + 200)));
        for (const r of pr as { bgg_id: string }[]) prices[r.bgg_id] = r;
      }
      return { groups, games, matches, posts, settings, bgg, prices } as Data;
    },
    async insert(table, rows) {
      await ok(sb.from(table).insert(rows));
    },
    async update(table, ids, patch) {
      await ok(sb.from(table).update(patch).in('id', ids));
    },
    async remove(table, ids) {
      await ok(sb.from(table).delete().in('id', ids));
    },
    async updateSettings(patch) {
      await ok(sb.from('settings').update(patch).eq('id', 1));
    },
    subscribe(onChange, onSettings) {
      const ch = sb
        .channel('meeple-watch')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (p) => onSettings(p.new as Settings))
        .subscribe();
      return () => void sb.removeChannel(ch);
    },
  };
}

function demoBackend(): Backend {
  const d = demoData();
  let listener = () => {};
  const tableOf = (t: Table) => d[t] as unknown as { id: string }[];
  const changed = () => setTimeout(() => listener(), 50);
  return {
    async load() {
      return structuredClone({ ...d, matches: d.matches.filter((m) => !m.dismissed), posts: d.posts.filter((p) => !p.dismissed) });
    },
    async insert(table, rows) {
      for (const r of rows) tableOf(table).push({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...r } as never);
      changed();
    },
    async update(table, ids, patch) {
      for (const r of tableOf(table)) if (ids.includes(r.id)) Object.assign(r, patch);
      changed();
    },
    async remove(table, ids) {
      (d[table] as unknown[]) = tableOf(table).filter((r) => !ids.includes(r.id));
      changed();
    },
    async updateSettings(patch) {
      Object.assign(d.settings, patch);
      if (patch.check_requested_at) {
        // Pretend the checker ran.
        const now = new Date().toISOString();
        Object.assign(d.settings.checker_status, { lastScanStartedAt: now, lastScanAt: now });
      }
      if (patch.bgg_sync_requested_at) {
        d.settings.bgg_sync_result = JSON.stringify({ at: new Date().toISOString(), ok: false, message: 'Demo mode: BGG sync runs on your PC checker.' });
      }
      changed();
    },
    subscribe(onChange) {
      listener = onChange;
      return () => (listener = () => {});
    },
  };
}

export const backend: Backend = supabase ? supabaseBackend(supabase) : demoBackend();
