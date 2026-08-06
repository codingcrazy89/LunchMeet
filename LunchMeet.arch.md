# LunchMeet — Architecture Analysis

> Generated using the RepoSwarm `mobile` prompt set (17 shared + 4 mobile-specific sections).
> Repo type detected: **mobile**. Analysis date: 2026-08-05. Commit: `89fc2c2`.

**Repository Name:** [[LunchMeet]]

---

## 1. High-Level Overview

### Project Purpose

LunchMeet is a social meetup application for arranging in-person lunches with strangers or
contacts at real restaurants. A user "hosts" a lunch at a specific restaurant, date/time and
seat count; other users browse nearby or upcoming lunches, request to join, and — once
accepted — get access to a per-lunch group chat. After the lunch, attendees rate each other.

The domain is social discovery / dating-adjacent networking, and the codebase reflects the
trust-and-safety concerns that come with it: reporting, ratings, automated suspension,
safety-tip interstitials, and confirmation modals before meeting a stranger.

### Architecture Pattern

**Serverless client-heavy (BaaS) architecture.** There is no application backend of the
project's own. The mobile client talks directly to Supabase (Postgres + Auth + Realtime +
Storage), and business logic lives in three places:

1. React Context providers in the client (`src/*Context.tsx`)
2. Postgres RLS policies, triggers, and `SECURITY DEFINER` RPC functions (`migrations/*.sql`)
3. A single stateless Node/Express proxy whose only job is to hide a Google API key

This is best described as **Client → BaaS with a thin API-key proxy sidecar**.

### Technology Stack

| Layer | Technology |
|---|---|
| Runtime | React Native 0.81.5, React 19.1.0, Expo SDK ~54.0.33 |
| Language | TypeScript ~5.9.2 (`strict: true`) |
| Routing | Expo Router ~6.0.23 (file-based) |
| Backend | Supabase (`@supabase/supabase-js` ^2.87.1) — Postgres, Auth, Realtime, Storage |
| Maps | `react-native-maps` 1.20.1 (native); Google Maps `<iframe>` embeds (web) |
| Proxy | Node ≥18, Express ^5.2.1, CORS ^2.8.5 — hosted on Render |
| Build/Release | EAS Build + EAS Submit; GitHub Actions for the static `docs/` site |
| Package manager | npm (`package-lock.json` v3, committed) |

### Initial Structure Impression

The root is a single Expo application, not a monorepo. High-level parts:

- **Mobile/web app** — `app/`, `components/`, `src/`, `hooks/`, `constants/`
- **Database schema** — `migrations/` (27 hand-run `.sql` files)
- **API-key proxy** — `server/` (own `package.json`, deployed separately)
- **Marketing/legal site** — `docs/` (GitHub Pages)
- **Dev tooling** — `scripts/` (21 files, heavily PowerShell/tunnel-oriented)
- **Documentation** — 30 root-level `.md` files, largely setup/troubleshooting runbooks

### Configuration and Package Files

`package.json`, `server/package.json`, `package-lock.json`, `app.config.js`, `eas.json`,
`babel.config.js`, `tsconfig.json`, `eslint.config.js`, `render.yaml`, `ngrok-tunnels.yml`,
`.github/workflows/github-pages.yml`, `.gitignore`, `.vscode/{settings,tasks,extensions}.json`,
`.cursor/rules/*.mdc`.

Notably there is **no `metro.config.js`** and **no `.env`** in the repo (gitignored).

### Directory Structure

The code is organized **by layer**, not by feature.

| Path | Purpose |
|---|---|
| `app/` | Expo Router routes. `(tabs)/` group, `login.tsx`, dynamic `profile/[id]`, `rate-attendees/[lunchId]` |
| `app/screens/` | Two orphaned placeholder screens, not wired into the router |
| `components/` | 23 presentational + modal components (mix of app code and untouched Expo template files) |
| `src/` | Cross-cutting state: 5 Context providers, Supabase client, utils |
| `hooks/` | Theme/color-scheme hooks (Expo template) |
| `constants/` | `theme.ts` design tokens, `safetyTips.ts` copy |
| `migrations/` | Postgres DDL, RLS policies, functions, triggers |
| `server/` | Express Places proxy + a Metro tunnel proxy |
| `scripts/` | Dev tunnel orchestration, QR generation, migration runners |
| `docs/` | Static landing page, privacy policy, support page |

### Build, Execution and Test

- **Entry point:** `expo-router/entry` (`package.json` `main`), root layout `app/_layout.tsx`
- **Dev:** `npm start` (Metro) plus `npm run proxy` (Places proxy on :8787)
- **Build:** `eas build --profile <development|preview|production> --platform <ios|android>`
- **Web:** `expo start --web` — local only, no automated web deploy
- **Lint:** `npm run lint` → `expo lint`
- **Test:** **none — there is no test framework, no test files, and no test script**

> ⚠️ `package.json` wires `postinstall`, `prestart`, and `prebuild` to `node scripts/write-config.js`,
> **but that file does not exist in the repo.** The `start-expo-tunnel` script likewise references
> a missing `scripts/start-expo-tunnel.ps1`. A clean `npm install` will fail its lifecycle hook.

---

## 2. Module Deep Dive

### Routing layer (`app/`)

A root `Stack` (all headers disabled) wraps a four-tab group plus two stack screens:

```
app/_layout.tsx  ─ providers, Stack, global toast, log viewer
├── login.tsx                     /login
├── (tabs)/_layout.tsx            custom AppHeader + Tabs
│   ├── index.tsx                 Lunches (browse/join, list + map)
│   ├── host.native|web.tsx       Host (create a lunch)
│   ├── my-lunches.tsx            Lunches I host or co-host
│   ├── profile.tsx               Edit my profile
│   └── chat.tsx                  Per-lunch chat (hidden, href: null)
├── profile/[id].tsx              Another user's public profile
└── rate-attendees/[lunchId].tsx  Post-lunch bulk rating
```

`app/modal.tsx`, `app/screens/HomeScreen.tsx` and `app/screens/LunchHostScreen.tsx` are
leftover template/placeholder files not registered in any navigator.

### State layer (`src/`)

Five React Contexts, nested in this order in `app/_layout.tsx`:
`AuthProvider → AppLogProvider → ContactsProvider → LunchProvider → NotificationProvider`.

| Provider | State | Key operations |
|---|---|---|
| `AuthContext` | `user`, `loading`, `suspendedMessage` | `signInWithEmail` (magic link), `signInWithGoogle`, `signInWithApple`, `signOut`; deep-link token parsing; profile bootstrap; suspension check |
| `LunchContext` | `lunches`, `invites`, `loading`, `fetchError`, `version` | `fetchLunches`, `addLunch`, `joinLunch`, `accept/denyRequest`, `leaveLunch`, `closeLunch`, `submitRating`, `accept/declineInvite` |
| `NotificationContext` | `notifications`, `latestToast`, `unreadCount` | `fetchNotifications`, `markAsRead`, `markAllAsRead`; Realtime INSERT subscription |
| `ContactsContext` | `contactsVersion` (integer) | `invalidateContacts()` — a cache-busting signal only; holds no contact data |
| `AppLogContext` | `logs` (last 150), `logViewerVisible` | Monkey-patches `console.log/warn/error` |

There is **no Redux, Zustand, React Query, or TanStack Query**. All server state is fetched
imperatively into Context and refetched manually.

`LunchContext` is the de-facto data access layer and is by far the largest module — it owns
nearly every Supabase query in the app plus retry logic (3 attempts at 2s/5s/10s backoff).

### Presentation layer (`components/`)

Roughly half the directory is live application code (the modals: `InviteUserModal`,
`NotificationsModal`, `RateAttendeeModal`, `RatePromptModal`, `ReportUserModal`,
`SafetyConfirmModal`, `SafetyTipsModal`, plus `StarRating`, `ZoomableImage`,
`NotificationToast`, `ErrorBoundary`, `ProfilePhotoImage`). The other half is untouched
Expo starter template (`themed-text`, `themed-view`, `hello-wave`, `parallax-scroll-view`,
`collapsible`, `external-link`, `haptic-tab`, `ui/icon-symbol`).

> ⚠️ `hooks/use-theme-color.ts` reads `Colors.light` / `Colors.dark`, but `constants/theme.ts`
> exports a **flat** `Colors` object with no such keys. Any component calling `useThemeColor`
> (`themed-text`, `themed-view`) would read `undefined`. These only render in the orphaned
> `app/modal.tsx`, so the bug is currently unreachable.

### Data layer (`migrations/`)

27 SQL files applied by hand through the Supabase SQL editor. They are **not sequenced**
(no numeric prefixes, no migration tool), and several supersede earlier ones
(`fix_lunch_attendees_rls.sql` → `fix_lunch_attendees_rls_v2.sql` → `alternative_rls_fix.sql`).
Determining the true production schema requires reading all of them in the right order.

### Proxy layer (`server/`)

`places-proxy.js` — 157 lines, three read-only endpoints, no state, no auth.
`metro-tunnel-proxy.js` — a dev-only HTTP/WS forwarder from :8082 to Metro on :8081.

---

## 3. Dependencies

### Runtime (selected)

| Package | Version | Role |
|---|---|---|
| `expo` | ~54.0.33 | SDK |
| `expo-router` | ~6.0.23 | File-based routing |
| `react-native` / `react` | 0.81.5 / 19.1.0 | Runtime |
| `@supabase/supabase-js` | ^2.87.1 | Auth, DB, Realtime, Storage |
| `react-native-maps` | 1.20.1 | Native maps |
| `expo-location` | ~19.0.8 | Foreground geolocation |
| `expo-image-picker` | ~17.0.10 | Photo library |
| `expo-image`, `expo-file-system` | ~3.0.11, ~19.0.21 | Cached remote images |
| `@react-native-community/datetimepicker` | 8.4.4 | Native date/time |
| `react-native-reanimated` / `-gesture-handler` | ~4.1.1 / ~2.28.0 | Pinch-zoom, gestures |
| `@react-native-async-storage/async-storage` | 2.2.0 | One boolean flag |
| `expo-linking` | ~8.0.10 | Magic-link deep links |
| `express`, `cors`, `dotenv` | ^5.2.1, ^2.8.5, ^17.2.3 | Proxy (also in root deps) |

### Dead dependencies

Present in `package.json` but never imported anywhere in source:

- `@react-google-maps/api` (^2.20.8) — web maps use raw `<iframe>` embeds instead
- `react-native-fetch-api` (^3.0.0)
- `expo-system-ui` (~6.0.9)
- `http-proxy` (^1.18.1), `jose` (^6.2.0) — dev deps, unused
- `expo-haptics`, `@react-navigation/bottom-tabs`, `@react-navigation/elements` — only referenced by `components/haptic-tab.tsx`, which is itself never imported
- `expo-apple-authentication` — registered as a config plugin, but Apple sign-in actually goes through `supabase.auth.signInWithOAuth({ provider: "apple" })`, so the native module is unused

### Notable absences

No test framework, no crash reporter, no analytics SDK, no `expo-notifications`,
no `expo-secure-store`, no `@react-native-community/netinfo`.

---

## 4. Core Entities

```
auth.users (Supabase Auth)
  │
  ├─1:1─ profiles
  │        name, age, gender, bio, photos[], looking_for[], social_media_url,
  │        suspended, flagged_for_investigation, suspended_at, suspended_reason
  │
  ├─1:N─ lunches ── host_id, co_host_id
  │        restaurant, restaurant_address, place_id, latitude, longitude,
  │        date_time, seats, description, is_public,
  │        visibility_gender[], visibility_looking_for[], rating_prompt_sent_at
  │        │
  │        ├─1:N─ lunch_attendees   (user_id, status: pending|accepted|denied)
  │        ├─1:N─ lunch_invites     (inviter_id, invitee_id, status) UNIQUE(lunch_id, invitee_id)
  │        ├─1:1─ chat_rooms        UNIQUE(lunch_id)
  │        │        └─1:N─ messages (sender_id, message)
  │        └─1:N─ user_ratings      UNIQUE(rater_id, rated_id, lunch_id), rating 1–5, comment
  │
  ├─1:N─ user_contacts   (user_id → contact_id) UNIQUE, CHECK user_id <> contact_id
  ├─1:N─ user_reports    (reporter_id → reported_id, comment)
  └─1:N─ notifications   (type, title, body, data JSONB, read_at)

app_config (key, value)  ── holds admin_user_id
```

**Aggregate root:** `lunches`. Nearly every other entity hangs off a lunch, and the lunch
lifecycle (create → request → accept → chat → rate) drives the whole application.

> ⚠️ The `CREATE TABLE` statements for `profiles`, `lunches`, and `lunch_attendees` **do not
> exist anywhere in the repo.** Those tables were created ad hoc in the Supabase dashboard.
> The columns above are reconstructed from `ALTER TABLE` migrations plus application queries.
> The repo cannot recreate its own database from scratch.

---

## 5. Databases

**Engine:** Postgres, managed by Supabase (project `oamukmulfmmlkxrjtjfx`).

### Tables defined in migrations

| Table | Defining migration | Notable constraints |
|---|---|---|
| `chat_rooms` | `create_chat_system.sql:15` | `UNIQUE(lunch_id)`, FK cascade to lunches |
| `messages` | `create_chat_system.sql:5` | FK `sender_id` → auth.users; **no FK on `chat_room_id`** |
| `lunch_invites` | `create_lunch_invites.sql:4` | `UNIQUE(lunch_id, invitee_id)`, status CHECK |
| `user_ratings` | `create_user_ratings.sql:4` | `UNIQUE(rater_id, rated_id, lunch_id)`, rating CHECK 1–5 |
| `user_contacts` | `create_user_contacts.sql:5` | `UNIQUE(user_id, contact_id)`, `CHECK user_id <> contact_id` |
| `notifications` | `create_notifications.sql:6` | type CHECK (7 values), partial index on unread |
| `user_reports` | `create_user_reports.sql:15` | FK cascade both sides |
| `app_config` | `create_user_reports.sql:6` | PK `key`; RLS on, no policies (service-role only) |

### Indexes

Present on all foreign keys and on `messages.created_at DESC`,
`notifications.created_at DESC`, plus a partial index
`idx_notifications_user_unread WHERE read_at IS NULL`.

### Functions (all `SECURITY DEFINER`)

| Function | Purpose |
|---|---|
| `get_or_create_chat_room(lunch_id)` | Idempotent chat room creation — **no caller authorization check inside** |
| `accept_attendee_request(attendee_id, lunch_id)` | Verifies host/co-host, sets `accepted`, decrements seats |
| `deny_attendee_request(attendee_id, lunch_id)` | Verifies host/co-host, deletes row |
| `leave_lunch(lunch_id)` | Deletes caller's attendee row, increments seats |
| `search_users_by_email(search)` | LIKE search over `auth.users`; returns id, name, **email** |
| `get_user_by_email(email)` | Exact match; returns id, name |
| `get_user_average_rating(user_id)` | Rounded average; `EXECUTE` revoked from `authenticated` |
| `send_rating_prompts_for_past_lunches()` | Cron target |
| `check_single_user(user_id)` | Auto-suspension evaluation |

### Triggers

Seven `AFTER` triggers fan out notifications on: invite insert, join request insert,
request accepted, co-host added, new message, user report, and rating threshold breach.

### Scheduled jobs

`pg_cron` runs `send_rating_prompts` every 15 minutes
(`rating_prompts_2hrs_after_lunch.sql:68`).

### Migration process

Manual. `README.md` instructs pasting SQL into the Supabase editor. Three helper scripts
(`run-migration.js`, `run-sql-migration.js`, `execute-migration.js`) exist but each only
handles the single `looking_for` column, and they depend on an `exec_sql(text)` function
that executes arbitrary SQL.

---

## 6. APIs

The app exposes **no API of its own**. It consumes two.

### Supabase (PostgREST + GoTrue + Realtime + Storage)

Accessed exclusively through `@supabase/supabase-js`. Query surface, by module:

| Caller | Tables / RPCs |
|---|---|
| `LunchContext` | `lunches`, `lunch_attendees`, `lunch_invites`, `user_ratings`, `profiles`; RPCs `accept_attendee_request`, `deny_attendee_request`, `leave_lunch`, `get_or_create_chat_room` |
| `NotificationContext` | `notifications` (select/update + Realtime) |
| `AuthContext` | GoTrue (`signInWithOtp`, `signInWithOAuth`, `setSession`, `getUser`, `signOut`), `profiles` |
| `chat.tsx` | `messages`, `chat_rooms` (+ Realtime) |
| `profile/[id].tsx` | `profiles`, `user_contacts`, `user_reports` |
| `host.*.tsx` | `lunches` insert, `user_contacts`, RPC `get_user_by_email` |

### Places proxy (`server/places-proxy.js`)

| Method | Route | Upstream | Params |
|---|---|---|---|
| GET | `/places/autocomplete` | Google Place Autocomplete | `input` (min 2 chars), `types=restaurant` |
| GET | `/places/nearby` | Google Nearby Search | `lat`, `lng`, `radius` (≤50000) |
| GET | `/places/details` | Google Place Details | `place_id` |

Unmatched routes return a 404 JSON body listing the valid routes. No authentication,
no rate limiting, `cors()` with default (fully open) configuration, binds `0.0.0.0:8787`.

---

## 7. Events

There is **no message broker, queue, or event bus.** "Events" are implemented two ways:

### Database triggers → `notifications` rows

| Trigger | Table | Fires on | Notification type |
|---|---|---|---|
| `trg_notify_lunch_invite` | `lunch_invites` | INSERT | `invite` |
| `trg_notify_join_request` | `lunch_attendees` | INSERT (pending) | `join_request` |
| `trg_notify_request_accepted` | `lunch_attendees` | UPDATE → accepted | `request_accepted` |
| `trg_notify_cohost_added` | `lunches` | UPDATE co_host_id | `cohost_added` |
| `trg_notify_new_message` | `messages` | INSERT | `new_message` |
| `trg_notify_admin_on_user_report` | `user_reports` | INSERT | `user_report` |
| `trg_user_ratings_check_threshold` | `user_ratings` | INSERT/UPDATE | (suspension check) |
| `send_rating_prompts` (pg_cron, 15 min) | `lunches` | 2h past end | `rate_attendees` |

### Supabase Realtime → client subscriptions

Publication `supabase_realtime` includes `messages` and `notifications`.

| Channel | Table | Event | Effect |
|---|---|---|---|
| `notifications:{userId}` | `notifications` | INSERT (filtered by user) | Prepend to list, raise toast |
| `chat:{chatRoomId}` | `messages` | INSERT (filtered by room) | Append message bubble |
| `profile-{userId}` | `profiles` | UPDATE | Refresh header display name |

The pattern is: **write → trigger → notifications row → Realtime fan-out → client toast.**
Lunch lists themselves are *not* realtime; they require manual refetch.

---

## 8. Service Dependencies

| Service | Purpose | Failure mode |
|---|---|---|
| **Supabase** | Auth, database, realtime, storage | Total outage — app is unusable; no offline cache |
| **Google Places API** | Restaurant search, nearby, details | Restaurant selection breaks; hosting a lunch is blocked |
| **Render** | Hosts the Places proxy | Same as above. Free-tier cold starts are handled by explicit 503/408 handling in the host screens |
| **Expo EAS** | Build, submit, OTA updates | Release pipeline only |
| **Apple / Google identity** | OAuth sign-in | Magic-link email remains available |
| **GitHub Pages** | `docs/` static site | Marketing/legal pages only |

Single points of failure: Supabase and the Render proxy. There is no circuit breaker,
no cache, and no offline mode (`NetInfo` is not installed).

---

## 9. Deployment

### Mobile

| Profile | Config | Use |
|---|---|---|
| `development` | dev client, internal distribution, `simulator: false` | On-device dev builds |
| `preview` | store distribution (iOS), internal APK (Android) | TestFlight / sideload |
| `production` | **`{}` — completely empty** | Nominally store builds |

`eas submit` targets App Store Connect app `6760374356`. iOS bundle `com.lunchmeet.app`,
build number 13, version 1.0.0. OTA updates configured via `expo-updates` against
`https://u.expo.dev/7af89ddf-...` with `runtimeVersion.policy: appVersion`.

The `production` profile is empty while `PUBLISH_IOS_APP_STORE.md` instructs building with
it. Supabase configuration still survives this, because `app.config.js` explicitly reads the
**development** profile's env block out of `eas.json` as a fallback and injects it into
`extra`:

```3:5:app.config.js
// Fallback: eas.json env (used when process.env is empty, e.g. dev build loading from Metro)
const easConfig = require("./eas.json");
const easEnv = easConfig?.build?.development?.env || {};
```

`src/lib/supabase.ts` then reads `Constants.expoConfig.extra`, so a production build does get
a working Supabase client. Two consequences are worth flagging anyway:

> ⚠️ **Production inherits development's configuration by design.** If dev and prod ever
> point at different Supabase projects, `app.config.js` will silently ship the *development*
> URL and key into store builds. The fallback is doing load-bearing work it wasn't intended
> for.

> ⚠️ **The Android Maps API key has no such fallback.** `extra.googleMapsApiKey` and the
> `android.config.googleMaps.apiKey` block read `process.env.GOOGLE_PLACES_API_KEY` only
> (`app.config.js:45-49, 78`). If that variable is not present as an EAS secret at build
> time, the entire `googleMaps` config block is omitted and native maps break on Android in
> release builds.

### Proxy

`render.yaml` defines one Node web service `lunchmeet-places-proxy`, root `server/`,
build `npm install`, start `node places-proxy.js`, with `GOOGLE_PLACES_API_KEY` set
manually in the Render dashboard (`sync: false`).

### CI/CD

The only workflow is `.github/workflows/github-pages.yml`, which publishes `docs/` to
GitHub Pages on push to `main`/`master`. **There is no CI for the application itself** —
no build check, no lint gate, no tests, no automated mobile build or submission.

---

## 10. Authentication

### Mechanisms

1. **Email magic link** — `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })`.
   No OTP code entry UI; link-only.
2. **Google OAuth** — `signInWithOAuth({ provider: "google" })`, URL opened via `Linking.openURL`.
3. **Apple Sign In** — same path, native platforms only (hidden on web).

### Redirect resolution (`AuthContext.getRedirectUrl`)

| Platform | Redirect |
|---|---|
| Web | `window.location.origin` |
| Expo Go | `exp+lunchmeet://` |
| Standalone / dev client | `Linking.createURL("")` → `lunchmeet://` |

### Callback handling

The deep-link handler parses the URL **fragment** for `access_token` / `refresh_token`
and calls `supabase.auth.setSession(...)`. Registered through both
`Linking.getInitialURL()` + `addEventListener("url")` and expo-linking's `useURL()`.

### Session management

`createClient(url, anonKey)` is called with **no auth options** — no explicit
`persistSession`, `autoRefreshToken`, or storage adapter. Persistence and refresh therefore
fall back to `supabase-js` defaults. `@react-native-async-storage/async-storage` is
installed but **not wired into the Supabase client**, which is the usual React Native
requirement for session persistence across app restarts.

Bootstrap is `getUser()` + `onAuthStateChange`, with an 8-second loading timeout fallback.

### Suspension

On every profile bootstrap, `ensureProfile` selects `name, suspended`. If `suspended` is
true it immediately signs the user out and surfaces
*"Your account has been suspended pending investigation."*

### Route protection

Client-side redirects only: `(tabs)/_layout.tsx` → `/login` when unauthenticated,
`login.tsx` → `/(tabs)` when authenticated, `profile/[id].tsx` → `/login`.
All Stack screens stay registered regardless of auth state.

---

## 11. Authorization

### Roles

| Role | Derivation | Capabilities |
|---|---|---|
| Host | `lunches.host_id` | Create, close/delete, accept/deny requests, invite, assign co-host, chat |
| Co-host | `lunches.co_host_id` | Same as host for accept/deny and chat |
| Attendee (pending) | `lunch_attendees.status = 'pending'` | Awaiting approval; no chat |
| Attendee (accepted) | `status = 'accepted'` | Chat access, may leave (frees a seat) |
| Reporter | any authenticated user | Insert into `user_reports` (50-word minimum, enforced client-side) |
| Admin | `app_config.admin_user_id` | Not an app role — receives report notifications; reads reports via service role |

### Enforcement split

Server-side RLS is genuinely good for the tables it covers:

| Table | Policy summary |
|---|---|
| `lunch_invites` | Host/co-host insert; invitee updates; read own sent/received |
| `messages` | Select/insert restricted to host, co-host, accepted attendees |
| `user_ratings` | Insert/update own; **read only ratings you gave** — the rated user cannot see their own received ratings |
| `user_reports` | Insert own; `SELECT` denied to everyone (`USING (false)`) |
| `user_contacts` | All operations scoped to `user_id = auth.uid()` |
| `notifications` | Select/update own; inserts only via `SECURITY DEFINER` triggers |
| `app_config` | RLS on, zero policies — service role only |

### Authorization gaps

These are the substantive findings of this section.

1. **No RLS on `lunches` or `profiles` anywhere in the repo.** Grep for `ON lunches` /
   `ON profiles` returns only trigger definitions, no `CREATE POLICY`. If these tables were
   never given policies in the dashboard, every lunch and every profile row is readable by
   any client bearing the anon key.

2. **Private lunches are filtered client-side only.** `LunchContext.fetchLunches` selects
   all lunches, then filters in JavaScript:

```138:152:src/LunchContext.tsx
    // Phase 1 filter: skip myProfile fetch (defer visibility to background) - completes faster
    let filtered = normalized;
    if (!user) {
      filtered = normalized.filter((lunch: any) => lunch.is_public !== false);
    } else {
      filtered = normalized.filter((lunch: any) => {
        if (lunch.host_id === user.id || lunch.co_host_id === user.id) return true;
        if (lunch.is_public === false) {
          return (lunch.lunch_attendees || []).some(
            (a: any) => a.user_id === user.id && (a.status === "accepted" || !a.status)
          );
        }
        return true; // Show all public initially; visibility filter applied in background
      });
    }
```

   The private-lunch rows are transmitted to every client and then hidden in the UI.

3. **`visibility_gender` / `visibility_looking_for` are never enforced.** They are written
   when hosting but no filter — client or server — ever reads them. The comment on line 150
   promises a background filter that does not exist in the file.

4. **`lunch_attendees` is world-readable:** `CREATE POLICY "Everyone can view attendees"
   ... FOR SELECT USING (true)` (`fix_lunch_attendees_rls_v2.sql:57`). Every attendance
   record for every lunch is visible to any authenticated user.

5. **`chat_rooms` insert is unrestricted:** `WITH CHECK (true)`
   (`create_chat_system.sql:53`), and `get_or_create_chat_room` performs no caller check.

6. **Storage policies have no ownership scoping.** Any authenticated user may update or
   delete *any* object in the `profile-photos` bucket, and the bucket is publicly readable.

---

## 12. Data Mapping (PII)

| Data | Store | Readable by |
|---|---|---|
| Email | `auth.users` | Owner; **plus any authenticated user via `search_users_by_email`** |
| Name, age, gender, bio | `profiles` | Any user viewing a profile or lunch |
| Photos | `profiles.photos` as **base64 data URIs** | Anyone who can read `profiles` |
| `looking_for`, `social_media_url` | `profiles` | Public profile view |
| Precise venue coordinates | `lunches.latitude/longitude` | Lunch listings |
| Device GPS | Transient — sent to Places proxy as query params | Not persisted |
| Attendance | `lunch_attendees` | **Everyone** (RLS `USING (true)`) |
| Ratings + comments | `user_ratings` | Rater only |
| Reports | `user_reports` | Nobody via API; admin via service role |
| Chat messages | `messages` | Lunch participants |
| Contacts | `user_contacts` | Owner |
| Suspension metadata | `profiles.suspended*` | Read during auth bootstrap |

### Photo storage

Profile photos are base64-encoded into the `profiles.photos` column rather than uploaded to
Supabase Storage — there are **no `.upload()` calls in the codebase**. Storage policies and
`src/utils/photoUrls.ts` exist to handle URL-based photos, suggesting this was migrated away
from. Storing images as data URIs in a row that is selected on nearly every screen inflates
every profile query by megabytes.

### Compliance

`docs/privacy/index.html` (last updated 2026-04-19) covers account data, photos, location,
messaging, ratings, and reports. Contact: `jpmitchell.grad@hotmail.com`.

Gaps: the policy states authentication uses "email and password," which does not match the
magic-link/OAuth implementation. There is **no in-app account deletion, no data export, and
no retention or purge logic** anywhere in the codebase — relevant to GDPR Articles 15/17 and
to App Store Guideline 5.1.1(v), which requires account deletion within apps that support
account creation.

---

## 13. Security Check

Ordered by practical risk.

| # | Finding | Severity | Evidence |
|---|---|---|---|
| 1 | **No RLS on `lunches`/`profiles` in repo**; if absent in production, the anon key grants full read of all profiles and lunches | Critical (if unmitigated) | No `CREATE POLICY` for these tables in `migrations/` |
| 2 | **Private lunch visibility enforced only in client JS** — rows still leave the server | High | `src/LunchContext.tsx:138-152` |
| 3 | **`lunch_attendees` readable by all** — reveals who is meeting whom | High | `fix_lunch_attendees_rls_v2.sql:57` |
| 4 | **`search_users_by_email` returns `auth.users.email`** to any authenticated caller via `LIKE '%…%'`; enumerable | High | `create_lunch_invites.sql:43-61` |
| 5 | **Storage bucket has no per-user path scoping** — any authenticated user can overwrite/delete anyone's photos; bucket is public-read | High | `storage_profile_photos_policies.sql:17-36` |
| 6 | **`exec_sql(text)` executes arbitrary SQL** as `SECURITY DEFINER`; created by migration scripts. If it persists in production and is grantable, it is a direct RCE-on-database primitive | High (if deployed) | `scripts/execute-migration.js:41-50` |
| 7 | **Full auth deep-link URLs logged**, including the fragment carrying `access_token` / `refresh_token`; captured into in-app log buffer | Medium | `src/AuthContext.tsx:95,119,129` + `src/AppLogContext.tsx:45-60` |
| 8 | **Places proxy is unauthenticated with open CORS**, binding `0.0.0.0` — anyone who learns the Render URL can bill the Google key | Medium | `server/places-proxy.js:6,151` |
| 9 | **Proxy logs the full Google URL including `key=`** to stdout → Render logs | Medium | `server/places-proxy.js:29` |
| 10 | **`chat_rooms` INSERT `WITH CHECK (true)`** and `get_or_create_chat_room` has no caller authorization | Medium | `create_chat_system.sql:53`, `:103` |
| 11 | Session persistence relies on defaults with no AsyncStorage adapter wired in | Low | `src/lib/supabase.ts:20` |
| 12 | No account deletion / data export | Low (compliance) | — |

### On the committed Supabase credentials

`eas.json` lines 13–14 and 24–25 commit the Supabase project URL and anon JWT
(`"role":"anon"`). **This is not itself a vulnerability** — the anon key is designed to ship
in client bundles and is trivially extractable from any published binary. It matters only
because it is the key that RLS is supposed to constrain. Findings 1–5 above are what turn a
public-by-design key into an exposure. No service-role key, Google API key, or tunnel token
is committed.

### Not applicable

No SQL injection surface from the app (all access is via the Supabase client, and the
`LIKE` in `search_users_by_email` is parameterized). No XSS surface on native. No
deserialization of untrusted input.

---

## 14. Monitoring and Observability

**There is essentially none.** No Sentry, Crashlytics, Bugsnag, Datadog, Firebase
Analytics, Amplitude, or Segment. No structured logging, no metrics, no tracing, no
health-check endpoint on the proxy beyond the implicit 404 handler.

What exists is entirely in-app and developer-facing:

| Mechanism | Behavior |
|---|---|
| `src/AppLogContext.tsx` | Monkey-patches `console.log/warn/error`, retains the last 150 entries in React state |
| `components/LogViewerModal.tsx` | Renders that buffer; mounted in the root layout |
| `components/ErrorBoundary.tsx` | Catches render errors; stack trace shown only when `__DEV__` |
| `server/places-proxy.js` | `console.log` per request to Render's log stream |

> ⚠️ `openLogViewer()` is exported from `AppLogContext` but **nothing in the codebase calls
> it.** The log viewer is mounted and populated but has no way to be opened. Meanwhile the
> buffer is capturing auth deep links containing session tokens (finding #7 above).

Consequence: a production crash or a failed Supabase query is invisible to the maintainer
unless a user reports it manually.

---

## 15. Third-Party ML Services

**None.** There is no ML, AI, LLM, recommendation engine, embedding, or vector search
anywhere in the codebase. Lunch discovery is a plain `SELECT ... ORDER BY created_at` with
client-side filtering. The rating and auto-suspension logic is deterministic SQL
(average ≤ 3 across ≥ 3 distinct lunches), not a model.

---

## 16. Feature Flags

**No feature flag framework** (no LaunchDarkly, Unleash, Flagsmith, Split, or homegrown
flag service). Configuration is entirely build-time via `EXPO_PUBLIC_*` environment
variables baked in through `eas.json` and `app.config.js`.

The closest runtime toggles are per-entity data fields rather than flags:
`lunches.is_public`, `lunches.visibility_gender`, `lunches.visibility_looking_for`, and the
`AsyncStorage` key `lunchmeet_has_seen_safety_tips`. Changing app behavior requires a new
build or an OTA update.

---

## 17. Prompt / LLM Security

**Not applicable.** The application makes no LLM calls, has no prompts, no agent loop, and
no user input that reaches a model. There is therefore no prompt injection, jailbreak, or
model-output-trust surface.

One adjacent note: `.cursor/agents/` contains eight markdown task specifications
(`AGENT_01_CLOSE_LUNCH_CONFIRM.md` through `AGENT_08_SOCIAL_AUTH.md`) and
`.cursor/rules/*.mdc` contains rules. These are *development-time* instructions for AI
coding assistants, not runtime artifacts — they ship in the repo but never execute.
`AGENT_05_VISIBILITY_FILTERING.md` describes the visibility filtering that finding #3 in
§11 shows was never implemented.

---

# Mobile-Specific Analysis

## 18. UI and Navigation

### Navigator structure

Root `Stack` (`headerShown: false` globally) → `(tabs)` group → four visible tabs plus a
hidden `chat` route (`href: null`, tab bar hidden). Headers are **not** Stack headers; the
`(tabs)` layout renders a custom `AppHeader` component above the navigator with the logo,
notification bell (badge + `NotificationsModal`), profile shortcut, and log out.

Tab badges are data-driven: the Lunches tab shows pending invite count, My Lunches shows
pending join-request count for lunches you host or co-host. Tab bar height is
`64 + max(insets.bottom, 0)`.

Two layout-level modals are mounted rather than routed: `SafetyTipsModal` (first launch,
gated by AsyncStorage) and `RatePromptModal` (polls for lunches 2+ hours past end with
unrated attendees, then navigates to `/rate-attendees/[lunchId]`).

> Note the routing ambiguity: `router.push("/profile")` opens the **profile tab**, while
> `router.push("/profile/" + id)` opens the **stack screen**. Two different screens one
> character apart.

### Platform splits

| Base | Native | Web |
|---|---|---|
| `app/(tabs)/host.tsx` (re-exports web) | `react-native-maps`, `expo-location`, native date/time pickers, `KeyboardAvoidingView`, marker-tap restaurant selection | Google Maps `<iframe>`, HTML `<input type="date">`, `<select>` for time (7:00–21:30 in 30-min steps), `alert()` |
| `components/ProfilePhotoImage.tsx` | `expo-image` + `expo-file-system` cache with anon auth header | plain RN `Image` |
| `hooks/use-color-scheme.ts` | re-export from RN | returns `'light'` until hydration |
| `components/ui/icon-symbol.tsx` | `expo-symbols` SF Symbols (`.ios`) | MaterialIcons name map |

The web Host screen has drifted: it hardcodes `#E85D4C` in places instead of consuming
`Colors` from the theme, so the two implementations will diverge on any palette change.

### Theming

`constants/theme.ts` exports a single **light** palette (`Colors`, `Spacing`, `Radius`,
`Typography`, platform `Shadows`). `app.config.js` declares
`userInterfaceStyle: "automatic"`, and the template dark-mode hooks are present, but **no
dark theme is implemented** — the root layout hardcodes `StatusBar style="light"` and every
screen uses the fixed light palette. Styling is `StyleSheet.create` plus theme tokens.

### Accessibility

**No `accessibilityLabel`, `accessibilityRole`, or `accessible` props appear anywhere in the
codebase.** The only touch-target accommodation is `hitSlop={12}` on header icon buttons.
For an App Store app this is a meaningful gap.

---

## 19. API and Network

### Proxy URL resolution (`src/utils/proxyUrl.ts`)

Four-step fallback chain:

1. `process.env.EXPO_PUBLIC_PLACES_PROXY_URL`
2. `Constants.expoConfig.extra.placesProxyUrl`
3. Web → `http://localhost:8787`
4. Expo Go on device → derive the Metro host IP, append `:8787`

`fetchFromPlacesProxy` adds `Bypass-Tunnel-Reminder` (localtunnel) and
`ngrok-skip-browser-warning` (ngrok) headers so tunnel interstitial HTML doesn't get parsed
as JSON.

### Resilience

| Concern | Implementation |
|---|---|
| Lunch fetch | 3 retries with 2s/5s/10s backoff, then error state + Retry button |
| Auth bootstrap | 8-second loading timeout fallback |
| Places search | 300ms debounce |
| Cold starts | Explicit handling of 503, 408, and HTML-instead-of-JSON responses |
| Request timeout | **None** — no `AbortController` anywhere |
| Offline | **None** — no NetInfo, no cache, no queue |
| Proxy retries | None |

### Transport

App→Supabase and app→Render proxy are HTTPS. `http://` appears only in local-dev fallbacks
(`localhost:8787`, `localhost:3001`, LAN IPs) and tunnel targets.

---

## 20. Device Features

| Capability | Package | Permission declared | Runtime request |
|---|---|---|---|
| Foreground location | `expo-location` | iOS `NSLocationWhenInUseUsageDescription` + `NSLocationAlwaysAndWhenInUse...`; Android `ACCESS_FINE/COARSE_LOCATION` | `requestForegroundPermissionsAsync()` in `host.native.tsx:407` |
| Native maps | `react-native-maps` | Android Maps API key injected at build | — |
| Photo library | `expo-image-picker` | **No `NSPhotoLibraryUsageDescription` in `app.config.js`** | `requestMediaLibraryPermissionsAsync()` on mount in `profile.tsx:45` |
| Deep linking | `expo-linking`, scheme `lunchmeet` | scheme declared; **no `associatedDomains`/Universal Links** | — |
| Splash | `expo-splash-screen` | configured | auto-hide + 2.5s fallback |
| Date/time | `@react-native-community/datetimepicker` | plugin | native dialogs |
| Local storage | AsyncStorage | — | one boolean flag |
| Haptics / SF Symbols | `expo-haptics`, `expo-symbols` | — | present but effectively unused |

> ⚠️ **Missing iOS photo library usage string.** `expo-image-picker` is called on the Profile
> tab but `app.config.js` declares no `NSPhotoLibraryUsageDescription`. iOS terminates apps
> that access the photo library without a purpose string, and App Review rejects for it. The
> Expo config plugin may supply a default, but nothing in this repo sets one explicitly.

### Push notifications

**There are none.** `expo-notifications` is not a dependency and no push permissions are
declared. All "notifications" are in-app: a Postgres row plus a Realtime subscription plus a
toast. Users receive nothing when the app is closed — a significant product gap for an app
built around time-sensitive meetup invitations.

---

## 21. Data and Persistence

| Layer | Mechanism | Contents |
|---|---|---|
| Remote source of truth | Supabase Postgres | All entities |
| Remote binary | Supabase Storage `profile-photos` | Legacy/alternate photo path only |
| In-memory | React Context | Lunches, invites, notifications, auth user |
| Device persistent | AsyncStorage | `lunchmeet_has_seen_safety_tips` (one boolean) |
| Device cache | `expo-file-system` | Downloaded profile images (native only) |
| Session | supabase-js default storage | Auth tokens |

### Characteristics

There is **no local database, no offline cache, and no optimistic UI**. Every screen fetches
on mount from Supabase; a lost connection yields an error state and a Retry button. State
freshness is managed by a manual `version` counter in `LunchContext` and a
`contactsVersion` counter in `ContactsContext` that components watch to trigger refetches —
a hand-rolled substitute for query invalidation.

Photos are the notable anomaly: stored as base64 data URIs directly in `profiles.photos`
rather than in the Storage bucket that exists and has policies configured for exactly that
purpose.

---

## Summary

LunchMeet is a competently built, feature-complete Expo application shipping on the iOS App
Store. The lunch lifecycle is fully realized, the trust-and-safety design (ratings,
reports, automated suspension, safety interstitials) is more thorough than most apps at this
stage, and the database triggers plus Realtime give it a genuinely reactive notification
system without any backend of its own.

The risks concentrate in three areas:

1. **Authorization is incomplete at the server boundary.** Private-lunch visibility and the
   entire gender/looking-for filtering feature are client-side or absent, `lunch_attendees`
   is world-readable, and no RLS for `lunches` or `profiles` exists in the repo. For a
   BaaS architecture, RLS *is* the security model — gaps in it are not defense-in-depth
   issues, they are the whole perimeter.

2. **The database is not reproducible from the repo.** Base tables were created by hand,
   27 unordered migrations include superseded duplicates, and there is no migration tool.
   Nobody can stand up a second environment from this codebase.

3. **Operationally blind and untested.** Zero tests, no CI for the app, no crash reporting,
   no analytics — combined with an empty `production` EAS profile and two `package.json`
   lifecycle scripts pointing at files that don't exist.

The highest-value next steps, in order: verify and add RLS policies on `lunches` and
`profiles`; move `is_public` and visibility filtering into those policies; scope the storage
bucket policies to `auth.uid()`; stop logging full auth deep links; and populate the
`production` build profile before the next release.
