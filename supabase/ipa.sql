-- ============================================================================
-- IPA (phonetic transcription) per phrase
--   • Stored on phrases.ipa (nullable text).
--   • Owners can set it on their own words (existing RLS update policy covers it).
--   • Community phrases can be curated via the dashboard; otherwise the app
--     auto-fetches IPA from the free Dictionary API at runtime.
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================================

alter table public.phrases add column if not exists ipa text;
