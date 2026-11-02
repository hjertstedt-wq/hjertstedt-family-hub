-- Apply to the verified STAGING Supabase project first. Additive: no legacy
-- persons/calendar_events policies or production records are changed.
begin;
create table public.hub_households (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade unique,
 name text not null check(char_length(trim(name)) between 1 and 120),
 created_at timestamptz not null default now()
);
create table public.hub_calendar_connections (
 household_id uuid not null references public.hub_households(id) on delete cascade,
 provider text not null check(provider = 'icloud'),
 encrypted_config text not null check(char_length(encrypted_config) between 40 and 20000),
 calendar_name text,
 status text not null check(status in ('choose_calendar','active')),
 consent_version text not null default 'icloud-read-v1',
 consented_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(household_id,provider)
);
alter table public.hub_households enable row level security;
alter table public.hub_calendar_connections enable row level security;
create policy household_owner on public.hub_households for all to authenticated
 using(owner_id = (select auth.uid())) with check(owner_id = (select auth.uid()));
create policy connection_owner on public.hub_calendar_connections for all to authenticated
 using(exists(select 1 from public.hub_households h where h.id=household_id and h.owner_id=(select auth.uid())))
 with check(exists(select 1 from public.hub_households h where h.id=household_id and h.owner_id=(select auth.uid())));
revoke all on public.hub_households, public.hub_calendar_connections from anon;
grant select, insert, update, delete on public.hub_households, public.hub_calendar_connections to authenticated;
-- Only ciphertext is stored in the connection row. Server AES-GCM key never
-- enters Supabase or the browser. Associated data binds tenant, owner, provider.
-- Atomic per-account provider request budget. Clients cannot edit this table.
create table public.hub_integration_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null,
 attempts integer not null
);
alter table public.hub_integration_limits enable row level security;
revoke all on public.hub_integration_limits from anon, authenticated;
create function public.hub_claim_icloud_attempt() returns boolean
language plpgsql security definer set search_path = '' as $$
declare used integer;
begin
 if auth.uid() is null then return false; end if;
 insert into public.hub_integration_limits(user_id,window_start,attempts)
 values(auth.uid(),now(),1)
 on conflict(user_id) do update set
   attempts=case when public.hub_integration_limits.window_start < now()-interval '1 minute' then 1 else public.hub_integration_limits.attempts+1 end,
   window_start=case when public.hub_integration_limits.window_start < now()-interval '1 minute' then now() else public.hub_integration_limits.window_start end
 returning attempts into used;
 return used <= 6;
end $$;
revoke all on function public.hub_claim_icloud_attempt() from public, anon;
grant execute on function public.hub_claim_icloud_attempt() to authenticated;
commit;
