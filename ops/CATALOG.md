# Dependency Catalogue

Generated from `packages/config/src/catalog.ts`. Do not edit by hand.

Every external system LunchMeet talks to, what it is for, and what it needs
to be configured. Run `npm run doctor` to check which are reachable.

Credential provisioning instructions live in [PRODUCTION_SECRETS.md](PRODUCTION_SECRETS.md).

## PostgreSQL

System of record for every entity, and the pub/sub backbone for realtime.

**Obtain:** Local: createdb lunchmeet_dev. Production: Cloud SQL for PostgreSQL, or a managed equivalent.

**Required Postgres extensions:** `citext`, `pg_trgm`, `cube`, `earthdistance`, `pgcrypto`

| Variable | Required | Secret | Stored in |
|---|---|---|---|
| `DATABASE_URL` | yes | yes | API host environment |

- `DATABASE_URL`: The production role must not be a superuser.

## Google Cloud Storage

Profile photos, replacing v1's base64-in-Postgres columns.

**Obtain:** Local: fake-gcs-server via docker compose. Production: a GCS bucket with a service account scoped to it.

| Variable | Required | Secret | Stored in |
|---|---|---|---|
| `GCP_PROJECT_ID` | yes | no | API host environment |
| `GCS_BUCKET` | yes | no | API host environment |
| `STORAGE_EMULATOR_HOST` | no | no | Not a stored value |
| `GCP_SERVICE_ACCOUNT_JSON` | no | yes | API host environment |

- `STORAGE_EMULATOR_HOST`: Dev only. Must be unset in production.
- `GCP_SERVICE_ACCOUNT_JSON`: Omit on GCP; attach a service account to the workload instead.

## Better Auth

Sessions, magic links, and Google/Apple OAuth. Replaces Supabase Auth.

**Obtain:** Self-hosted. OAuth credentials come from Google Cloud Console and Apple Developer.

| Variable | Required | Secret | Stored in |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | yes | yes | API host environment |
| `BETTER_AUTH_URL` | yes | no | API host environment |
| `GOOGLE_CLIENT_ID` | no | yes | API host environment |
| `GOOGLE_CLIENT_SECRET` | no | yes | API host environment |
| `APPLE_CLIENT_ID` | no | no | API host environment |
| `APPLE_TEAM_ID` | no | no | API host environment |
| `APPLE_KEY_ID` | no | no | API host environment |
| `APPLE_PRIVATE_KEY` | no | yes | API host environment |

- `BETTER_AUTH_SECRET`: Rotating this signs every user out.
- `APPLE_PRIVATE_KEY`: The .p8 downloads exactly once and cannot be retrieved again.

## Outbound email

Delivers magic-link sign-in. Sign-in is unusable if this fails.

**Obtain:** Local: Mailpit via docker compose. Production: Resend, Postmark, or SES.

| Variable | Required | Secret | Stored in |
|---|---|---|---|
| `SMTP_HOST` | yes | no | API host environment |
| `SMTP_PORT` | yes | no | API host environment |
| `SMTP_USER` | no | no | API host environment |
| `SMTP_PASSWORD` | no | yes | API host environment |
| `EMAIL_FROM` | yes | no | API host environment |

- `EMAIL_FROM`: Domain needs SPF, DKIM and DMARC or links land in spam.

## Google Places API (optional)

Restaurant search, nearby lookup, and place details when hosting a lunch.

**Obtain:** Google Cloud Console → Credentials. Restrict by IP and to the Places API only.

| Variable | Required | Secret | Stored in |
|---|---|---|---|
| `GOOGLE_PLACES_API_KEY` | no | yes | API host environment |

- `GOOGLE_PLACES_API_KEY`: Server-side only. Must never reach the client.

## Expo Push Service (optional)

Delivers notifications when the app is backgrounded. v1 had none.

**Obtain:** expo.dev → Access Tokens. APNs and FCM keys go in the EAS credentials store.

| Variable | Required | Secret | Stored in |
|---|---|---|---|
| `EXPO_ACCESS_TOKEN` | no | yes | API host environment |

- `EXPO_ACCESS_TOKEN`: Optional; enables enhanced security so only your servers can push.

## Sentry (optional)

Error reporting for API and client. v1 was blind to production crashes.

**Obtain:** sentry.io → Project Settings → Client Keys (DSN).

| Variable | Required | Secret | Stored in |
|---|---|---|---|
| `SENTRY_DSN` | no | no | API host environment |
| `EXPO_PUBLIC_SENTRY_DSN` | no | no | EAS secrets (ships in the app binary) |
| `SENTRY_AUTH_TOKEN` | no | yes | GitHub Actions secrets |

- `EXPO_PUBLIC_SENTRY_DSN`: Client DSN. Ships in the binary; identifies the project but cannot read data.
- `SENTRY_AUTH_TOKEN`: CI only, for uploading source maps.

## Production database prerequisites

Migrations issue `CREATE EXTENSION`, which a non-superuser role cannot do. An
administrator must pre-create these in the production database or the first
deploy fails:

- `citext`
- `pg_trgm`
- `cube`
- `earthdistance`
- `pgcrypto`
