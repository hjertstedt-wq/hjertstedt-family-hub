import { NextRequest } from "next/server";
import { googleSelectionKey } from "../../lib/integrations/google-selection";

// Supabase Auth scopes writes to the bearer token owner. No supplied user ID,
// service key or public table is used. Only this metadata key is merged.
export async function saveGoogleCalendar(request: NextRequest, userId: string, calendarId: string) {
  const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "") + "/auth/v1/user", {
    method: "PUT",
    headers: {
      Authorization: request.headers.get("authorization")!,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ data: { [googleSelectionKey]: calendarId } }),
    cache: "no-store", signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw Error("selection_save_failed");
  const user = await response.json();
  if (user.id !== userId || user.user_metadata?.[googleSelectionKey] !== calendarId) {
    throw Error("selection_save_unconfirmed");
  }
}
