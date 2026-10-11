# Shared Google family calendar integration

Target: the family's existing shared Google Calendar.

Phase 1: read-only import into Family Hub staging.

Requirements:
- Connect a Google account that has access to the shared calendar.
- Select the shared calendar by calendar ID, not just the account's primary calendar.
- Use server-side OAuth 2.0 with state validation and secure token storage.
- Restrict connection and sync configuration to staging administrators.
- Import events idempotently using source calendar ID plus external event ID.
- Handle updated and cancelled events without deleting unrelated Family Hub events.
- Keep Google credentials out of GitHub and out of NEXT_PUBLIC variables.
- Never touch production database while testing staging.

Next: configure Google Cloud OAuth consent and Calendar API, then implement server-side routes and staging tests.
