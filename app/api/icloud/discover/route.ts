import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only CalDAV discovery. No events are written or imported.
function xmlText(xml: string, name: string): string | null {
  const match = xml.match(new RegExp("<(?:[\\w.-]+:)?" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?" + name + "\\s*>", "i"));
  return match?.[1]?.trim() ?? null;
}
function decodeXml(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function responses(xml: string): string[] {
  return [...xml.matchAll(/<(?:[\w.-]+:)?response(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?response\s*>/gi)].map(m => m[1]);
}
export async function GET() {
  const appleId = process.env.ICLOUD_APPLE_ID;
  const password = process.env.ICLOUD_APP_PASSWORD;
  if (!appleId || !password) return NextResponse.json({ error: "iCloud är inte konfigurerat." }, { status: 503 });
  const authorization = "Basic " + Buffer.from(appleId + ":" + password).toString("base64");
  async function propfind(url: string, body: string, depth = "0") {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !(parsed.hostname === "caldav.icloud.com" || parsed.hostname.endsWith(".caldav.icloud.com"))) throw new Error("Unexpected CalDAV host");
    const response = await fetch(url, { method: "PROPFIND", headers: { Authorization: authorization, Depth: depth, "Content-Type": "application/xml; charset=utf-8" }, body, cache: "no-store", signal: AbortSignal.timeout(12000), redirect: "manual" });
    if (response.status >= 300 && response.status < 400) { const target = response.headers.get("location"); if (!target) throw new Error("redirect_missing_location"); return propfind(new URL(target, url).href, body, depth); }
    if (!response.ok) throw new Error("http_" + response.status);
    return response.text();
  }
  function resolved(base: string, href: string) {
    const url = new URL(decodeXml(href), base);
    if (url.protocol !== "https:" || !(url.hostname === "caldav.icloud.com" || url.hostname.endsWith(".caldav.icloud.com"))) throw new Error("Unexpected CalDAV redirect");
    return url.href;
  }
  try {
    const root = "https://caldav.icloud.com/";
    const principalXml = await propfind(root, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>');
    const principalHref = xmlText(xmlText(principalXml, "current-user-principal") ?? "", "href");
    if (!principalHref) throw new Error("No principal");
    const principal = resolved(root, principalHref);
    const homeXml = await propfind(principal, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>');
    const homeHref = xmlText(xmlText(homeXml, "calendar-home-set") ?? "", "href");
    if (!homeHref) throw new Error("No calendar home");
    const home = resolved(principal, homeHref);
    const listXml = await propfind(home, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:displayname/><d:resourcetype/></d:prop></d:propfind>', "1");
    const calendars = responses(listXml).filter(r => /<(?:[\w.-]+:)?calendar\s*\/?\s*>/i.test(xmlText(r, "resourcetype") ?? "")).map(r => ({ name: decodeXml(xmlText(r, "displayname") ?? ""), href: xmlText(r, "href") })).filter(c => c.href);
    return NextResponse.json({ status: "discovered", calendars: calendars.map(c => ({ name: c.name, isFamilj: c.name.trim().toLocaleLowerCase("sv-SE") === "familj" })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "unknown";
    const code = /^http_\\d+$/.test(message) ? message : ["redirect_missing_location", "No principal", "No calendar home", "Unexpected CalDAV host", "Unexpected CalDAV redirect"].includes(message) ? message : "connection_failed";
    return NextResponse.json({ error: "Kunde inte läsa iCloud-kalendrar.", diagnostic: code }, { status: 502 });
  }
}
