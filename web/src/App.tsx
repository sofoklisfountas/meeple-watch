import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Bell, Dices, Heart, Loader2, RefreshCw, Settings as Cog, Users } from 'lucide-react';
import { Button, Toaster, cx, toast } from './components/ui';
import { backend, isDemo, supabase } from './lib/backend';
import { checkerView, toneDot } from './lib/status';
import { useData, useTick } from './lib/useData';
import { buildFeed } from './lib/posts';
import { applyAccent } from './lib/accent';
import { Matches } from './pages/Matches';
import { Wishlist } from './pages/Wishlist';
import { Groups } from './pages/Groups';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';

export type Page = 'matches' | 'wishlist' | 'groups' | 'settings';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(isDemo ? null : undefined);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <Splash />;
  if (!isDemo && !session) return <><Login /><Toaster /></>;
  return <><Shell email={session?.user.email} /><Toaster /></>;
}

function Shell({ email }: { email?: string }) {
  const { data, error, run } = useData(true);
  const [page, setPageState] = useState<Page>(() => (location.hash.slice(1) as Page) || 'matches');
  useTick();
  useEffect(() => {
    const onHash = () => setPageState((location.hash.slice(1) as Page) || 'matches');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (p: Page) => {
    setPageState(p);
    history.replaceState(null, '', `#${p}`);
    window.scrollTo(0, 0);
  };

  // Accent saved in the database wins (same color on phone and PC).
  const accent = data?.settings.accent;
  useEffect(() => { if (accent) applyAccent(accent); }, [accent]);

  if (!data) return error ? <Splash text={`Can't load data: ${error}`} /> : <Splash />;

  const view = checkerView(data.settings);
  const unread = buildFeed(data.posts, data.matches).filter((p) => p.matches.length && !p.read).length;
  const checkNow = () => {
    const now = new Date().toISOString();
    run(() => backend.updateSettings({ check_requested_at: now }), (d) => ({ ...d, settings: { ...d.settings, check_requested_at: now } }));
    toast(view.online ? 'Checking now…' : 'PC is offline. It will check when it’s on.');
  };

  const nav: { id: Page; label: string; icon: ReactNode; badge?: number }[] = [
    { id: 'matches', label: 'Posts', icon: <Bell size={19} />, badge: unread },
    { id: 'wishlist', label: 'Wishlist', icon: <Heart size={19} /> },
    { id: 'groups', label: 'Groups', icon: <Users size={19} /> },
    { id: 'settings', label: 'Settings', icon: <Cog size={19} /> },
  ];
  const busy = view.pending || data.settings.checker_status?.state === 'scanning';

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-zinc-200 bg-white/60 p-3 md:flex dark:border-zinc-800 dark:bg-zinc-900/40">
        <Brand className="px-2 pb-6 pt-2" />
        <nav className="space-y-0.5">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={cx(
                'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                page === n.id ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100',
              )}
            >
              {n.icon}
              {n.label}
              {!!n.badge && <span className="ml-auto rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold leading-[18px] text-accent-fg">{n.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-xl bg-white p-3 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className={cx('h-2 w-2 rounded-full', toneDot[view.tone])} /> {view.title}
          </div>
          <div className="mt-0.5 truncate text-xs text-zinc-500">{view.detail}</div>
          <Button size="sm" className="mt-3 w-full" onClick={checkNow} disabled={busy}>
            <RefreshCw size={14} className={cx(busy && 'animate-spin')} /> Check now
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header id="mw-topbar" className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200 bg-white/80 px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/80">
          <Brand />
          <button onClick={() => go('settings')} className="ml-auto flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
            <span className={cx('h-2 w-2 shrink-0 rounded-full', toneDot[view.tone])} />
            <span className="truncate">{view.title}</span>
          </button>
          <Button size="icon" variant="ghost" onClick={checkNow} disabled={busy} aria-label="Check now">
            <RefreshCw size={18} className={cx(busy && 'animate-spin')} />
          </Button>
        </header>

        {isDemo && (
          <div className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Demo mode: sample data. Add your Supabase keys to go live.
          </div>
        )}

        <main className="mx-auto max-w-3xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-10">
          {page === 'matches' && <Matches data={data} run={run} go={go} />}
          {page === 'wishlist' && <Wishlist data={data} run={run} />}
          {page === 'groups' && <Groups data={data} run={run} />}
          {page === 'settings' && <Settings data={data} run={run} email={email} checkNow={checkNow} />}
        </main>
      </div>

      {/* Mobile tab bar */}
      <nav id="mw-tabbar" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-zinc-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/90">
        {nav.map((n) => (
          <button
            key={n.id}
            onClick={() => go(n.id)}
            className={cx('relative flex cursor-pointer flex-col items-center gap-0.5 py-2 text-[11px] font-medium', page === n.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500')}
          >
            {n.icon}
            {n.label}
            {!!n.badge && <span className="absolute left-1/2 top-1 ml-2 rounded-full bg-indigo-600 px-1.5 text-[10px] font-semibold leading-4 text-accent-fg">{n.badge}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-center gap-2.5', className)}>
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 text-accent-fg shadow-sm">
        <Dices size={18} />
      </div>
      <span className="font-semibold tracking-tight">Meeple Watch</span>
    </div>
  );
}

function Splash({ text }: { text?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center text-sm text-zinc-500">
      {text ?? <Loader2 className="animate-spin" />}
    </div>
  );
}
