# LunchMeet 🍽️

A social platform for organizing lunch meetups where users can host or join lunch meetings at restaurants.

Shipping on iOS as **LunchMeet Social**.

[![App Store](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fitunes.apple.com%2Flookup%3Fid%3D6760374356&query=%24.results%5B0%5D.version&label=App%20Store&color=0D96F6&logo=apple&logoColor=white)](https://apps.apple.com/us/app/lunchmeet-social/id6760374356)
[![Rating](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fitunes.apple.com%2Flookup%3Fid%3D6760374356&query=%24.results%5B0%5D.averageUserRating&suffix=%20%2F%205&label=rating&color=brightgreen)](https://apps.apple.com/us/app/lunchmeet-social/id6760374356)
[![Ratings](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fitunes.apple.com%2Flookup%3Fid%3D6760374356&query=%24.results%5B0%5D.userRatingCount&label=ratings&color=blue)](https://apps.apple.com/us/app/lunchmeet-social/id6760374356)
[![Min iOS](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fitunes.apple.com%2Flookup%3Fid%3D6760374356&query=%24.results%5B0%5D.minimumOsVersion&prefix=iOS%20&label=requires&color=lightgrey)](https://apps.apple.com/us/app/lunchmeet-social/id6760374356)

These read live from Apple's public iTunes Lookup API, so they update without a CI job or any stored secret. Download counts are deliberately absent — Apple exposes them in no public API, only through authenticated App Store Connect reports. A profiles-created badge lands once the v2 API ships `GET /v1/public/stats`.

## Features

- 🔍 Google Places integration for restaurant search
- 📅 Schedule lunch meets with date, time, and guest count
- 👤 User profiles with photos, bio, and interests
- 💬 Real-time group chat for lunch attendees
- ✅ Request/approval system for joining lunches
- ⭐ User ratings (1-5 stars) after lunch meets
- 🔒 Lunch visibility filtering (gender, looking for)
- 👥 Co-host feature for lunch management
- ✉️ Direct private invites by email
- 🔐 Sign in with Google or Apple (in addition to email magic link)
- 🛡️ Safety tips and first-launch warning

## Repository layout

v2 is a npm-workspaces monorepo:

```
apps/
  mobile/          Expo / React Native client (Expo Router)
  api/             Hono API, Better Auth, WebSocket hub
packages/
  db/              Drizzle schema and versioned migrations
  shared/          Zod schemas and domain types used by both sides
  config/          Source catalogue: every env var and dependency, declared once
ops/               Production runbooks (PRODUCTION_SECRETS.md)
docs/              Public GitHub Pages site (landing, privacy, support)
archive/           v1 setup docs and backups, kept for reference
```

## Get started

### Prerequisites

- Node.js 22+
- Docker (for the local object-storage and mail containers)
- PostgreSQL 16 running locally on port 5432

### Installation

1. Clone and install

   ```bash
   git clone https://github.com/codingcrazy89/LunchMeet.git
   cd LunchMeet
   npm install
   ```

2. Create the development database

   ```sql
   CREATE ROLE lunchmeet_dev WITH LOGIN PASSWORD 'choose-one';
   CREATE DATABASE lunchmeet_dev OWNER lunchmeet_dev;
   ```

3. Configure environment

   Copy `.env.example` to `.env` and fill it in. Every variable is declared and
   validated in `packages/config`; the API refuses to boot with a clear error
   rather than failing later on an undefined value.

4. Start supporting services

   ```bash
   npm run dev:services      # fake-gcs-server + Mailpit
   ```

5. Set up the database

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

6. Run the app

   ```bash
   npm run api               # Hono API
   npm run mobile            # Expo
   ```

Local development needs no Google Cloud account. `fake-gcs-server` stands in for
Cloud Storage and Mailpit catches magic-link emails at http://localhost:8025.

### Useful commands

| Command | Purpose |
|---|---|
| `npm run doctor` | Health-check every configured dependency |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:studio` | Browse the database |
| `npm run lint` / `typecheck` / `test` | Across all workspaces |

---

# Architecture

The analysis that motivated the rebuild is in [LunchMeet.arch.md](LunchMeet.arch.md);
the plan is in [the v2 plan](.cursor/plans/lunchmeet-v2-rebuild.plan.md).

## The stack

| Layer | Choice |
|---|---|
| Language | TypeScript, everywhere |
| Client | Expo / React Native + Expo Router |
| Client data | TanStack Query |
| API | Hono on Node |
| Auth | Better Auth |
| ORM | Drizzle |
| Database | Postgres 16 (self-owned) |
| Validation | Zod |
| Realtime | WebSockets over Postgres LISTEN/NOTIFY |
| Storage | S3-compatible (MinIO dev, R2 prod) |
| Tests / CI | Vitest, React Native Testing Library, GitHub Actions |
| Errors | Sentry |

## Why

Three findings from the v1 analysis drive every choice: authorization was never enforced server-side, the database could not be rebuilt from the repo, and there were no tests, CI, or error reporting.

**One language across the network boundary.** Every choice serves a single constraint — a small team maintaining a mobile client, a backend, and a database. TypeScript end-to-end means types cross the wire: Hono exports an RPC type the Expo app imports directly, Drizzle infers types from the schema with no codegen step, and Zod schemas are shared by server validation and client forms. Rename a database column and the mobile app fails to compile. That targets v1's actual failure mode, where the client believed it was filtering private lunches while the server sent every row, and wrote `visibility_gender` values that nothing ever read.

**Expo / React Native is kept, not rewritten.** The app works and ships. Its problems were structural — organized by layer instead of feature, five Context providers standing in for a data layer, hand-rolled version counters instead of cache invalidation, zero tests. A rewrite in another framework discards working chat, maps, and profile code without addressing any of it. Expo also earns its place through EAS handling signing and submission, and Expo Push Service providing push notifications without operating APNs and FCM credentials directly — the largest missing feature in v1.

**TanStack Query** replaces a hand-rolled cache: manual refetches, two version counters, a bespoke retry backoff, and no offline story.

**Hono over Fastify or NestJS.** The RPC type export decided it; nothing else gives the client end-to-end types for free. It is small, built on Web Standards, and runs on Node now with an edge runtime available later without a rewrite. NestJS's value is enforcing consistency across many contributors, which is not the problem being solved here.

**Better Auth** replaces Supabase Auth. Hand-writing OAuth, magic links, and session refresh is exactly the security-critical code worth not authoring. Better Auth is MIT, self-hosted into your own Postgres, has a Drizzle adapter, and ships a first-class Expo plugin handling the OAuth deep-link handshake and SecureStore, preserving the existing Google, Apple, and magic-link flows.

**Drizzle** is the direct fix for v1's worst structural failure: the `CREATE TABLE` statements for `profiles`, `lunches`, and `lunch_attendees` existed in no migration file, so the database could not be recreated from the repo. Schema is TypeScript and `drizzle-kit generate` emits numbered SQL migrations.

**Postgres 16, self-owned.** It was already Postgres beneath Supabase, so this is a change of ownership rather than an engine migration, and it removes the model where row-level security was the entire security perimeter. Extensions each replace something v1 did poorly: `citext` for case-insensitive email instead of a `LIKE`-based lookup that exposed addresses, `pg_trgm` for fuzzy search, and `cube` + `earthdistance` for indexed radius queries in place of no server-side geo at all.

**WebSockets over LISTEN/NOTIFY.** Chat and notifications at this scale do not justify Redis or Kafka. Postgres already provides pub/sub and is already running.

**S3-compatible storage.** v1 stored base64 data URIs in `profiles.photos`, a column read on nearly every screen. Presigned uploads to object storage take megabytes out of every profile query.

## Deliberately not chosen

- **NestJS / Prisma** — see above; abstraction cost without the team-scale benefit.
- **PostGIS** — `cube` + `earthdistance` covers radius search; PostGIS earns its weight only with polygons or routing.
- **pg_cron** — a database cron job is invisible to tests and error reporting; the scheduler moves into the API.
- **Self-hosted Supabase** — preserves the same RLS-as-sole-perimeter model whose gaps caused v1's problems.

## Learn more

To learn more about developing with Expo, check out:
- [Expo documentation](https://docs.expo.dev/)
- [Expo Router documentation](https://docs.expo.dev/router/introduction/)
