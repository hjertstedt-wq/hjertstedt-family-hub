# Hjertstedt Family Hub 2.0 — nästa utvecklingspaket

Status: **Planerat, ej implementerat.** Denna fil ändrar inte appens körning eller databas. Arbete sker endast på staging/develop tills verifierat.

## Mål
Familjen ska kunna öppna appen på iPhone och snabbt se vem som ska vart, vilka aktiviteter som krockar och vad som behöver planeras. iCloud är initialt skrivskyddad källa.

## Leveransordning och acceptanskriterier

### P0 — Stabil grund
- Verifiera att iPhone-inloggning fungerar i Safari och att sessionen består efter omladdning.
- Skydda iCloud-API:er med serverkontrollerad behörighet till familjen, inte bara valfri inloggad användare.
- Få stagingbygget grönt med typecheck och tester innan vidare release.
- Säkerställ att inga Apple- eller Supabase-hemligheter hamnar i klientkod/loggar.

### P1 — Kalenderkvalitet
- RFC5545: RRULE, RDATE, EXDATE, RECURRENCE-ID, TZID och sommartid.
- Hantera heldagshändelsers exklusiva DTEND korrekt.
- Behåll käll-ID och kalenderidentitet; deduplicera inte orelaterade händelser bara för att titel/tid är samma.
- Enhetstester för veckovisa träningar, undantagna datum, ändrade instanser och övergång sommar/vintertid.
- Visa tydligt källa, familjemedlem och läs-/skrivbehörighet.

### P2 — Personer och åtkomst
- Fyra profiler: Oskar, Magdalena, Elsa, Alva. Namn är visningsdata, inte automatisk kontokoppling.
- Koppla profiler till riktiga användar-ID först efter administratörens godkännande.
- Supabase RLS för familjemedlemskap, roller och eventdeltagare.
- Migrera/arkivera testpersoner först efter granskning; inga destruktiva automatiska databasändringar.
- Föräldrars adminrättigheter och begränsad åtkomst för barn, enligt beslut.

### P3 — Alpint först: träning och tävling för Elsa och Alva
- Utgå från befintlig /ski-vy som redan hanterar tävlingsförslag, godkännande och deltagare; bygg ut den, inte en konkurrerande vy.
- Två personvyer: Elsa (U16 säsong 2026/27) och Alva (U14 säsong 2026/27).
- Två aktivitetsflöden: träning (snö, teknik, fys, läger) och tävling (SL, GS, SG, DH när relevant).
- Träning ska ha start/slut, plats, träningsgrupp, deltagare, anteckning och status planerad/bekräftad/inställd.
- Tävling ska ha officiell källa, tävlingsdatum, disciplin, klass, sista anmälan, deltagare och status förslag/godkänd/anmäld.
- Officiella tävlingskällor: Svenska Skidförbundets TA, relevanta Region 5- och klubbkällor. Inga påhittade datum.
- Import idempotent och källspårbar; preliminära tävlingar syns inte som bokade i huvudkalendern.
- Kalenderkrockar mellan alpina pass, tävlingar och iCloud. Förbered framtida teknikanalys och träningsmål.

### P3b — Övriga sportintegrationer efter alpint
- **Alvas SportsAdmin får inte glömmas**: identifiera förening/lag och säker läsmetod innan koppling; ingen otestad scraping eller inloggningsdelning.
- Svenskalag: endast fotboll, lagen 2011, 2012 och junior damer; filter för Elsa anmäld.
- För båda källor: källa, senast synkad, dublettskydd och tydlig status.

### P4 — Familjeassistent och iPhone
- Veckobrief: nästa sju dagar, schemakrockar, restider endast när adresser/ruttdata är verifierade.
- Första version regelbaserad; generativ AI kräver separat säkerhets- och dataskyddsbeslut.
- Mobilnavigering, PWA-manifest och ikoner, hemskärmsinstallation.
- Kontroll av Safari/iPhone inklusive login, reload, offline-fel och uppdateringar.

## Datamodell (förslag; ej körd SQL)
- family_members: id, family_id, display_name, role, auth_user_id nullable
- family_memberships: family_id, auth_user_id, role, status
- event_sources: id, family_id, provider, external_calendar_id, read_only, sync_state
- events: id, family_id, source_id, external_uid, recurrence_id, starts_at, ends_at, all_day, timezone, title, location
- event_participants: event_id, member_id, status
- sync_runs: id, source_id, started_at, finished_at, outcome, error_code

## Säkerhetsprinciper
- En familjs data ska aldrig vara åtkomlig för annan familj.
- Supabase RLS på samtliga familjerelaterade tabeller.
- Serverhemligheter endast i Vercels servermiljö.
- Ingen skrivning till Apple iCloud förrän användaren uttryckligen väljer tvåvägssynk.
- Importerade sportdata är förslag tills verifierade.

## Definition of done
- Bygg och typkontroll godkända.
- Automatiska tester för datum, rättigheter och dublettimport.
- Fungerar på iPhone Safari och desktop.
- Inga ändringar i det separata produktionsprojektet.
- Tydlig rollback och manuell acceptans före produktionssättning.
