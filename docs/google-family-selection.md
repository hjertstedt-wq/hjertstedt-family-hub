# Exact Family selection (staging / develop)

The family calendar endpoint lists all accessible Google calendars (up to 750;
if more pages remain it fails safely) and matches `summary === "Family"`.
There is no primary-calendar, Familj, case-insensitive or browser-local fallback.
If names collide, a saved validated ID wins; otherwise the user explicitly selects
between calendars named Family. A removed/renamed saved calendar is re-resolved.
Every selected ID is validated against the current Google account before events
are read. Client-supplied IDs and metadata cannot grant calendar access.

## Account persistence and isolation

`hfh_google_family_calendar_v2` in Supabase Auth user metadata stores only the
calendar ID. The server reads `/auth/v1/user` using the current Hub bearer token
and merges only this key using PUT to that same self-service endpoint. Supabase
Auth restricts the operation to the token owner (equivalent account isolation,
without a public table or RLS migration). The write response is checked before
success is reported. Unrelated metadata is retained. No service role key, Google
token or private event content is written to metadata. Metadata is a preference,
not an authorization claim. Supabase documents user metadata and self-service
updates at https://supabase.com/docs/guides/auth/managing-user-data and
https://supabase.com/docs/reference/javascript/auth-updateuser.

A fresh browser/iPhone request reads the same server preference; stale
localStorage values from the former v1 implementation are ignored. The metadata
key is new and production code on main does not consume it. No schema or sports
integration configuration is changed.

## OAuth boundary

Existing encrypted HttpOnly Google cookies remain browser-scoped. Each browser
must authorize Google once through Connections > Anslut Google, using a Google
account with access to Family. The app requests calendar.readonly and offline
access; absent, expired or rejected grants produce a visible reconnect message.
After consent the Connections page automatically discovers Family; opening the
calendar also resolves it automatically. No calendar ID needs to be copied.
OAuth redirect origin and existing encryption settings are unchanged.

## Verification

`tests/google-family.test.mjs` exercises exact matching, duplicates, stale and
foreign IDs, multiple Calendar List pages, safe failure on incomplete lists,
self-service persistence, two accounts, new-device requests, persistence errors,
Google permission errors, event mapping and cookie user binding. External services
are mocked: these tests do not prove a real user's Google grant or live Supabase
write. Live verification requires an authenticated staging session and Google
consent on that browser. Existing sports and ski regression tests remain in place.
