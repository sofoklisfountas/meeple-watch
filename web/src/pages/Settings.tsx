import type { ReactNode } from 'react';
import { Check, Download, LogOut, RefreshCw } from 'lucide-react';
import { ACCENTS, applyAccent } from '../lib/accent';
import { Button, Card, PageHeader, Segmented, Switch, cx } from '../components/ui';
import { backend, supabase } from '../lib/backend';
import { checkerView, toneDot } from '../lib/status';
import { timeAgo } from '../lib/time';
import { useInstallPrompt } from '../lib/install';
import type { Data, Settings as S } from '../lib/types';
import type { Run } from '../lib/useData';

export function Settings({ data, run, email, checkNow }: { data: Data; run: Run; email?: string; checkNow: () => void }) {
  const s = data.settings;
  const cs = s.checker_status || {};
  const v = checkerView(s);
  const install = useInstallPrompt();
  const set = (p: Partial<S>) => run(() => backend.updateSettings(p), (d) => ({ ...d, settings: { ...d.settings, ...p } }));

  return (
    <>
      <PageHeader title="Settings" />

      <Section title="PC checker">
        <div className="flex items-center gap-3 px-4 py-4">
          <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', toneDot[v.tone])} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{v.title}</div>
            <div className="truncate text-xs text-zinc-500">{v.detail}</div>
          </div>
          <Button size="sm" onClick={checkNow} disabled={v.pending || cs.state === 'scanning'}>
            <RefreshCw size={15} className={cx(cs.state === 'scanning' && 'animate-spin')} /> Check now
          </Button>
        </div>
        <Row label="Computer" value={cs.pc || '—'} />
        <Row label="Facebook" value={cs.fbConnected === false ? 'Login needed' : cs.fbConnected ? 'Connected' : '—'} />
        <Row
          label="Last check"
          value={cs.lastScanAt ? `${timeAgo(cs.lastScanAt)}${cs.lastSummary ? ` · ${cs.lastSummary.posts} posts · ${cs.lastSummary.found} new` : ''}` : 'Never'}
        />
        {cs.lastError && <div className="border-t border-zinc-100 px-4 py-3 text-sm text-red-600 dark:border-zinc-800">{cs.lastError}</div>}
      </Section>

      <Section title="Checking">
        <Setting label="Check every" hint="Longer is safer for your Facebook account.">
          <Segmented
            value={s.interval_minutes}
            onChange={(n) => set({ interval_minutes: n })}
            options={[15, 30, 60, 120].map((n) => ({ value: n, label: n < 60 ? `${n}m` : `${n / 60}h` }))}
          />
        </Setting>
        <Setting label="Posts per group" hint="Newest posts to read each time.">
          <Segmented
            value={s.scan_depth}
            onChange={(d) => set({ scan_depth: d })}
            options={[{ value: 'light', label: '~10' }, { value: 'normal', label: '~25' }, { value: 'deep', label: '~50' }]}
          />
        </Setting>
        <Setting label="Pause checking">
          <Switch checked={s.paused} onChange={(p) => set({ paused: p })} label="Pause checking" />
        </Setting>
      </Section>

      <Section title="Appearance">
        <div className="px-4 py-3.5">
          <div className="text-sm font-medium">Accent color</div>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {ACCENTS.map((a) => {
              const on = (s.accent || ACCENTS[0].id) === a.id;
              return (
                <button
                  key={a.id}
                  title={a.label}
                  aria-label={a.label}
                  aria-pressed={on}
                  onClick={() => { applyAccent(a.id); set({ accent: a.id }); }}
                  style={{ background: a.hex }}
                  className={cx(
                    'grid h-9 w-9 cursor-pointer place-items-center rounded-full text-zinc-900 transition hover:scale-110',
                    on && 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900',
                  )}
                >
                  {on && <Check size={16} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="App">
        {!install.installed && (
          <Setting label="Install on this device" hint={install.canInstall ? undefined : 'Browser menu › Add to Home screen / Install app'}>
            {install.canInstall && <Button size="sm" onClick={install.install}><Download size={15} /> Install</Button>}
          </Setting>
        )}
        {supabase && (
          <Setting label="Signed in" hint={email}>
            <Button size="sm" variant="ghost" onClick={() => supabase!.auth.signOut()}><LogOut size={15} /> Sign out</Button>
          </Setting>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      <Card className="divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">{children}</Card>
    </section>
  );
}

function Setting({ label, hint, children }: { label: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-zinc-500">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}
