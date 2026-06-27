# Technology Stack: Gotta Go

**Project:** Gotta Go — crowdsourced bathroom finder (React Native / Expo)
**Researched:** 2026-05-18
**Overall confidence:** HIGH
**Stance:** Prescriptive. The schema is live, the platform decisions (Expo, Supabase, Mapbox) are locked from prior design work. This document picks specific libraries, versions, and patterns.

---

## TL;DR — Pin These Versions

```jsonc
{
  "dependencies": {
    "expo": "~55.0.0",
    "react": "19.2.0",
    "react-native": "0.83.x",

    "expo-router": "~6.0.0",
    "expo-location": "~55.0.0",
    "expo-task-manager": "~55.0.0",
    "expo-camera": "~55.0.0",
    "expo-image": "~55.0.0",
    "expo-image-picker": "~55.0.0",
    "expo-secure-store": "~55.0.0",
    "expo-splash-screen": "~55.0.0",
    "expo-status-bar": "~55.0.0",
    "expo-constants": "~55.0.0",
    "expo-linking": "~55.0.0",
    "expo-haptics": "~55.0.0",
    "expo-application": "~55.0.0",

    "@rnmapbox/maps": "^10.1.x",
    "@supabase/supabase-js": "^2.58.0",
    "@react-native-async-storage/async-storage": "^2.x",
    "react-native-mmkv": "^3.x",

    "@tanstack/react-query": "^5.x",
    "zustand": "^5.0.x",

    "react-native-mock-location-detector": "^3.x",
    "react-hook-form": "^7.x",
    "zod": "^3.x",
    "@sentry/react-native": "^7.x"
  },
  "devDependencies": {
    "typescript": "~5.6.x",
    "jest": "^29.x",
    "jest-expo": "~55.0.0",
    "@testing-library/react-native": "^14.x",
    "@testing-library/jest-native": "^5.x",
    "msw": "^2.x",
    "tdd-guard": "current",
    "eslint": "^9.x",
    "eslint-config-expo": "~9.x",
    "prettier": "^3.x"
  }
}
```

Rationale and alternatives below.

---

## 1. Framework: Expo SDK 55

| Decision | Choice | Confidence |
|----------|--------|------------|
| Framework | Expo SDK 55 (stable since Feb 2026) | HIGH |
| React Native | 0.83.x (bundled with SDK 55) | HIGH |
| React | 19.2 | HIGH |
| Architecture | New Architecture (mandatory — cannot be disabled) | HIGH |
| Build flavor | EAS Build dev client (NOT Expo Go) | HIGH |

**Why SDK 55, not 54:**
- SDK 55 went stable February 25, 2026; we are 3 months past release with point releases shipped. Production-safe.
- SDK 55 fully removes Legacy Architecture support. Starting any new project on Legacy is malpractice — every library worth using has already migrated.
- Same-version-as-SDK package scheme: `expo-location` for SDK 55 is `~55.0.0`. Eliminates the version-matching mistakes that plagued SDK 50–53.

**Why NOT bare React Native:**
- We need expo-task-manager for background GPS, expo-secure-store for tokens, expo-location with config plugins, EAS Build for native code. Re-implementing this without Expo costs weeks of plumbing.
- Mapbox requires a dev client either way; Expo dev client gives us OTA updates and EAS Submit on top.

**Why NOT wait for SDK 56:**
- SDK 56 beta will land around July–August 2026 based on Expo's cadence. By then this project should already be shipping as a global proof of concept. Upgrade after launch when there is a working app to test against.

**Critical constraint:**
- `@rnmapbox/maps` cannot run in Expo Go. We MUST use `eas build --profile development` for a dev client from day one. Do not start the project with Expo Go intending to "migrate later" — every map screen will be broken until you switch.

Sources:
- [Expo SDK 55 — Expo Changelog](https://expo.dev/changelog/sdk-55)
- [Expo SDK 55 Migration Guide (2026)](https://reactnativerelay.com/article/expo-sdk-55-migration-guide-breaking-changes-sdk-53-to-55)
- [React Native's New Architecture — Expo Documentation](https://docs.expo.dev/guides/new-architecture/)

---

## 2. Navigation: Expo Router 6

| Decision | Choice | Confidence |
|----------|--------|------------|
| Router | `expo-router` ~6.0.0 (file-based) | HIGH |
| Typed routes | ENABLED (`experiments.typedRoutes: true`) | HIGH |
| Deep linking | Built-in via `expo-linking` for OAuth callback | HIGH |

**Why Expo Router over React Navigation:**
- Expo Router is built on top of React Navigation; you do not give up anything by choosing it. You gain: file-based routes, type-safe `<Link href={...}>`, deep-link routing for free, and the new `<Stack.Protected>` API for auth-gated stacks.
- For an app with auth + tabs + nested map/detail/submission flows, file-based routing keeps the route tree visible in the file system instead of buried in a navigator config.
- Supabase OAuth (Google) and email magic links require deep linking. Expo Router wires this in by default; React Navigation requires manual `Linking.getInitialURL` plumbing.

**Recommended structure:**

```
src/app/
  _layout.tsx                # root: SupabaseProvider, QueryClientProvider, GestureHandlerRootView
  (auth)/                    # unauthenticated group
    _layout.tsx              # redirects to /(tabs) if session exists
    sign-in.tsx
    sign-up.tsx
  (tabs)/                    # authenticated group
    _layout.tsx              # protected: redirect to /(auth)/sign-in if no session
    index.tsx                # map (home / emergency)
    submit.tsx               # new location form
    profile.tsx
  location/
    [id].tsx                 # location detail (modal-style)
  +not-found.tsx
```

**Auth pattern (canonical, ship this):**
- Wrap root in a `SessionProvider` that subscribes to `supabase.auth.onAuthStateChange`.
- In `(tabs)/_layout.tsx` use `<Redirect href="/(auth)/sign-in" />` when session is null.
- Do NOT call `supabase.auth.getSession()` inside every screen — that's an N-query antipattern.

**Why NOT React Navigation directly:**
- Higher boilerplate, no typed routes, no protected-route primitive. Acceptable in 2023; not in 2026.

**Why NOT TanStack Router:**
- No first-class React Native support. Web-only as of mid-2026.

Sources:
- [Authentication in Expo Router — Expo Documentation](https://docs.expo.dev/router/advanced/authentication/)
- [Simplifying auth flows in Expo Router with protected routes](https://expo.dev/blog/simplifying-auth-flows-with-protected-routes)

---

## 3. Mapping: @rnmapbox/maps with Mapbox SDK v11

| Decision | Choice | Confidence |
|----------|--------|------------|
| Library | `@rnmapbox/maps` ^10.1.x | HIGH |
| Native SDK | Mapbox Maps SDK v11 (set via `RNMapboxMapsVersion: "11.20.1"` or later 11.x) | HIGH |
| Style | Custom Mapbox Studio style + standard `mapbox://styles/mapbox/streets-v12` fallback | MEDIUM |
| Offline | Mapbox offline tile packs (built into v11) — defer until v1.1 unless proof-of-concept testing shows coverage gaps | MEDIUM |

**Config plugin (app.json):**

```json
{
  "expo": {
    "plugins": [
      [
        "@rnmapbox/maps",
        {
          "RNMapboxMapsVersion": "11.20.1",
          "RNMapboxMapsDownloadToken": "sk.xxx_secret_download_token_for_install",
          "RNMapboxMapsImpl": "mapbox"
        }
      ]
    ]
  }
}
```

**Two-token setup (CRITICAL — easy to get wrong):**
1. **Secret download token** (`sk.*`, scope `Downloads:Read`) — passed to the config plugin. Used at build time to download the native SDK from Mapbox's private registry. NEVER bundled into the app. Store in EAS secrets: `eas secret:create --name MAPBOX_DOWNLOAD_TOKEN`.
2. **Public access token** (`pk.*`) — passed to `Mapbox.setAccessToken(...)` at runtime. Used for tile and style requests. Bundle in `app.config.ts` from `EXPO_PUBLIC_MAPBOX_TOKEN` env var.

**Why Mapbox over react-native-maps:**
- Project constraint: "Mapbox over Google Maps — Better offline tiles, better React Native SDK" (PROJECT.md).
- `react-native-maps` is currently broken on Expo SDK 55 with Google Maps on iOS (open issue #43288). Picking it would block iOS development.
- Mapbox Studio gives us custom styling for the brand. Apple/Google Maps cannot match this.
- Mapbox vector tiles render markers and clusters far faster than `react-native-maps` for the kind of 50–500 pin density we expect in promoted regions.

**Why NOT MapLibre RN:**
- It's a viable fork of rnmapbox and avoids Mapbox costs, but: (a) Mapbox free tier (50k MAU map loads) should cover proof-of-concept usage, (b) Mapbox traffic and 3D buildings are differentiated on iOS, (c) MapLibre's offline-pack API is less mature on the alpha branch.
- Revisit when MAU approaches the free-tier ceiling.

**Why pin to v11 native, not v10:**
- v10 is officially deprecated by Mapbox. New features (Standard style, 3D, improved clustering perf) only ship to v11.

**Anti-pattern (do not do):**
- Do not put marker `View` children inside `<MapView>` as plain React children for >50 markers. Use `<ShapeSource>` + `<SymbolLayer>` with clustering. This is the difference between 5fps and 60fps in dense viewports.

Sources:
- [Install | @rnmapbox/maps](https://rnmapbox.github.io/docs/install)
- [maps/plugin/install.md at main · rnmapbox/maps](https://github.com/rnmapbox/maps/blob/main/plugin/install.md)
- [react-native-maps vs Mapbox RN vs MapLibre RN 2026](https://www.pkgpulse.com/blog/react-native-maps-vs-mapbox-rn-vs-maplibre-rn-mobile-maps-2026)
- [SDK 55: react-native-maps not compatible with Expo 55 when using Google Maps on iOS #43288](https://github.com/expo/expo/issues/43288)

---

## 4. Backend Client: Supabase JS v2

| Decision | Choice | Confidence |
|----------|--------|------------|
| Library | `@supabase/supabase-js` ^2.58.0 | HIGH |
| Auth storage | `@react-native-async-storage/async-storage` (NOT MMKV for auth) | HIGH |
| `detectSessionInUrl` | `false` (browser-only feature) | HIGH |
| `persistSession` | `true` | HIGH |
| `autoRefreshToken` | `true` | HIGH |
| PostGIS calls | Via `rpc()` to security-definer functions (NOT raw `from()` for spatial queries) | HIGH |

**Canonical client setup (`src/lib/supabase.ts`):**

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types'; // generated by `supabase gen types`

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

**Why AsyncStorage for auth, NOT MMKV:**
- Supabase auth refresh tokens MUST persist atomically across app restarts. AsyncStorage is the documented contract; MMKV works but is undocumented and any Supabase SDK update can break it.
- We get MMKV's speed where it actually matters (Zustand persist, image cache, query cache) without putting our auth flow on an unsupported path.

**Why NOT skip the URL polyfill:**
- Supabase JS internally uses `new URL()` for redirect parsing. React Native's URL implementation is incomplete pre-Hermes 0.83. `react-native-url-polyfill/auto` is required; omit it and you get cryptic "URL is not a constructor" errors on Android.

**Generate types from your live schema (do this Day 1):**

```bash
npx supabase login
npx supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts
```

Commit `database.types.ts`. Regenerate every time the schema changes. This is the single biggest correctness lever for the entire app.

**PostGIS query pattern:**
- ALWAYS go through `supabase.rpc('nearby_bathrooms', { lat, lng, radius_m })` — never `.from('locations').select(...)` with client-side distance math.
- Why: PostGIS distance functions need `geography` operators with spatial indexes; doing this on the client requires shipping every row to the device. With even 500 locations in a promoted region, that's wasteful and gives bad UX on slow networks.
- The RPC should be `SECURITY DEFINER` with `SET search_path = public, extensions` and explicit filtering of `deleted_at`, `suppressed_at`, `is_shadowbanned` (per schema-contract.md).

**Anti-patterns to reject in review:**
- Storing `latitude` / `longitude` columns as the source of truth (schema-contract.md forbids this).
- Computing distance in JS from `(user.lat - row.lat)^2 + ...`. Degrees ≠ meters; this gives wrong answers at any non-equatorial latitude.
- Calling `supabase.auth.getSession()` inside `useEffect` on every screen — use a single subscription in a top-level `SessionProvider`.

Sources:
- [Use Supabase Auth with React Native — Supabase Docs](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Use Supabase with Expo React Native — Supabase Docs](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [PostGIS: Geo queries — Supabase Docs](https://supabase.com/docs/guides/database/extensions/postgis)
- [@supabase/supabase-js GitHub](https://github.com/supabase/supabase-js)

---

## 5. State Management: Zustand 5 + TanStack Query 5

| Decision | Choice | Confidence |
|----------|--------|------------|
| Server state | TanStack Query (React Query) v5 | HIGH |
| Client state | Zustand 5 | HIGH |
| Form state | React Hook Form + Zod | HIGH |
| Persistence | MMKV via `zustand/middleware` `persist` + `createJSONStorage` | HIGH |

**The single most important rule:** server state and client state are different problems with different solutions. Do not put bathroom data in Zustand. Do not put modal-open state in TanStack Query.

**TanStack Query is for:**
- `useQuery(['nearby', lat, lng, radius], fetchNearbyBathrooms)` — caches results, deduplicates concurrent calls, refetches on focus.
- `useMutation` for submissions, verifications, ratings — handles retry, optimistic updates, invalidation.
- `useInfiniteQuery` for the location list with pagination.

**Zustand is for:**
- Current GPS coordinate (refreshed by a watcher, not refetched).
- Emergency-mode toggle.
- Filter selections (changing table, currently open, access type).
- Map viewport state if we need to share it across components.

**Why Zustand over Redux Toolkit:**
- ~1KB vs ~15KB. On a GPS-heavy mobile app, every KB of JS we ship is bridge time we never get back.
- No reducers, no slices, no `Provider` boilerplate. A bathroom-finder app is not a Fortune 500 ERP; we do not need the structure RTK gives.
- Zustand 5 ships with React 19.2 concurrent mode support that earlier versions lacked.

**Why Zustand over Jotai:**
- Jotai's atom model is great for fine-grained reactivity (form state, complex derived values). Our app has a few coarse stores: location, filters, UI. Zustand is a better fit for that shape.
- React Hook Form already handles the use case Jotai would win (forms). No need to add a third state library.

**Why NOT Context for client state:**
- Context re-renders every consumer when any value changes. With a map screen that has 50+ pin components, this is death. Zustand uses subscription-based selectors and skips renders that don't read changed slices.

**Persistence (MMKV-backed):**

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'gotta-go-store' });

const zustandMMKVStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

export const useFiltersStore = create(
  persist(
    (set) => ({
      changingTableOnly: false,
      accessType: 'all',
      setAccessType: (t) => set({ accessType: t }),
    }),
    { name: 'filters', storage: createJSONStorage(() => zustandMMKVStorage) }
  )
);
```

Sources:
- [Ultimate React Native State Management Guide 2026: Redux Toolkit vs Zustand vs Jotai](https://www.oflight.co.jp/en/columns/react-native-state-management-2026)
- [Zustand Persisting store data docs](https://github.com/pmndrs/zustand/blob/main/docs/reference/integrations/persisting-store-data.md)
- [zustand-mmkv-storage: Blazing Fast Persistence](https://dev.to/mehdifaraji/zustand-mmkv-storage-blazing-fast-persistence-for-zustand-in-react-native-3ef1)
- [TanStack Query React Native docs](https://tanstack.com/query/v5/docs/framework/react/react-native)

---

## 6. Location & GPS Verification

| Decision | Choice | Confidence |
|----------|--------|------------|
| Foreground GPS | `expo-location` ~55.0.0 with `Location.Accuracy.BestForNavigation` for verification | HIGH |
| Background GPS | `expo-task-manager` + `expo-location` `startLocationUpdatesAsync` (foreground-service on Android) | MEDIUM |
| Mock detection | `react-native-turbo-mock-location-detector` ^4.x (Fabric / New Arch ready) | HIGH |
| Permissions UX | Foreground-only at first launch; background-only when user opts into "auto-verify nearby" feature | HIGH |

**Verification flow (this is the data-integrity backbone of the app):**

```ts
import * as Location from 'expo-location';
import { isMockingLocation } from 'react-native-turbo-mock-location-detector';

async function verifyAtLocation(targetId: string) {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new VerifyError('PERMISSION_DENIED');

  // Reject if dev-mode mock providers are active.
  const { isLocationMocked } = await isMockingLocation();
  if (isLocationMocked) throw new VerifyError('MOCK_LOCATION');

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
    mayShowUserSettingsDialog: true,
  });

  // Server-side checks distance, freshness, accuracy, trust, dedupe.
  return supabase.rpc('record_verification', {
    location_id: targetId,
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy_m: pos.coords.accuracy,
    sampled_at: new Date(pos.timestamp).toISOString(),
  });
}
```

**Required server-side checks (NEVER trust the client):**
- `gps_accuracy_meters <= 50` — anything looser is unverifiable in dense urban environments.
- Distance from canonical PostGIS point `<= 100m` (or whatever business threshold).
- `verified_at` is server-now, not client-supplied.
- One verification per user per location per 24h (dedupe).
- Per `locations` schema rules: reject shadowbanned users from affecting public aggregates.

**Background location — when (and when not) to enable:**
- v1 launch: foreground-only verification (user opens app, taps "I'm here", we verify).
- v1.1 if validated: opt-in "auto-verify when I pass by saved locations" mode. Requires:
  - `locationAlwaysAndWhenInUsePermission` string
  - `isIosBackgroundLocationEnabled: true`
  - `isAndroidBackgroundLocationEnabled: true`
  - `UIBackgroundModes: ["location"]` on iOS
  - Foreground service notification on Android
- iOS App Store will reject vague background-location usage. We need a documented user benefit (auto-confirm) and a clearly-disclosed setting toggle, or the review will fail.

**Spoofing reality check:**
- `react-native-turbo-mock-location-detector` catches Android Developer Options mock providers and iOS Simulator location injection. It does NOT catch jailbroken/rooted devices running GPS-spoofing kernel modules. Those exist and we cannot defeat them client-side alone.
- Defense in depth: (a) two-verification threshold (already in constraints), (b) trust-weighted verification values, (c) anomaly detection in server logic (impossible-velocity check: same user verified two locations 50km apart in 5 min → flag).

**Why NOT `react-native-background-geolocation` (transistorsoft):**
- It's the gold standard for production background tracking, but it costs ~$400/year per platform license. For a v1 launch with foreground-only verification, expo-task-manager + expo-location is sufficient. Revisit if we need always-on background tracking at scale.

Sources:
- [Location — Expo Documentation](https://docs.expo.dev/versions/latest/sdk/location/)
- [react-native-turbo-mock-location-detector](https://github.com/jpudysz/react-native-turbo-mock-location-detector)
- [Detect Fake GPS on Android Apps](https://blog.anmolthedeveloper.com/caught-in-the-act-detecting-fake-gps-locations-in-your-android-app)

---

## 7. Forms & Validation

| Decision | Choice | Confidence |
|----------|--------|------------|
| Form library | `react-hook-form` ^7.x | HIGH |
| Schema | `zod` ^3.x with `@hookform/resolvers/zod` | HIGH |

**Why this pair:**
- One Zod schema is the contract for both the form and the Supabase RPC payload. No double-typed validation.
- React Hook Form is uncontrolled by default → fewer re-renders on each keystroke than Formik. With keyboard-heavy forms (submitting a new location: name, address, hours, code, policy tag), this is visible.
- We can reuse the same Zod schemas in `supabase/functions/` for Edge Function input validation if we add those.

---

## 8. Testing: jest-expo + RNTL 14 + MSW 2

| Decision | Choice | Confidence |
|----------|--------|------------|
| Runner | `jest` ^29 with `jest-expo` ~55 preset | HIGH |
| Component | `@testing-library/react-native` ^14 | HIGH |
| Matchers | `@testing-library/jest-native` ^5 (`toBeOnTheScreen`, `toHaveTextContent`) | HIGH |
| Network mocking | `msw` (Mock Service Worker) v2 with `msw/native` setup | HIGH |
| TDD enforcement | `tdd-guard` (already installed per PROJECT.md) | HIGH |

**jest.config.js:**

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo|@unimodules|@rnmapbox|react-clone-referenced-element|@react-native-community)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/_layout.tsx',
  ],
};
```

**jest.setup.ts (mock the libraries you cannot run in Node):**

```ts
import '@testing-library/jest-native/extend-expect';

jest.mock('@rnmapbox/maps', () => ({
  MapView: 'MapView',
  Camera: 'Camera',
  setAccessToken: jest.fn(),
}));

jest.mock('expo-location', () => ({
  getCurrentPositionAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  Accuracy: { BestForNavigation: 6, Balanced: 3 },
}));

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => store.set(k, v),
      delete: (k: string) => store.delete(k),
    })),
  };
});
```

**Mocking Supabase — use MSW, not module mocks:**

The temptation is `jest.mock('@supabase/supabase-js')` with a chain of `from().select().eq()` stubs. **Do not do this.** That style of mock:
- Couples tests to the query builder shape, so refactoring a query breaks tests with no behavioral change.
- Misses real serialization issues (UUIDs, dates, PostGIS WKT).

Use MSW to intercept the actual HTTP calls Supabase makes:

```ts
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

const SUPABASE_URL = 'https://test.supabase.co';

export const handlers = [
  http.post(`${SUPABASE_URL}/rest/v1/rpc/nearby_bathrooms`, () =>
    HttpResponse.json([
      { id: 'loc-1', name: 'Voodoo Doughnut', distance_m: 87 },
    ])
  ),

  http.post(`${SUPABASE_URL}/rest/v1/rpc/record_verification`, async ({ request }) => {
    const body = (await request.json()) as { lat: number; lng: number };
    if (Math.abs(body.lat) > 90) {
      return HttpResponse.json({ error: 'invalid_coords' }, { status: 400 });
    }
    return HttpResponse.json({ ok: true, status: 'pending' });
  }),
];
```

```ts
// src/test/mocks/server.ts
import { setupServer } from 'msw/native';
import { handlers } from './handlers';
export const server = setupServer(...handlers);
```

```ts
// jest.setup.ts (continued)
import { server } from './src/test/mocks/server';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` is mandatory. Without it, an un-mocked request silently 404s, and you spend an afternoon debugging "why isn't my optimistic update working in the test".

**Test focus per project constraints:**
- Trust-weighted verification math: pure unit tests.
- RLS-policy correctness: integration test against a local Supabase + pgTAP migrations. Out of scope for Jest.
- GPS distance acceptance/rejection: MSW + RNTL.
- Code-redaction (no PII in logs): unit test the logger middleware.

**Why NOT Vitest:**
- Vitest support for React Native is preview-level. `jest-expo` is the documented, supported preset. Use it.

**Why NOT Detox / Maestro for v1:**
- E2E is high-value but high-maintenance. Stand up Jest + RNTL first. Add Maestro (cheaper, YAML-based) for smoke tests around v1.0 to lock in critical flows (sign-up → submit location → verify).

Sources:
- [Unit testing with Jest — Expo Documentation](https://docs.expo.dev/develop/unit-testing/)
- [jest-expo — npm](https://www.npmjs.com/package/jest-expo)
- [@testing-library/react-native v14 core pattern](https://github.com/callstack/react-native-testing-library)
- [Testing React and Supabase with React Testing Library and Mock Service Worker](https://nygaard.dev/blog/testing-supabase-rtl-msw)

---

## 9. Storage Strategy

| Data class | Storage | Why |
|------------|---------|-----|
| Supabase auth session | `@react-native-async-storage/async-storage` | Required by Supabase JS, documented contract |
| App preferences, filters, last-seen-location | `react-native-mmkv` | Synchronous, fast, no Promise overhead |
| Sensitive tokens (Mapbox runtime token, if rotated; Stripe keys later) | `expo-secure-store` | Hardware-backed (Keychain / Keystore) |
| Image cache | `expo-image` built-in disk cache | Already optimized, do not reinvent |
| Offline tile cache | Mapbox SDK offline regions (v11) | Built-in, deferred to v1.1 |

**Do not:**
- Store JWTs in AsyncStorage AND mirror them in MMKV. One source of truth (AsyncStorage, owned by Supabase).
- Store Mapbox public token in expo-secure-store. It is bundled in the JS bundle anyway; secure-store gives no benefit and adds friction.

Sources:
- [SecureStore — Expo Documentation](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [MMKV vs AsyncStorage vs SecureStore 2026 — PkgPulse Guides](https://www.pkgpulse.com/guides/react-native-mmkv-vs-async-storage-vs-expo-secure-store-2026)

---

## 10. Error Tracking: Sentry

| Decision | Choice | Confidence |
|----------|--------|------------|
| SDK | `@sentry/react-native` ^7.x | HIGH |
| Expo Router integration | `Sentry.reactNavigationIntegration` for Expo Router 6 | HIGH |
| Source maps | Auto-upload via Sentry Expo plugin during EAS Build | HIGH |
| Sample rates (prod) | `tracesSampleRate: 0.1`, `replaysSessionSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0` | HIGH |

**Privacy alignment with project constraints:**
- PROJECT.md forbids PII in logs. Sentry's `beforeSend` MUST scrub `lat`, `lng`, email, full address before sending.
- Use Sentry tags for non-PII context: `app_version`, `route`, `user_role`, `is_shadowbanned`, `trust_tier`.

**Anti-pattern:**
- Default Sentry config sends device IDs and IP addresses. Disable `sendDefaultPii: false` (verify it's set; default behavior changed in v6→v7).

Sources:
- [Using Sentry — Expo Documentation](https://docs.expo.dev/guides/using-sentry/)
- [Expo Router — Sentry for React Native](https://docs.sentry.io/platforms/react-native/tracing/instrumentation/expo-router/)

---

## 11. Supporting Libraries (the rest of the iceberg)

| Library | Version | Purpose |
|---------|---------|---------|
| `react-native-gesture-handler` | (bundled by Expo) | Required by Expo Router, react-navigation |
| `react-native-reanimated` | ~4.x (bundled by SDK 55) | Map animations, transitions |
| `react-native-safe-area-context` | (bundled by Expo) | Notch / Dynamic Island handling |
| `react-native-screens` | (bundled by Expo) | Native screen primitives |
| `nativewind` | ^4.x | Tailwind classes for React Native — optional but recommended |
| `date-fns` | ^3.x | Timezone-safe time math for "currently open" filter |
| `geolib` | ^3.x | Client-side haversine for cheap pre-filter before RPC (display "X meters away") |

**Why NativeWind (optional):**
- Tailwind class strings ship in the JS bundle but compile to StyleSheet under the hood. The DX win on a single-developer + multi-agent review project is significant.
- If the multi-agent review workflow finds NativeWind too noisy for diffs, fall back to `StyleSheet.create` per-component.

**Why `geolib`:**
- The server is authoritative for verification distance. But we still show "0.3 mi away" in the list UI. `geolib.getDistance` does this client-side without round-trips.

---

## 12. Things to Explicitly NOT Use

| Anti-choice | Why not |
|-------------|---------|
| Redux + Redux Toolkit | Overkill. Zustand is the correct tool for this app size. |
| `react-native-maps` with Google Maps | Broken on Expo SDK 55 iOS (expo/expo#43288). |
| Mapbox SDK v10 native | Deprecated by Mapbox. Pin v11. |
| Firebase Auth | We already chose Supabase Auth. Two auth providers = security incident waiting. |
| Realm / WatermelonDB | Premature optimization. PostgreSQL is the source of truth; cache layer is TanStack Query. Local DB only justified if global proof-of-concept data exceeds device memory at 50k+ locations. |
| Formik | Slower re-renders than RHF, larger bundle, less active maintenance. |
| Apollo Client / urql | We don't have GraphQL. Supabase REST + TanStack Query is the path. |
| `react-native-google-signin` directly | Use Supabase's native Google OAuth flow with deep linking. One fewer SDK to maintain. |
| Manual fetch + useReducer for server state | Reinventing TanStack Query badly. |
| `expo-sqlite` for the app DB | Schema is in Supabase. SQLite is fine for analytics buffering if we add that. |
| Background fetch for background sync (`expo-background-fetch`) | Unreliable across iOS versions. If we need real background work, use a dedicated task with task-manager and accept the constraints. |
| Yarn 1 / npm workspaces "yolo" mode | Use `pnpm` or `npm 10+` with `package-lock.json` checked in. Reproducible installs are a review constraint. |

---

## 13. Install Sequence (when implementation starts)

```bash
# 1. Init the project
npx create-expo-app@latest "gotta-go-app" --template tabs@sdk-55
cd gotta-go-app

# 2. Routing & auth ergonomics (mostly included by the template)
npx expo install expo-router expo-linking expo-constants

# 3. Location & verification
npx expo install expo-location expo-task-manager
npm install react-native-turbo-mock-location-detector

# 4. Mapping
npx expo install @rnmapbox/maps

# 5. Backend client
npm install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill

# 6. State + queries + forms
npm install zustand @tanstack/react-query react-hook-form zod @hookform/resolvers
npm install react-native-mmkv

# 7. Secure storage + diagnostics
npx expo install expo-secure-store
npm install @sentry/react-native

# 8. Testing
npx expo install -- --save-dev jest jest-expo @testing-library/react-native @testing-library/jest-native msw

# 9. Generate Supabase types from live schema
npx supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts

# 10. Build a dev client (REQUIRED — Mapbox + Sentry need native code)
eas build --profile development --platform all
```

---

## 14. Confidence Notes & Things to Re-verify Before Coding

| Claim | Confidence | How to verify on day 1 |
|-------|------------|------------------------|
| Expo SDK 55 stable | HIGH | `npx create-expo-app@latest --template tabs@sdk-55` produces a working dev client |
| `@rnmapbox/maps` v10.1.x is the latest stable | MEDIUM | Check `npm view @rnmapbox/maps version` — pin to the exact latest |
| Mapbox native SDK 11.20.1 ships with v11 features we need | HIGH | Verify by rendering Standard style and a clustered ShapeSource |
| `react-native-turbo-mock-location-detector` New Arch ready | MEDIUM | Test on Fabric in dev client; fall back to `react-native-mock-location-detector` if Turbo build fails |
| Supabase JS v2.58 RPC for `geography(Point, 4326)` returns correctly | HIGH | Smoke test: create a `nearby` RPC, call from RN client, assert ordering |
| MSW v2 `msw/native` works under jest-expo preset | MEDIUM | Run the first MSW-backed test before scaling out the test suite — confirm transformIgnorePatterns includes `msw` if needed |
| SDK 55 New Arch + Reanimated 4 + Mapbox v10.1.x all compose | MEDIUM | Build a dev client with all three before writing app code |

The MEDIUM items above are where Phase 0 ("scaffold + smoke test") earns its keep: prove the stack composes before writing any feature code.

---

## Sources (consolidated)

- [Expo SDK 55 — Expo Changelog](https://expo.dev/changelog/sdk-55)
- [Expo SDK 55 Migration Guide (2026) — React Native Relay](https://reactnativerelay.com/article/expo-sdk-55-migration-guide-breaking-changes-sdk-53-to-55)
- [React Native's New Architecture — Expo Documentation](https://docs.expo.dev/guides/new-architecture/)
- [Authentication in Expo Router — Expo Documentation](https://docs.expo.dev/router/advanced/authentication/)
- [Simplifying auth flows in Expo Router with protected routes — Expo blog](https://expo.dev/blog/simplifying-auth-flows-with-protected-routes)
- [Install | @rnmapbox/maps](https://rnmapbox.github.io/docs/install)
- [maps/plugin/install.md — @rnmapbox/maps](https://github.com/rnmapbox/maps/blob/main/plugin/install.md)
- [react-native-maps vs Mapbox RN vs MapLibre RN 2026 — PkgPulse](https://www.pkgpulse.com/blog/react-native-maps-vs-mapbox-rn-vs-maplibre-rn-mobile-maps-2026)
- [Use Supabase Auth with React Native — Supabase Docs](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Use Supabase with Expo React Native — Supabase Docs](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [PostGIS: Geo queries — Supabase Docs](https://supabase.com/docs/guides/database/extensions/postgis)
- [@supabase/supabase-js — GitHub](https://github.com/supabase/supabase-js)
- [Ultimate React Native State Management Guide 2026 — Oflight](https://www.oflight.co.jp/en/columns/react-native-state-management-2026)
- [Zustand persisting store data docs](https://github.com/pmndrs/zustand/blob/main/docs/reference/integrations/persisting-store-data.md)
- [TanStack Query React Native docs](https://tanstack.com/query/v5/docs/framework/react/react-native)
- [Location — Expo Documentation](https://docs.expo.dev/versions/latest/sdk/location/)
- [react-native-turbo-mock-location-detector — GitHub](https://github.com/jpudysz/react-native-turbo-mock-location-detector)
- [Unit testing with Jest — Expo Documentation](https://docs.expo.dev/develop/unit-testing/)
- [@testing-library/react-native v14 — GitHub](https://github.com/callstack/react-native-testing-library)
- [Testing Supabase with MSW — Herman Nygaard](https://nygaard.dev/blog/testing-supabase-rtl-msw)
- [SecureStore — Expo Documentation](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [MMKV vs AsyncStorage vs SecureStore 2026 — PkgPulse](https://www.pkgpulse.com/guides/react-native-mmkv-vs-async-storage-vs-expo-secure-store-2026)
- [Using Sentry — Expo Documentation](https://docs.expo.dev/guides/using-sentry/)
- [Expo Router — Sentry for React Native](https://docs.sentry.io/platforms/react-native/tracing/instrumentation/expo-router/)
- [SDK 55: react-native-maps not compatible with Expo 55 (Google Maps iOS) #43288](https://github.com/expo/expo/issues/43288)
