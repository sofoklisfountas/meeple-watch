import { useState } from 'react';
import { ExternalLink, Plus, Trash2, Users } from 'lucide-react';
import { Button, Card, Empty, Input, PageHeader, Switch, cx, toast } from '../components/ui';
import { backend } from '../lib/backend';
import { timeAgo } from '../lib/time';
import type { Data, Group } from '../lib/types';
import type { Run } from '../lib/useData';
import { parseGroupInput } from '../../../shared/facebook.js';

export function Groups({ data, run }: { data: Data; run: Run }) {
  const [link, setLink] = useState('');

  const add = () => {
    const g = parseGroupInput(link);
    if (!g) return toast('Paste a link like facebook.com/groups/…', 'error');
    if (data.groups.some((x) => x.fb_id === g.fbId)) return toast('That group is already added.');
    run(() => backend.insert('groups', [{ fb_id: g.fbId, url: g.url }]));
    setLink('');
    toast('Group added. Name appears after the next check.');
  };
  const patch = (g: Group, p: Partial<Group>) =>
    run(() => backend.update('groups', [g.id], p), (d) => ({ ...d, groups: d.groups.map((x) => (x.id === g.id ? { ...x, ...p } : x)) }));
  const remove = (g: Group) =>
    run(() => backend.remove('groups', [g.id]), (d) => ({ ...d, groups: d.groups.filter((x) => x.id !== g.id) }));

  return (
    <>
      <PageHeader title="Groups" subtitle="Facebook buy/sell groups you're a member of." />

      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste group link: facebook.com/groups/…" />
        <Button variant="primary" type="submit" disabled={!link.trim()}><Plus size={16} /> Add</Button>
      </form>

      <Card>
        {data.groups.length === 0 ? (
          <Empty icon={<Users size={22} />} title="No groups yet" text="Open the group on Facebook, copy the link, paste it above." />
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.groups.map((g) => (
              <li key={g.id} className={cx('flex items-center gap-3 px-4 py-3', !g.enabled && 'opacity-50')}>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <Users size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <a href={g.url} target="_blank" rel="noopener" className="group flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate group-hover:underline">{g.name || g.fb_id}</span>
                    <ExternalLink size={13} className="shrink-0 text-zinc-400" />
                  </a>
                  <div className={cx('truncate text-xs', g.last_error ? 'text-red-600' : 'text-zinc-500')}>
                    {g.last_error ?? (g.last_checked_at ? `${g.last_post_count} posts · checked ${timeAgo(g.last_checked_at)}` : 'Not checked yet')}
                  </div>
                </div>
                <Switch checked={g.enabled} onChange={(v) => patch(g, { enabled: v })} label={g.enabled ? 'Watching' : 'Paused'} />
                <Button variant="danger" size="icon" onClick={() => remove(g)} title="Remove"><Trash2 size={16} /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
