# Phase 3: Read Path & Map - Pattern Map

**Mapped:** 2026-07-04
**Files analyzed:** 18 (11 new, 7 modified/regenerated)
**Analogs found:** 15 / 18 (3 no-analog: filters store, formatDistance util, bottom-sheet component partial)

> All SQL analogs are LIVE migration source (read directly). All client analogs are Phase 2 code already through the review gate. Prefer these real analogs over RESEARCH.md's illustrative skeletons — the skeletons are correct in shape but the analogs carry the exact project conventions (grant/revoke style, `auth.uid()` derivation, user-scoped query keys, design-token usage).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/<ts>_phase3_suppressed_at.sql` | migration | schema-DDL | `20260519020000_fix_schema.sql` | role-match |
| `supabase/migrations/<ts>_phase3_search_rpcs.sql` (bbox/nearby/detail) | migration (RPC) | request-response | `20260624000002_ratings_privacy_fix.sql` (`get_locations_in_radius`) | exact |
| `supabase/migrations/<ts>_phase3_max_pins_config.sql` | migration (seed) | config | `20260519020000_fix_schema.sql` (app_config INSERT) | exact |
| `supabase/migrations/<ts>_phase3_family_mode_rpc.sql` (extend `update_profile`) | migration (RPC) | CRUD (write) | `20260627000004_profile_rpcs.sql` (`update_profile`) | exact |
| `supabase/seed.sql` (dev-only seed, D-31) | migration (seed) | batch-insert | *none* (no seed INSERTs exist) | no-analog |
| `app/src/features/locations/useLocationsBbox.ts` | service (data hook) | request-response (read) | `app/src/features/profile/profileStats.ts` | role-match |
| `app/src/features/locations/useNearby.ts` | service (data hook) | request-response (read) | `app/src/features/profile/profileStats.ts` | role-match |
| `app/src/features/locations/useLocationDetail.ts` | service (data hook) | request-response (read) | `app/src/features/profile/profileStats.ts` | role-match |
| `app/src/features/locations/useFamilyMode.ts` | service (data hook) | CRUD (read + write) | `app/src/features/profile/getMyProfile.ts` + `updateProfile.ts` | exact |
| `app/src/features/locations/formatDistance.ts` | utility | transform | *none* (pure numeric util) | no-analog |
| `app/src/features/locations/types.ts` | model (types) | — | `app/src/features/profile/profileStats.ts` (interface convention) | role-match |
| `app/src/features/filters/useFiltersStore.ts` | store (zustand) | event-driven (UI state) | *none* (zustand installed, never used) | no-analog |
| `app/src/features/**/__tests__/*.test.ts` (hook tests) | test | — | `app/src/features/profile/__tests__/profileStats.test.ts` | exact |
| `app/src/app/(tabs)/index.tsx` (MapScreen) | screen | request-response | `app/src/app/(tabs)/profile.tsx` | role-match |
| `app/src/app/(tabs)/nearby.tsx` (Nearby list) | screen | request-response | `app/src/app/(tabs)/profile.tsx` | role-match |
| `app/src/app/(tabs)/profile.tsx` (+ family_mode Switch) | screen | CRUD (write) | itself (extend in place) | exact |
| `app/src/app/(components)/LocationDetailSheet.tsx` | component | request-response | `app/src/app/(components)/DeleteAccountModal.tsx` | role-match (sheet lib differs) |
| `app/src/lib/database.types.ts` | config (generated) | — | itself (regenerate via `supabase gen types`) | exact |

---

## Pattern Assignments

### `<ts>_phase3_search_rpcs.sql` — search_locations_bbox / _nearby / get_location_detail (migration RPC, request-response)

**Analog:** `supabase/migrations/20260624000002_ratings_privacy_fix.sql` (`get_locations_in_radius`, lines 17-75) + `20260701211135_profile_stats_rpc.sql` (`auth.uid()` derivation + explicit grant/revoke, lines 16-38)

**Filter + tag-join + KNN pattern to COPY** (`get_locations_in_radius`, lines 35-67):
```sql
select l.*                            -- ⚠ DO NOT copy `select l.*` / `setof locations` (leaks access code) — use explicit column list
from locations l
where l.deleted_at is null
  and l.shadowban_status = false
  and st_dwithin(
        l.coordinates::geography,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
        radius_m
      )
  and (not filter_open_now     or l.is_open_now = true)
  and (not filter_chill_spot   or l.chill_spot = true)
  and (not filter_wheelchair   or exists (
         select 1 from tags t
         where t.location_id = l.id
           and t.key = 'accessibility' and t.value = 'wheelchair'))
  and (not filter_changing     or exists (
         select 1 from tags t
         where t.location_id = l.id
           and t.key = 'amenity' and t.value = 'changing_table'))
  and (not filter_high_conf    or l.confidence_tier = 'High')
order by l.coordinates::geography <-> st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography;
```
- `(not filter_x or <cond>)` is EXACTLY the D-08 null-include convention. Mirror the key/value pairs verbatim (`accessibility/wheelchair`, `amenity/changing_table`, `purchase_required/false`, `gender/neutral`) — do NOT invent new tag vocab (Pattern 3).
- Live column is `shadowban_status` (not `is_shadowbanned`). `confidence_tier` is TEXT ('High'/'Medium'/'Low').
- ⚠ **New RPCs deviate from the analog in 3 ways** (per RESEARCH Pitfalls 2/4 + Pattern 2): (a) add `and l.suppressed_at is null`; (b) for bbox use `l.coordinates::geometry && st_makemeenvelope(...)` NOT `st_dwithin`; (c) `order by case l.confidence_tier when 'High' then 3 when 'Medium' then 2 when 'Low' then 1 else 0 end desc, l.verification_count desc limit max_pins` — NOT `order by confidence_score`.

**`auth.uid()` server-side derivation pattern to COPY** (`get_profile_stats`, lines 24-32 + Pattern 4): the RPC reads the caller's own row; the client never passes `family_mode`.
```sql
-- inside the RPC body (plpgsql variant):
declare v_family boolean := false;
begin
  if auth.uid() is not null then
    select family_mode into v_family from public.users where id = auth.uid();
  end if;
  -- ... and (not v_family or l.access_sensitivity is distinct from 'sensitive')
```

**SECURITY DEFINER hardening + grant/revoke to COPY** (`get_profile_stats`, lines 18-38 for reads; `get_locations_in_radius` lines 70-75 for anon+authenticated):
```sql
language sql  -- or plpgsql
security definer
stable
set search_path = public
...
-- READS (bbox/nearby/detail) → anon + authenticated:
revoke execute on function public.<fn>(...) from public;
grant  execute on function public.<fn>(...) to anon;
grant  execute on function public.<fn>(...) to authenticated;
```
⚠ Note the project convention (comment in `20260627000004` lines 20-23): Supabase auto-grants EXECUTE to anon/authenticated via ALTER DEFAULT PRIVILEGES, so `revoke ... from public` alone is INSUFFICIENT — you must also explicitly `revoke ... from anon` for authenticated-only functions.

---

### `<ts>_phase3_family_mode_rpc.sql` — extend `update_profile` (migration RPC, CRUD write)

**Analog:** `supabase/migrations/20260627000004_profile_rpcs.sql` (`update_profile`, lines 26-45)

**Authenticated-only write pattern to COPY verbatim** (lines 26-45):
```sql
create or replace function public.update_profile(new_display_name text)  -- add: , new_family_mode boolean default null
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
    set display_name = new_display_name,     -- keep existing; add: family_mode = coalesce(new_family_mode, family_mode)
        updated_at   = now()
  where id = auth.uid();
end;
$$;

revoke execute on function public.update_profile(text) from public;
revoke execute on function public.update_profile(text) from anon;
grant  execute on function public.update_profile(text) to authenticated;
```
⚠ Adding a parameter **changes the function signature** → the old `update_profile(text)` grants/revokes reference the old signature. Use `default null` for the new param and re-issue the revoke/grant against the NEW arg-type list `(text, boolean)`. Consider whether to `drop function public.update_profile(text)` first or overload — planner decision. `coalesce(new_family_mode, family_mode)` preserves display-name-only calls.

---

### `<ts>_phase3_max_pins_config.sql` — app_config seed (migration, config)

**Analog:** `supabase/migrations/20260519020000_fix_schema.sql` (app_config INSERT, lines 21-27)

**Config-row seed pattern to COPY** (lines 21-27):
```sql
insert into app_config (key, value, description) values
  ('max_accuracy_m',            '50',   'GPS accuracy threshold for submission and verification'),
  ('verify_radius_m',           '100',  'Physical presence window in meters for verification'),
  ...
```
- Add exactly one row: `('max_pins_per_viewport', '200', 'Max locations returned per bbox/viewport query (D-32, admin-tunable)')`.
- `value` is TEXT (the existing rows store numerics as strings — match that). Anon SELECT policy already exists (`app_config_select_anon`, lines 15-17), so the client can read it without a new grant.
- Client-side, mirror `app/src/lib/appConfigSmoke.ts` (the `APP_CONFIG_SMOKE_KEYS` list) if a smoke/read reference is needed.

---

### `<ts>_phase3_suppressed_at.sql` — add column + extend partial index (migration, schema-DDL)

**Analog:** `supabase/migrations/20260519020000_fix_schema.sql` (`alter table ... add column`, line 11; gist index create, lines 49-50)

**Add-column + spatial-index pattern:**
```sql
alter table app_config add column description text;          -- shape to copy for: alter table locations add column suppressed_at timestamptz;
...
create index idx_verification_events_gps_location
  on verification_events using gist (gps_location);          -- shape to copy for extending idx_locations_coordinates_active
```
⚠ Per RESEARCH Pitfall 1 + Pattern 2: the column must be added BEFORE the RPC migration references it, and the existing partial GiST index `idx_locations_coordinates_active` (currently `WHERE deleted_at IS NULL AND shadowban_status = false`) must be dropped/recreated to add `AND suppressed_at IS NULL` so the moderation-filtered search stays index-backed.

---

### `app/src/features/locations/useFamilyMode.ts` (service data hook, CRUD read+write)

**Analog:** `app/src/features/profile/getMyProfile.ts` (RLS-safe own-row read, lines 15-24) + `app/src/features/profile/updateProfile.ts` (RPC write, lines 13-21)

**RLS-safe own-row read to COPY** (`getMyProfile.ts`, lines 15-24):
```typescript
export async function getMyProfile(userId: string): Promise<MyProfile> {
  const { data, error } = await supabase
    .from('users')
    .select('display_name')       // → 'family_mode' for the read hook
    .eq('id', userId)
    .single();
  if (error) throw error;
  return { displayName: data?.display_name ?? null };
}
```

**RPC write to COPY** (`updateProfile.ts`, lines 13-21):
```typescript
export async function updateProfile(displayName: string): Promise<void> {
  const { error } = await supabase.rpc('update_profile', { new_display_name: displayName });
  if (error) { ...; throw error; }
}
// → supabase.rpc('update_profile', { new_family_mode: value }) for the toggle write
```

---

### `app/src/features/locations/useLocationsBbox.ts` / `useNearby.ts` / `useLocationDetail.ts` (service data hooks, request-response read)

**Analog:** `app/src/features/profile/profileStats.ts` (RPC call + snake→camel mapping, lines 24-35)

**RPC-call + result-mapping pattern to COPY** (`profileStats.ts`, lines 24-35):
```typescript
export async function profileStats(): Promise<ProfileStats> {
  const { data, error } = await supabase.rpc('get_profile_stats');
  if (error) throw error;
  const stats = data as unknown as GetProfileStatsRpcResult;   // typed snake_case RPC shape
  return {
    gpsVerifications: stats.gps_verifications ?? 0,            // map to camelCase + null-default
    ...
  };
}
```
- Each new hook wraps a `.rpc('search_locations_bbox' | 'search_locations_nearby' | 'get_location_detail', {...})` call, maps snake_case RPC rows → a camelCase public-safe shape (defined in `types.ts`).
- For bbox: transform rows → GeoJSON `featureCollection` for `ShapeSource` (RESEARCH Pattern 1). No analog for the GeoJSON transform — see No Analog.
- **TanStack Query wrapping + user-scoped keys** live in the SCREEN (see profile.tsx analog below), not the plain async fn — mirror that split (plain `async` fn in `features/`, `useQuery` in the screen), OR co-locate a `useXxx` hook exporting `useQuery`. Either way the `queryKey` MUST include `session?.user.id` for any user-scoped query (family_mode) to avoid cross-user cache leak (Codex WU-02-T5).

---

### hook tests — `app/src/features/locations/__tests__/*.test.ts` (test)

**Analog:** `app/src/features/profile/__tests__/profileStats.test.ts` (lines 1-70) + `updateProfile.test.ts` (lines 1-50)

**Supabase-mock + rpc-assertion pattern to COPY** (`profileStats.test.ts`, lines 7-51):
```typescript
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: { getSession: jest.fn(), onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } } })), signOut: jest.fn() },
  },
}));
const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as { rpc: jest.Mock };
beforeEach(() => { jest.clearAllMocks(); });

it('calls the RPC with expected args', async () => {
  mockSupabase.rpc.mockResolvedValue({ data: {...}, error: null });
  await fn();
  expect(mockSupabase.rpc).toHaveBeenCalledWith('rpc_name', {...});
});
it('throws when the RPC returns an error', async () => {
  mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('...') });
  await expect(fn()).rejects.toThrow('...');
});
```
⚠ Per RESEARCH Validation Architecture, RPC/RLS *correctness* (family_mode exclusion, access-code omission, moderation filters) is tested at the SQL layer (pgTAP / local Supabase), NOT jest — these jest tests only cover the client mapping/args. TDD Guard requires test-first; 100% coverage on `src/features/**`.

---

### `app/src/app/(tabs)/index.tsx` (MapScreen) & `nearby.tsx` (screen, request-response)

**Analog:** `app/src/app/(tabs)/profile.tsx` (whole file — TanStack Query + design tokens + dark mode)

**Screen scaffolding to COPY** (`profile.tsx`, lines 1-47):
```typescript
import { View, Text, Pressable, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { useSession } from '../../features/auth/useSession';

export default function ProfileScreen() {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';   // D-25 light/dark
  const colors = Colors[colorScheme];
  const session = useSession()?.session ?? null;

  const statsQuery = useQuery({
    queryKey: ['profileStats', session?.user.id],   // ⚠ user-scoped key (Codex WU-02-T5)
    queryFn: profileStats,
    enabled: session !== null,
  });
```
- ALL styling via `Colors[colorScheme]` + `spacing`/`typography`/`radius` tokens — no raw hex, no magic numbers (D-33 accepts the existing token scale; do not re-flag).
- Loading/error/empty branches: `profile.tsx` `renderStatValue` (lines 87-100) shows the skeleton + error-dash + loading pattern to mirror for D-02 (pins-as-they-arrive) and D-28 (error banner + stale pins).
- Both screens are thin `src/app/` wrappers → excluded from the coverage gate (jest.config.js); behavioral logic belongs in `features/`.
- ⚠ Map canvas (`ShapeSource`/`SymbolLayer` native clustering) has NO codebase analog — use RESEARCH Pattern 1 + STACK.md. `@rnmapbox/maps` is installed but not yet rendered anywhere.

---

### `app/src/app/(tabs)/profile.tsx` (+ family_mode Switch) (screen, CRUD write — extend in place)

**Analog:** itself (`settingsRow` block, lines 136-183) + `updateProfile` mutation call pattern

**Settings-row pattern to COPY for the new toggle** (lines 137-140):
```tsx
<View style={[styles.settingsRow, { borderBottomColor: colors.divider }]}>
  <Text style={[styles.body, { color: colors.textPrimary }]}>Account</Text>
  <Text style={[styles.subhead, { color: colors.textDisabled }]}>Coming soon</Text>
</View>
```
- Replace the right-hand `<Text>` with RN `<Switch>` (D-30), wired to a `useMutation(update_profile{family_mode})` + a user-scoped `useFamilyMode` read query. Add `accessibilityRole`/`accessibilityLabel` per the existing rows.
- Cite design-system.md §20 Component Acceptance Checklist in the PLAN.md (ROADMAP SC10).

---

### `app/src/app/(components)/LocationDetailSheet.tsx` (component, request-response)

**Analog:** `app/src/app/(components)/DeleteAccountModal.tsx` (route-group component-folder modal, lines 1-197)

**Component-folder modal conventions to COPY** (lines 1-46): default-export component, `useColorScheme` + `Colors[colorScheme]`, design-token `StyleSheet`, `submittingRef` re-entrancy guard where async actions fire, `accessibilityRole`/`accessibilityLabel`/`accessibilityLiveRegion` on interactive + status elements, `testID` on the root.
```tsx
export default function DeleteAccountModal({ visible, onCancel }: DeleteAccountModalProps) {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  ...
  <Modal testID="delete-account-modal" visible={visible} transparent animationType="fade">
    <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
```
⚠ **Container differs:** this analog uses RN `<Modal>`; the LocationDetailSheet uses `@gorhom/bottom-sheet` (net-new, peek/half/full snap points, swipe/tap-outside dismiss per D-12/D-17). Copy the *conventions* (tokens, a11y, default export, `(components)/` location — an accepted structural pattern per CLAUDE.md, do NOT relocate) but the sheet mechanics come from RESEARCH §Don't-Hand-Roll + UI-SPEC, not this file. Requires `GestureHandlerRootView` at root + reanimated plugin (RESEARCH Pitfall 7).

---

## Shared Patterns

### SECURITY DEFINER RPC hardening
**Source:** `20260627000004_profile_rpcs.sql` (lines 29-45), `20260701211135_profile_stats_rpc.sql` (lines 18-38)
**Apply to:** All new RPCs (bbox, nearby, detail, family_mode extend)
```sql
language plpgsql  -- or sql
security definer
stable            -- reads only; omit for the write RPC
set search_path = public
...
revoke execute on function public.<fn>(...) from public;
revoke execute on function public.<fn>(...) from anon;         -- authed-only writes only
grant  execute on function public.<fn>(...) to authenticated;  -- + anon for public reads
```

### Server-authoritative moderation + family_mode filtering
**Source:** `get_locations_in_radius` (lines 37-38, 66), Pattern 4
**Apply to:** All three read RPCs — every body ends in the moderation filter, enforced in SQL, never the client:
```sql
where l.deleted_at is null
  and l.suppressed_at is null          -- NEW column (this phase)
  and l.shadowban_status = false
  and (not v_family or l.access_sensitivity is distinct from 'sensitive')
```

### snake_case RPC → camelCase client mapping
**Source:** `profileStats.ts` (lines 9-35)
**Apply to:** Every `features/locations/*` read hook — typed `Xxx RpcResult` interface (snake_case) mapped to a camelCase public shape with `?? default`.

### User-scoped TanStack Query keys
**Source:** `profile.tsx` (lines 34-47, with the WU-02-T5 comment)
**Apply to:** Any user-scoped query (family_mode). `queryKey: ['<name>', session?.user.id]` + `enabled: session !== null`.

### Design-token styling + dark mode + a11y
**Source:** `profile.tsx` (lines 1-9, 26-29, 193-294), `DeleteAccountModal.tsx` (a11y attrs)
**Apply to:** Every screen/component. `Colors[useColorScheme()]`, `spacing`/`typography`/`radius` from `src/constants/`; no raw hex/magic numbers (D-33 exception standing). `accessibilityRole`/`accessibilityLabel` on all interactive elements (esp. Nearby list rows, D-27/D-29).

---

## No Analog Found

| File | Role | Data Flow | Reason / Guidance |
|------|------|-----------|-------------------|
| `app/src/features/filters/useFiltersStore.ts` | store (zustand) | event-driven | `zustand ^5.0.13` is installed but used NOWHERE in the codebase. No store precedent exists. Use RESEARCH STACK.md §5 (zustand `persist` + MMKV) for D-05/06/07/08 session-persist. First store in the project — planner should establish the convention. |
| `app/src/features/locations/formatDistance.ts` | utility | transform | No numeric-formatting util exists. Closest stylistic cousins are the pure fns in `features/auth/` (`displayName.ts`, `validation.ts`) for the export/test shape. Body comes from RESEARCH §Code Examples (meters→mi/km by locale, D-22/23) + `expo-localization` or `Intl`. |
| GeoJSON transform (inside `useLocationsBbox.ts`) | — | transform | No map-rendering code exists yet; `@rnmapbox/maps` installed but never used. RPC rows → `featureCollection` for `ShapeSource` per RESEARCH Pattern 1. |
| Map canvas (`(tabs)/index.tsx` `ShapeSource`/`SymbolLayer`/clustering) | screen | — | No `@rnmapbox/maps` usage anywhere. Native-clustering render pattern from RESEARCH Pattern 1 + STACK.md; screen shell from `profile.tsx`. |
| `LocationDetailSheet.tsx` bottom-sheet mechanics | component | — | `@gorhom/bottom-sheet` is net-new. Modal *conventions* from `DeleteAccountModal.tsx`; snap/gesture mechanics from RESEARCH + UI-SPEC. |
| `supabase/seed.sql` (dev seed, D-31) | migration | batch-insert | Zero seed INSERTs exist in any migration (`locations` table is empty). No precedent for a dev-only guard — planner must specify a reviewable prod-exclusion mechanism (RESEARCH Pitfall 6). |

## Metadata

**Analog search scope:** `supabase/migrations/` (13 migrations), `app/src/features/` (auth, profile), `app/src/app/(tabs)/`, `app/src/app/(components)/`, `app/src/lib/`, `app/src/constants/`
**Files scanned:** ~55 source files (13 SQL migrations + ~42 TS/TSX)
**Pattern extraction date:** 2026-07-04
