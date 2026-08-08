-- ============================================================================
-- BizEnglish — full schema (mirrors production)
-- ============================================================================

-- ── categories ───────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id         serial primary key,
  name       text   not null,
  slug       text   not null unique,
  emoji      text,
  sort_order int
);

alter table public.categories enable row level security;

create policy "categories_select_all"
  on public.categories
  for select using (true);


-- ── phrases ──────────────────────────────────────────────────────────────────
create table if not exists public.phrases (
  id          serial primary key,
  phrase      text        not null,
  definition  text,
  example     text,
  category_id int         references public.categories (id),
  created_at  timestamptz not null default now(),
  owner_id    uuid        references auth.users (id) on delete cascade,
  is_public   boolean     not null default false,
  ipa         text
);

create index if not exists phrases_category_id_idx on public.phrases (category_id);
create index if not exists phrases_owner_idx        on public.phrases (owner_id);

alter table public.phrases enable row level security;


-- ── admins + is_admin() ───────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

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


-- ── phrases RLS (owner + admin) ───────────────────────────────────────────────
create policy "phrases_select_visible"
  on public.phrases
  for select
  using (
    owner_id is null
    or is_public
    or owner_id = auth.uid()
    or public.is_admin()
  );

create policy "phrases_insert_own"
  on public.phrases
  for insert
  with check (owner_id = auth.uid());

create policy "phrases_update_own"
  on public.phrases
  for update
  using  (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create policy "phrases_delete_own"
  on public.phrases
  for delete
  using (owner_id = auth.uid() or public.is_admin());


-- ── IPA cache helper ──────────────────────────────────────────────────────────
create or replace function public.set_phrase_ipa(p_id integer, p_ipa text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.phrases
     set ipa = p_ipa
   where id = p_id
     and coalesce(nullif(trim(ipa), ''), null) is null
     and p_ipa is not null
     and trim(p_ipa) <> '';
end;
$$;

grant execute on function public.set_phrase_ipa(integer, text) to anon, authenticated;


-- ── user_progress ────────────────────────────────────────────────────────────
create table if not exists public.user_progress (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  phrase_id  int         not null references public.phrases (id) on delete cascade,
  status     text        not null default 'new'
               check (status in ('new', 'learning', 'learned')),
  is_favorite boolean    not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, phrase_id)
);

create index if not exists user_progress_user_status_idx
  on public.user_progress (user_id, status);

create index if not exists user_progress_favorites_idx
  on public.user_progress (user_id, is_favorite)
  where is_favorite;

alter table public.user_progress enable row level security;

create policy "user_progress_select_own"
  on public.user_progress
  for select using (auth.uid() = user_id);

create policy "user_progress_insert_own"
  on public.user_progress
  for insert with check (auth.uid() = user_id);

create policy "user_progress_update_own"
  on public.user_progress
  for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_progress_delete_own"
  on public.user_progress
  for delete using (auth.uid() = user_id);


-- ── phrase_examples (curated) ────────────────────────────────────────────────
create table if not exists public.phrase_examples (
  id         uuid    primary key default gen_random_uuid(),
  phrase_id  integer not null references public.phrases (id) on delete cascade,
  text       text    not null,
  sort_order int     not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists phrase_examples_phrase_id_idx
  on public.phrase_examples (phrase_id);

alter table public.phrase_examples enable row level security;

create policy "phrase_examples_select_all"
  on public.phrase_examples
  for select using (true);


-- ── user_examples ────────────────────────────────────────────────────────────
create table if not exists public.user_examples (
  id        uuid    primary key default gen_random_uuid(),
  user_id   uuid    not null references auth.users (id) on delete cascade,
  phrase_id integer not null references public.phrases (id) on delete cascade,
  text      text    not null check (char_length(trim(text)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists user_examples_user_phrase_idx
  on public.user_examples (user_id, phrase_id);

alter table public.user_examples enable row level security;

create policy "user_examples_select_own"
  on public.user_examples
  for select using (auth.uid() = user_id);

create policy "user_examples_insert_own"
  on public.user_examples
  for insert with check (auth.uid() = user_id);

create policy "user_examples_delete_own"
  on public.user_examples
  for delete using (auth.uid() = user_id);

create or replace function public.enforce_user_examples_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*) from public.user_examples
    where user_id = new.user_id and phrase_id = new.phrase_id
  ) >= 5 then
    raise exception 'You can add at most 5 examples per phrase.';
  end if;
  return new;
end;
$$;

drop trigger if exists user_examples_limit on public.user_examples;
create trigger user_examples_limit
  before insert on public.user_examples
  for each row execute function public.enforce_user_examples_limit();


-- ── Role grants (required by PostgREST; dashboard adds these automatically) ──
grant usage on schema public to anon, authenticated;

grant select                       on public.categories      to anon, authenticated;
grant select                       on public.phrases         to anon, authenticated;
grant select, insert, update, delete on public.user_progress to authenticated;
grant select                       on public.phrase_examples to anon, authenticated;
grant select, insert, delete       on public.user_examples   to authenticated;
grant select, insert, update, delete on public.phrases       to authenticated;
