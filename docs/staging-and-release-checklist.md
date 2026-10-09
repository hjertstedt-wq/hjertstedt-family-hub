# Family Hub 4.0 — staging and release gates

## Separation first (do not use production data for destructive tests)
1. Create a **separate Supabase project** named Family Hub Staging.
2. Apply reviewed schema and RLS migrations to staging. Never copy production user emails, passwords, tokens or personal calendar data into staging.
3. Create two test users: staging admin and staging read-only member. Seed fictional people and events only.
4. Create a **separate Vercel project** (or dedicated staging environment) connected to the staging Supabase URL and publishable key. Keep production variables unchanged. Never put a Supabase service-role key into NEXT_PUBLIC_*.
5. Verify both environments independently: a staging event must not appear in production and vice versa.
6. Only then run create/edit/delete tests in staging.

## Release gates
- [ ] GitHub Actions tests and Next.js build pass on exact release SHA
- [ ] Vercel production deployment succeeds on same SHA
- [ ] Logged-out users cannot read or write protected family records
- [ ] Admin can create, edit and delete a fictional calendar event in staging
- [ ] Read-only user cannot modify records (verified by RLS, not only disabled buttons)
- [ ] U14/U16 candidate approvals and removals work, including bulk operations
- [ ] Unverified ski events stay out of main calendar
- [ ] Import UTC, all-day, duplicate UID, malformed timestamp and source change cases
- [ ] Approved imported events remain unchanged when source changes
- [ ] Month/week/day views and family filters work on phone and desktop
- [ ] Restore a staging backup and verify record counts and references
- [ ] No P0/P1 bugs remain; rollback procedure rehearsed

## Production incident response
1. Stop new releases; note affected commit, timestamps and symptoms.
2. Roll back to the last known-good Vercel deployment.
3. If database integrity is affected, stop writes and inspect backups; never restore production without confirming recovery point and data-loss implications.
4. Reproduce in staging, add regression test, fix and redeploy only after gates pass.

## Current limitations
- This document does **not** create Supabase staging or change RLS.
- The ski source endpoint checks reachability, not verified event content.
- GitHub Actions/Vercel statuses must be checked externally; a committed workflow is not proof of passing tests.
- Do not deploy multi-family SQL design until tenant isolation and RLS are audited.
