import ICAL from "ical.js";

export type ImportedCalendarEvent = { id: string; title: string; starts_at: string; ends_at: string; location: string | null; source: string; category: string };
export function normalizeIcloud(objects: { data?: string }[], calendarId: string, start: Date, end: Date) {
  const output = new Map<string, ImportedCalendarEvent>();
  let iterations = 0, skipped = 0;
  const serialize = (time: ICAL.Time) => time.isDate || time.zone.tzid === "floating" ? time.toString() : time.toJSDate().toISOString();
  for (const object of objects) {
    if (!object.data || object.data.length > 3_000_000) throw Error("invalid_calendar_object");
    const root = new ICAL.Component(ICAL.parse(object.data));
    const components = root.getAllSubcomponents("vevent");
    const masters = new Set(components.filter(c => !c.hasProperty("recurrence-id")).map(c => c.getFirstPropertyValue("uid")));
    for (const component of components) {
      const event = new ICAL.Event(component);
      if (!event.uid) { skipped++; continue; }
      if (event.isRecurrenceException() && masters.has(event.uid)) continue;
      // Embedded VTIMEZONE definitions are resolved per document, never stored
      // in a global registry shared across tenants.
      const time = component.getFirstProperty("dtstart");
      if (time?.getParameter("tzid") && event.startDate.zone.tzid === "floating") { skipped++; continue; }
      function append(item: ICAL.Event, occurrence: ICAL.Time, occurrenceStart: ICAL.Time, occurrenceEnd: ICAL.Time) {
        if (String(item.component.getFirstPropertyValue("status")).toUpperCase() === "CANCELLED") return;
        const starts = serialize(occurrenceStart), ends = serialize(occurrenceEnd);
        if (new Date(ends).getTime() < start.getTime() || new Date(starts).getTime() >= end.getTime()) return;
        const id = "icloud:" + calendarId + ":" + event.uid + ":" + occurrence.toString();
        output.set(id, { id, title: item.summary || "(Utan rubrik)", starts_at: starts, ends_at: ends,
          location: item.location || null, source: "icloud", category: "icloud" });
        if (output.size > 2000) throw Error("too_many_occurrences");
      }
      if (!event.isRecurring()) { append(event, event.startDate, event.startDate, event.endDate); continue; }
      const iterator = event.iterator();
      for (const exception of Object.values(event.exceptions) as ICAL.Event[]) {
        if (exception.startDate) append(exception, exception.recurrenceId, exception.startDate, exception.endDate);
      }
      for (;;) {
        if (++iterations > 30000) throw Error("recurrence_limit");
        const occurrence = iterator.next();
        if (!occurrence) break;
        if (new Date(serialize(occurrence)).getTime() >= end.getTime()) break;
        const detail = event.getOccurrenceDetails(occurrence);
        append(detail.item, occurrence, detail.startDate, detail.endDate);
      }
    }
  }
  return { events: [...output.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at)), skipped };
}
