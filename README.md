# Gotta Go

Gotta Go is a crowdsourced bathroom finder for moments when restroom access is urgent. The project focuses on fast discovery, verified location data, contributor privacy, and abuse-resistant moderation.

The v1.0 MVP target is a Eugene, Oregon seed launch with 50+ GPS-verified bathroom locations, parent and accessibility filters, emergency modes, and a trust engine that prevents spam and unsafe data from becoming public.

## Status

- Phase 1: Foundation & Scaffold - complete
- Phase 1.5: UX Foundation & Design System - plans complete
- Phase 2: Auth & Profiles - not started

See [.planning/ROADMAP.md](.planning/ROADMAP.md) for the current phase plan.

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

Install app dependencies:

```powershell
cd app
npm.cmd install
```

Create `app/.env.local` with local development values:

```text
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
MAPBOX_DOWNLOAD_TOKEN=your-mapbox-download-token
```

Do not commit `.env.local`, service-role keys, access tokens, or private credentials.

Start the Expo app:

```powershell
cd app
npm.cmd run start
```

## Verification

Run the standard local checks from the app workspace:

```powershell
cd app
npm.cmd run typecheck
npm.cmd test -- --runInBand
npm.cmd run lint
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
