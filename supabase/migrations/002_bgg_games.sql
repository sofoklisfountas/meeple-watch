-- Stats for any BGG game seen in posts (filled from BGG's ranks file, then the BGG API if a token exists).
create table if not exists public.bgg_games (
  bgg_id text primary key,
  name text not null,
  year text,
  bgg_rank int,
  rating numeric,
  votes int,
  weight numeric,
  min_players int,
  max_players int,
  best_players int[] not null default '{}',
  rec_players int[] not null default '{}',
  min_time int,
  max_time int,
  owned int,
  api_updated_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.bgg_games enable row level security;
drop policy if exists "owner all" on public.bgg_games;
create policy "owner all" on public.bgg_games for all to authenticated using (true) with check (true);

-- Which BGG game each line of a post is: { "<line text>": "<bgg id>" }.
alter table public.matches add column if not exists line_games jsonb not null default '{}';
