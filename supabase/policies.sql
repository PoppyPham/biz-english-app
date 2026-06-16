-- ============================================================================
-- Row Level Security policies for BizEnglish
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: drops each policy before recreating it.
-- ============================================================================

-- ── categories: public read-only reference data ──────────────────────────────
alter table public.categories enable row level security;

drop policy if exists "categories_select_all" on public.categories;
create policy "categories_select_all"
  on public.categories
  for select
  using (true);
-- No insert/update/delete policies → writes are blocked for anon & authenticated.
-- Manage rows via the dashboard or a service-role key (which bypasses RLS).


-- ── phrases: public read-only reference data ─────────────────────────────────
alter table public.phrases enable row level security;

drop policy if exists "phrases_select_all" on public.phrases;
create policy "phrases_select_all"
  on public.phrases
  for select
  using (true);


-- ── user_progress: each user can only see and modify their own rows ──────────
alter table public.user_progress enable row level security;

drop policy if exists "user_progress_select_own" on public.user_progress;
create policy "user_progress_select_own"
  on public.user_progress
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_progress_insert_own" on public.user_progress;
create policy "user_progress_insert_own"
  on public.user_progress
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_progress_update_own" on public.user_progress;
create policy "user_progress_update_own"
  on public.user_progress
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_progress_delete_own" on public.user_progress;
create policy "user_progress_delete_own"
  on public.user_progress
  for delete
  using (auth.uid() = user_id);

-- ── Required for the app's upsert(onConflict: "user_id,phrase_id") ───────────
-- The flashcard/quiz/list code relies on a unique constraint on (user_id, phrase_id).
alter table public.user_progress
  drop constraint if exists user_progress_user_phrase_unique;
alter table public.user_progress
  add constraint user_progress_user_phrase_unique unique (user_id, phrase_id);
