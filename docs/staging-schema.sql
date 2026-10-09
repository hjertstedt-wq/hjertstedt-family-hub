-- STAGING ONLY. Run in a NEW, EMPTY Supabase project, never production.
-- No production data, no production user IDs. Create test users via Supabase Auth UI.
begin;
create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 300),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  category text not null default 'general',
  source text not null default 'manual',
  external_id text,
  created_at timestamptz not null default now(),
  constraint valid_event_range check (ends_at > starts_at)
);
create table if not exists public.event_persons (
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  primary key (event_id,person_id)
);
create unique index if not exists staging_event_source_external_unique
  on public.calendar_events(source,external_id) where external_id is not null;
create table if not exists public.staging_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on public.staging_admins from anon, authenticated;
-- RLS policy checks use a locked-down SECURITY DEFINER helper to avoid recursion/privilege errors.
create or replace function public.is_staging_admin() returns boolean
language sql stable security definer set search_path = '' as $
  select exists (select 1 from public.staging_admins where user_id = (select auth.uid()));
$;
revoke all on function public.is_staging_admin() from public, anon;
grant execute on function public.is_staging_admin() to authenticated;
alter table public.persons enable row level security;
alter table public.calendar_events enable row level security;
alter table public.event_persons enable row level security;
alter table public.staging_admins enable row level security;
-- No anonymous access. Test members read, designated test admin writes.
create policy "staging_persons_read" on public.persons for select to authenticated using (true);
create policy "staging_events_read" on public.calendar_events for select to authenticated using (true);
create policy "staging_links_read" on public.event_persons for select to authenticated using (true);
create policy "staging_persons_admin_insert" on public.persons for insert to authenticated with check ((select public.is_staging_admin()));
create policy "staging_persons_admin_update" on public.persons for update to authenticated using ((select public.is_staging_admin())) with check ((select public.is_staging_admin()));
create policy "staging_persons_admin_delete" on public.persons for delete to authenticated using ((select public.is_staging_admin()));
create policy "staging_events_admin_insert" on public.calendar_events for insert to authenticated with check ((select public.is_staging_admin()));
create policy "staging_events_admin_update" on public.calendar_events for update to authenticated using ((select public.is_staging_admin())) with check ((select public.is_staging_admin()));
create policy "staging_events_admin_delete" on public.calendar_events for delete to authenticated using ((select public.is_staging_admin()));
create policy "staging_links_admin_insert" on public.event_persons for insert to authenticated with check ((select public.is_staging_admin()));
create policy "staging_links_admin_delete" on public.event_persons for delete to authenticated using ((select public.is_staging_admin()));
commit;
-- AFTER creating a staging Auth user, run manually in staging SQL editor:
-- insert into public.staging_admins(user_id) values ('REPLACE_WITH_STAGING_TEST_ADMIN_AUTH_UID');
-- Seed fictional people only:
-- insert into public.persons(name) values ('Elsa Test'),('Alva Test'),('Förälder Test');
