# Production Secrets Manifest

Everything LunchMeet v2 needs to run in production: what each credential is, where to obtain it, where it is stored, and how sensitive it is.

## Rules

**This file contains no values, and never will.** It is an inventory of what must be provisioned. Real values live only in the secret stores listed below. A credential pasted into this file is a credential published to the internet — this repository is public.

The machine-readable source of truth is `packages/config/catalog.ts`. This document is its human-facing provisioning runbook. If the two disagree, the catalogue wins and this file needs updating; CI checks that the variable names match.

The local development password used for `lunchmeet_dev` must never be reused in production.

## Where secrets live

There are four distinct stores, and putting a value in the wrong one is the most common way to leak it:

- **API host environment** — runtime secrets for the Hono API (Render, Fly, or Railway dashboard). Never in the repo.
- **EAS secrets** (`eas secret:create`) — values baked into mobile builds. Only `EXPO_PUBLIC_*` variables belong here, and everything in it ships inside the app binary and is extractable. Never put a server secret here.
- **GitHub Actions secrets** — CI-only credentials for building, submitting, and uploading source maps.
- **EAS credentials store** — certificates and keys that are files rather than environment variables. Managed by `eas credentials`.

Local development uses a gitignored `.env`, which is never committed and never mirrors production values.

---

## Database

- `DATABASE_URL` — **secret**. Postgres connection string for the API.
  - Obtain: GCP is the intended cloud, so most likely Cloud SQL for PostgreSQL; a managed alternative such as Neon remains open. The specific choice is made at Phase 8.
  - Store: API host environment, or Secret Manager if the API runs on GCP.
  - Notes: the production role must **not** be a superuser. Because migrations issue `CREATE EXTENSION`, an administrator must pre-create `citext`, `pg_trgm`, `cube`, `earthdistance`, and `pgcrypto` in the production database, or the first deploy fails.

## Authentication (Better Auth)

- `BETTER_AUTH_SECRET` — **secret**. Signs sessions. Generate with `openssl rand -base64 32`.
  - Store: API host environment.
  - Notes: rotating this invalidates every active session and signs all users out.
- `BETTER_AUTH_URL` — public. The API's canonical public origin, used to build OAuth callback URLs.

### Google OAuth

- `GOOGLE_CLIENT_ID` — low sensitivity but treat as secret.
- `GOOGLE_CLIENT_SECRET` — **secret**.
  - Obtain: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID.
  - Store: API host environment.
  - Notes: the authorized redirect URI must exactly match `BETTER_AUTH_URL` plus Better Auth's callback path.

### Apple Sign In

Required for App Store approval, since the app offers third-party sign-in.

- `APPLE_CLIENT_ID` — the Services ID (not the app bundle ID).
- `APPLE_TEAM_ID` — from your Apple Developer account.
- `APPLE_KEY_ID` — identifies the Sign In with Apple key.
- `APPLE_PRIVATE_KEY` — **secret**. Contents of the `.p8` file.
  - Obtain: Apple Developer → Certificates, Identifiers & Profiles → Keys, enabling Sign In with Apple.
  - Store: API host environment. The `.p8` downloads exactly once and cannot be retrieved again — losing it means generating a new key.

## Google Maps and Places

Two **separate, differently restricted** keys. Do not reuse one for both.

- `GOOGLE_PLACES_API_KEY` — **secret**. Server-side only, used by the API's Places endpoints.
  - Obtain: Google Cloud Console → Credentials.
  - Store: API host environment.
  - Restrict by: IP address, plus the Places API only. This key must never reach the client.
- `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` — public by necessity; ships inside the Android binary.
  - Store: EAS secrets.
  - Restrict by: Android package name `com.lunchmeet.app` plus SHA-1 signing certificate fingerprint, and the Maps SDK for Android only. Restriction is the only thing protecting it, since the value itself is extractable from the APK.
  - Notes: v1 omitted this in release builds, which silently disabled native maps on Android.

## Object storage — Google Cloud Storage

Profile photos, replacing v1's base64-in-Postgres approach. Uses the native `@google-cloud/storage` SDK.

- `GCP_PROJECT_ID` — public.
- `GCS_BUCKET` — public. Bucket name.
- `GCP_SERVICE_ACCOUNT_JSON` — **secret**. Only needed where a service account cannot be attached to the workload.
  - Obtain: Google Cloud Console → IAM & Admin → Service Accounts → Keys.
  - Grant: `roles/storage.objectAdmin`, scoped to this bucket rather than project-wide.

**Prefer attached identity over a key file.** On Cloud Run, GKE, or Compute Engine, attach the service account to the workload and omit `GCP_SERVICE_ACCOUNT_JSON` entirely — Application Default Credentials resolves it automatically. A downloaded JSON key is a long-lived credential that cannot be rotated without a redeploy and is the most common way GCP projects get compromised. It is needed only when hosting outside GCP.

Note that signing V4 URLs without a private key requires the service account to also hold `roles/iam.serviceAccountTokenCreator` on itself, so it can call the IAM `signBlob` API.

Clients never receive any of these — uploads go through V4 signed URLs issued by the API, under a per-user key prefix.

Local development uses `fake-gcs-server` and requires no real credentials.

## Email (magic links)

Magic-link sign-in is unusable if outbound email fails, so this is launch-blocking.

- `RESEND_API_KEY` — **secret**. (Or the equivalent for Postmark or SES.)
- `EMAIL_FROM` — public. Must be an address on a domain you have verified.
  - Obtain: your email provider dashboard.
  - Store: API host environment.
  - Notes: SPF, DKIM, and DMARC records must be configured, or magic links land in spam. v1's `MAGIC_LINK_OUTLOOK.md` documents that this bit them already.

## Push notifications

- `EXPO_ACCESS_TOKEN` — **secret**. Optional but recommended; enables enhanced security so only your servers can send to your app's push tokens.
  - Obtain: expo.dev → Account Settings → Access Tokens.
  - Store: API host environment.

Credentials that are **not** environment variables and live in the EAS credentials store instead:

- **APNs key** (`.p8`) — iOS push. Apple Developer → Keys → Apple Push Notifications service.
- **FCM server key / service account** — Android push. Firebase Console → Project Settings → Cloud Messaging.
- Upload both with `eas credentials`. Push silently fails without them.

## Error reporting

- `SENTRY_DSN` — semi-public. Embedded in the client; identifies the project but cannot read data.
- `SENTRY_AUTH_TOKEN` — **secret**. CI-only, for uploading source maps.
- `SENTRY_ORG`, `SENTRY_PROJECT` — public.
  - Store: DSN in API host environment and EAS secrets; auth token in GitHub Actions secrets only.

## Build and release (CI only)

- `EXPO_TOKEN` — **secret**. Lets GitHub Actions run `eas build` and `eas submit`.
  - Obtain: expo.dev → Account Settings → Access Tokens.
- `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY` — **secret**. App Store Connect API key for automated iOS submission.
  - Obtain: App Store Connect → Users and Access → Integrations → App Store Connect API. Requires App Manager role.
  - Notes: the same key would later enable download and install metrics, which are unavailable from any public API.
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — **secret**. Android submission, only once you ship to Play.
  - Store: all of the above in GitHub Actions secrets.

---

## Public configuration (not secrets)

Safe to commit and to bake into client bundles. Listed for completeness, since `packages/config` validates them alongside the secrets:

- `EXPO_PUBLIC_API_URL` — the API's public base URL.
- `EXPO_PUBLIC_WS_URL` — WebSocket endpoint for chat and notifications.
- `NODE_ENV`, `LOG_LEVEL`.

## Rotation and incident response

- Rotate `BETTER_AUTH_SECRET` only deliberately — it signs every user out.
- Rotate Google, S3, and email keys on a schedule and immediately if exposed.
- If a key leaks: revoke at the provider first, then issue a replacement, then redeploy. Revoking first limits the window; the reverse order leaves the leaked key live.
- The Apple `.p8` files cannot be re-downloaded. Store them in a password manager, not on a laptop.
- Secrets that reach a mobile binary (anything `EXPO_PUBLIC_*`) cannot be rotated by redeploying — they require a new app release, so restrictions matter more than secrecy.

## Pre-launch checklist

- [ ] Production Postgres provisioned, extensions pre-created, role is not superuser
- [ ] `BETTER_AUTH_SECRET` generated and stored
- [ ] Google OAuth redirect URI matches `BETTER_AUTH_URL` exactly
- [ ] Apple Sign In key created and `.p8` backed up
- [ ] Places key restricted by IP, Android Maps key restricted by package and SHA-1
- [ ] Object storage bucket created, token scoped to it
- [ ] Sending domain verified with SPF, DKIM, DMARC, and a magic link delivered end to end
- [ ] APNs key and FCM credentials uploaded to EAS
- [ ] Sentry receiving events from both client and API
- [ ] Every value present in its correct store, and none of them in this file
