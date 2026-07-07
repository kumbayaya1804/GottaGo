# Phase 4: GPS Service & Submission - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 22 (new/modified)
**Analogs found:** 21 / 22 (SubmitFlow wizard = compose-from-multiple; no single multi-step analog exists)

> Read alongside RESEARCH.md — its §"Architecture Patterns" gives the exact RPC bodies. This file maps each new file to the **closest shipped code to copy from**, with line numbers. Where RESEARCH already wrote the SQL, the analog here is the *style/convention* source (grants, auth-gate, hardening) the executor must match verbatim.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/XXXXXX_phase4_submission_staging.sql` (ALTER submissions + locations) | migration | batch/DDL | `20260704010000_phase3_suppressed_at.sql` + `20260519010000_remote_schema.sql` | role-match |
| `submit_location` RPC (migration) | migration / write RPC | request-response | `20260627000004_profile_rpcs.sql` (`update_profile`) | exact |
| `update_access_code` RPC (migration) | migration / write RPC | request-response | `20260627000004_profile_rpcs.sql` (`update_profile`) | exact |
| `withdraw_submission` RPC (migration) | migration / write RPC | request-response | `20260627000004_profile_rpcs.sql` (`delete_account`) | exact |
| `get_my_pending_submissions` RPC (migration) | migration / read RPC | request-response | `20260704010002_phase3_search_rpcs.sql` (`search_locations_nearby`) | exact |
| `get_access_code` RPC (migration, authed-only) | migration / read RPC | request-response | `get_location_detail` (body) + `update_profile` (authed-only grants) | role-match |
| `app/src/features/submit/useGpsSample.ts` | hook | file-I/O (device sensor) | `features/locations/useCurrentPosition.ts` | exact |
| `app/src/features/submit/submitLocation.ts` | service | request-response (mutation) | `features/profile/updateProfile.ts` | exact |
| `app/src/features/submit/updateAccessCode.ts` | service | request-response (mutation) | `features/profile/updateProfile.ts` | exact |
| `app/src/features/submit/withdrawSubmission.ts` | service | request-response (mutation) | `features/profile/deleteAccount.ts` | exact |
| `app/src/features/submit/useMyPendingSubmissions.ts` | service | request-response (query→GeoJSON) | `features/locations/useLocationsBbox.ts` | exact |
| `app/src/features/submit/submitSchema.ts` | utility (validation) | transform | `features/auth/validation.ts` | exact |
| `app/src/features/submit/types.ts` | utility (types) | transform | `features/locations/types.ts` | exact |
| `app/src/app/(tabs)/submit.tsx` (SubmitFlow wizard) | component (screen) | request-response | *compose:* `FilterChipRow.tsx` (segmented/toggle) + `(auth)/sign-up.tsx` (RHF+Zod form) + `DeleteAccountModal.tsx` (confirm) | partial (no multi-step analog) |
| Pending-status sheet (new content variant) | component | request-response | `(components)/LocationDetailSheet.tsx` | exact |
| "Update door code" button + code-update UI (modify `LocationDetailSheet.tsx`) | component | request-response | `LocationDetailSheet.tsx` (self) + `DeleteAccountModal.tsx` | exact |
| Sensitivity confirm (D-15) + Withdraw confirm (D-30) dialogs | component | event-driven | `(components)/DeleteAccountModal.tsx` | exact |
| Pending-pin map layer (modify `(tabs)/index.tsx`) | component | streaming (map) | `(tabs)/index.tsx` (self — existing `ShapeSource`/`CircleLayer`) | exact |
| `access_sensitivity` switch (Step 1) | component | event-driven | `FilterChipRow.tsx` (toggle) + RN `Switch` | role-match |
| `supabase/tests/phase4_submit.test.sql` (pgTAP) | test | request-response | `supabase/tests/phase3_read_rpcs.test.sql` | exact |
| `features/submit/__tests__/*.test.ts` (unit, MSW/jest) | test | request-response | `features/profile/__tests__/updateProfile.test.ts` + `useCurrentPosition.test.ts` | exact |
| `expo-location` jest mock + MSW handlers | test infra | — | existing `jest.setup.ts` expo-location mock + `updateProfile.test.ts` supabase mock | role-match |

---

## Pattern Assignments

### `submit_location` / `update_access_code` / `withdraw_submission` RPCs (migration, write)

**Analog:** `supabase/migrations/20260627000004_profile_rpcs.sql`

This file is the **canonical write-RPC template** for the phase. RESEARCH §Pattern 2/5 already wrote the `submit_location` body; copy the *scaffolding conventions* from here verbatim.

**Auth-gate + SECURITY DEFINER header** (lines 26-45, `update_profile`):
```sql
create or replace function public.update_profile(new_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.users
    set display_name = new_display_name, updated_at = now()
  where id = auth.uid();
end;
$$;

revoke execute on function public.update_profile(text) from public;
revoke execute on function public.update_profile(text) from anon;
grant execute on function public.update_profile(text) to authenticated;
```
- Copy the `security definer` + `set search_path = public` + `if auth.uid() is null then raise exception 'not authenticated'` header into all four write RPCs (RESEARCH Pitfall 5, D-18).
- **Critical (Pitfall 5):** every write RPC needs BOTH `revoke ... from public` AND `revoke ... from anon`, THEN `grant ... to authenticated` — the full triple, with the **exact argument type signature** in each revoke/grant (see RESEARCH Pattern 2 lines 282-284 for `submit_location`'s 12-arg signature).
- Write RPCs are **NOT `stable`** (they mutate) — omit `stable` (contrast the read RPCs below which use it).

**Self-scoped mutation pattern for `withdraw_submission`** (lines 48-74, `delete_account`):
```sql
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  ...
  update submissions set submitter_id = null where submitter_id = uid;
```
- `withdraw_submission(id)` mirrors this `uid := auth.uid()` capture, then `DELETE FROM submissions WHERE id = $1 AND submitter_id = uid AND status = 'pending'` (RESEARCH Pitfall 6 / D-29 — DELETE, never a `status='withdrawn'` value, which the CHECK constraint forbids).

---

### `submit_location` GPS validation specifics (migration, write)

**Analog for config reads:** `20260704010002_phase3_search_rpcs.sql` lines 75-77 (`search_locations_bbox`)

```sql
select value::integer into v_max_pins from public.app_config where key = 'max_pins_per_viewport';
v_max_pins := coalesce(v_max_pins, 200);
```
- Copy this `app_config` read-with-`coalesce`-fallback shape for `max_accuracy_m` (50) and `max_gps_age_s` (60) — RESEARCH Pattern 2 lines 252-255. Do NOT hardcode thresholds in the client (RESEARCH "Don't Hand-Roll").
- Coordinate write: `st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography` — matches the read RPCs' `st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography` (lines 215, 234). **Note `lng` first** in `st_makepoint`.
- Generic error only (`raise exception 'gps rejected'`) — SC7 / RESEARCH Anti-Pattern; never echo which check failed.

---

### `get_my_pending_submissions` / `get_access_code` RPCs (migration, read)

**Analog:** `20260704010002_phase3_search_rpcs.sql` (`search_locations_nearby`, lines 167-241)

**Read-RPC header + `auth.uid()` scoping** (lines 190-201):
```sql
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_family boolean := false;
begin
  if auth.uid() is not null then
    select family_mode into v_family from public.users where id = auth.uid();
  end if;
```
- Reads ARE `stable` (contrast the write RPCs above).
- `get_my_pending_submissions` scopes by identity in ONE place: `where s.submitter_id = auth.uid() and s.status = 'pending'` (RESEARCH Pattern 4 lines 300-320). This is the entire "visible only to submitter" enforcement — do NOT touch the five Phase 3 readers (RESEARCH Anti-Pattern, §Summary).

**Coordinate extraction for pin rendering** (lines 205-207):
```sql
st_y(l.coordinates::geometry)::double precision as lat,
st_x(l.coordinates::geometry)::double precision as lng,
```
- `get_my_pending_submissions` returns `lat`/`lng` via the same `st_y`/`st_x(...::geometry)` extraction (RESEARCH Pattern 4 lines 311-312) so the client GeoJSON transform is identical to the published path.

**Grants divergence:** `search_locations_*` grant to BOTH `anon` and `authenticated` (lines 239-241). The Phase 4 read RPCs are **authed-only** — grant to `authenticated` ONLY, and revoke from `anon` (like the write RPCs above). `get_access_code` especially must never be `anon`-callable (RESEARCH Pitfall 4).

---

### `app/src/features/submit/useGpsSample.ts` (hook, device sensor)

**Analog:** `features/locations/useCurrentPosition.ts` (whole file, 65 lines)

**expo-location permission + read shape** (lines 39-62):
```ts
Location.requestForegroundPermissionsAsync().then((perm) => {
  if (perm.status !== 'granted') {
    setState({ coords: null, status: perm.status === 'denied' ? 'denied' : 'undetermined', isStale: false });
    return undefined;
  }
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((pos) => { ... });
});
```
- **DIVERGE from the analog on accuracy:** submission needs `Location.Accuracy.BestForNavigation` (SC1 / RESEARCH Code Examples line 438), NOT `Balanced`.
- **Capture `mocked`:** the analog does not read `pos.mocked` — the new hook MUST return `{ coord, accuracy, mocked, timestamp }`, mapping `pos.mocked ?? false` (iOS returns `undefined`; RESEARCH Pitfall 1 / Code Examples lines 425-446).
- Reuse the analog's freshness constant idea (`POSITION_FRESHNESS_MS = 60_000`, line 6) but the *authoritative* freshness check is server-side; the client value is advisory for the Step-3 ERR-03 copy only.
- Never throw on denied — return a `{ denied: true }` sentinel (analog returns `coords: null`; RESEARCH Code Examples line 435).

---

### `app/src/features/submit/submitLocation.ts` / `updateAccessCode.ts` (service, mutation)

**Analog:** `features/profile/updateProfile.ts` (whole file, 21 lines)

**RPC-call + error-throw shape** (lines 13-21):
```ts
export async function updateProfile(displayName: string): Promise<void> {
  const { error } = await supabase.rpc('update_profile', { new_display_name: displayName });
  if (error) {
    if (isDisplayNameTakenError(error)) { throw new Error(DISPLAY_NAME_TAKEN_MESSAGE); }
    throw error;
  }
}
```
- Import the singleton: `import { supabase } from '../../lib/supabase';`.
- `submitLocation` returns the submission id (`return data as string`) — see RESEARCH Code Examples lines 452-464 for the exact `p_*` argument mapping (`p_access_sensitivity: input.sensitive ? 'sensitive' : null` D-09; `p_access_code` only when `policyTag === 'code_required'` D-17).
- **Do not map the generic `'gps rejected'` string here** — rethrow raw; the SubmitFlow Step-3 UI maps it to the locked ERR-08/02/03 copy (UI-SPEC Error states table). This mirrors how `updateProfile` maps only the one known error and rethrows the rest.

### `app/src/features/submit/withdrawSubmission.ts` (service, mutation)

**Analog:** `features/profile/deleteAccount.ts` (whole file, 13 lines)
```ts
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
}
```
- `withdrawSubmission(id)` is this exact shape with one arg. Does NOT navigate/refetch itself — the caller invalidates `['pendingSubmissions', uid]` via TanStack (RESEARCH "Don't Hand-Roll"), same division of labor the `deleteAccount` comment describes (SessionProvider handles the redirect, not the mutation).

---

### `app/src/features/submit/useMyPendingSubmissions.ts` (service, query → GeoJSON)

**Analog:** `features/locations/useLocationsBbox.ts` (whole file, 95 lines)

**RPC → FeatureCollection transform** (lines 56-94):
```ts
const { data, error } = await supabase.rpc('search_locations_bbox', { ... });
if (error) throw error;
const rows = (data ?? []) as unknown as BboxRpcRow[];
return {
  type: 'FeatureCollection',
  features: rows.map((row) => {
    const loc = toMapLocation(row);
    return { type: 'Feature', geometry: { type: 'Point', coordinates: [loc.lng, loc.lat] }, properties: { ... } };
  }),
};
```
- `useMyPendingSubmissions` calls `get_my_pending_submissions` (no args) and produces the same `LocationFeatureCollection` shape (RESEARCH types are in `features/locations/types.ts`). Carry `confirmation_count`/`expires_at` in `properties` so the pending-status sheet reads them (D-27) without a second fetch.
- Coordinates are `[lng, lat]` GeoJSON order (line 79) — same as the published layer.
- Provide a `toMapLocation`-equivalent mapper for the snake_case→camelCase step (analog lines 35-48).

---

### `app/src/features/submit/submitSchema.ts` (utility, validation)

**Analog:** `features/auth/validation.ts` (whole file, 45 lines)

**Zod v4 field + composed object shape** (lines 9-45):
```ts
import { z } from 'zod';
export const displayName = z.string().min(3, 'Display name must be 3–20 characters.').max(20, '...').regex(...);
export const signUpSchema = z.object({ displayName, email, password });
```
- Same v4 `z.object` composition. Full `submitSchema` body (with the conditional-PIN `superRefine` on `policy_tag`, D-17) is written in RESEARCH Pattern 7 lines 337-353 — copy it directly.
- Error strings are LOCKED — pull them from UI-SPEC §Copywriting Contract, not invented (this analog sources its copy from "UI-SPEC §15 error-state copy matrix", line 21).
- `policyTag: z.enum(['chill_spot','purchase_required','code_required','public_facility'])` — the exact four values the DB CHECK / read RPCs use.

---

### `app/src/app/(tabs)/submit.tsx` — SubmitFlow wizard (component, screen)

**Analog:** compose — no single multi-step analog exists (see §No Analog Found). Copy sub-patterns:

**Design-token + colorScheme header** (from `FilterChipRow.tsx` lines 68-70, used everywhere):
```ts
const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
const colors = Colors[colorScheme];
```
- Every Phase 4 screen/component opens with this. Token imports: `Colors`, `spacing`, `typography`, `radius` from `../../constants/*` (UI-SPEC Design System table). No raw hex, no inline `fontSize`.

**Toggle/segmented control pattern** (`FilterChipRow.tsx` lines 39-66) — for the `policy_tag` segmented picker (Step 1) and the accessibility checkboxes: active = `colors.primary` fill + `colors.textInverse` label; inactive = `colors.surface` + `colors.border`. `accessibilityState={{ selected }}`, `minHeight: 44`.

**`access_sensitivity` switch (D-13):** use RN `Switch` (a *distinct* control from the segmented picker per D-13/UI-SPEC Color §Accent list) with `colors.primary` as the ON track tint. The FilterChip toggle logic (lines 46-47) is the state-binding reference, but render a `Switch`, not a Pressable chip.

**RHF + Zod wiring:** RESEARCH Pattern 7 + Standard Stack (`react-hook-form` 7.76, `@hookform/resolvers` 5.2.2, `zodResolver`). No shipped screen uses RHF yet — the `(auth)/sign-up.tsx` form is the nearest existing form screen; follow its field/error-rendering layout, adding step state.

**Locked copy:** every CTA/label/error string comes verbatim from UI-SPEC §Copywriting Contract ("Not suitable for kids" D-10, "Door code (optional) — only shown to signed-in users" D-19, "Next →", "I'm at This Location", etc.). See how `(tabs)/index.tsx` lines 47-57 declares `// [LOCKED ...]` string consts — replicate that convention.

**Auth gate (D-18):** the whole wizard requires sign-in from the start — reuse `AuthRequiredModal.tsx` (`action='submit'`, already an enum value line 19), rendered inline (never a hard redirect, per its header comment).

---

### Pending-status sheet + "Update door code" (component; modify `LocationDetailSheet.tsx`)

**Analog:** `(components)/LocationDetailSheet.tsx` (whole file, 347 lines)

**BottomSheet mechanics to reuse** (lines 116-173):
```ts
const sheetRef = useRef<BottomSheet>(null);
const snapPoints = useMemo(() => ['30%', '55%', '90%'], []);
const detailQuery = useQuery({ queryKey: [...], queryFn: () => ..., enabled: locationId !== null });
useEffect(() => { if (locationId !== null) sheetRef.current?.snapToIndex(0); else sheetRef.current?.close(); }, [locationId]);
```
- The pending-status sheet (D-26) is a **content variant** reusing this `BottomSheet`/`BottomSheetView` scaffold, snap points, skeleton-loading (lines 175-181), and error-fallback (lines 182-188) — but renders verification-progress copy (D-27, locked in UI-SPEC: `Pending — 1 of 2 GPS verifications received. Share with friends to speed up verification.`) instead of the published badge/hours/directions block. NO Rate/Report/Directions row for pending (UI-SPEC surface table).
- The pending sheet's `Withdraw submission` button uses the **destructive** treatment from `DeleteAccountModal.tsx` (see below), `colors.emergency` (UI-SPEC Color §Destructive).
- **"Update door code" (D-23):** add a signed-in-only Pressable in the *published* sheet's action row (lines 242-254 is the existing single-button `actionRow` to extend). Style matches the existing `primaryButton` (lines 323-334), label `Update door code`, `colors.primary`. Gate behind session presence; if signed out, open `AuthRequiredModal` (`action='see access code'`).

---

### Confirm dialogs — sensitivity (D-15) & withdraw (D-30) (component)

**Analog:** `(components)/DeleteAccountModal.tsx` (whole file, 197 lines)

**Confirm-before-destructive modal skeleton** (lines 65-134):
```tsx
<Modal testID="..." visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
  <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text style={styles.title}>...</Text>
      <Text style={styles.body}>...</Text>
      <Pressable ... onPress={handleConfirm}>  {/* destructive */}
      <Pressable ... onPress={onCancel}>        {/* ghost Cancel */}
```
- Both new dialogs copy this scrim+card+confirm+cancel structure. Withdraw uses the **destructive** button styling (lines 173-184, `colors.emergency`); sensitivity-confirm uses the standard `colors.primary` confirm (UI-SPEC Color §Accent list includes "the confirm button inside the sensitivity dialog").
- **Re-entrancy guard** (lines 34, 50-63): copy the `submittingRef` synchronous double-tap guard for the withdraw confirm (network action). Sensitivity confirm is local-only (no network) so it may skip the ref.
- **Reset-on-open** effect (lines 39-46): copy for any dialog that holds transient state.
- Locked confirm copy: `This location will be hidden from Family mode users` (D-15) and `Are you sure? This can't be undone` (D-30) — verbatim from UI-SPEC §Destructive actions table.
- Swipe-to-dismiss FORBIDDEN — `onRequestClose={() => {}}` / explicit Cancel only (design-system §16, this analog's header comment).

---

### Pending-pin map layer (modify `(tabs)/index.tsx`)

**Analog:** `(tabs)/index.tsx` (self — existing published `ShapeSource`/`CircleLayer`, lines 158-186)

```tsx
<ShapeSource id="locations" shape={featureCollection} cluster clusterRadius={50} onPress={handleShapePress}>
  <CircleLayer id="singlePin" filter={['!', ['has', 'point_count']]}
    style={{ circleColor: pinColor, circleRadius: 8, circleStrokeWidth: 2, circleStrokeColor: colors.background }} />
</ShapeSource>
```
- Add a **SECOND, separate** `ShapeSource` (e.g. `id="pendingLocations"`) fed by `useMyPendingSubmissions` — do NOT cluster it with the published source (RESEARCH Pattern 4 note, line 322). Color = `colors.pinPending` with the dashed/`< Pending >` treatment (UI-SPEC Color §semantic tokens).
- **`handleShapePress` branch** (lines 120-138): the existing handler routes single pins to `setSelectedId`. Extend it so features from the pending source open the **pending-status sheet** instead of `LocationDetailSheet` (RESEARCH Pattern 4 line 322; CONTEXT D-26). Keep the existing published branch untouched.
- The `pinColor` `match` expression (lines 106-118) already lists `colors.pinPending` only as the *fallback* — the new layer makes it a real, data-scoped layer.
- **Auth-scope:** only fetch pending pins when signed in (query `enabled: !!session`); the RPC returns nothing for anon anyway (defense in depth).

---

### `supabase/tests/phase4_submit.test.sql` (pgTAP)

**Analog:** `supabase/tests/phase3_read_rpcs.test.sql` (lines 1-80 read; same harness)

**Test scaffold + authed-caller fixture** (lines 18-64):
```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(N);

insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000', 'a0000000-...-0001', 'authenticated', 'authenticated', 'phase4-...@example.com');

-- impersonate the authed caller:
select set_config('request.jwt.claims',
  json_build_object('sub','a0000000-...-0001','role','authenticated')::text, true);
-- ... assertions ...
select set_config('request.jwt.claims', '', true);
```
- Copy this `begin;` + `plan()` + `auth.users` insert (fires the `handle_new_user` trigger) + `set_config('request.jwt.claims', ...)` impersonation pattern for the authed write/read RPCs (RESEARCH Test Map: reject `mocked=true`/accuracy>50/age>60; pending insert `confirmation_count=1`; pending-scoping; withdraw own-only).
- Use `throws_ok(..., 'SQLSTATE', ...)` (line 67) to assert `submit_location` raises `'gps rejected'` / `'not authenticated'`, and to assert `get_access_code` is not `anon`-callable.
- ⚠ Carryover: Phase 3 pgTAP has never run (no Docker) — RESEARCH Validation §Sampling Rate. Planner must run on a Docker-capable machine or record the same tracked override.

---

### `features/submit/__tests__/*.test.ts` (unit)

**Analogs:** `features/profile/__tests__/updateProfile.test.ts` (mutations) + `features/locations/__tests__/useCurrentPosition.test.ts` (GPS hook)

**Supabase singleton mock** (`updateProfile.test.ts` lines 1-19):
```ts
jest.mock('../../../lib/supabase', () => ({ supabase: { rpc: jest.fn(), auth: { ... } } }));
const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as { rpc: jest.Mock };
beforeEach(() => jest.clearAllMocks());
```
- Use for `submitLocation`/`updateAccessCode`/`withdrawSubmission`/`useMyPendingSubmissions` — assert `rpc` called with the exact `p_*` args (e.g. `sensitive:true` → `p_access_sensitivity:'sensitive'`; PIN omitted unless `code_required`).

**expo-location hook mock** (`useCurrentPosition.test.ts` lines 1-52):
```ts
const mockPerm = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPos = Location.getCurrentPositionAsync as jest.Mock;
mockPos.mockResolvedValue({ coords: { latitude: 44.05, longitude: -123.09 }, timestamp: Date.now() });
```
- Use for `useGpsSample`, adding `mocked: true/false` and low-accuracy fixtures (assert the hook surfaces `mocked` and `accuracy`; iOS `mocked: undefined → false`).
- TDD Guard: test-first is MANDATORY on `features/**` (RESEARCH Pitfall 7, 100% coverage). Screens under `src/app/` are excluded from the coverage gate but still TDD-guarded.

---

## Shared Patterns

### Authenticated write-RPC scaffold
**Source:** `supabase/migrations/20260627000004_profile_rpcs.sql` lines 26-45
**Apply to:** `submit_location`, `update_access_code`, `withdraw_submission`, `get_access_code`, `get_my_pending_submissions`
```sql
security definer
set search_path = public
-- body opens with:  if auth.uid() is null then raise exception 'not authenticated'; end if;
revoke execute on function public.<fn>(<types>) from public;
revoke execute on function public.<fn>(<types>) from anon;
grant  execute on function public.<fn>(<types>) to authenticated;
```
Writes omit `stable`; reads keep `stable`. Every revoke/grant repeats the full arg-type signature (Pitfall 5).

### `app_config` threshold read
**Source:** `20260704010002_phase3_search_rpcs.sql` lines 75-77
**Apply to:** `submit_location` (GPS thresholds) and any Phase 4 gate reading a tunable
```sql
select value::numeric into v_x from public.app_config where key = '<key>';
v_x := coalesce(v_x, <default>);
```

### PostGIS coordinate handling
**Source:** `20260704010002_phase3_search_rpcs.sql` lines 205-207, 215
**Apply to:** `submissions.coordinates` staging column + `get_my_pending_submissions`
- Store: `st_setsrid(st_makepoint(lng, lat), 4326)::geography` (lng first).
- Extract for pins: `st_y(coordinates::geometry)` = lat, `st_x(coordinates::geometry)` = lng.
- Never raw numerics (RESEARCH Anti-Pattern; CLAUDE.md "geography only").

### Design-token + colorScheme opener
**Source:** `FilterChipRow.tsx` lines 68-70 (and every component)
**Apply to:** every new/modified screen & component
```ts
const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
const colors = Colors[colorScheme];
```
Import `Colors`/`spacing`/`typography`/`radius` from `../../constants/*`. No raw hex/inline sizes (UI-SPEC Token source). Every status indicator = color + icon + text (UI-SPEC Color, WCAG 1.4.1).

### Client mutation → throw → UI maps friendly copy
**Source:** `features/profile/updateProfile.ts` lines 13-21
**Apply to:** all four client RPC wrappers
```ts
const { error } = await supabase.rpc('<fn>', { ... });
if (error) throw error;   // caller/UI maps to LOCKED copy; generic 'gps rejected' never destructured
```

### Confirm-before-destructive modal
**Source:** `(components)/DeleteAccountModal.tsx` lines 34, 39-63, 65-134
**Apply to:** withdraw (D-30), sensitivity (D-15), code-overwrite confirm (D-24)
- `submittingRef` synchronous double-tap guard for network actions.
- Reset transient state on `visible` open.
- Swipe-dismiss forbidden (`onRequestClose={() => {}}`), explicit Cancel only.
- Destructive = `colors.emergency`; standard confirm = `colors.primary`.

### Feature-module test doubles
**Source:** `updateProfile.test.ts` lines 1-19 (supabase) + `useCurrentPosition.test.ts` lines 8-9 (expo-location)
**Apply to:** every `features/submit/__tests__/*` file. `jest.clearAllMocks()` in `beforeEach`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/src/app/(tabs)/submit.tsx` (multi-step RHF wizard) | component (screen) | request-response | No multi-step wizard, and no RHF-based screen, ships yet. `react-hook-form`/`@hookform/resolvers` are installed but **unused** (RESEARCH Standard Stack lines 101-102). **Compose** from: `FilterChipRow.tsx` (toggle/segment visuals), `(auth)/sign-up.tsx` (nearest field-form layout), `DeleteAccountModal.tsx` (confirm dialogs), `AuthRequiredModal.tsx` (D-18 gate). RHF wiring + `submitSchema` come from RESEARCH Pattern 7 (lines 332-353), not a codebase analog. |

Partial-only surfaces (analog exists but diverges — flagged inline above): `useGpsSample` (analog uses `Balanced`+omits `mocked`; new needs `BestForNavigation`+`mocked`), `access_sensitivity` switch (analog is a Pressable chip; new is an RN `Switch`), `get_access_code`/`get_my_pending_submissions` grants (analog grants `anon`; new is authed-only).

---

## Metadata

**Analog search scope:** `app/src/features/{auth,profile,locations,filters}/**`, `app/src/app/(components|tabs|auth)/**`, `supabase/migrations/**`, `supabase/tests/**`
**Files scanned:** ~18 read in full/part (5 migrations sampled, 6 feature modules, 5 components/screens, 2 tests, 1 types file)
**Pattern extraction date:** 2026-07-07
**Open items for planner (from RESEARCH, affect pattern choice):** OQ-1 (Places autocomplete in scope? → address field stays free-text stub if deferred), OQ-3 (`update_access_code` D-24 confirm mechanism underspecified → Pattern 5 stage-then-confirm needs ratification before its migration/UI can be planned).
