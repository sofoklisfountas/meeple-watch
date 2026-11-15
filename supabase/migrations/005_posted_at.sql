-- When the post was really posted on Facebook (from Facebook's own data). Null = unknown.
alter table public.posts add column if not exists posted_at timestamptz;
create index if not exists posts_posted_at_idx on public.posts (posted_at desc);
