-- Hjertstedt Family Hub / STAGING ONLY
-- USM-finalen 2027, Funäsdalen, 5–11 april.
-- Only Elsa (U16). Alva (U14) is not eligible.
-- This is a PLANNED competition week; no per-discipline dates or confirmed start.
-- Safe to run twice: checks existing event and participant association.
--
-- IMPORTANT: Confirm the SQL editor project is STAGING:
-- https://supabase.com/dashboard/project/vohbfgeidvnybkplnfci/sql/new
BEGIN;
DO $usm$
DECLARE
  v_family uuid := 'bf763c14-7788-4003-a45b-cd05fb1f779b';
  v_elsa uuid;
  v_person_count integer;
  v_event uuid;
  v_external_id text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_family) THEN
    RAISE EXCEPTION 'Staging family not found. No change was made.';
  END IF;

  SELECT count(*), min(id::text)::uuid INTO v_person_count, v_elsa
    FROM public.persons
   WHERE family_id = v_family
     AND name ~* '(^|[[:space:]])Elsa([[:space:]]|$)';

  IF v_person_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Elsa profile in staging family; found %. No change was made.', v_person_count;
  END IF;

  v_event := NULL;
  v_external_id := 'region5-gs-usm-kval-2027-' || v_family::text;
  SELECT id INTO v_event FROM public.calendar_events
   WHERE family_id=v_family AND ((source='ssf_stomprogram' AND external_id=v_external_id)
     OR (title ~* 'USM' AND title ILIKE '%Stöten%' AND starts_at >= '2027-01-22 00:00:00+01'::timestamptz AND starts_at < '2027-01-25 00:00:00+01'::timestamptz))
   ORDER BY (external_id=v_external_id) DESC NULLS LAST LIMIT 1;
  IF v_event IS NULL THEN
    INSERT INTO public.calendar_events (family_id,title,description,starts_at,ends_at,location,category,source,external_id)
    VALUES (v_family,'Region 5 GS USM-kval 2027 – Stöten (preliminärt)','U16 · Preliminär planering Region 5, Götalandsting 2026-05-09. Deltagande, grendagar och starttider ej bekräftade. Källa: https://www.skidor.com/download/18.df057a419e48ccf6df54dc/1779350909998/Signerat%20protokoll%20Alpint%20G%C3%B6talandsting%202026_alpint.pdf','2027-01-22 00:00:00+01','2027-01-25 00:00:00+01','Stöten','ski_approved','ssf_stomprogram',v_external_id) RETURNING id INTO v_event;
  ELSE
    UPDATE public.calendar_events SET category='ski_approved' WHERE id=v_event AND family_id=v_family;
  END IF;
  INSERT INTO public.event_persons(event_id,person_id) VALUES(v_event,v_elsa) ON CONFLICT(event_id,person_id) DO NOTHING;
  v_event := NULL;
  v_external_id := 'region5-sl-usm-kval-2027-' || v_family::text;
  SELECT id INTO v_event FROM public.calendar_events
   WHERE family_id=v_family AND ((source='ssf_stomprogram' AND external_id=v_external_id)
     OR (title ~* 'USM' AND title ILIKE '%Högheden%' AND starts_at >= '2027-02-05 00:00:00+01'::timestamptz AND starts_at < '2027-02-08 00:00:00+01'::timestamptz))
   ORDER BY (external_id=v_external_id) DESC NULLS LAST LIMIT 1;
  IF v_event IS NULL THEN
    INSERT INTO public.calendar_events (family_id,title,description,starts_at,ends_at,location,category,source,external_id)
    VALUES (v_family,'Region 5 SL USM-kval 2027 – Högheden (preliminärt)','U16 · Preliminär planering Region 5, Götalandsting 2026-05-09. Deltagande, grendagar och starttider ej bekräftade. Källa: https://www.skidor.com/download/18.df057a419e48ccf6df54dc/1779350909998/Signerat%20protokoll%20Alpint%20G%C3%B6talandsting%202026_alpint.pdf','2027-02-05 00:00:00+01','2027-02-08 00:00:00+01','Högheden','ski_approved','ssf_stomprogram',v_external_id) RETURNING id INTO v_event;
  ELSE
    UPDATE public.calendar_events SET category='ski_approved' WHERE id=v_event AND family_id=v_family;
  END IF;
  INSERT INTO public.event_persons(event_id,person_id) VALUES(v_event,v_elsa) ON CONFLICT(event_id,person_id) DO NOTHING;
  v_event := NULL;
  v_external_id := 'usm-final-2027-funasdalen-' || v_family::text;
  SELECT id INTO v_event FROM public.calendar_events
   WHERE family_id=v_family AND ((source='ssf_stomprogram' AND external_id=v_external_id)
     OR (title ~* 'USM' AND title ILIKE '%Funäsdalen%' AND starts_at >= '2027-04-05 00:00:00+02'::timestamptz AND starts_at < '2027-04-12 00:00:00+02'::timestamptz))
   ORDER BY (external_id=v_external_id) DESC NULLS LAST LIMIT 1;
  IF v_event IS NULL THEN
    INSERT INTO public.calendar_events (family_id,title,description,starts_at,ends_at,location,category,source,external_id)
    VALUES (v_family,'USM-final 2027 – Funäsdalen (planerad)','U16 · Preliminär planering Region 5, Götalandsting 2026-05-09. Deltagande, grendagar och starttider ej bekräftade. Källa: https://www.skidor.com/download/18.df057a419e48ccf6df54dc/1779350909998/Signerat%20protokoll%20Alpint%20G%C3%B6talandsting%202026_alpint.pdf','2027-04-05 00:00:00+02','2027-04-12 00:00:00+02','Funäsdalen','ski_approved','ssf_stomprogram',v_external_id) RETURNING id INTO v_event;
  ELSE
    UPDATE public.calendar_events SET category='ski_approved' WHERE id=v_event AND family_id=v_family;
  END IF;
  INSERT INTO public.event_persons(event_id,person_id) VALUES(v_event,v_elsa) ON CONFLICT(event_id,person_id) DO NOTHING;
  RAISE NOTICE 'USM 2027 linked to Elsa. Event: %, Person: %', v_event, v_elsa;
END;
$usm$;
COMMIT;

SELECT e.title,e.starts_at,e.ends_at,p.name FROM public.calendar_events e
JOIN public.event_persons ep ON ep.event_id=e.id JOIN public.persons p ON p.id=ep.person_id
WHERE e.family_id='bf763c14-7788-4003-a45b-cd05fb1f779b' AND e.source='ssf_stomprogram' AND e.title ~* 'USM' ORDER BY starts_at;
