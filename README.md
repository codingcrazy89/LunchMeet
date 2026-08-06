# LunchMeet 🍽️

A social platform for organizing lunch meetups where users can host or join lunch meetings at restaurants.

Shipping on iOS as **LunchMeet Social** — [App Store](https://apps.apple.com/us/app/lunchmeet-social/id6760374356)

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

## Get started

### Prerequisites

- Node.js installed
- A Google Places API key
- A Supabase account with project set up

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/codingcrazy89/LunchMeet.git
   cd LunchMeet
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Set up environment variables

   Create a `.env` file in the root directory:

   ```env
   GOOGLE_PLACES_API_KEY=your_google_places_api_key
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Configure Google and Apple OAuth (optional, for social sign-in)

   To enable "Sign in with Google" and "Sign in with Apple":

   - Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Providers**
   - **Google**: Enable the Google provider and add your OAuth client ID and secret from [Google Cloud Console](https://console.cloud.google.com/)
   - **Apple**: Enable the Apple provider and add your Apple OAuth credentials (required for iOS App Store; only shown on native, not web)
   - Add your **Redirect URLs** in Supabase → Authentication → URL Configuration:
     - For web: your app origin (e.g. `http://localhost:8081` for local dev, or your production URL)
     - For native: your Expo deep link scheme (e.g. `exp://...` or your custom scheme)

5. Start the proxy server (for Google Places API)

   ```bash
   npm run proxy
   ```

6. Start the app

   ```bash
   npm run web
   ```

## Database Setup

Run the SQL migrations in the `migrations/` directory in your Supabase SQL Editor (in order):

1. `create_chat_system.sql` - Creates chat rooms and messages tables
2. `add_looking_for_column.sql` - Adds looking_for column to profiles
3. `add_status_to_lunch_attendees.sql` - Adds status to lunch_attendees
4. `fix_lunch_attendees_rls_v2.sql` - Sets up RLS policies for lunch_attendees
5. `alternative_rls_fix.sql` - Creates RPC functions for accepting/denying requests
6. `enable_realtime_messages.sql` - Enables real-time for messages
7. `create_user_ratings.sql` - User 1-5 star ratings after lunch meets
8. `add_lunch_visibility.sql` - Visibility filtering (gender, looking for)
9. `add_co_host_to_lunches.sql` - Co-host support
10. `create_lunch_invites.sql` - Direct private invites
11. `add_social_media_url.sql` - Social media link badge on profiles
12. `create_notifications.sql` - In-app notifications (invites, join requests, co-host, chat, request accepted)
13. `add_lunch_is_public.sql` - Public/private lunch visibility (private = invite-only)

## Tech Stack (v1 — currently shipping)

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL + Authentication + Realtime)
- **Maps**: Google Places API
- **Routing**: Expo Router

---

# Version 2 — Architecture Direction

v2 is an in-progress rebuild on the `v2` branch. Everything above still describes the shipping app.

Full detail lives in [the v2 plan](.cursor/plans/lunchmeet-v2-rebuild.plan.md), and the analysis that motivated it is in [LunchMeet.arch.md](LunchMeet.arch.md).

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
