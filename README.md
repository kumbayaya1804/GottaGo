# Gotta Go

Gotta Go is a crowdsourced bathroom finder for moments when restroom access is urgent. It is built around one idea: finding a bathroom should not depend on luck, embarrassment, or insider knowledge.

## Why This Exists

I am building Gotta Go because public restroom access is treated like a minor inconvenience until someone urgently needs it. For people with bowel conditions, parents with infants, wheelchair users, delivery drivers, travelers, and anyone caught away from home, bad information can become a real loss of dignity.

Bathrooms exist, but the useful details are scattered: which places allow walk-ins, which doors need codes, which restrooms have changing tables, which locations are accessible, which information is stale, and which places are safe to rely on in a hurry.

Gotta Go is meant to turn that hidden local knowledge into community-verified infrastructure: visible, searchable, privacy-aware, and useful in the moment it matters.

## What Gotta Go Does

Gotta Go helps people find nearby bathrooms, search by city or address, filter for accessibility and family needs, use emergency modes, and contribute updated information when they are physically present.

The v1.0 MVP target is a global proof of concept for crowdsourced bathroom access. The app should be available wherever users are, while local density grows through marketing, promotion, owned social channels, partnerships, and community contribution.

## What Makes It Different

- GPS-verified contributions instead of anonymous untrusted listings
- Trust and moderation rules that protect public search quality
- Parent and accessibility filters, including changing-table and wheelchair-accessible needs
- Emergency modes designed for urgency rather than browsing
- Access-code handling for signed-in users only
- Privacy rules that avoid exposing contributor identity, precise movement, auth tokens, or moderation state

## Status

Current progress lives in [.planning/STATE.md](.planning/STATE.md) (completed phases, active plan, next action) and is not duplicated here, so this README cannot go stale. See [.planning/ROADMAP.md](.planning/ROADMAP.md) for the phase plan.

## Tech Stack

- React Native / Expo SDK 55
- Expo Router
- TypeScript
- Supabase / Postgres / PostGIS
- Mapbox rendering
- Jest and Testing Library
- ESLint and Prettier

## Repository Layout

```text
app/        Expo React Native application
supabase/   Supabase config, migrations, and seed data
docs/       Architecture, schema, review, and verification docs
.planning/  Roadmap, phase plans, and phase context
.claude/    Agent prompts and review artifacts
```

## Local Development

Commands below work in any POSIX shell (macOS, Linux) and in Windows PowerShell. On Windows PowerShell, if execution policy blocks the `npm` shim, use `npm.cmd` instead.

Prerequisites: Node.js (CI uses Node 22), git, and, for database work, the Supabase CLI plus a Docker-compatible runtime (for example OrbStack or Docker Desktop). Building for iOS needs full Xcode on macOS; Android needs Android Studio.

Install dependencies (root holds repo tooling such as Probity; `app/` holds the Expo app):

```bash
npm install
cd app
npm install
```

Enable the repo's tracked git hooks (the pre-commit review gate) once per clone:

```bash
git config core.hooksPath .beads/hooks
```

Create `app/.env.local` with local development values:

```text
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-public-access-token
MAPBOX_DOWNLOAD_TOKEN=your-mapbox-download-token
```

Do not commit `.env.local`, service-role keys, access tokens, or private credentials.

Start the Expo app. Mapbox is a native module, so use a development build (`npm run ios` / `npm run android`), not Expo Go:

```bash
cd app
npm run start
```

## Verification

Run the standard local checks from the app workspace:

```bash
cd app
npm run typecheck
npm test -- --runInBand
npm run lint
```

## Project Rules

- Moderation, shadowban, trust, and GPS enforcement must happen below the UI layer.
- Public search must exclude deleted, suppressed, and shadowbanned locations.
- Precise contributor location, auth tokens, service-role keys, and private user data must not be exposed in logs, analytics, or public UI.
- Client-facing work should follow the Phase 1.5 UX contract before implementation review.

## Key Docs

- [SPEC.md](SPEC.md) - product and safety contract
- [.planning/ROADMAP.md](.planning/ROADMAP.md) - phase roadmap
- [docs/schema-contract.md](docs/schema-contract.md) - database schema contract
- [docs/review-severity.md](docs/review-severity.md) - review verdict and severity rules
- [CODEX.md](CODEX.md) - Codex review workflow
