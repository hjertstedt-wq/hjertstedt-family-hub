import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Disabled until each household can consent to its own private Apple calendar.
// The former pilot credentials must never be used as shared, app-wide credentials.
export async function GET() {
  return NextResponse.json({
    error: "iCloud är en valfri anslutning som ännu inte har aktiverats för din familj.",
    status: "not_connected"
  }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
