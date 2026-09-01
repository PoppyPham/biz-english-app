-- ============================================================================
-- Fix: admins could not INSERT community phrases (owner_id = NULL)
--   phrases_insert_own only allowed `owner_id = auth.uid()`, so an admin
--   trying to bulk-import words into a system category (owner_id null) was
--   rejected by RLS. Bring INSERT in line with the existing UPDATE/DELETE
--   policies, which already allow is_admin() to act on any row.
-- Run in Supabase SQL Editor. Safe to re-run. Depends on admin.sql (is_admin()).
-- ============================================================================

drop policy if exists "phrases_insert_own" on public.phrases;
create policy "phrases_insert_own"
  on public.phrases
  for insert
  with check (owner_id = auth.uid() or public.is_admin());
