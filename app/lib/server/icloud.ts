import { createHash } from "node:crypto";
import { createDAVClient } from "tsdav";
import { IntegrationError, type IcloudConfig } from "./integration-store";

export function appleUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash ||
      !/^(?:caldav|p\d{1,3}-caldav)\.icloud\.com$/.test(url.hostname)) {
    throw new IntegrationError("invalid_apple_endpoint", "iCloud returnerade en otillåten serveradress.", 502);
  }
  return url;
}
export const calendarId = (url: string) => createHash("sha256").update(url).digest("hex");

// Every request and redirect is checked before Basic credentials are sent.
// No user-supplied hosts, external redirects, cookies or write methods.
export function appleTransport(network: typeof fetch = fetch): typeof fetch {
  let requests = 0, totalBytes = 0;
  const deadline = Date.now() + 25000;
  return async (input, init: RequestInit = {}) => {
    let url = appleUrl(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (!['GET', 'OPTIONS', 'PROPFIND', 'REPORT'].includes((init.method ?? "GET").toUpperCase())) throw Error("read_only_transport");
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (++requests > 25 || Date.now() >= deadline) throw new IntegrationError("icloud_limit", "iCloud tog för lång tid. Försök igen.", 502);
      const response = await network(url, { ...init, redirect: "manual", cache: "no-store", credentials: "omit",
        signal: AbortSignal.timeout(Math.max(1, Math.min(10000, deadline - Date.now()))) });
      if ([301, 302, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw Error("invalid_redirect");
        url = appleUrl(new URL(location, url).href);
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        await response.body?.cancel();
        throw new IntegrationError("apple_auth_failed", "Apple kunde inte godkänna anslutningen. Kontrollera Apple-konto, appspecifikt lösenord och att delningen är accepterad.", 401);
      }
      if (!response.ok) { await response.body?.cancel(); throw Error("apple_unavailable"); }
      const chunks: Uint8Array[] = [];
      const reader = response.body?.getReader();
      if (reader) {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            if (totalBytes > 8_000_000) throw new IntegrationError("icloud_limit", "Kalendern är för stor för en hämtning. Välj ett kortare tidsintervall.", 413);
            chunks.push(value);
          }
        } catch (error) { await reader.cancel(); throw error; }
        finally { reader.releaseLock(); }
      }
      const body = Buffer.concat(chunks);
      if (/<!DOCTYPE|<!ENTITY/i.test(body.toString("utf8"))) throw Error("invalid_xml");
      const bounded = new Response(body, { status: response.status, headers: response.headers });
      Object.defineProperty(bounded, "url", { value: url.href });
      return bounded;
    }
    throw Error("too_many_redirects");
  };
}
export async function openIcloud(config: IcloudConfig) {
  const transport = appleTransport();
  const client = await createDAVClient({ serverUrl: "https://caldav.icloud.com",
    credentials: { username: config.username, password: config.password },
    authMethod: "Basic", defaultAccountType: "caldav", fetch: transport });
  const calendars = (await client.fetchCalendars()).filter(calendar =>
    !calendar.components || calendar.components.includes("VEVENT"));
  if (calendars.length > 100) throw Error("too_many_calendars");
  for (const calendar of calendars) appleUrl(calendar.url);
  return { client, calendars };
}
export function choices(calendars: Awaited<ReturnType<typeof openIcloud>>['calendars']) {
  return calendars.map(calendar => ({ id: calendarId(calendar.url), name: typeof calendar.displayName === "string" ? calendar.displayName : "Namnlös kalender" }));
}
