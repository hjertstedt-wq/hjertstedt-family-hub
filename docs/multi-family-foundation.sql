-- DESIGN ONLY: Do not execute in production without a backup and an RLS migration.
-- Multi-family foundation for a later, controlled migration.
create table if not exists public.families (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 1 and 120),
 created_at timestamptz not null default now()
);
create table if not exists public.family_memberships (
 family_id uuid not null references public.families(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','admin','member')),
 created_at timestamptz not null default now(),
 primary key (family_id,user_id)
);
create table if not exists public.family_sources (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 provider text not null,
 source_key text not null,
 display_name text not null,
 status text not null default 'not_connected' check (status in ('not_connected','active','error','paused')),
 last_checked_at timestamptz,
 last_synced_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 unique(family_id,provider,source_key)
);
create index if not exists family_memberships_user_idx on public.family_memberships(user_id);
create index if not exists family_sources_family_idx on public.family_sources(family_id);
alter table public.families enable row level security;
alter table public.family_memberships enable row level security;
alter table public.family_sources enable row level security;
-- Membership SELECT can only expose the requesting user's own memberships.
create policy "memberships_self_read" on public.family_memberships
 for select to authenticated using (user_id = (select auth.uid()));
create policy "families_member_read" on public.families
 for select to authenticated using (
  exists (select 1 from public.family_memberships m where m.family_id=id and m.user_id=(select auth.uid()))
 );
create policy "family_sources_member_read" on public.family_sources
 for select to authenticated using (
  exists (select 1 from public.family_memberships m where m.family_id=public.family_sources.family_id and m.user_id=(select auth.uid()))
 );
-- No client write policies yet. Use a security-reviewed, authenticated server flow for family creation.
-- NEXT MIGRATION (NOT INCLUDED): add family_id to persons/calendar_events/event_persons,
-- backfill existing data into the Hjertstedt family, then enforce NOT NULL and tenant RLS.
-- Never loosen existing RLS or expose service-role keys in the browser.
