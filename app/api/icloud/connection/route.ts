import { NextRequest } from "next/server";
import { claimIcloudAttempt, connection, saveConnection, integrationUser, failure, reply, IntegrationError, db, household } from "../../../lib/server/integration-store";
import { openIcloud, choices, calendarId } from "../../../lib/server/icloud";
import { normalizeAppleAppPassword } from "../../../lib/integrations/apple-app-password";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function input(request: NextRequest) {
  if (Number(request.headers.get("content-length")) > 4096) throw new IntegrationError("invalid_input", "För stor begäran.", 400);
  const text = await request.text();
  if (text.length > 4096) throw new IntegrationError("invalid_input", "För stor begäran.", 400);
  try { return JSON.parse(text); } catch { throw new IntegrationError("invalid_input", "Kontrollera uppgifterna.", 400); }
}
export async function POST(request: NextRequest) {
  try {
    const userId = await integrationUser(request);
    await claimIcloudAttempt(request);
    // Fail before accepting credentials if server storage/encryption is absent.
    const { home } = await connection(request, userId, false);
    const body = await input(request);
    const password = normalizeAppleAppPassword(body.password);
    if (body.consent !== true || typeof body.username !== "string" || body.username.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.username) ||
        !password) {
      throw new IntegrationError("invalid_input", "Ange din Apple-kontoadress och ett appspecifikt lösenord med 16 bokstäver (med eller utan bindestreck) samt godkänn anslutningen.", 400);
    }
    const config = { username: body.username.trim(), password };
    const { calendars } = await openIcloud(config);
    const available = choices(calendars);
    const exact = available.filter(calendar => calendar.name === "Family");
    const selected = exact.length === 1 ? calendars.find(c => calendarId(c.url) === exact[0].id) : undefined;
    await saveConnection(request, userId, home.id, { ...config,
      ...(selected ? { calendarUrl: selected.url, calendarName: "Family" } : {}) });
    return reply({ status: selected ? "active" : "choose_calendar", calendars: available,
      selectedId: selected ? calendarId(selected.url) : null, calendarName: selected ? "Family" : null });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    const userId = await integrationUser(request);
    await claimIcloudAttempt(request);
    const { home, config } = await connection(request, userId);
    if (!config) throw new IntegrationError("not_connected", "Anslut iCloud först.", 409);
    const { calendarId: requested } = await input(request);
    const { calendars } = await openIcloud(config);
    const selected = calendars.find(calendar => calendarId(calendar.url) === requested);
    if (!selected) throw new IntegrationError("calendar_not_found", "Kalendern finns inte i ditt anslutna Apple-konto.", 404);
    const name = typeof selected.displayName === "string" ? selected.displayName : "iCloud-kalender";
    await saveConnection(request, userId, home.id, { ...config, calendarUrl: selected.url, calendarName: name });
    return reply({ status: "active", selectedId: requested, calendarName: name });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: NextRequest) {
  try {
    const userId = await integrationUser(request);
    const home = await household(request, userId);
    if (home) await db(request, "hub_calendar_connections?provider=eq.icloud&household_id=eq." + home.id, { method: "DELETE" });
    return reply({ status: "not_connected" });
  } catch (error) { return failure(error); }
}
