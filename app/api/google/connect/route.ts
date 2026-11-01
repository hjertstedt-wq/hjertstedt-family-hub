import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { seal } from "../token-crypto";
import { authenticatedUserId } from "../session-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const userId = await authenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Logga in i Family Hub först." }, { status: 401 });
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = new URL(request.url).origin;
  if (!clientId || !clientSecret || process.env.GOOGLE_OAUTH_APP_ORIGIN !== origin) {
    return NextResponse.json({ error: "Google-kopplingen är inte färdigkonfigurerad för staging." }, { status: 503 });
  }
  const state = randomBytes(32).toString("hex");
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", origin + "/api/google/callback");
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.readonly");
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent");
  auth.searchParams.set("state", state);
  const response = NextResponse.json({ url: auth.href });
  response.cookies.set("google_oauth_state", seal(JSON.stringify({ state, userId })), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/api/google/callback", maxAge: 600
  });
  return response;
}

// A GET cannot validate the signed-in household and must not start an OAuth flow.
export async function GET() {
  return NextResponse.json({ error: "Starta Google-anslutningen från Family Hub." }, { status: 405 });
}
