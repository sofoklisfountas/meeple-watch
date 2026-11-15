-- Accent color picked in Settings → Appearance (lavender, sky, mint, ...).
alter table public.settings add column if not exists accent text;
