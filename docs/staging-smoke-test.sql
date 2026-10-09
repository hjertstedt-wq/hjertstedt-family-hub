-- Hjertstedt Family Hub: STAGING ONLY
-- Run ONLY in the separate staging Supabase project.
-- Seeds fictional data idempotently and checks basic relationships.
begin;
insert into public.persons(id,name)
values
 ('11111111-1111-4111-8111-111111111101','Alva Test'),
 ('11111111-1111-4111-8111-111111111102','Elsa Test'),
 ('11111111-1111-4111-8111-111111111103','Förälder Test')
on conflict(id) do update set name=excluded.name;

insert into public.calendar_events(id,title,description,starts_at,ends_at,location,category,source,external_id)
values
 ('22222222-2222-4222-8222-222222222201','STAGING – Alpint U14','U14 · Testaktivitet','2026-11-14 09:00:00+01','2026-11-14 12:00:00+01','Testbacken','ski_candidate','staging_seed','staging-u14'),
 ('22222222-2222-4222-8222-222222222202','STAGING – Alpint U16','U16 · Testaktivitet','2026-11-15 09:00:00+01','2026-11-15 12:00:00+01','Testbacken','ski_candidate','staging_seed','staging-u16'),
 ('22222222-2222-4222-8222-222222222203','STAGING – Familjekalender','Fiktivt kalendertest','2026-11-16 17:00:00+01','2026-11-16 18:00:00+01','Testplats','general','staging_seed','staging-family')
on conflict(id) do update set title=excluded.title,description=excluded.description,starts_at=excluded.starts_at,ends_at=excluded.ends_at,location=excluded.location,category=excluded.category;

insert into public.event_persons(event_id,person_id)
values
 ('22222222-2222-4222-8222-222222222201','11111111-1111-4111-8111-111111111101'),
 ('22222222-2222-4222-8222-222222222202','11111111-1111-4111-8111-111111111102'),
 ('22222222-2222-4222-8222-222222222203','11111111-1111-4111-8111-111111111103')
on conflict do nothing;
commit;

-- SQL Editor runs with elevated database privileges; these checks verify schema,
-- NOT the real browser/RLS permissions of authenticated or anonymous users.
select 'persons' as object, count(*) as test_rows from public.persons where id::text like '11111111-1111-4111-8111-%'
union all
select 'calendar_events',count(*) from public.calendar_events where source='staging_seed'
union all
select 'event_persons',count(*) from public.event_persons where event_id::text like '22222222-2222-4222-8222-%';

select 'staging_admin_exists' as check_name,exists(
 select 1 from public.staging_admins where user_id='28cd4313-70ce-44e2-ba56-4aa7a5128586'
) as passed;
