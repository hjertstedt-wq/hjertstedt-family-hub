import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { seal } from "../token-crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const destination = new URL("/calendar", origin);
  const state = url.searchParams.get("state") ?? "";
  const expected = request.cookies.get("google_oauth_state")?.value ?? "";
  const validState = state.length === expected.length && state.length > 0 &&
    timingSafeEqual(Buffer.from(state), Buffer.from(expected));
  const result = (reason: string) => {
    destination.searchParams.set("google", reason);
    const response = NextResponse.redirect(destination);
    response.cookies.set("google_oauth_state", "", { path: "/api/google/callback", maxAge: 0, httpOnly: true, secure: true, sameSite: "lax" });
    return response;
  };
  if (!validState || process.env.GOOGLE_OAUTH_APP_ORIGIN !== origin) return result("invalid_state");
  if (url.searchParams.get("error")) return result("denied");
  const code = url.searchParams.get("code");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!code || !clientId || !clientSecret) return result("configuration_error");
  try {
    const exchange = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: origin + "/api/google/callback", grant_type: "authorization_code"
      }),
      cache: "no-store"
    });
    if (!exchange.ok) return result("exchange_failed");
    const tokens = await exchange.json() as { access_token?: string; expires_in?: number };
    if (!tokens.access_token) return result("exchange_failed");
    const response = result("connected_temporarily");
    response.cookies.set("google_calendar_access", seal(tokens.access_token), {
      httpOnly: true, secure: true, sameSite: "lax", path: "/api/google",
      maxAge: Math.min(Math.max(tokens.expires_in ?? 3600, 60), 3600)
    });
    return response;
  } catch {
    return result("configuration_error");
  }
}
