-- New (shop) price per game, from boardgameprices.eu, to compare with used prices in posts.
-- One row per BGG game; refreshed at most every 30 days. price null = no shop found.
create table if not exists public.prices (
  bgg_id text primary key,
  price numeric,                -- product price only (no shipping), EUR
  country text,                 -- shop country, e.g. GR
  in_stock boolean,
  url text,                     -- boardgameprices.eu page for the game
  shops int not null default 0,
  gr_shops int not null default 0,
  checked_at timestamptz not null default now()
);

alter table public.prices enable row level security;
drop policy if exists "owner all" on public.prices;
create policy "owner all" on public.prices for all to authenticated using (true) with check (true);
