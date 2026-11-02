export type CalendarFilter = "all" | "alva" | "elsa" | "family" | "races";
type Event = { id: string; title: string; source: string; category: string; sportsMember?: string };
export function matchesCalendarFilter(event: Event, filter: CalendarFilter,
  persons: { id: string; name: string }[], participants: Record<string, string[]>) {
  if (event.category === "ski_candidate") return false;
  if (filter === "all") return true;
  if (filter === "races") return event.category === "ski_approved";
  if (filter === "family") return event.source === "icloud" || event.source === "google";
  const name = new RegExp("\\b" + filter + "s?\\b", "i");
  const assigned = participants[event.id] ?? [];
  if (assigned.length) return persons.some(person => assigned.includes(person.id) && name.test(person.name));
  if (event.category === "sports_feed") return event.sportsMember === filter || event.sportsMember === "both";
  return name.test(event.title);
}
