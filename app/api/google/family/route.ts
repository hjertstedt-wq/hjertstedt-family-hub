import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser } from "../session-auth";
import { getGoogleAccess, setGoogleAccessCookie } from "../access";

import { readSelectedGoogleCalendar, selectFamilyCalendar } from "../../../lib/integrations/google-selection";
import { saveGoogleCalendar } from "../selection-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GoogleCalendar = { id: string; summary?: string; primary?: boolean };
type GoogleEvent = {
  id: string;
  summary?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
};

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const send = (body: Record<string, unknown>, status = 200, updatedCookie?: string, refreshable = false) => {
    const response = NextResponse.json(body, {
      status, headers: { "Cache-Control": "private, no-store" }
    });
    if (updatedCookie) setGoogleAccessCookie(response, updatedCookie, refreshable);
    return response;
  };

  if (process.env.GOOGLE_OAUTH_APP_ORIGIN !== origin) return send({
    status: "configuration_error",
    error: "Google är inte konfigurerat för den här webbadressen. Använd stagingens vanliga adress."
  }, 503);

  const user = await authenticatedUser(request);
  if (!user) return send({
    status: "not_authenticated",
    error: "Logga in i Family Hub innan du öppnar Google Kalender."
  }, 401);

  const access = await getGoogleAccess(request, user.id);
  if ("reason" in access) return send({ status: access.reason, error: access.error }, access.status);

  const updatedCookie = access.nextCookie;
  const respond = (body: Record<string, unknown>, status = 200) =>
    send(body, status, updatedCookie, access.refreshable);
  const headers = { Authorization: "Bearer " + access.accessToken };

  try {
    // All calendar IDs must come from the signed-in user's own Calendar List.
    const calendars: GoogleCalendar[] = [];
    let nextCalendarToken: string | undefined;
    for (let page = 0; page < 3; page++) {
      const endpoint = new URL("https://www.googleapis.com/calendar/v3/users/me/calendarList");
      endpoint.searchParams.set("maxResults", "250");
      if (nextCalendarToken) endpoint.searchParams.set("pageToken", nextCalendarToken);
      const response = await fetch(endpoint, {
        headers, cache: "no-store", signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) {
        return respond({
          status: "google_access_failed",
          error: response.status === 401 || response.status === 403
            ? "Google har avvisat kalenderbehörigheten. Välj Anslut Google igen."
            : "Google Kalender kunde inte nås just nu."
        }, response.status === 401 || response.status === 403 ? 401 : 502);
      }
      const data = await response.json() as {
        items?: GoogleCalendar[];
        nextPageToken?: string;
      };
      calendars.push(...(data.items ?? []).filter(calendar => Boolean(calendar.id)));
      nextCalendarToken = data.nextPageToken;
      if (!nextCalendarToken) break;
    }

    const available = calendars.map(calendar => ({
      id: calendar.id,
      name: calendar.summary ?? "Namnlös kalender",
      primary: Boolean(calendar.primary)
    }));

    // A later page could contain a second Family calendar: never guess.
    if (nextCalendarToken) return respond({
      status: "calendar_list_incomplete",
      error: "Hela kalenderlistan kunde inte läsas. Försök igen innan kalendern väljs."
    }, 502);

    const savedId = readSelectedGoogleCalendar(user.user_metadata);
    const requested = new URL(request.url).searchParams.get("calendarId");
    const selected = selectFamilyCalendar(calendars, savedId, requested);
    const familyCalendars = available.filter(calendar => calendar.name === "Family");
    if (!selected) return respond({
      status: familyCalendars.length ? "choose_calendar" : "calendar_not_found",
      error: requested
        ? "Den valda kalendern är inte längre en tillgänglig Family-kalender. Klicka på Hitta Family igen."
        : familyCalendars.length
        ? "Flera kalendrar heter exakt Family. Välj rätt kalender nedan."
        : "Ingen kalender heter exakt Family i det anslutna Google-kontot. Kontrollera konto och kalendernamn.",
      calendars: familyCalendars
    }, requested ? 404 : 200);

    if (savedId !== selected.id) {
      try { await saveGoogleCalendar(request, user.id, selected.id); }
      catch { return respond({
        status: "selection_save_failed",
        error: "Family hittades men kalendervalet kunde inte sparas på ditt konto. Försök igen."
      }, 503); }
    }

    if (new URL(request.url).searchParams.get("list") === "1") return respond({
      status: "calendars", calendars: familyCalendars,
      calendar: { id: selected.id, name: "Family" }, selectionSaved: true,
      refreshable: access.refreshable
    });

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);
    const timeMax = new Date();
    timeMax.setFullYear(timeMax.getFullYear() + 1);
    const events: GoogleEvent[] = [];
    let nextEventToken: string | undefined;

    for (let page = 0; page < 4; page++) {
      const endpoint = new URL("https://www.googleapis.com/calendar/v3/calendars/" +
        encodeURIComponent(selected.id) + "/events");
      endpoint.searchParams.set("singleEvents", "true");
      endpoint.searchParams.set("orderBy", "startTime");
      endpoint.searchParams.set("timeMin", timeMin.toISOString());
      endpoint.searchParams.set("timeMax", timeMax.toISOString());
      endpoint.searchParams.set("maxResults", "250");
      if (nextEventToken) endpoint.searchParams.set("pageToken", nextEventToken);
      const response = await fetch(endpoint, {
        headers, cache: "no-store", signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) {
        return respond({
          status: "events_unavailable",
          error: "Det gick inte att läsa aktiviteter från " +
            (selected.summary ?? "den valda Google-kalendern") +
            ". Kontrollera kalenderbehörigheten."
        }, 502);
      }
      const data = await response.json() as {
        items?: GoogleEvent[];
        nextPageToken?: string;
      };
      events.push(...(data.items ?? []));
      nextEventToken = data.nextPageToken;
      if (!nextEventToken) break;
    }

    return respond({
      status: "preview",
      calendar: { id: selected.id, name: selected.summary ?? "Namnlös kalender" },
      calendars: familyCalendars,
      selectionSaved: true,
      refreshable: access.refreshable,
      truncated: Boolean(nextEventToken),
      events: events.filter(event => event.status !== "cancelled" && Boolean(event.id))
        .map(event => ({
          id: event.id,
          title: event.summary ?? "(Utan rubrik)",
          starts_at: event.start?.dateTime ?? event.start?.date,
          ends_at: event.end?.dateTime ?? event.end?.date,
          location: event.location ?? null
        }))
    });
  } catch {
    return respond({
      status: "google_unavailable",
      error: "Google Kalender svarar inte just nu. Försök igen."
    }, 502);
  }
}
