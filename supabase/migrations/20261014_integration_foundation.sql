-- Family Hub integration foundation, staging review migration.
-- Apply only after reviewing existing household/membership schema.
create table if not exists public.family_integrations (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null,
 provider text not null check (provider in ('icloud','svenskalag','sportadmin','skidor_ta','google')),
 label text not null,
 connection_ref text,
 status text not null default 'pending' check (status in ('pending','active','paused','error')),
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(family_id,provider,connection_ref)
);
create table if not exists public.integration_sync_runs (
 id uuid primary key default gen_random_uuid(),
 integration_id uuid not null references public.family_integrations(id) on delete cascade,
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 status text not null default 'running' check(status in ('running','success','partial','failed')),
 fetched_count integer not null default 0,
 inserted_count integer not null default 0,
 updated_count integer not null default 0,
 error_code text
);
create table if not exists public.imported_event_versions (
 id uuid primary key default gen_random_uuid(),
 integration_id uuid not null references public.family_integrations(id) on delete cascade,
 sync_run_id uuid references public.integration_sync_runs(id),
 external_uid text not null,
 occurrence_key text not null default '',
 revision_hash text not null,
 title text not null,
 starts_at timestamptz not null,
 ends_at timestamptz,
 location text,
 raw_payload jsonb,
 observed_at timestamptz not null default now(),
 is_current boolean not null default true,
 unique(integration_id,external_uid,occurrence_key,revision_hash)
);
create index if not exists imported_event_versions_lookup on public.imported_event_versions(integration_id,external_uid,occurrence_key,observed_at desc);
create index if not exists imported_event_versions_time on public.imported_event_versions(starts_at);
alter table public.family_integrations enable row level security;
alter table public.integration_sync_runs enable row level security;
alter table public.imported_event_versions enable row level security;
-- Intentionally no client policies until household membership RLS is verified.
-- Import and synchronization must use trusted server-side credentials and family authorization.
-- Never store plaintext passwords or calendar tokens in connection_ref/raw_payload.
