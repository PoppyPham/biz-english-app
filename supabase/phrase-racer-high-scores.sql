-- ============================================================================
-- Phrase Racer high scores
--   One row per (user, scope) — scope is the category slug Phrase Racer was
--   played in ("your-words" for Your Words, "all" for every category), same
--   convention as quiz_high_scores. high_score is the best distance (meters)
--   reached in that scope.
-- Run in Supabase SQL Editor. Safe to re-run.
-- Run this BEFORE (re-)running leaderboard.sql, since get_leaderboard()
-- references this table.
-- ============================================================================

create table if not exists public.phrase_racer_high_scores (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  scope       text not null,
  high_score  integer not null default 0,
  updated_at  timestamptz not null default now(),
  unique (user_id, scope)
);

create index if not exists phrase_racer_high_scores_user_idx on public.phrase_racer_high_scores (user_id);

alter table public.phrase_racer_high_scores enable row level security;

grant select, insert, update on public.phrase_racer_high_scores to authenticated;

drop policy if exists "phrase_racer_high_scores_select_own" on public.phrase_racer_high_scores;
create policy "phrase_racer_high_scores_select_own"
  on public.phrase_racer_high_scores
  for select
  using (auth.uid() = user_id);

drop policy if exists "phrase_racer_high_scores_insert_own" on public.phrase_racer_high_scores;
create policy "phrase_racer_high_scores_insert_own"
  on public.phrase_racer_high_scores
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "phrase_racer_high_scores_update_own" on public.phrase_racer_high_scores;
create policy "phrase_racer_high_scores_update_own"
  on public.phrase_racer_high_scores
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
