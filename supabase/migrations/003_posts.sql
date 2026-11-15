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
