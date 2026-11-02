import { NextRequest } from "next/server";
import { claimIcloudAttempt, integrationUser, connection, reply, failure } from "../../../lib/server/integration-store";
import { openIcloud, choices, calendarId } from "../../../lib/server/icloud";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  try {
    const userId = await integrationUser(request);
    await claimIcloudAttempt(request);
    const { config } = await connection(request, userId);
    if (!config) return reply({ status: "not_connected", calendars: [] });
    const { calendars } = await openIcloud(config);
    return reply({ status: config.calendarUrl ? "active" : "choose_calendar", calendars: choices(calendars),
      selectedId: config.calendarUrl ? calendarId(config.calendarUrl) : null, calendarName: config.calendarName ?? null });
  } catch (error) { return failure(error); }
}
