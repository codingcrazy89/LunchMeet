# v2 Cutover Runbook

Moving LunchMeet from Supabase to the v2 stack, and getting the new build onto
the App Store.

## What makes this cheap

The live app has shipped exactly one version, 1.0 on 2026-04-30, and carries a
single rating. The installed base is almost certainly tiny, which is why a
clean break was chosen over dual-running. Confirm this before starting:

```bash
curl -s "https://itunes.apple.com/lookup?id=6760374356" \
  | python3 -c "import json,sys; r=json.load(sys.stdin)['results'][0]; \
print(r['version'], r['releaseDate'], r['userRatingCount'], 'ratings')"
```

If that number has grown substantially, revisit the decision: a phased
migration behind a feature flag becomes worth the extra work.

## What does not carry over

Be explicit with users about this, because it is visible to them.

- **Sessions.** Supabase Auth sessions cannot be translated into Better Auth
  sessions. Everyone is signed out once and signs in again by magic link. Email
  addresses are preserved, so it is one tap, not a re-registration.
- **Photos already on Supabase Storage.** The migration decodes the base64 data
  URIs that v1 actually used. Any photo stored as a Storage URL is reported as
  skipped and needs re-hosting separately.
- **Notifications older than 30 days.** Deliberately not migrated; they are
  transient and reference a UI that has changed.

Everything else moves: users, profiles, lunches, attendance, invitations, chat
history, ratings, contacts, and reports.

## Prerequisites

1. Production Postgres provisioned, with `citext`, `pg_trgm`, `cube`,
   `earthdistance` and `pgcrypto` pre-created by an administrator. Migrations
   issue `CREATE EXTENSION`, which the application role cannot do. Application
   tables go in the `lunchmeet` schema, so the role needs `USAGE, CREATE` there
   and only `USAGE` on `public`. See
   [PRODUCTION_SECRETS.md](PRODUCTION_SECRETS.md).
2. Every credential in [PRODUCTION_SECRETS.md](PRODUCTION_SECRETS.md) in place,
   verified with `npm run doctor`.
3. A GCS bucket, and a service account attached to the workload rather than a
   downloaded key file.
4. A read-only Supabase connection string. Take it from the Supabase dashboard
   under Project Settings, Database. Treat it as a secret and do not commit it.

## Migration

The script defaults to a dry run and writes nothing without `--apply`.

**Step 1: dry run.** Reports exactly what it would write, and what it would skip.

```bash
cd apps/api
SUPABASE_DB_URL='postgresql://...' npx tsx src/scripts/migrate-from-supabase.ts
```

Read the skipped list carefully. Two categories are expected: photos that are
URLs rather than base64, and self-ratings, which v2 forbids with a check
constraint that v1 lacked. Anything else needs investigating before proceeding.

**Step 2: snapshot both sides.** Take a Supabase backup and a target dump, so
there is a way back.

**Step 3: apply.** The script refuses to run if the target already has users, so
a re-run cannot silently double-import.

```bash
SUPABASE_DB_URL='postgresql://...' npx tsx src/scripts/migrate-from-supabase.ts --apply
```

It prints row counts per table afterwards. Compare them against the dry run.

**Step 4: verify.**

```bash
curl -s https://<api-host>/health/ready
```

Then spot-check by hand: sign in as a migrated user, confirm their profile and
photos render, open a lunch with chat history, and confirm a private lunch is
invisible to an account that was not invited. That last check is the one worth
doing personally, since it is what v1 got wrong.

## Release sequencing

Order matters here: the new binary cannot ship before the API it talks to.

1. **Deploy the API** and confirm `/health/ready` reports all dependencies
   healthy. The old app keeps running against Supabase and is unaffected.
2. **Run the migration** during a quiet period. Writes to Supabase after this
   point will not be carried over, so keep the window short.
3. **Build with EAS.** `eas build --profile production --platform ios`. The
   profile is populated now; v1's was `{}` and inherited development
   configuration silently.
4. **Submit.** `eas submit --platform ios --latest`, targeting App Store Connect
   app `6760374356`.
5. **Wait for review before retiring Supabase.** If the build is rejected, the
   old app is still the one on phones and it still needs its backend.
6. **Release**, then watch Sentry. This is the first release with error
   reporting, so treat the first day's volume as a baseline rather than a
   regression.
7. **Retire Supabase** once the new version is adopted and stable. Keep the
   project in a paused state, not deleted, until you are confident.

### Store metadata to update

- The app name in `app.config.ts` is now `LunchMeet Social`, matching the store
  listing it previously disagreed with.
- The privacy policy in `docs/privacy/` states authentication uses "email and
  password", which was never true and is still not. Correct it to magic link
  and social sign-in.
- Photos now live in Cloud Storage rather than the database, and push
  notifications are new. Both change the answers on the App Privacy
  questionnaire.

## Rollback

Before the store release, rollback is free: the live app still talks to
Supabase, so stop the cutover and nothing user-visible has changed.

After the release it is harder, because a submitted build cannot be recalled.
The realistic path is to fix forward, which is why steps 1 and 4 exist: the API
is deployed and verified before any binary is submitted, and an OTA update can
ship JavaScript fixes without another review cycle.
