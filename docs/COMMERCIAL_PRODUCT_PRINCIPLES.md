# Commercial-first product principles

Family Hub is a multi-tenant commercial product. The Hjertstedt family is the first pilot customer, not a hard-coded account model.

## Customer experience
1. Create account with email, passkey or secure sign-in.
2. Create household and invite members.
3. Choose services from a visually polished connection catalog.
4. Connect via provider-hosted OAuth/consent when available. Never request provider passwords in Family Hub.
5. Where OAuth is unavailable, offer a documented supported subscription/import flow; clearly disclose limitations.
6. Assign imported events to household members, review duplicates and view a clean unified calendar.

## Non-negotiable architecture
- Multi-tenant household isolation and RLS from day one; no global shared Apple credentials.
- Credentials and tokens stored encrypted server-side, scoped to household and provider, revocable; never expose them to browser or logs.
- Least-privilege access and explicit consent; support disconnect, deletion and export.
- Source adapters share a typed contract: connect, connection status, sync, normalize, disconnect.
- Sync jobs idempotent, incremental where supported, rate-limited, observable and resilient to provider outages.
- Separate verified integrations from planned/unsupported providers; never render fake Connect buttons.
- Apple CalDAV app-specific passwords may require a guided setup; don't promise Apple OAuth without confirmed support.
- Svenskalag and SportsAdmin integration feasibility, official APIs, terms and authentication must be verified before offering one-click login.
- Compliance plan: GDPR, data minimization, child privacy, retention, audit trail and privacy policy.
- Security gates and successful staging verification before production release.

## Design system
- Mobile-first responsive layouts, clear hierarchy, consistent spacing, typography and accessible color contrast.
- Simple Swedish onboarding, friendly empty states, concise status text, useful recovery paths.
- Connection cards: logo/name, capabilities, status, last sync, action, explanation of required permissions.
- Avoid jargon (ICS, CalDAV, API) on primary screens; show it only in advanced details.
- One clear primary action per view; loading, success and failure states must be real.
- Support Swedish initially, with internationalization-ready copy.

## Next implementation milestones
1. Define provider registry and connector contract; replace hard-coded family-specific UI in reusable components.
2. Implement household/member schema with RLS and migration plan.
3. Build real connection catalog and guided onboarding, with truthful provider status.
4. Verify provider-approved access for Apple, Google, SportsAdmin, Svenskalag, Svenska Skidförbundet.
5. Add background sync, monitoring, consent, deletion and test coverage.
6. Conduct iPhone usability tests with a fresh test household.

Current state: this document is a product/engineering requirement, not a claim that these integrations already exist.
