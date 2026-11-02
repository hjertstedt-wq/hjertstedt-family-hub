import { NextRequest, NextResponse } from "next/server";
import { authenticatedUserId } from "../../api/google/session-auth";
import { integrationEncryptionReady, encryptConfig, decryptConfig } from "./integration-crypto";

export class IntegrationError extends Error {
  constructor(public code: string, message: string, public status = 503) { super(message); }
}
export const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "private, no-store" }
});
export function failure(error: unknown) {
  if (error instanceof IntegrationError) return reply({ status: error.code, error: error.message }, error.status);
  return reply({ status: "provider_unavailable", error: "Kalenderanslutningen kunde inte läsas. Försök igen." }, 502);
}
export async function integrationUser(request: NextRequest) {
  const origin = process.env.INTEGRATIONS_APP_ORIGIN ?? process.env.GOOGLE_OAUTH_APP_ORIGIN;
  if (!origin || new URL(request.url).origin !== origin) throw new IntegrationError("configuration_required", "Anslutningar är inte aktiverade på den här webbadressen.");
  const userId = await authenticatedUserId(request);
  if (!userId) throw new IntegrationError("not_authenticated", "Logga in i Family Hub först.", 401);
  return userId;
}
export async function db(request: NextRequest, path: string, init: RequestInit = {}) {
  const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "") + "/rest/v1/" + path, {
    ...init, headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      Authorization: request.headers.get("authorization")!, "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates", ...init.headers },
    cache: "no-store", signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) {
    if (response.status === 401) throw new IntegrationError("not_authenticated", "Din inloggning har gått ut. Logga in igen.", 401);
    // Never return raw provider/database messages, configuration or credentials.
    throw new IntegrationError("storage_not_ready", "Säker serverlagring behöver aktiveras av administratören innan anslutningen kan användas.");
  }
  return response.status === 204 ? [] : await response.json();
}
export async function household(request: NextRequest, userId: string) {
  const rows = await db(request, "hub_households?select=id,name&owner_id=eq." + encodeURIComponent(userId));
  return rows[0] as { id: string; name: string } | undefined;
}
export type IcloudConfig = { username: string; password: string; calendarUrl?: string; calendarName?: string };
const context = (userId: string, householdId: string) => userId + ":" + householdId + ":icloud";
export async function connection(request: NextRequest, userId: string, readConfig = true) {
  const home = await household(request, userId);
  if (!home) throw new IntegrationError("household_required", "Skapa ditt hushåll i Kom igång först.", 409);
  if (!integrationEncryptionReady()) throw new IntegrationError("configuration_required", "Serverns kryptering behöver konfigureras innan iCloud kan anslutas.");
  const rows = await db(request, "hub_calendar_connections?select=encrypted_config,status,calendar_name,updated_at&provider=eq.icloud&household_id=eq." + home.id);
  let config: IcloudConfig | null = null;
  if (rows[0] && readConfig) {
    try { config = decryptConfig<IcloudConfig>(rows[0].encrypted_config, context(userId, home.id)); }
    catch { throw new IntegrationError("reconnect_required", "Den sparade anslutningen kunde inte läsas. Anslut iCloud igen.", 409); }
  }
  return { home, config, row: rows[0] };
}
export async function saveConnection(request: NextRequest, userId: string, householdId: string, config: IcloudConfig) {
  await db(request, "hub_calendar_connections?on_conflict=household_id,provider", { method: "POST", body: JSON.stringify({
    household_id: householdId, provider: "icloud", encrypted_config: encryptConfig(config, context(userId, householdId)),
    status: config.calendarUrl ? "active" : "choose_calendar", calendar_name: config.calendarName ?? null,
    updated_at: new Date().toISOString(), consent_version: "icloud-read-v1", consented_at: new Date().toISOString()
  }) });
}

export async function claimIcloudAttempt(request: NextRequest) {
  const allowed = await db(request, "rpc/hub_claim_icloud_attempt", { method: "POST", body: "{}" });
  if (allowed !== true) throw new IntegrationError("rate_limited", "För många iCloud-försök. Vänta en minut och försök igen.", 429);
}
