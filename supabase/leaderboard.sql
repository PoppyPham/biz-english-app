-- ============================================================================
-- Leaderboard
--   • profiles: public-readable mirror of auth.users' display_name, kept in
--     sync via trigger. auth.users itself is never exposed to clients.
--   • get_leaderboard(): SECURITY DEFINER RPC that aggregates every user's
--     best quiz score, best Phrase Racer score (each across all scopes), and
--     learned-phrase count, bypassing the "own row only" RLS on
--     quiz_high_scores / phrase_racer_high_scores / user_progress — this is
--     the one place those numbers are intentionally shown across users.
-- Run in Supabase SQL Editor. Safe to re-run.
-- Requires phrase-racer-high-scores.sql to have been run first (this
-- function references that table).
-- ============================================================================

create table if not exists public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles
  for select
  using (true);

-- Keep profiles.display_name in sync with auth.users' metadata.
create or replace function public.sync_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    now()
  )
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_sync_profile on auth.users;
create trigger on_auth_user_sync_profile
  after insert or update on auth.users
  for each row execute function public.sync_profile();

-- Backfill profiles for users who already existed before this migration.
insert into public.profiles (user_id, display_name, updated_at)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1)), now()
from auth.users
on conflict (user_id) do update
  set display_name = excluded.display_name;

-- Ranked leaderboard: every user, their best quiz score and best Phrase
-- Racer score (each across all scopes), and their total learned-phrase
-- count (used to derive Word Mastery Level).
-- The OUT-parameter row shape changed (added best_racer_score), and
-- Postgres won't let create-or-replace change a function's return type —
-- drop it first so re-running this file stays safe.
drop function if exists public.get_leaderboard();
create or replace function public.get_leaderboard()
returns table (
  user_id          uuid,
  display_name     text,
  best_score       integer,
  best_racer_score integer,
  learned_count    integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.user_id,
    p.display_name,
    coalesce(max(q.high_score), 0)::integer as best_score,
    coalesce(max(r.high_score), 0)::integer as best_racer_score,
    coalesce(lc.learned_count, 0)::integer as learned_count
  from public.profiles p
  left join public.quiz_high_scores q on q.user_id = p.user_id
  left join public.phrase_racer_high_scores r on r.user_id = p.user_id
  left join (
    select user_id, count(*) as learned_count
    from public.user_progress
    where status = 'learned'
    group by user_id
  ) lc on lc.user_id = p.user_id
  group by p.user_id, p.display_name, lc.learned_count
  order by best_score desc, learned_count desc, p.display_name asc nulls last;
$$;

grant execute on function public.get_leaderboard() to authenticated;
