// Pastel accent colors. Hex values must match index.css.
export const ACCENTS = [
  { id: 'lavender', label: 'Lavender', hex: '#b4a7f5' },
  { id: 'sky', label: 'Sky', hex: '#9ec5fe' },
  { id: 'mint', label: 'Mint', hex: '#9ee6c4' },
  { id: 'aqua', label: 'Aqua', hex: '#8fe3e8' },
  { id: 'peach', label: 'Peach', hex: '#ffc09f' },
  { id: 'rose', label: 'Rose', hex: '#f9a8c9' },
  { id: 'lemon', label: 'Lemon', hex: '#f3e08a' },
  { id: 'lilac', label: 'Lilac', hex: '#e0b0f5' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];
const KEY = 'mw-accent';

/** Apply an accent to the page and remember it on this device (so it shows before data loads). */
export function applyAccent(id: string | null | undefined) {
  const a = ACCENTS.find((x) => x.id === id) || ACCENTS[0];
  document.documentElement.dataset.accent = a.id;
  try { localStorage.setItem(KEY, a.id); } catch {}
}

export function initAccent() {
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  applyAccent(saved);
}
