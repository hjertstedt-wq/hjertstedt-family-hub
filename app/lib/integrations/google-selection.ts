export type GoogleCalendarChoice = { id: string; summary?: string; primary?: boolean };

// A user preference, never an authorization claim. Validate against Google's
// current Calendar List before reading events, including after account switches.
export const googleSelectionKey = "hfh_google_family_calendar_v2";

export function readSelectedGoogleCalendar(metadata?: Record<string, unknown>): string | null {
  const value = metadata?.[googleSelectionKey];
  return typeof value === "string" && value.length > 0 && value.length <= 1024 ? value : null;
}

export function selectFamilyCalendar(calendars: GoogleCalendarChoice[], savedId: string | null, requestedId: string | null) {
  const matches = calendars.filter(calendar => calendar.summary === "Family");
  if (requestedId) return matches.find(calendar => calendar.id === requestedId);
  return matches.find(calendar => calendar.id === savedId) ?? (matches.length === 1 ? matches[0] : undefined);
}
