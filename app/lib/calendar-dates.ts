// iCalendar DATE values are local calendar dates, not UTC instants.
export function calendarDate(value: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T00:00:00" : value);
}
export function calendarTimeLabel(start: string, end: string, source?: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return "Heldag";
  if (source === "ssf_stomprogram") {
    const first = calendarDate(start), last = calendarDate(end);
    if (last > first && [first, last].every(date => date.getHours() === 0 && date.getMinutes() === 0)) return "Heldag · tider ej fastställda";
  }
  const format = (value: string) => calendarDate(value).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  return format(start) + "–" + format(end);
}
