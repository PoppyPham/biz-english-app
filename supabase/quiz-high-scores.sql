-- ============================================================================
-- Quiz high scores
--   One row per (user, scope) — scope is the category slug the quiz was
--   played in, or 'all' for "every category" mode. Lets each user chase a
--   best score per category (and for the all-categories endless mode).
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================================

create table if not exists public.quiz_high_scores (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  scope       text not null,
  high_score  integer not null default 0,
  updated_at  timestamptz not null default now(),
  unique (user_id, scope)
);

create index if not exists quiz_high_scores_user_idx on public.quiz_high_scores (user_id);

alter table public.quiz_high_scores enable row level security;

-- Table is new → grant explicitly (don't rely on default privileges).
grant select, insert, update on public.quiz_high_scores to authenticated;

drop policy if exists "quiz_high_scores_select_own" on public.quiz_high_scores;
create policy "quiz_high_scores_select_own"
  on public.quiz_high_scores
  for select
  using (auth.uid() = user_id);

drop policy if exists "quiz_high_scores_insert_own" on public.quiz_high_scores;
create policy "quiz_high_scores_insert_own"
  on public.quiz_high_scores
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "quiz_high_scores_update_own" on public.quiz_high_scores;
create policy "quiz_high_scores_update_own"
  on public.quiz_high_scores
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
