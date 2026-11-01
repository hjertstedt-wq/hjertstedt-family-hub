import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { seal, unseal } from "../token-crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const destination = new URL("/connections", origin);
  const suppliedState = url.searchParams.get("state") ?? "";
  let expectedState = "";
  let userId = "";
  try {
    const value = request.cookies.get("google_oauth_state")?.value ?? "";
    const saved = JSON.parse(unseal(value)) as { state?: string; userId?: string };
    expectedState = saved.state ?? "";
    userId = saved.userId ?? "";
  } catch { /* Invalid or missing OAuth state cookie */ }
  const validState = Boolean(userId) && suppliedState.length === expectedState.length &&
    suppliedState.length > 0 && timingSafeEqual(Buffer.from(suppliedState), Buffer.from(expectedState));
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
      }), cache: "no-store"
    });
    if (!exchange.ok) return result("exchange_failed");
    const tokens = await exchange.json() as { access_token?: string; expires_in?: number };
    if (!tokens.access_token) return result("exchange_failed");
    // Store an encrypted, short-lived, browser cookie only. No refresh tokens are saved.
    // The authorized user ID is checked again on every calendar read.
    const response = result("connected_temporarily");
    response.cookies.set("google_calendar_access", seal(JSON.stringify({ token: tokens.access_token, userId })), {
      httpOnly: true, secure: true, sameSite: "lax", path: "/api/google",
      maxAge: Math.min(Math.max(tokens.expires_in ?? 3600, 60), 3600)
    });
    return response;
  } catch { return result("configuration_error"); }
}
