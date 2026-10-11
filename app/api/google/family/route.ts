import { NextRequest, NextResponse } from "next/server";
import { unseal } from "../token-crypto";

export const runtime = "nodejs";

type GoogleCalendar = { id: string; summary?: string; primary?: boolean };
type GoogleEvent = { id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; location?: string };

export async function GET(request: NextRequest) {
  if (process.env.GOOGLE_OAUTH_APP_ORIGIN !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Wrong environment" }, { status: 403 });
  }
  const encrypted = request.cookies.get("google_calendar_access")?.value;
  if (!encrypted) return NextResponse.json({ error: "Google account not connected" }, { status: 401 });
  try {
    const accessToken = unseal(encrypted);
    const headers = { Authorization: "Bearer " + accessToken };
    const calendarsResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250", { headers, cache: "no-store" });
    if (!calendarsResponse.ok) return NextResponse.json({ error: "Google calendar access expired or denied" }, { status: 401 });
    const calendars = await calendarsResponse.json() as { items?: GoogleCalendar[] };
    const matches = (calendars.items ?? []).filter(c => c.summary?.trim().toLocaleLowerCase("sv-SE") === "familj");
    if (matches.length !== 1) return NextResponse.json({ status: matches.length === 0 ? "not_found" : "ambiguous", matches: matches.map(c => ({ id: c.id, name: c.summary })) });
    const calendar = matches[0];
    const endpoint = new URL("https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendar.id) + "/events");
    endpoint.searchParams.set("singleEvents", "true");
    endpoint.searchParams.set("orderBy", "startTime");
    endpoint.searchParams.set("timeMin", new Date().toISOString());
    endpoint.searchParams.set("maxResults", "100");
    const eventsResponse = await fetch(endpoint, { headers, cache: "no-store" });
    if (!eventsResponse.ok) return NextResponse.json({ error: "Could not read Familj calendar" }, { status: 502 });
    const events = await eventsResponse.json() as { items?: GoogleEvent[] };
    return NextResponse.json({
      status: "preview", calendar: { id: calendar.id, name: calendar.summary },
      events: (events.items ?? []).map(e => ({
        id: e.id, title: e.summary ?? "(Utan rubrik)",
        starts_at: e.start?.dateTime ?? e.start?.date,
        ends_at: e.end?.dateTime ?? e.end?.date, location: e.location ?? null
      }))
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to read Google connection" }, { status: 401 });
  }
}
