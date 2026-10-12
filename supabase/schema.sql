-- Anime Tracker database schema
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once.

-- ---------------------------------------------------------------
-- library: one row per anime a user has saved
-- ---------------------------------------------------------------
create table if not exists public.library (
  user_id    uuid not null references auth.users (id) on delete cascade,
  anime_id   integer not null,                 -- AniList id (title/cover are fetched from AniList)
  status     text not null default 'Plan to Watch'
             check (status in ('Watching', 'Completed', 'Plan to Watch', 'Dropped')),
  watched    integer not null default 0 check (watched >= 0),  -- episodes watched
  updated_at timestamptz not null default now(),
  -- also what the app's upsert (onConflict: "user_id,anime_id") relies on
  primary key (user_id, anime_id)
);

-- ---------------------------------------------------------------
-- episode_links: links a user saved for an episode
-- ---------------------------------------------------------------
create table if not exists public.episode_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  anime_id   integer not null,                 -- AniList id
  episode    integer not null check (episode >= 1),
  url        text not null,
  label      text,
  created_at timestamptz not null default now()
);

create index if not exists episode_links_user_anime_idx
  on public.episode_links (user_id, anime_id);

-- ---------------------------------------------------------------
-- Row Level Security: users can only touch their own rows
-- ---------------------------------------------------------------
alter table public.library enable row level security;
alter table public.episode_links enable row level security;

drop policy if exists "Users manage their own library" on public.library;
create policy "Users manage their own library"
  on public.library
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users manage their own episode links" on public.episode_links;
create policy "Users manage their own episode links"
  on public.episode_links
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());