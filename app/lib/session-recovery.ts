import type { SupabaseClient } from "@supabase/supabase-js";

type Failure = { message?: string; code?: string; status?: number } | null;
export class SessionExpiredError extends Error {
  constructor() { super("Din inloggning har gått ut. Logga in igen."); }
}
export function isExpiredJwt(error: Failure) {
  return Boolean(error && /jwt (?:has )?expired|token (?:has )?expired/i.test(error.message ?? ""));
}

// getSession alone may return a locally cached identity. Validate with Auth
// before reading data, and retry once only when a token is explicitly expired.
export async function loadWithSessionRecovery<T extends { errors: Failure[] }>(
  client: Pick<SupabaseClient, "auth">,
  read: () => Promise<T>
) {
  let refreshed = false;
  async function refresh() {
    refreshed = true;
    const { data, error } = await client.auth.refreshSession();
    if (error || !data.session) {
      if (error && (!error.status || error.status >= 500)) {
        throw Error("Kunde inte förnya inloggningen just nu. Kontrollera anslutningen och försök igen.");
      }
      throw new SessionExpiredError();
    }
  }
  let identity = await client.auth.getUser();
  if (isExpiredJwt(identity.error)) {
    await refresh();
    identity = await client.auth.getUser();
  }
  if (identity.error || !identity.data.user) {
    if (identity.error && (!identity.error.status || identity.error.status >= 500) &&
        identity.error.name !== "AuthSessionMissingError") {
      throw Error("Kunde inte kontrollera inloggningen. Kontrollera anslutningen och försök igen.");
    }
    throw new SessionExpiredError();
  }
  let result = await read();
  if (result.errors.some(isExpiredJwt)) {
    if (refreshed) throw new SessionExpiredError();
    await refresh();
    // Revalidate before retrying: a refresh must never change the account whose
    // data this operation displays (for example after another tab signs in).
    const verified = await client.auth.getUser();
    if (verified.error || verified.data.user?.id !== identity.data.user.id) throw new SessionExpiredError();
    result = await read();
    if (result.errors.some(isExpiredJwt)) throw new SessionExpiredError();
  }
  return { user: identity.data.user, result };
}
