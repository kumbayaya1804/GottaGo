-- Phase 5 — pgTAP regression suite for submit_location's name rules
-- (20261016010000_phase5_submission_name_hardening.sql).
-- Run locally with:  supabase test db   (requires Docker)
--
-- A name must contain at least one visible character and be at most 120 characters.
-- "Visible" excludes whitespace AND invisible formatting characters (zero-width space,
-- BOM, soft hyphen, bidi marks, ...), listed explicitly rather than through the locale's
-- [:space:] class, whose membership varies by database locale. The app's form applies
-- the same list (app/src/features/submit/submitSchema.ts), so an input the form accepts
-- is never rejected here.
--
-- Every call runs as the real `authenticated` role, not the connection role.

begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'a8000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'p5nh-creator@example.com');

select set_config('request.jwt.claims',
  json_build_object('sub', 'a8000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

-- ═══ Invisible-only names are rejected ═══════════════════════════════════════
select throws_ok(
  $$ select public.submit_location(chr(8203), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a zero-width-space-only name (U+200B)');
select throws_ok(
  $$ select public.submit_location(chr(65279), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a BOM-only name (U+FEFF)');
select throws_ok(
  $$ select public.submit_location(chr(6158) || chr(8204) || chr(8205) || chr(8288), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a name of U+180E, ZWNJ, ZWJ and word joiner only');
select throws_ok(
  $$ select public.submit_location(chr(173) || chr(8206) || chr(8207), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a name of soft hyphen and bidi marks only');
select throws_ok(
  $$ select public.submit_location(chr(160) || chr(133) || chr(12288) || chr(8239), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a name of NBSP, NEL, ideographic and narrow no-break spaces only');

-- Further invisible characters: bidi isolates, Arabic letter mark, blank-rendering
-- fillers, variation selectors, tag characters, musical format controls, and CGJ.
select throws_ok(
  $$ select public.submit_location(chr(8294), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a LEFT-TO-RIGHT ISOLATE-only name (U+2066)');
select throws_ok(
  $$ select public.submit_location(chr(1564) || chr(8295) || chr(8296) || chr(8297), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a name of U+061C and U+2067-2069 only');
select throws_ok(
  $$ select public.submit_location(chr(12644) || chr(4447) || chr(65440), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a name of Hangul fillers only (U+3164, U+115F, U+FFA0)');
select throws_ok(
  $$ select public.submit_location(chr(10240), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a Braille-blank-only name (U+2800)');
select throws_ok(
  $$ select public.submit_location(chr(65024) || chr(65039) || chr(847), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a name of variation selectors and CGJ only');
select throws_ok(
  $$ select public.submit_location(chr(917505) || chr(917536) || chr(119155), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a name of tag characters and a musical format control only');
-- Control characters print nothing: C0 (U+0001-001F), DEL, C1 (U+0080-009F), and the
-- interlinear annotation controls U+FFF9-FFFB.
select throws_ok(
  $$ select public.submit_location(chr(1), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a U+0001-only name (C0 control)');
select throws_ok(
  $$ select public.submit_location(chr(27) || chr(31) || chr(127), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a name of ESC, U+001F and DEL only');
select throws_ok(
  $$ select public.submit_location(chr(128) || chr(150) || chr(159), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a name of C1 controls only');
select throws_ok(
  $$ select public.submit_location(chr(65529) || chr(65531), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a name of interlinear annotation controls only');
select lives_ok(
  $$ select public.submit_location('I ' || chr(10084) || chr(65039) || ' parks', 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'accepts an emoji with a variation selector inside a real name');

-- ═══ Length cap ═══════════════════════════════════════════════════════════════
select throws_ok(
  $$ select public.submit_location(repeat('a', 121), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'P0001', 'invalid submission', 'rejects a 121-character name');
select lives_ok(
  $$ select public.submit_location(repeat('a', 120), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'accepts a 120-character name');

-- ═══ Real names still pass ════════════════════════════════════════════════════
select lives_ok(
  $$ select public.submit_location('Café Ñandú', 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'accepts accented Latin letters');
select lives_ok(
  $$ select public.submit_location('图书馆 洗手间', 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'accepts CJK text with an interior space');
select lives_ok(
  $$ select public.submit_location('Park ' || chr(128701), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'accepts a name with an emoji');
select lives_ok(
  $$ select public.submit_location('A' || chr(8203) || 'B', 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'accepts a visible name that contains an invisible character');
select lives_ok(
  $$ select public.submit_location(repeat(chr(128701), 120), 44.05, -123.09, 10::numeric, false, now(), 'chill_spot') $$,
  'counts characters, not bytes: 120 emoji are accepted');

reset role;
select is(
  (select count(*)::int from public.submissions
    where submitter_id = 'a8000000-0000-0000-0000-000000000001'),
  7,
  'exactly the seven valid names were staged');

select * from finish();
rollback;
