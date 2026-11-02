// iCalendar DATE values are local calendar dates, not UTC instants.
export function calendarDate(value: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T00:00:00" : value);
}
export function calendarTimeLabel(start: string, end: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return "Heldag";
  const format = (value: string) => calendarDate(value).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  return format(start) + "–" + format(end);
}
