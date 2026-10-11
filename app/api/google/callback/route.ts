import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const state = url.searchParams.get("state") ?? "";
  const expected = request.cookies.get("google_oauth_state")?.value ?? "";
  const validState = state.length === expected.length && state.length > 0 &&
    timingSafeEqual(Buffer.from(state), Buffer.from(expected));
  const destination = new URL("/calendar", origin);
  const response = NextResponse.redirect(destination);
  response.cookies.set("google_oauth_state", "", { path: "/api/google/callback", maxAge: 0, httpOnly: true, secure: true, sameSite: "lax" });
  if (!validState || process.env.GOOGLE_OAUTH_APP_ORIGIN !== origin) {
    destination.searchParams.set("google", "invalid_state");
    return response;
  }
  if (url.searchParams.get("error")) {
    destination.searchParams.set("google", "denied");
    return response;
  }
  const code = url.searchParams.get("code");
  if (!code || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    destination.searchParams.set("google", "configuration_error");
    return response;
  }
  // No tokens are persisted until an authenticated, user-scoped storage flow exists.
  // Exchanging and discarding an authorization code would create a misleading connection.
  destination.searchParams.set("google", "storage_not_configured");
  return response;
}
