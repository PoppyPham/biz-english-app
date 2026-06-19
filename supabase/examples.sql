-- ============================================================================
-- Examples feature for BizEnglish
--   • phrase_examples : curated/system examples (up to 5 per phrase, public read)
--   • user_examples   : examples a user adds themselves (up to 5 per phrase)
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================================

-- ── System / curated examples ───────────────────────────────────────────────
create table if not exists public.phrase_examples (
  id          uuid primary key default gen_random_uuid(),
  phrase_id   uuid not null references public.phrases (id) on delete cascade,
  text        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists phrase_examples_phrase_id_idx
  on public.phrase_examples (phrase_id);

alter table public.phrase_examples enable row level security;

drop policy if exists "phrase_examples_select_all" on public.phrase_examples;
create policy "phrase_examples_select_all"
  on public.phrase_examples
  for select using (true);
-- No write policies → curate via dashboard / service-role key only.


-- ── User-contributed examples ───────────────────────────────────────────────
create table if not exists public.user_examples (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  phrase_id   uuid not null references public.phrases (id) on delete cascade,
  text        text not null check (char_length(trim(text)) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index if not exists user_examples_user_phrase_idx
  on public.user_examples (user_id, phrase_id);

alter table public.user_examples enable row level security;

drop policy if exists "user_examples_select_own" on public.user_examples;
create policy "user_examples_select_own"
  on public.user_examples
  for select using (auth.uid() = user_id);

drop policy if exists "user_examples_insert_own" on public.user_examples;
create policy "user_examples_insert_own"
  on public.user_examples
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_examples_delete_own" on public.user_examples;
create policy "user_examples_delete_own"
  on public.user_examples
  for delete using (auth.uid() = user_id);


-- ── Enforce max 5 user examples per (user, phrase) at the DB level ───────────
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
