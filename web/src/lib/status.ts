import type { Settings } from './types';
import { timeAgo, timeUntil } from './time';

export type Tone = 'green' | 'amber' | 'red' | 'gray';
export interface CheckerView {
  online: boolean;
  tone: Tone;
  title: string;
  detail: string;
  pending: boolean; // "Check now" requested but not started yet
}

export function checkerView(s: Settings): CheckerView {
  const cs = s.checker_status || {};
  const online = !!cs.heartbeatAt && Date.now() - new Date(cs.heartbeatAt).getTime() < 60_000;
  const pending = !!s.check_requested_at && (!cs.lastScanStartedAt || s.check_requested_at > cs.lastScanStartedAt);
  const last = cs.lastScanAt ? `Last check ${timeAgo(cs.lastScanAt)}` : 'No checks yet';

  if (!online) return { online, pending, tone: 'gray', title: 'PC offline', detail: `${last}. Checks run while your PC is on.` };
  if (cs.state === 'scanning' && cs.progress)
    return { online, pending, tone: 'amber', title: `Checking ${cs.progress.done + 1} of ${cs.progress.total}`, detail: cs.progress.current || '' };
  if (cs.fbConnected === false) return { online, pending, tone: 'red', title: 'Facebook login needed', detail: 'On your PC, run connect-facebook.' };
  if (pending) return { online, pending, tone: 'amber', title: 'Starting check…', detail: last };
  if (s.paused) return { online, pending, tone: 'gray', title: 'Paused', detail: last };
  return { online, pending, tone: 'green', title: 'Watching', detail: cs.nextScanAt ? `Next check ${timeUntil(cs.nextScanAt)}` : last };
}

export const toneDot: Record<Tone, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500 animate-pulse',
  red: 'bg-red-500',
  gray: 'bg-zinc-400',
};
