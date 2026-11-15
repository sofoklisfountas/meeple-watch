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
