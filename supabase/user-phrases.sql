-- ============================================================================
-- User-owned phrases + community visibility
--   • owner_id NULL          → original community phrase (read-only for all)
--   • owner_id = a user       → private to that user (their "Your Words")
--   • is_public = true        → owner published it; visible to everyone
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================================

-- ── Ownership / visibility columns ──────────────────────────────────────────
alter table public.phrases
  add column if not exists owner_id   uuid references auth.users (id) on delete cascade,
  add column if not exists is_public  boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

-- User words have no category → allow NULL.
alter table public.phrases alter column category_id drop not null;

create index if not exists phrases_owner_idx on public.phrases (owner_id);

-- ── Ensure phrases.id auto-generates on insert (users create new rows) ───────
do $$
declare has_default boolean;
begin
  select (column_default is not null or is_identity = 'YES')
    into has_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'phrases' and column_name = 'id';

  if not coalesce(has_default, false) then
    create sequence if not exists public.phrases_id_seq owned by public.phrases.id;
    perform setval(
      'public.phrases_id_seq',
      coalesce((select max(id) from public.phrases), 0) + 1,
      false
    );
    alter table public.phrases alter column id set default nextval('public.phrases_id_seq');
  end if;
end $$;

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.phrases enable row level security;

-- Replace the old "everyone can read everything" policy with a visibility rule.
drop policy if exists "phrases_select_all"     on public.phrases;
drop policy if exists "phrases_select_visible" on public.phrases;
create policy "phrases_select_visible"
  on public.phrases
  for select
  using (owner_id is null or is_public or owner_id = auth.uid());

drop policy if exists "phrases_insert_own" on public.phrases;
create policy "phrases_insert_own"
  on public.phrases
  for insert
  with check (owner_id = auth.uid());

drop policy if exists "phrases_update_own" on public.phrases;
create policy "phrases_update_own"
  on public.phrases
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "phrases_delete_own" on public.phrases;
create policy "phrases_delete_own"
  on public.phrases
  for delete
  using (owner_id = auth.uid());
