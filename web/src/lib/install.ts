// Captures the browser's "Install app" prompt so we can show our own button.
import { useEffect, useState } from 'react';

type PromptEvent = Event & { prompt: () => Promise<void> };
let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as PromptEvent;
  listeners.forEach((l) => l());
});

export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const installed = window.matchMedia('(display-mode: standalone)').matches;
  return {
    installed,
    canInstall: !!deferred && !installed,
    install: async () => {
      await deferred?.prompt();
      deferred = null;
      force((x) => x + 1);
    },
  };
}
