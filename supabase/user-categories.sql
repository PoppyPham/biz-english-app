-- ============================================================================
-- User-owned categories
--   • owner_id NULL  → system/community category (existing, read-only)
--   • owner_id set    → a user's own category
--   • is_public       → user may publish (surfaced later via an "explore" page)
--   • Free users: max 5 categories. Admins: unlimited.
-- Run in Supabase SQL Editor. Safe to re-run. Depends on admin.sql (is_admin()).
-- ============================================================================

alter table public.categories
  add column if not exists owner_id   uuid references auth.users (id) on delete cascade,
  add column if not exists is_public  boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

alter table public.categories alter column sort_order set default 0;

-- categories was read-only before → grant write privileges (RLS still gates rows).
grant insert, update, delete on public.categories to authenticated;
grant usage, select on sequence public.categories_id_seq to authenticated;

create index if not exists categories_owner_idx on public.categories (owner_id);

-- ── Auto-generate a unique slug for user categories ─────────────────────────
create or replace function public.set_user_category_slug()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is not null and (new.slug is null or trim(new.slug) = '') then
    new.slug := regexp_replace(lower(trim(new.name)), '[^a-z0-9]+', '-', 'g');
    new.slug := trim(both '-' from new.slug);
    if new.slug = '' then new.slug := 'category'; end if;
    -- random suffix guarantees global uniqueness (categories.slug is unique)
    new.slug := new.slug || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  end if;
  return new;
end;
$$;

drop trigger if exists user_category_slug on public.categories;
create trigger user_category_slug
  before insert on public.categories
  for each row execute function public.set_user_category_slug();

-- ── Enforce the free-tier limit (max 5) for non-admins ──────────────────────
create or replace function public.enforce_user_category_limit()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is not null and not public.is_admin() then
    if (select count(*) from public.categories where owner_id = new.owner_id) >= 5 then
      raise exception 'FREE_CATEGORY_LIMIT' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_category_limit on public.categories;
create trigger user_category_limit
  before insert on public.categories
  for each row execute function public.enforce_user_category_limit();

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.categories enable row level security;

-- Users see system categories + their own. (Others' public categories are kept
-- for a future "explore" page and are not surfaced here yet.) Admins see all.
drop policy if exists "categories_select_all"     on public.categories;
drop policy if exists "categories_select_visible" on public.categories;
create policy "categories_select_visible"
  on public.categories
  for select
  using (owner_id is null or owner_id = auth.uid() or public.is_admin());

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own"
  on public.categories
  for insert
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own"
  on public.categories
  for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own"
  on public.categories
  for delete
  using (owner_id = auth.uid() or public.is_admin());
