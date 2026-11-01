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

  SELECT count(*), min(id) INTO v_person_count, v_elsa
    FROM public.persons
   WHERE family_id = v_family
     AND name ~* '(^|[[:space:]])Elsa([[:space:]]|$)';

  IF v_person_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Elsa profile in staging family; found %. No change was made.', v_person_count;
  END IF;

  v_external_id := 'usm-final-2027-funasdalen-' || v_family::text;

  SELECT id INTO v_event
    FROM public.calendar_events
   WHERE family_id = v_family
     AND (
       (source = 'ssf_stomprogram' AND external_id = v_external_id)
       OR (
         starts_at >= '2027-04-04 20:00:00+00'::timestamptz
         AND starts_at < '2027-04-07 00:00:00+00'::timestamptz
         AND title ~* 'USM'
         AND title ~* '2027|final'
       )
     )
   ORDER BY (source = 'ssf_stomprogram' AND external_id = v_external_id) DESC
   LIMIT 1;

  IF v_event IS NULL THEN
    INSERT INTO public.calendar_events
      (family_id, title, description, starts_at, ends_at, location,
       category, source, external_id)
    VALUES (
      v_family,
      'USM-final 2027 – Funäsdalen (planerad)',
      'U16 · USM-final · 5–11 april 2027 enligt stomprogram. Grenarnas datum och Elsas deltagande är ännu inte bekräftade.',
      '2027-04-05 00:00:00+02'::timestamptz,
      '2027-04-12 00:00:00+02'::timestamptz,
      'Funäsdalen',
      'ski_approved',
      'ssf_stomprogram',
      v_external_id
    )
    RETURNING id INTO v_event;
  ELSE
    UPDATE public.calendar_events
       SET category = 'ski_approved'
     WHERE id = v_event AND family_id = v_family;
  END IF;

  INSERT INTO public.event_persons (family_id, event_id, person_id)
  VALUES (v_family, v_event, v_elsa)
  ON CONFLICT (event_id, person_id) DO NOTHING;

  RAISE NOTICE 'USM 2027 linked to Elsa. Event: %, Person: %', v_event, v_elsa;
END;
$usm$;
COMMIT;

-- Verify in STAGING, including any existing manually entered USM event:
SELECT e.id, e.title, e.starts_at, e.ends_at, e.category, p.name AS assigned_to
FROM public.calendar_events e
JOIN public.event_persons ep ON ep.event_id = e.id
JOIN public.persons p ON p.id = ep.person_id
WHERE e.family_id = 'bf763c14-7788-4003-a45b-cd05fb1f779b'
  AND e.title ~* 'USM'
  AND e.starts_at >= '2027-04-04 20:00:00+00'::timestamptz
  AND e.starts_at < '2027-04-07 00:00:00+00'::timestamptz;
