import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = new URL(request.url).origin;
  const configuredOrigin = process.env.GOOGLE_OAUTH_APP_ORIGIN;
  if (!clientId || !clientSecret || !configuredOrigin || configuredOrigin !== origin) {
    return NextResponse.json({ error: "Google Calendar OAuth is not configured for this environment." }, { status: 503 });
  }
  const state = randomBytes(32).toString("hex");
  const redirectUri = origin + "/api/google/callback";
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.readonly");
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent");
  auth.searchParams.set("state", state);
  const response = NextResponse.redirect(auth);
  response.cookies.set("google_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google/callback", maxAge: 600 });
  return response;
}
