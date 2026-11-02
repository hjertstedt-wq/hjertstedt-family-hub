import { NextRequest } from "next/server";
import { claimIcloudAttempt, integrationUser, connection, reply, failure, IntegrationError } from "../../../lib/server/integration-store";
import { openIcloud, calendarId } from "../../../lib/server/icloud";
import { normalizeIcloud } from "../../../lib/server/icloud-events";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  try {
    const userId = await integrationUser(request);
    await claimIcloudAttempt(request);
    const { config } = await connection(request, userId);
    if (!config) return reply({ status: "not_connected", error: "Anslut din privata iCloud-kalender i Kom igång.", events: [] });
    if (!config.calendarUrl) return reply({ status: "choose_calendar", error: "Välj vilken iCloud-kalender som ska visas i Kom igång.", events: [] });
    const params = new URL(request.url).searchParams;
    const start = new Date(params.get("start") ?? new Date(Date.now() - 7 * 86400000).toISOString());
    const end = new Date(params.get("end") ?? new Date(Date.now() + 90 * 86400000).toISOString());
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 100 * 86400000) {
      throw new IntegrationError("invalid_range", "Välj ett tidsintervall på högst 100 dagar.", 400);
    }
    const { client, calendars } = await openIcloud(config);
    const selected = calendars.find(calendar => calendar.url === config.calendarUrl);
    if (!selected) throw new IntegrationError("calendar_not_found", "Kalenderdelningen har ändrats. Välj kalender igen i Kom igång.", 404);
    const objects = await client.fetchCalendarObjects({ calendar: selected, timeRange: { start: start.toISOString(), end: end.toISOString() } });
    if (objects.length > 1500) throw Error("too_many_objects");
    const normalized = normalizeIcloud(objects, calendarId(selected.url), start, end);
    return reply({ status: "active", calendarName: config.calendarName, ...normalized, checkedAt: new Date().toISOString() });
  } catch (error) { return failure(error); }
}
