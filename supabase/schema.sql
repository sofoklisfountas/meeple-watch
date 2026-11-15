-- Meeple Watch database. Paste this whole file into Supabase > SQL Editor > Run.

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  fb_id text not null unique,
  url text not null,
  name text,
  enabled boolean not null default true,
  last_checked_at timestamptz,
  last_post_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  bgg_id text unique,
  name text not null,
  year text,
  thumbnail text,
  priority int,
  aliases text[] not null default '{}',
  enabled boolean not null default true,
  source text not null default 'manual', -- manual | import | bgg
  created_at timestamptz not null default now()
);
-- BGG stats (from the collection CSV or the BGG API).
alter table public.games
  add column if not exists rating numeric,
  add column if not exists weight numeric,
  add column if not exists bgg_rank int,
  add column if not exists min_players int,
  add column if not exists max_players int,
  add column if not exists best_players int[] not null default '{}',
  add column if not exists rec_players int[] not null default '{}',
  add column if not exists min_time int,
  add column if not exists max_time int,
  add column if not exists owned int,
  add column if not exists votes int;

create table if not exists public.matches (
  id text primary key,                     -- "<post key>|<game id>"
  game_id uuid references public.games(id) on delete cascade,
  game_name text not null,
  thumbnail text,
  group_id uuid references public.groups(id) on delete set null,
  group_name text,
  url text not null,
  exact_link boolean not null default true,
  snippet text,
  found_at timestamptz not null default now(),
  read boolean not null default false,
  dismissed boolean not null default false
);
alter table public.matches add column if not exists post_text text;
alter table public.matches add column if not exists images text[] not null default '{}';
create index if not exists matches_found_at_idx on public.matches (found_at desc);

-- One row of app settings + checker status.
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  interval_minutes int not null default 30,
  scan_depth text not null default 'normal',  -- light | normal | deep
  paused boolean not null default false,
  bgg_username text,
  check_requested_at timestamptz,             -- set by website "Check now"
  bgg_sync_requested_at timestamptz,          -- set by website "Sync from BGG"
  bgg_sync_result text,                        -- written by checker
  checker_status jsonb not null default '{}'   -- written by checker
);
insert into public.settings (id) values (1) on conflict do nothing;

-- Security: only logged-in users (just you — turn off sign-ups) can read/write.
alter table public.groups   enable row level security;
alter table public.games    enable row level security;
alter table public.matches  enable row level security;
alter table public.settings enable row level security;

drop policy if exists "owner all" on public.groups;
drop policy if exists "owner all" on public.games;
drop policy if exists "owner all" on public.matches;
drop policy if exists "owner all" on public.settings;
create policy "owner all" on public.groups   for all to authenticated using (true) with check (true);
create policy "owner all" on public.games    for all to authenticated using (true) with check (true);
create policy "owner all" on public.matches  for all to authenticated using (true) with check (true);
create policy "owner all" on public.settings for all to authenticated using (true) with check (true);

-- Live updates in the website.
do $$
begin
  begin alter publication supabase_realtime add table public.matches;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.settings; exception when others then null; end;
  begin alter publication supabase_realtime add table public.groups;   exception when others then null; end;
end $$;

-- All posts seen (see migrations/003_posts.sql).
-- Every post the checker sees (not only wishlist hits), kept ~30 days. Wishlist hits stay in matches.
create table if not exists public.posts (
  id text primary key,                     -- post key, same as the part of matches.id before "|"
  group_id uuid references public.groups(id) on delete set null,
  group_name text,
  url text not null,
  exact_link boolean not null default true,
  post_text text,
  images text[] not null default '{}',
  line_games jsonb not null default '{}',
  found_at timestamptz not null default now(),
  dismissed boolean not null default false
);
create index if not exists posts_found_at_idx on public.posts (found_at desc);

alter table public.posts enable row level security;
drop policy if exists "owner all" on public.posts;
create policy "owner all" on public.posts for all to authenticated using (true) with check (true);

do $$
begin
  begin alter publication supabase_realtime add table public.posts; exception when others then null; end;
end $$;

-- Accent color (see migrations/004_accent.sql).
alter table public.settings add column if not exists accent text;
