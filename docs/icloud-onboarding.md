# Private iCloud onboarding — staging release

## Implemented

`/onboarding`: existing Hub account → create owned household → choose real source
→ consent to private iCloud access → discover accepted shared/personal calendars
→ auto-select an unambiguous exact Family name or explicitly choose another
→ read events in `/calendar` → disconnect and erase saved connection.

The adapter only uses read methods against an allowlist of Apple calendar hosts.
All redirects are validated before credentials are sent. Provider requests have
bounds on time, count and response size. XML declarations/entities are rejected.
The database enforces a six-attempt-per-minute budget per authenticated user.
Normal event reads use the visible date window; recurrence expansion is bounded.
Stable occurrence IDs, EXDATE, overrides, cancellations, all-day dates and embedded
VTIMEZONE definitions are supported. Unknown timezones are reported as skipped.
No event content is persisted by this integration and no Apple mutations are made.

## Storage

Apply `supabase/migrations/20261102_private_calendar_onboarding.sql` only to the
verified staging project `vohbfgeidvnybkplnfci`. It adds new `hub_*` tables/policies
without altering legacy tables. Household ownership is derived from the validated
Hub bearer token; RLS applies to all CRUD operations. No client-supplied owner or
household ID is trusted by API routes. One owned household per account in this
release; invitations and shared Hub membership are not implemented yet.

Apple credentials and the private calendar URL are encrypted together using
AES-256-GCM with authenticated context binding owner, household and provider.
A user can access their encrypted database row under RLS but cannot decrypt it
without the server-only key. The app never returns that row or any plaintext
credential to the browser. It never stores credentials in user metadata,
localStorage, sessionStorage or a cookie. The password field is cleared after
submission. Use an Apple app-specific password, never the primary password.

`INTEGRATION_ENCRYPTION_KEY` is a 32-byte hex key held only by Vercel server runtime.
If absent, the existing server-only `GOOGLE_TOKEN_ENCRYPTION_KEY` is used as key
material with a distinct HKDF context. Both versions derive a separate integration
key; Google cookie encryption is unchanged. Back up and retain the key while any
connections exist. A key rotation requires decrypt/re-encrypt migration or users
must reconnect. Do not print keys, credentials or private calendar URLs in logs.

`INTEGRATIONS_APP_ORIGIN` limits the deployment origin; it defaults to the existing
`GOOGLE_OAUTH_APP_ORIGIN`. Staging's canonical origin is
`https://hjertstedt-family-hub-staging.vercel.app`. Missing/wrong origin, missing
key or missing database schema fail closed. Credentials are not sent to Apple
until server storage readiness is checked.

## Activation and verification

1. Review/apply the additive migration in the verified staging database.
2. Verify RLS with two real staging accounts and no authenticated session.
3. Confirm the runtime key and origin exist without exposing their values.
4. Sign into Hub, open onboarding, create a household and connect the Apple account
   that accepted the Family sharing invitation. User enters the app-specific
   password directly in the app, never in chat.
5. Verify Family events including one recurrence on desktop and iPhone logged into
   the same Hub account; verify disconnect removes saved access. Revoke the
   app-specific password at Apple if it should no longer be used.

Local tests cover encryption context isolation, endpoint/redirect validation,
read-only transport, response limits, recurrence/timezone parsing and actual
PostgreSQL RLS behavior. They cannot establish access to a real Apple calendar.
A deployed source build is not proof that the database migration is activated.

## Commercial release gates (still outstanding)

This is an onboarding and connector foundation, not a completed public SaaS
launch. Do not enable public signup until legacy persons/calendar_events and all
other application data are tenant-scoped and audited. Existing legacy RLS is not
modified by this release. Remaining work includes household invitations/roles,
provider-wide persistent selections (sports and Google OAuth are still pilot
flows), scheduled incremental sync with observability, deletion/export UX across
all data, retention/privacy/legal policies, billing and live multi-account/iPhone
acceptance tests. No production migration or release is authorized by this
staging workflow.

Provider guidance: https://support.apple.com/en-us/102654
Adapter API: https://tsdav.vercel.app/intro/
Recurrence semantics: https://kewisch.github.io/ical.js/api/ICAL.Event.html
