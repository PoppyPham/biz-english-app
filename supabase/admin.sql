-- ============================================================================
-- Super admin
--   • admins table holds privileged user ids.
--   • is_admin() is used by RLS policies to grant elevated rights.
--   • Admins can read/update/delete ANY phrase (e.g. fix IPA on community
--     phrases they don't own). Extend other policies with is_admin() later.
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================================

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- No policies → table is not directly readable by clients. is_admin() reads it
-- via SECURITY DEFINER, which bypasses RLS.

-- Seed the super admin (psb.jct@gmail.com).
insert into public.admins (user_id)
values ('d05d7f2f-b7f9-49fa-b64f-eba5162e08bf')
on conflict (user_id) do nothing;

-- True when the current request is an admin.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ── Extend phrases RLS so admins have full control ───────────────────────────
drop policy if exists "phrases_select_visible" on public.phrases;
create policy "phrases_select_visible"
  on public.phrases
  for select
  using (
    owner_id is null
    or is_public
    or owner_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "phrases_update_own" on public.phrases;
create policy "phrases_update_own"
  on public.phrases
  for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "phrases_delete_own" on public.phrases;
create policy "phrases_delete_own"
  on public.phrases
  for delete
  using (owner_id = auth.uid() or public.is_admin());
