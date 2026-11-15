-- ONE-TIME: lets the PC checker (secret key only) apply future database changes itself.
-- Paste all of this into Supabase > SQL Editor > New query > Run.

create or replace function public.run_sql(query text) returns void
language plpgsql security definer set search_path = public as $$
begin
  execute query;
end;
$$;
revoke all on function public.run_sql(text) from public, anon, authenticated;
grant execute on function public.run_sql(text) to service_role;

create table if not exists public.migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
alter table public.migrations enable row level security;

-- Pending change: BGG stats on games.
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

notify pgrst, 'reload schema';
