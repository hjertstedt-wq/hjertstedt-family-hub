import { NextRequest, NextResponse } from "next/server";
import { authenticatedUserId } from "../../google/session-auth";
import { parseCalendarFeed } from "../../../lib/integrations/calendar-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Source = "svenskalag" | "sportadmin";
const hosts: Record<Source, readonly string[]> = {
  svenskalag: ["cal.svenskalag.se"],
  sportadmin: ["cal.sportadmin.se", "publicweb.sportadmin.se"],
};

// A deliberately small allowlist protects the server against internal network requests.
// This pilot endpoint only previews vendor-hosted subscriptions; it stores nothing.
function subscriptionUrl(raw: string, source: Source): URL {
  const cleaned = raw.trim().replace(/^webcal:\/\//i, "https://");
  const url = new URL(cleaned);
  if (url.protocol !== "https:" || !hosts[source].includes(url.hostname.toLowerCase()) ||
      url.username || url.password || url.port || url.hash || url.href.length > 1800) {
    throw new Error("invalid_url");
  }
  return url;
}

async function boundedBody(response: Response): Promise<string> {
  if (!response.body) throw new Error("missing_body");
  const reader = response.body.getReader();
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2_000_000) throw new Error("feed_too_large");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(output);
}

export async function POST(req: NextRequest) {
  const userId = await authenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: "Logga in för att förhandsgranska kalendern." }, { status: 401 });
  let data: { source?: string; url?: string };
  try { data = await req.json(); }
  catch { return NextResponse.json({ error: "Ogiltig begäran." }, { status: 400 }); }
  if (data.source !== "svenskalag" && data.source !== "sportadmin") {
    return NextResponse.json({ error: "Okänd kalenderleverantör." }, { status: 400 });
  }
  try {
    const url = subscriptionUrl(data.url ?? "", data.source);
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "text/calendar, text/plain;q=0.5" },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store"
    });
    if (!response.ok) throw new Error("upstream_" + response.status);
    const text = await boundedBody(response);
    const events = parseCalendarFeed(text);
    const total = (text.match(/BEGIN:VEVENT\r?\n/g) ?? []).length;
    return NextResponse.json({
      source: data.source,
      status: "preview",
      total,
      supported: events.length,
      skipped: Math.max(0, total - events.length),
      events: events.slice(0, 80).map(e => ({
        uid: e.uid, title: e.title, starts_at: e.starts_at,
        ends_at: e.ends_at, location: e.location
      })),
      notice: "Förhandsgranskning. Ingen automatisk synkronisering eller import har aktiverats. Återkommande och tidszonsberoende poster kan saknas."
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown";
    const message = code === "invalid_url" ? "Ange en webcal-länk från rätt leverantör."
      : code === "feed_too_large" ? "Kalendern är för stor för förhandsgranskning."
      : "Kalendern kunde inte hämtas. Kontrollera prenumerationslänken.";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
