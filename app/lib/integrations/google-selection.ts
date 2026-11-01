// Browser-local Google calendar choice for staging pilots.
// This setting is account-scoped but is not yet shared across devices.
const prefix = "hfh-google-calendar-v1:";

export function readSelectedGoogleCalendar(userId: string): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const id = window.localStorage.getItem(prefix + userId);
    return id && id.length <= 1024 ? id : null;
  } catch { return null; }
}

export function saveSelectedGoogleCalendar(userId: string, calendarId: string) {
  if (!userId || !calendarId || calendarId.length > 1024 || typeof window === "undefined") return;
  window.localStorage.setItem(prefix + userId, calendarId);
}
