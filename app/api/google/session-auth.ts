import { NextRequest } from "next/server";

// Validate bearer tokens against this deployment's Supabase project, not against
// untrusted request claims. This helper is read-only and never accepts passwords.
export async function authenticatedUser(request: NextRequest): Promise<{ id: string; user_metadata?: Record<string, unknown> } | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !base || !key) return null;
  try {
    const result = await fetch(base.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { authorization: "Bearer " + token, apikey: key },
      cache: "no-store", signal: AbortSignal.timeout(8000)
    });
    if (!result.ok) return null;
    const user = await result.json();
    return typeof user.id === "string" ? user : null;
  } catch { return null; }
}

export async function authenticatedUserId(request: NextRequest): Promise<string | null> {
  return (await authenticatedUser(request))?.id ?? null;
}
