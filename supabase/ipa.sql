-- ============================================================================
-- IPA (phonetic transcription) per phrase
--   • Stored on phrases.ipa (nullable text).
--   • Owners can set it on their own words (existing RLS update policy covers it).
--   • Community phrases can be curated via the dashboard; otherwise the app
--     auto-fetches IPA from the free Dictionary API at runtime.
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================================

alter table public.phrases add column if not exists ipa text;

-- ── Cache backfill RPC ───────────────────────────────────────────────────────
-- Lets the client save an auto-fetched IPA back to the DB. SECURITY DEFINER so
-- it bypasses RLS (community phrases have no owner), but it ONLY writes when the
-- IPA is currently empty — so it can't overwrite or vandalise existing values.
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
