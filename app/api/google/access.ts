import { NextRequest, NextResponse } from "next/server";
import { unseal, seal } from "./token-crypto";

type StoredConnection = {
  userId: string;
  token: string;
  refreshToken?: string;
  expiresAt?: number;
};

export type AccessResult =
  | { ok: true; accessToken: string; nextCookie?: string; refreshable: boolean }
  | { ok: false; status: number; error: string; reason: string };

const cookieName = "google_calendar_access";
const refreshWindowMs = 90_000;
const monthSeconds = 30 * 24 * 60 * 60;

export function setGoogleAccessCookie(response: NextResponse, encrypted: string, refreshable: boolean, seconds?: number) {
  response.cookies.set(cookieName, encrypted, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/api/google",
    maxAge: refreshable ? monthSeconds : Math.max(60, Math.min(seconds ?? 3600, 3600))
  });
}

export async function getGoogleAccess(request: NextRequest, userId: string): Promise<AccessResult> {
  const encrypted = request.cookies.get(cookieName)?.value;
  if (!encrypted) return {
    ok: false, status: 401, reason: "not_connected",
    error: "Google Kalender är inte ansluten i den här webbläsaren. Välj Anslut Google."
  };

  let connection: StoredConnection;
  try {
    const parsed = JSON.parse(unseal(encrypted)) as Partial<StoredConnection> & { refresh_token?: string };
    if (parsed.userId !== userId || !parsed.token) return {
      ok: false, status: 403, reason: "wrong_user",
      error: "Google-kopplingen tillhör ett annat Family Hub-konto. Anslut Google med det konto du använder nu."
    };
    connection = {
      userId: parsed.userId, token: parsed.token,
      refreshToken: parsed.refreshToken ?? parsed.refresh_token,
      expiresAt: parsed.expiresAt
    };
  } catch {
    return {
      ok: false, status: 401, reason: "invalid_connection",
      error: "Den sparade Google-kopplingen kunde inte läsas. Anslut Google igen."
    };
  }

  if (!connection.expiresAt || connection.expiresAt > Date.now() + refreshWindowMs) {
    return { ok: true, accessToken: connection.token, refreshable: Boolean(connection.refreshToken) };
  }

  if (!connection.refreshToken) return {
    ok: false, status: 401, reason: "expired",
    error: "Google-behörigheten har gått ut. Anslut Google igen för att visa kalendern."
  };

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return {
    ok: false, status: 503, reason: "configuration_error",
    error: "Google Kalender behöver konfigureras färdigt av administratören."
  };

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token", refresh_token: connection.refreshToken,
        client_id: clientId, client_secret: clientSecret
      }),
      cache: "no-store", signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return {
      ok: false, status: 401, reason: "refresh_failed",
      error: "Google-behörigheten kunde inte förnyas. Anslut Google igen."
    };
    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw Error("missing_access_token");
    const expiresIn = Math.max(60, Number(data.expires_in) || 3600);
    const updated: StoredConnection = {
      ...connection, token: data.access_token,
      expiresAt: Date.now() + expiresIn * 1000
    };
    return {
      ok: true, accessToken: data.access_token,
      nextCookie: seal(JSON.stringify(updated)), refreshable: true
    };
  } catch {
    return {
      ok: false, status: 503, reason: "refresh_unavailable",
      error: "Kunde inte nå Google för att förnya kalenderkopplingen. Försök igen."
    };
  }
}
