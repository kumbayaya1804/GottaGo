# Phase 5: Trust Engine + Verification - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 26 (8 migrations, 5 pgTAP suites, 1 Edge Function, 7 client feature files, 5 UI surfaces)
**Analogs found:** 23 / 26 (3 partial/no-analog — all NEW surface: Edge Function, device-token RLS table, push-permission hook)

> Every SQL surface in this phase is a near-mechanical extension of a shipped Phase 3/4 migration. The planner should have each plan's action section point at the exact analog file + line range below and copy the header, auth-gate, `app_config` read, revoke/grant triple, and PostGIS idiom verbatim. The only genuinely new surface is the notification pipeline (05-05).

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `supabase/migrations/*_phase5_event_model.sql` | migration (schema evolution + lifecycle) | transform / event-driven | `20260707020000_phase4_submission_staging.sql` §1 + `20260710121534_..._lockdown.sql` | role-match (new: polymorphic FK, CHECK, unique idx) |
| `supabase/migrations/*_phase5_discovery_rpc.sql` | RPC (read) | request-response / CRUD-read | `20260704010002_phase3_search_rpcs.sql` (b) `search_locations_nearby` + `get_my_pending_submissions` | exact |
| `supabase/migrations/*_phase5_confidence_numeric.sql` | migration (column + backfill) | batch / transform | `20260704010001_phase3_max_pins_config.sql` (seed idiom) + `phase3_search_rpcs` (c) CASE tier | role-match |
| `supabase/migrations/*_phase5_verify_and_publish.sql` | RPC (write + atomic txn) | request-response + transform | `submit_location` (GPS validate) + `phase3_search_rpcs` (PostGIS distance) | role-match (new: FOR UPDATE, publish txn, trust append) |
| `supabase/migrations/*_phase5_app_config_seeds.sql` | migration (config seed) | config | `20260704010001_phase3_max_pins_config.sql` | exact |
| `supabase/migrations/*_phase5_impact_stat.sql` | RPC (read, extend) | request-response | `20260701211135_profile_stats_rpc.sql` `get_profile_stats` | exact |
| `supabase/migrations/*_phase5_notification_pipeline.sql` | migration (tables + RLS + register RPC) | event-driven / pub-sub | `submit_location` (RPC write) + lockdown ACL migration (RLS) | partial (owner-scoped token table + outbox are new) |
| `supabase/migrations/*_phase5_promote_stub.sql` | migration (disabled cron stub) | batch (disabled) | — | no analog (new; fail-closed stub) |
| `supabase/tests/phase5_event_model.test.sql` | test (pgTAP) | — | `phase4_submit.test.sql` §7 (RLS denial) | exact |
| `supabase/tests/phase5_discovery.test.sql` | test (pgTAP) | — | `phase4_submit.test.sql` §4 (caller-scoped) | exact |
| `supabase/tests/phase5_verify_publish.test.sql` | test (pgTAP, concurrency) | — | `phase4_submit.test.sql` (generic-error, role-switch) | role-match (new: 2-session concurrency) |
| `supabase/tests/phase5_confidence.test.sql` | test (pgTAP) | — | `phase4_submit.test.sql` | role-match |
| `supabase/tests/phase5_notifications.test.sql` | test (pgTAP, RLS + idempotency) | — | `phase5prep_verification_events_lockdown.test.sql` | role-match |
| `supabase/functions/drain-notification-outbox/index.ts` | Edge Function (Deno) | pub-sub / batch drain | — | no analog (no `supabase/functions/` exists) |
| `app/src/features/verify/verifyLocation.ts` | service (RPC wrapper) | request-response | `app/src/features/submit/submitLocation.ts` | exact |
| `app/src/features/verify/useVerifyCandidates.ts` | service (RPC wrapper) | request-response | `app/src/features/locations/useNearby.ts` `fetchNearby` | exact |
| `app/src/features/verify/useVerifyGpsSample.ts` | utility (GPS capture) | file-I/O (device sensor) | `app/src/features/submit/useGpsSample.ts` | exact |
| `app/src/features/verify/useVerify.ts` | hook (react-query mutation) | request-response | `(tabs)/submit.tsx` `useMutation` block (lines 144-150) | role-match |
| `app/src/features/verify/types.ts` | model (types) | — | `app/src/features/submit/types.ts` | exact |
| `app/src/features/notifications/registerPushToken.ts` | service (permission + RPC) | request-response | `useGpsSample.ts` (permission sentinel) + `withdrawSubmission.ts` (RPC call) | partial (expo-notifications new) |
| `app/src/features/notifications/usePushPermission.ts` | hook (permission priming) | event-driven | `useGpsSample.ts` `{denied:true}` sentinel | partial |
| `app/src/app/(modals)/verify.tsx` (VerifyFlow) | component (screen/wizard) | request-response | `(tabs)/submit.tsx` SubmitFlow | role-match |
| Candidate discovery list | component (list) | request-response | `(tabs)/nearby.tsx` NearbyScreen | exact |
| `app/src/app/(components)/PendingStatusSheet.tsx` (MODIFY) | component (bottom sheet) | request-response | itself (extend for "Published!" state) | exact (self) |
| `app/src/app/(tabs)/profile.tsx` (MODIFY) + `profileStats.ts` (MODIFY) | component + service | request-response | `profileStats.ts` + Profile stats block | exact (self) |

---

## Pattern Assignments

### Discovery RPC — `*_phase5_discovery_rpc.sql` (RPC read, request-response)

**Analog:** `supabase/migrations/20260704010002_phase3_search_rpcs.sql` (b) `search_locations_nearby` (lines 167-241) + `20260707020000_phase4_submission_staging.sql` §3 `get_my_pending_submissions` (lines 119-155)

**RPC skeleton + auth-gate + app_config read** (copy from submit_location lines 63-80):
```sql
language plpgsql security definer volatile set search_path = ''
as $$
declare v_radius numeric;
begin
  if auth.uid() is null then return; end if;        -- anon → zero rows (get_my_pending_submissions L135)
  -- Atomically claim last_discovery_at in private.verification_rate_limits.
  -- This write is why the RPC must be VOLATILE, not STABLE (D-36).
  select value::numeric into v_radius from public.app_config where key = 'discovery_radius_m';
  v_radius := coalesce(v_radius, 500);               -- always coalesce (submit_location L79); NEVER read verify_radius_m here — that key is the separate 100m hard server gate used only in verify_location
```

**PostGIS distance + KNN order** (search_locations_nearby lines 214-234, lng FIRST):
```sql
st_distance(s.coordinates, st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography)::double precision
...
order by s.coordinates <-> st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
limit least(result_limit, 10);                        -- cap 5-10 (D-37)
```
> NOTE: `phase3_search_rpcs.sql` uses BARE `st_*`; the 2026-07-10 remediation (`20260710010000_phase3_postgis_schema_qualification_fix.sql`) qualifies with `extensions.`. Follow the qualified `extensions.st_*` style of the most recent migration, as RESEARCH §Pattern 2 directs.

**Exclusions** (D-37 — own + already-verified; mirror the `where` shape of get_my_pending_submissions L147-149):
```sql
where s.status = 'pending' and s.expires_at > now()
  and s.submitter_id <> auth.uid()
  and not exists (select 1 from public.verification_events ve
                  where ve.submission_id = s.id and ve.user_id = auth.uid())
  and st_dwithin(s.coordinates, st_setsrid(st_makepoint(user_lng, user_lat),4326)::geography, v_radius)
```

**Revoke/grant triple** — authed-ONLY (copy get_my_pending_submissions lines 153-155; NOT the anon grant used by the Phase 3 search RPCs, since verification requires a signed-in user):
```sql
revoke execute on function public.search_pending_submissions_nearby(numeric,numeric,integer) from public;
revoke execute on function public.search_pending_submissions_nearby(numeric,numeric,integer) from anon;
grant  execute on function public.search_pending_submissions_nearby(numeric,numeric,integer) to authenticated;
```

**Explicit public-safe column list** — NEVER return `submitter_id`, `access_instructions`/code, `timing_tip`, or coords outside the radius (mirror the explicit `returns table (...)` in both analogs; see phase3_search_rpcs header comment lines 18-20).

---

### verify_location + atomic publish — `*_phase5_verify_and_publish.sql` (RPC write + atomic txn)

**Analog:** `submit_location` (`20260707020000_phase4_submission_staging.sql` lines 48-107) for the GPS-validation + generic-error block; `phase3_search_rpcs` for PostGIS distance.

**GPS triple validation — SINGLE generic error, never echo the check (copy submit_location lines 82-91):**
```sql
if p_mocked is true then return jsonb_build_object('accepted', false); end if;
if p_accuracy_m is null or p_accuracy_m > v_accuracy_floor then
  return jsonb_build_object('accepted', false); end if;
if p_captured_at is null or (now() - p_captured_at) > make_interval(secs => v_max_age_s) then
  return jsonb_build_object('accepted', false); end if;
```
> D-36 cooldown: atomically record the attempt in the private rate-limit table BEFORE domain validation and RETURN a reason-free rejection. Raising would abort the RPC transaction and roll the cooldown write back.

**Server-computed weight (NEVER trust client; RESEARCH §Pattern 3, linear decay D-56):**
```sql
-- proximity_decay = greatest(0, 1 - distance_m / v_radius_m)
-- accuracy_decay  = greatest(0, 1 - accuracy_m / v_accuracy_span)
-- weight = case when shadowbanned then 0 else v_multiplier * proximity_decay * accuracy_decay end
```
Read shadowban server-side via `auth.uid()` — never a client param (Pitfall 3, mirror family_mode read in phase3_search_rpcs lines 70-73).

**Concurrency-safe deciding verifier (RESEARCH §Pattern 5 — NEW pattern, no analog):**
```sql
select * into v_submission from public.submissions where id = p_submission_id for update;
-- Require pending, unexpired, non-own target before inserting any event.
select 1 + count(distinct ve.user_id) into v_confirmation_count
  from public.verification_events ve
 where ve.submission_id = p_submission_id and ve.weight > 0
   and ve.user_id <> v_submission.submitter_id;
if v_confirmation_count >= v_publish_threshold then -- creator implicit claim + independent verifier
                          -- copy submission_tags→tags, carry pending_access_code, trust_events, outbox
end if;
```
Idempotency: re-check `status='pending'` under the lock so a retried deciding call is a no-op.

**Publish INSERT into locations** — mirror the staged-column list from `submit_location` §1 (submission_staging lines 28-37); those columns were deliberately typed to mirror `locations` for a clean copy.

**Revoke/grant triple** — authed-only (submit_location lines 109-111 pattern).

---

### Event-model evolution — `*_phase5_event_model.sql` (migration, transform)

**Analog:** `20260707020000_phase4_submission_staging.sql` §1 (`alter table ... add column if not exists`, lines 28-37) for the ALTER idiom; `20260710121534_verification_events_client_write_acl_lockdown.sql` (whole file) for the ACL contract that MUST be preserved.

**Polymorphic FK + exactly-one CHECK + uniqueness (RESEARCH §Pattern 4):**
```sql
alter table public.verification_events
  add column if not exists submission_id uuid references public.submissions(id),
  alter column location_id drop not null;
alter table public.verification_events
  add constraint verification_events_target_exactly_one check (num_nonnulls(submission_id, location_id) = 1);
create unique index verification_events_user_submission_uniq
  on public.verification_events (user_id, submission_id) where submission_id is not null;   -- D-43
```

**Lifecycle CHECK** — add `cancelled` (D-58) + `expired` (D-59) to the `submissions.status` CHECK. RESEARCH Assumption A3: verify the current CHECK allows `pending/published/expired/rejected` before altering; a missing `cancelled` value makes the D-58 write fail.

**submission_tags staging table** (D-62/63, exactly 2 keys) — model on the `public.tags (location_id, key, value)` shape referenced in `phase3_search_rpcs.sql` filter subqueries (lines 108-116).

**Evidence columns:** reuse shipped `gps_location` and `distance_from_location_meters`; add only missing accuracy/capture/purge-deadline fields. Do not create parallel `distance_m`, `gps_lat`, or `gps_lon` authorities. Index the new submission_id FK.

**PRESERVE lockdown** — do not re-add broad client grants; the lockdown migration (lines 17-18) leaves `authenticated` with SELECT-only. Add a pgTAP regression asserting direct `authenticated` INSERT still raises 42501 (Pitfall 7).

---

### Confidence numeric column + backfill — `*_phase5_confidence_numeric.sql` (migration, batch)

**Analog:** `20260704010001_phase3_max_pins_config.sql` for the additive migration comment style; `phase3_search_rpcs.sql` (c) lines 118-119 for the CASE tier ordering that must NOT be repeated against TEXT.

**Pitfall 2:** never order/threshold on confidence_score TEXT. Make a 0..100 numeric column the writable authority and derive the display label through an app_config-aware helper used by every public reader. A generated column cannot query app_config, so do not combine "tunable thresholds" with an impossible generated-column promise.

---

### app_config seeds — `*_phase5_app_config_seeds.sql` (migration, config)

**Analog:** `20260704010001_phase3_max_pins_config.sql` (whole file, lines 13-14) — EXACT.
```sql
insert into public.app_config (key, value, description) values
  ('discovery_radius_m', '500', 'Discovery + decay radius in meters (D-35/D-56)'),
  ('verify_cooldown_s', '3', 'Per-user verification cooldown (D-36)'),
  ('accuracy_floor_m', '100', 'Hard GPS-accuracy reject floor (D-46)'),
  ...;
```
`value` is TEXT. RPCs read with `coalesce()`. `verify_radius_m=100` already exists and remains the hard server gate; never overwrite it with the 500m discovery/decay value.

---

### Impact stat — `*_phase5_impact_stat.sql` + `profileStats.ts` (MODIFY) (RPC read + service)

**Analog (SQL):** `20260701211135_profile_stats_rpc.sql` `get_profile_stats` (whole file, lines 16-38) — EXACT. Add a 4th JSON key:
```sql
'bathrooms_helped', (
  select gps_verified_contribution_count from public.users where id = auth.uid()
),
```
Server-maintained count (D-65) — incremented inside the publish txn for qualifying distinct nonzero verifications (RESEARCH §Pattern 9). Keep `language sql security definer stable set search_path = public` and the authed-only revoke/grant triple (lines 36-38).

**Analog (client):** `app/src/features/profile/profileStats.ts` (whole file, lines 24-35) — add `bathroomsHelped` to the `ProfileStats` interface + `GetProfileStatsRpcResult` + the `?? 0` mapping (lines 30-34).

---

### Notification pipeline — `*_phase5_notification_pipeline.sql` (migration, NEW surface — partial analog)

**register_device_token RPC** — mirror `submit_location`'s SECURITY DEFINER write shape + authed-only triple (submission_staging lines 63-111). Owner-scoped: derive owner via `auth.uid()`, never a param.

**device_tokens RLS** — owner-scoped, RLS never exposes another user's token. Model the least-privilege ACL comment + `revoke all ... grant select` from `20260710121534_verification_events_client_write_acl_lockdown.sql` (lines 1-18). Add a pgTAP RLS-isolation test (mirror `phase5prep_verification_events_lockdown.test.sql`).

**notification_outbox** — idempotent ENQUEUE inside the publish txn (unique submission_id) plus claim/attempt/ticket/receipt/backoff state. The consumer claims with a service-only `FOR UPDATE SKIP LOCKED` RPC. This prevents duplicate enqueue/concurrent claims; it does not promise exactly-once delivery across Expo's external boundary.

**Edge Function** `supabase/functions/drain-notification-outbox/index.ts` — NO analog. Fetch SDK-55 docs at implementation time. Read Supabase secret keys from function environment; validate a custom cron bearer secret. Vault stores the scheduled invocation URL/secret only. Persist Expo tickets, check receipts, revoke DeviceNotRegistered tokens, and back off on transient failures. Every push/deploy/secret/schedule remains separately authorized.

---

### VerifyFlow client service — `verify/verifyLocation.ts` (service, request-response)

**Analog:** `app/src/features/submit/submitLocation.ts` (whole file, lines 16-39) — EXACT.
```ts
export async function verifyLocation(input: VerifyInput): Promise<VerifyResult> {
  const { data, error } = await supabase.rpc('verify_location', args);
  if (error) throw error;          // rethrow RAW — wizard maps to accepted/rejected/denied copy, NOT here (SC7)
  return data as VerifyResult;
}
```
Args typed via `Database['public']['Functions']['verify_location']['Args']` (submitLocation line 5). Regenerate `database.types.ts` after the migration.

---

### Candidate fetch — `verify/useVerifyCandidates.ts` (service, request-response)

**Analog:** `app/src/features/locations/useNearby.ts` `fetchNearby` (whole file, lines 21-38) — EXACT. `supabase.rpc('search_pending_submissions_nearby', {...})` → `if (error) throw error` → map snake_case rows to camelCase, preserving KNN order.

---

### GPS capture — `verify/useVerifyGpsSample.ts` (utility, device I/O)

**Analog:** `app/src/features/submit/useGpsSample.ts` (whole file, lines 20-36) — EXACT. `Accuracy.BestForNavigation`, `mocked: pos.mocked ?? false` (Android-only), `{denied:true}` sentinel on non-granted permission (never throws → renders the denied state, never a dead end, per UI-SPEC state machine).

---

### VerifyFlow screen — `(modals)/verify.tsx` (component, screen)

**Analog:** `app/src/app/(tabs)/submit.tsx` SubmitFlow (whole file). Reuse:
- `useMutation` block (lines 144-150) for accepted/rejected states
- LOCKED-copy-const pattern (lines 44-62) — put all UI-SPEC §Copywriting strings as `const` at top; map ANY RPC error to the SINGLE ERR-09 string "Unable to verify your location. Please try again." — the client MUST NOT branch copy on the error (SC7 / UI-SPEC).
- GPS advisory pre-check (lines 195-206): accuracy ≤50m AND within 100m enables the "I'm Here" 56pt CTA; live readout uses `successGreen`/`warningAmber` glyph+text pairing (lines 522-541). This client readout is advisory only and leaks nothing (UI-SPEC "Client vs server distinction").
- Design tokens: `Colors[colorScheme]`, `spacing`, `typography`, `radius` from `../../constants/*` — never raw values (UI-SPEC Design System).

**Candidate discovery list** analog: `(tabs)/nearby.tsx` NearbyScreen (lines 1-60 + list body) — `useQuery` + `FlatList`, LOCKED empty-state copy consts (lines 28-39), row → tap opens the Verify modal.

---

### PendingStatusSheet extension (MODIFY, component)

**Analog:** itself — `app/src/app/(components)/PendingStatusSheet.tsx` (whole file). Extend to render the D-68 "Published!" resolved state when `status='published'` on next view. Keep `PUBLISH_THRESHOLD = 2` (line 30) and the LOCKED `progressCopy()` (lines 37-39). Add the NEW "Published!" heading/body (UI-SPEC §Progress indicator) using the existing `successGreen` + badge/`BottomSheetView` scaffold (lines 88-133). D-58: the existing WithdrawConfirmModal wiring stays, but withdrawal now moves to `cancelled` server-side (no client change beyond confirm copy).

---

## Shared Patterns

### SECURITY DEFINER RPC skeleton (ALL new RPCs)
**Source:** `submit_location` (`20260707020000_phase4_submission_staging.sql` lines 63-80, 109-111)
**Apply to:** discovery RPC, verify_location, register_device_token, get_profile_stats extension
```sql
language plpgsql security definer set search_path = public   -- read RPCs add `stable`
as $$ begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select value::numeric into v_x from public.app_config where key = '...';
  v_x := coalesce(v_x, <fallback>);
  ...
end; $$;
revoke execute on function public.f(...) from public;
revoke execute on function public.f(...) from anon;
grant  execute on function public.f(...) to authenticated;
```
Anti-pattern (RESEARCH §Pattern 1): granting to `anon`, omitting `set search_path`, `select *` / `setof locations`, reading shadowban/family_mode from a client param.

### PostGIS lng-FIRST (all spatial SQL)
**Source:** `phase3_search_rpcs.sql` lines 214-234 (bare) / `20260710010000_phase3_postgis_schema_qualification_fix.sql` (qualified)
**Apply to:** discovery RPC, verify_location distance, GiST index
`st_setsrid(st_makepoint(lng, lat), 4326)::geography` — longitude FIRST. `st_distance` for meters, `<->` for KNN order, `st_dwithin` for the radius predicate. Use the `extensions.`-qualified form of the newest migration.

### Generic single-error rejection (SC7)
**Source:** `submit_location` lines 82-91 (SQL) + `submit.tsx` error-mapping consts lines 57-62 (client)
**Apply to:** verify_location returns only `{accepted:false}` for expected domain denials so the cooldown write commits; it exposes no reason. VerifyFlow maps accepted=false and thrown transport/system errors to the same ERR-09 copy.

### app_config tunable read with coalesce (all tunables)
**Source:** `submit_location` lines 77-80; seed idiom `20260704010001_phase3_max_pins_config.sql`
**Apply to:** radius, cooldown, accuracy floor, decay constants, confidence thresholds, mid-tier start. Seed as TEXT rows; read with `coalesce()` fallback. Never hardcode in the RPC body.

### pgTAP conventions (all test suites)
**Source:** `supabase/tests/phase4_submit.test.sql` (whole file)
**Apply to:** all Phase 5 suites. Use transaction/fixtures/role impersonation/finish+rollback conventions. Expected verification denials assert the identical reason-free return shape and persisted cooldown; privilege violations still use throws_ok/42501. Phase 5 pgTAP execution is blocking before live push, not another carry-forward override.

### Design tokens (all UI)
**Source:** `PendingStatusSheet.tsx` lines 4-7 / `submit.tsx` lines 17-20
**Apply to:** VerifyFlow, candidate list, Published state, impact stat. Import `Colors`/`spacing`/`typography`/`radius` from `../../constants/*`; reference `Colors[colorScheme]`; never raw hex or px. Honor the D-33 approved 5-size/3-weight + 12/20 spacing exception (UI-SPEC).

### GPS permission sentinel (verify + notifications)
**Source:** `useGpsSample.ts` lines 20-24 (`{denied:true}` sentinel)
**Apply to:** `useVerifyGpsSample.ts` (verify GPS) and `registerPushToken.ts`/`usePushPermission.ts` (push permission denied → return null / render fallback, never a dead end; D-68).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/functions/drain-notification-outbox/index.ts` | Edge Function (Deno) | pub-sub drain | No `supabase/functions/` dir exists in the repo today; entirely new surface (05-05). Follow RESEARCH §Code Examples + SDK-55 docs at implement time. |
| `*_phase5_promote_stub.sql` | migration (disabled cron stub) | batch (disabled) | No auto-promotion path exists; D-60 ships a fail-closed stub only. No prior cron/scheduler migration to copy. |
| `app/src/features/notifications/usePushPermission.ts` | hook (permission priming) | event-driven | `expo-notifications` is a NEW dependency; only the `{denied:true}` sentinel shape from `useGpsSample.ts` transfers. Version resolved via `npx expo install` (gated checkpoint). |

**Partial-analog files** (structure copies cleanly; one new dependency each): `registerPushToken.ts`, `*_phase5_notification_pipeline.sql` (register RPC + RLS reuse shipped idioms; the owner-scoped token table + idempotent outbox are new tables).

---

## Metadata

**Analog search scope:** `supabase/migrations/` (27 files), `supabase/tests/` (5 files), `app/src/features/{submit,profile,locations}/`, `app/src/app/(components)/`, `app/src/app/(tabs)/`
**Files scanned (read in full or targeted):** 12 primary analogs (submission_staging, phase3_search_rpcs, profile_stats_rpc, verification_events lockdown, max_pins_config, phase4_submit.test, submitLocation, useGpsSample, profileStats, withdrawSubmission, useNearby, useLocationDetail, PendingStatusSheet, submit.tsx, nearby.tsx)
**Pattern extraction date:** 2026-07-11

**Key patterns identified:**
- Every Phase 5 RPC = `submit_location`/`get_my_pending_submissions` skeleton (SECURITY DEFINER, `set search_path`, `auth.uid()` gate, `app_config` coalesce read, authed-only revoke/anon-revoke/authenticated-grant triple, explicit public-safe column lists).
- All spatial SQL = lng-first `st_setsrid(st_makepoint(lng,lat),4326)::geography`, `st_distance`/`<->`/`st_dwithin`, prefer the `extensions.`-qualified form of the newest migration.
- All client RPC wrappers = `supabase.rpc(...)` → `if (error) throw error` → snake→camel map; the wizard (not the service) maps errors to LOCKED copy (SC7).
- The concurrency-safe deciding-verifier publish (FOR UPDATE + re-count + atomic publish) and the notification outbox/Edge Function are the only genuinely new engineering; everything else is convention-following.
