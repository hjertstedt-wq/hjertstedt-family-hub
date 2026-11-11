"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import { matchesCalendarFilter, type CalendarFilter } from "../lib/integrations/calendar-filters";
import { calendarDate, calendarTimeLabel } from "../lib/calendar-dates";
import { useIcloudCalendar } from "../lib/integrations/use-icloud-calendar";
import { useSportsCalendar } from "../lib/integrations/use-sports-calendar";
import type { SportsMember } from "../lib/integrations/pilot-sports";

type Person = { id: string; name: string };

type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  category: string;
  source: string;
  sportsMember?: SportsMember;
  sourceLabel?: string;
};

const familyColor = (name: string) => name.toLowerCase().includes("elsa") ? "#74b8ff" : name.toLowerCase().includes("alva") ? "#ff9cbd" : name.toLowerCase().includes("magdalena") ? "#c8a4f8" : "#80d9ab";
const addDays = (date: Date, count: number) => { const next = new Date(date); next.setDate(next.getDate() + count); return next; };
const weekdays = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const monthLabel = new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" });
const dateKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [googleStatus, setGoogleStatus] = useState("Kontrollerar Google Kalender…");
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [showGoogle, setShowGoogle] = useState(true);
  const { sportsEvents, sportsStatus } = useSportsCalendar();
  const [showSports, setShowSports] = useState(true);
  const [googlePreview, setGooglePreview] = useState<{title: string; starts_at?: string}[]>([]);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [persons, setPersons] = useState<Person[]>([]);
  const [eventParticipants, setEventParticipants] = useState<Record<string, string[]>>({});
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => dateKey(new Date()));
  const [endDate, setEndDate] = useState(() => dateKey(new Date()));
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:00");
  const [location, setLocation] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>("all");

  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [showSearch, setShowSearch] = useState(false);
  const [dayAgenda, setDayAgenda] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("family-hub-calendar-theme");
      if (saved === "light" || saved === "dark" || saved === "system") setTheme(saved);
    } catch { /* The calendar also works when browser storage is disabled. */ }
  }, []);
  const changeTheme = (value: "system" | "light" | "dark") => {
    setTheme(value);
    try { localStorage.setItem("family-hub-calendar-theme", value); } catch { /* Keep the choice for this visit. */ }
  };

  const [search, setSearch] = useState("");
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  const [showIcloud, setShowIcloud] = useState(true);
  const range = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = addDays(first, -((first.getDay() + 6) % 7));
    return { start: start.toISOString(), end: addDays(start, 42).toISOString() };
  }, [month]);
  const { icloudEvents, icloudStatus, icloudBusy, refreshIcloud } = useIcloudCalendar(range.start, range.end);

  useEffect(() => {
    let initialLoad = true;
    async function loadEvents() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/login");
        return;
      }
      const { data, error: queryError } = await supabase
        .from("calendar_events")
        .select("id,title,starts_at,ends_at,location,category,source")
        .neq("category", "ski_candidate")
        .order("starts_at", { ascending: true });
      if (queryError) setError(queryError.message);
      else {
        setEvents(data ?? []);
        const params = new URLSearchParams(window.location.search);
        if (initialLoad && params.get("filter") === "races") setCalendarFilter("races");
        const eventId = params.get("event");
        const linkedEvent = (data ?? []).find(item => item.id === eventId);
        if (initialLoad && linkedEvent) {
          const date = new Date(linkedEvent.starts_at);
          setViewingId(linkedEvent.id);
          setDayAgenda(true);
          setSelected(dateKey(date));
          setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        }
      }
      const { data: family } = await supabase.from("persons").select("id,name").order("name");
      setPersons(family ?? []);
      const { data: links } = await supabase.from("event_persons").select("event_id,person_id");
      const participants: Record<string, string[]> = {};
      for (const link of links ?? []) (participants[link.event_id] ??= []).push(link.person_id);
      setEventParticipants(participants);
      initialLoad = false;
      setLoading(false);
    }
    void loadEvents();
    const refresh = () => { if (document.visibilityState === "visible") void loadEvents(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router]);

  // Google stays read-only and the selected calendar is tied to the current user.
  // Surface connection failures instead of silently hiding Google activities.
  async function refreshGoogle() {
    setGoogleBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!session || !user) {
        setGoogleStatus("Logga in i Family Hub för att använda Google Kalender.");
        setGoogleEvents([]);
        return;
      }
      const response = await fetch("/api/google/family", {
        headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store"
      });
      const data = await response.json() as {
        status?: string;
        error?: string;
        calendar?: { id: string; name: string };
        events?: { id: string; title: string; starts_at?: string; ends_at?: string; location?: string | null }[];
        refreshable?: boolean;
        truncated?: boolean;
      };
      if (!response.ok || data.status !== "preview") {
        setGoogleEvents([]);
        setGooglePreview([]);
        setGoogleStatus(data.error ?? "Ingen Google-kalender vald. Gå till Anslut kalendrar och välj din Google-kalender.");
        return;
      }
      const readable = (data.events ?? []).filter(event => Boolean(event.starts_at));
      setGoogleEvents(readable.map(event => ({
        id: "google:" + data.calendar?.id + ":" + event.id,
        title: event.title,
        starts_at: event.starts_at!,
        ends_at: event.ends_at ?? event.starts_at!,
        location: event.location ?? null,
        source: "google",
        category: "google"
      })));
      setGooglePreview(readable);
      setGoogleStatus("Google: " + readable.length + " aktiviteter från '" + (data.calendar?.name ?? "vald kalender") +
        "' visas skrivskyddat." +
        (data.truncated ? " Fler aktiviteter finns än vad som kan läsas i ett svep." : "") +
        (!data.refreshable ? " Kopplingen är tillfällig och kan behöva förnyas." : ""));
    } catch {
      setGoogleEvents([]);
      setGooglePreview([]);
      setGoogleStatus("Kunde inte läsa Google Kalender. Kontrollera anslutningen under Anslut kalendrar.");
    } finally { setGoogleBusy(false); }
  }

  useEffect(() => {
    void refreshGoogle();
    // Refresh once on mount; manual reload is available via the button below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleEvents = useMemo(() => [...events, ...(showIcloud ? icloudEvents : []), ...(showGoogle ? googleEvents : []), ...(showSports ? sportsEvents : [])].filter(event => {
    if (!matchesCalendarFilter(event, calendarFilter, persons, eventParticipants)) return false;
    const query = search.trim().toLocaleLowerCase("sv-SE");
    if (!query) return true;
    return [event.title, event.location ?? "", dateKey(calendarDate(event.starts_at)), calendarDate(event.starts_at).toLocaleDateString("sv-SE")].some(value => value.toLocaleLowerCase("sv-SE").includes(query));
  }), [events, icloudEvents, showIcloud, googleEvents, showGoogle, sportsEvents, showSports, eventParticipants, persons, calendarFilter, search]);
  const eventColor = (event: CalendarEvent) => {
    const member = persons.find(p => (eventParticipants[event.id] ?? []).includes(p.id));
    return member ? familyColor(member.name) : event.category === "sports_feed"
      ? event.sportsMember === "elsa" ? familyColor("Elsa") : event.sportsMember === "alva" ? familyColor("Alva") : "#f4ead8"
      : event.source === "icloud" ? "#8db9ff" : event.source === "google" ? "#e4c64a" : "#a4b3c7";
  };
  const calendarDays = useMemo(() => {
    const firstWeekday = (month.getDay() + 6) % 7;
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - firstWeekday);
    if (view === "day") return [new Date(selected + "T12:00:00")];
    if (view === "week") {
      const chosen = new Date(selected + "T12:00:00");
      const monday = addDays(chosen, -((chosen.getDay() + 6) % 7));
      return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
    }
    const cells = Math.ceil((firstWeekday + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7;
    return Array.from({ length: cells }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [month, view, selected]);

  const eventsByDay = useMemo(() => {
    const result: Record<string, CalendarEvent[]> = {};
    for (const event of visibleEvents) {
      const start = calendarDate(event.starts_at);
      const end = calendarDate(event.ends_at);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      // Multi-day events are visible on every calendar day they cover.
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const finalDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      if (end.getTime() > start.getTime() && end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
        finalDay.setDate(finalDay.getDate() - 1);
      }
      let count = 0;
      while (day <= finalDay && count < 366) {
        (result[dateKey(day)] ??= []).push(event);
        day.setDate(day.getDate() + 1);
        count++;
      }
    }
    return result;
  }, [visibleEvents]);

  const selectedEvents = [...(eventsByDay[selected] ?? [])].sort((a, b) => calendarDate(a.starts_at).getTime() - calendarDate(b.starts_at).getTime());
  const monthEvents = useMemo(() => {
    const items = new Map<string, CalendarEvent>();
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= lastDay; day++) {
      const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
      for (const event of eventsByDay[key] ?? []) items.set(event.id, event);
    }
    return [...items.values()].sort((a, b) => +calendarDate(a.starts_at) - +calendarDate(b.starts_at));
  }, [eventsByDay, month]);
  const showMonthAgenda = view === "month" && !dayAgenda;
  const agendaEvents = showMonthAgenda ? monthEvents : selectedEvents;
  const saveEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    const start = new Date(eventDate + "T" + startTime);
    const end = new Date(endDate + "T" + endTime);
    if (!title.trim() || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || (!allDay && end <= start) || endDate < eventDate) {
      setFormError("Ange rubrik och en sluttid efter starttiden.");
      return;
    }
    setSaving(true);
    const payload = { title: title.trim(), starts_at: (allDay ? new Date(eventDate + "T00:00:00") : start).toISOString(), ends_at: (allDay ? new Date(new Date(endDate + "T00:00:00").getTime() + 86400000) : end).toISOString(), location: location.trim() || null };
    if (!editingId && repeatWeeks > 1) {
      const duration = new Date(payload.ends_at).getTime() - new Date(payload.starts_at).getTime();
      const first = new Date(payload.starts_at);
      const rows = Array.from({ length: repeatWeeks }, (_, i) => {
        const occurrence = addDays(first, i * 7);
        return { ...payload, starts_at: occurrence.toISOString(), ends_at: new Date(occurrence.getTime() + duration).toISOString(), source: "manual" };
      });
      const { data: created, error: seriesError } = await supabase.from("calendar_events").insert(rows).select("id,title,starts_at,ends_at,location,category,source");
      if (seriesError || !created || created.length !== rows.length) {
        setFormError("Kunde inte skapa återkommande aktiviteter: " + (seriesError?.message ?? "Ofullständigt svar"));
        setSaving(false);
        return;
      }
      if (participantIds.length) {
        const links = created.flatMap(item => participantIds.map(person_id => ({ event_id: item.id, person_id })));
        const { error: linkError } = await supabase.from("event_persons").insert(links);
        if (linkError) {
          await supabase.from("calendar_events").delete().in("id", created.map(item => item.id));
          setFormError("Deltagarna kunde inte kopplas. Serien har återställts: " + linkError.message);
          setSaving(false);
          return;
        }
      }
      setEvents(current => [...current, ...created]);
      setEventParticipants(current => { const next = { ...current }; for (const item of created) next[item.id] = participantIds; return next; });
      setShowForm(false);
      setSelected(eventDate);
      setMonth(new Date(start.getFullYear(), start.getMonth(), 1));
      setRepeatWeeks(1);
      setFormSuccess(repeatWeeks + " veckovisa aktiviteter har sparats.");
      setSaving(false);
      return;
    }
    const query = editingId
      ? supabase.from("calendar_events").update(payload).eq("id", editingId).in("source", ["manual", "staging_seed"])
      : supabase.from("calendar_events").insert({ ...payload, source: "manual" });
    const { data, error: insertError } = await query.select("id,title,starts_at,ends_at,location,category,source").single();
    if (insertError || !data) {
      setFormError(insertError?.message ?? "Aktiviteten kunde inte sparas.");
      setSaving(false);
      return;
    }
    if (editingId) {
      const { error: clearError } = await supabase.from("event_persons").delete().eq("event_id", data.id);
      if (clearError) {
        setFormError("Aktiviteten uppdaterades, men deltagarna kunde inte ändras: " + clearError.message);
        setEvents(current => current.map(item => item.id === data.id ? data : item));
        setSaving(false);
        return;
      }
    }
    if (participantIds.length) {
      const { error: participantsError } = await supabase.from("event_persons")
        .insert(participantIds.map(person_id => ({ event_id: data.id, person_id })));
      if (participantsError) {
        setFormError("Aktiviteten sparades, men deltagarna kunde inte kopplas: " + participantsError.message);
        setEvents(current => editingId ? current.map(item => item.id === data.id ? data : item) : [...current, data]);
        setSaving(false);
        return;
      }
    }
    setEvents(current => editingId ? current.map(item => item.id === data.id ? data : item) : [...current, data]);
    setEventParticipants(current => ({ ...current, [data.id]: participantIds }));
    setViewingId(data.id);
    setSelected(eventDate);
    setMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setLocation("");
    setParticipantIds([]);
    setFormSuccess(editingId ? "Ändringarna har sparats." : "Aktiviteten har sparats.");
    setSaving(false);
  };
  const chooseDate = (key: string) => {
    setSelected(key);
    setViewingId(null);
    setEditingId(null);
    setTitle("");
    setLocation("");
    setParticipantIds([]);
    setAllDay(false);
    setRepeatWeeks(1);
    setEventDate(key);
    setEndDate(key);
    setFormError("");
    setShowForm(true);
  };
  const editEvent = async (event: CalendarEvent) => {
    if (!["manual", "staging_seed"].includes(event.source)) return;
    setEditingId(event.id);
    setRepeatWeeks(1);
    setFormError("");
    setFormSuccess("");
    setTitle(event.title);
    setLocation(event.location ?? "");
    const start = calendarDate(event.starts_at);
    const end = calendarDate(event.ends_at);
    const isAllDay = start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 0 && end.getMinutes() === 0;
    const lastDay = new Date(end);
    if (isAllDay) lastDay.setDate(lastDay.getDate() - 1);
    setAllDay(isAllDay);
    setEventDate(dateKey(start));
    setEndDate(dateKey(lastDay));
    setStartTime(start.toTimeString().slice(0, 5));
    setEndTime(end.toTimeString().slice(0, 5));
    setParticipantIds([]);
    setShowForm(true);
    const { data, error: membersError } = await supabase.from("event_persons").select("person_id").eq("event_id", event.id);
    if (membersError) setFormError("Deltagarna kunde inte hämtas: " + membersError.message);
    else setParticipantIds((data ?? []).map(item => item.person_id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const deleteEvent = async (event: CalendarEvent) => {
    if (!["manual", "staging_seed"].includes(event.source) || deletingId) return;
    if (!window.confirm('Vill du verkligen radera "' + event.title + '"? Aktiviteten tas bort permanent.')) return;
    setDeletingId(event.id);
    setDeleteError("");
    const { data, error: removeError } = await supabase.from("calendar_events")
      .delete().eq("id", event.id).in("source", ["manual", "staging_seed"]).select("id");
    if (removeError) {
      setDeleteError("Kunde inte radera aktiviteten: " + removeError.message);
    } else if (!data || data.length === 0) {
      setDeleteError("Aktiviteten kunde inte raderas. Kontrollera din behörighet.");
    } else {
      setEvents(current => current.filter(item => item.id !== event.id));
      setEventParticipants(current => { const updated = { ...current }; delete updated[event.id]; return updated; });
      setViewingId(current => current === event.id ? null : current);
      setFormSuccess("Aktiviteten har raderats.");
    }
    setDeletingId(null);
  };
  const viewingEvent = [...events, ...icloudEvents, ...googleEvents, ...sportsEvents].find(event => event.id === viewingId);
  const showDetails = (event: CalendarEvent) => {
    setSelected(dateKey(calendarDate(event.starts_at)));
    setViewingId(event.id);
    setShowForm(false);
  };
  const moveMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelected(dateKey(next));
  };
  const selectDay = (key: string) => {
    setSelected(key);
    setDayAgenda(true);
  };
  const navigate = (direction: number) => {
    if (view === "month") { moveMonth(direction); setDayAgenda(false); return; }
    const date = addDays(new Date(selected + "T12:00:00"), direction * (view === "week" ? 7 : 1));
    setSelected(dateKey(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  return (
    <main className="family-calendar" data-theme={theme} style={{ minHeight: "100vh", background: "var(--page)", padding: "32px 16px", fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", color: "var(--text)" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto" }}>
        <header className="calendar-toolbar">
          <button className="toolbar-pill" onClick={() => router.push("/")} aria-label="Tillbaka till familjen">‹ <span>Familjen</span></button>
          <div className="toolbar-pill toolbar-actions">
            <button type="button" aria-label="Visa eller dölj sökning" aria-expanded={showSearch} onClick={() => setShowSearch(value => !value)}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg></button>
            <button type="button" aria-label="Lägg till aktivitet" onClick={() => chooseDate(selected)} style={{fontSize: 32}}>+</button>
          </div>
        </header>
        <h1 className="calendar-title">Familjens kalender</h1>
        <div className="calendar-preferences">
          <a href="/ski">Välj tävlingar</a>
          <label>Utseende <select aria-label="Utseende" value={theme} onChange={e => changeTheme(e.target.value as typeof theme)}>
            <option value="system">Automatiskt</option><option value="light">Ljust</option><option value="dark">Mörkt</option>
          </select></label>
        </div>
        <nav aria-label="Visa kalenderposter" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
          {([{ id: "all", label: "Alla" }, { id: "alva", label: "Alva" }, { id: "elsa", label: "Elsa" }, { id: "family", label: "Family" }, { id: "races", label: "Tävlingar" }] as const).map(filter => <button
            key={filter.id} type="button" aria-pressed={calendarFilter === filter.id} onClick={() => setCalendarFilter(filter.id)}
            style={{ border: "1px solid " + (calendarFilter === filter.id ? "#254c80" : "#d3deeb"), borderRadius: 24, padding: "10px 18px", background: calendarFilter === filter.id ? "#254c80" : "var(--surface)", color: calendarFilter === filter.id ? "#fff" : "var(--text)", fontWeight: 700, cursor: "pointer" }}>{filter.label}</button>)}
        </nav>
        <section aria-label="Kalenderfilter" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {(["month", "week", "day"] as const).map(mode => <button key={mode} type="button" onClick={() => { setView(mode); setDayAgenda(false); }} aria-pressed={view === mode} style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid #cbd5e1", background: view === mode ? "#315e9c" : "var(--surface)", color: view === mode ? "#fff" : "var(--text)", cursor: "pointer" }}>{mode === "month" ? "Månad" : mode === "week" ? "Vecka" : "Dag"}</button>)}
          </div>
          {showSearch && <input autoFocus aria-label="Sök aktiviteter" placeholder="Sök namn, plats eller datum" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: "min(100%, 260px)", marginTop: 0 }} />}
        </section>
        {(calendarFilter === "alva" || calendarFilter === "elsa") && <p style={{ fontSize: 13, color: "var(--muted)" }}>Visar kopplade deltagare, föreningsaktiviteter och poster med namnet i rubriken. Övriga privata poster finns under Alla eller Family.</p>}
        {formSuccess && <p role="status">{formSuccess}</p>}
        {showForm && <section style={{ background: "var(--surface)", borderRadius: 20, padding: 24, marginTop: 18 }}>
          <h2 style={{ marginTop: 0 }}>{editingId ? "Redigera aktivitet" : "Ny aktivitet"}</h2>
          <form onSubmit={saveEvent} style={{ display: "grid", gap: 14 }}>
            <label>Rubrik <input required value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="T.ex. Träning" /></label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ flex: 1 }}>Från datum <input required type="date" value={eventDate} onChange={e => { setEventDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }} style={inputStyle} /></label>
              <label style={{ flex: 1 }}>Till och med datum <input required type="date" min={eventDate} value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} /></label>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />Heldag / flera hela dagar</label>
            {!allDay && <div style={{ display: "flex", gap: 12 }}>
              <label style={{ flex: 1 }}>Starttid <input required type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} /></label>
              <label style={{ flex: 1 }}>Sluttid <input required type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} /></label>
            </div>}
            {!editingId && <label>Upprepa varje vecka
              <select value={repeatWeeks} onChange={e => setRepeatWeeks(Number(e.target.value))} style={inputStyle}>
                <option value={1}>Upprepas inte</option>
                <option value={4}>4 veckor</option>
                <option value={8}>8 veckor</option>
                <option value={12}>12 veckor</option>
                <option value={26}>26 veckor</option>
                <option value={52}>52 veckor</option>
              </select>
            </label>}
            <label>Plats <input value={location} onChange={e => setLocation(e.target.value)} style={inputStyle} placeholder="Valfritt" /></label>
            <fieldset style={{ border: "1px solid #e1e7ef", borderRadius: 10, padding: 14 }}>
              <legend>Familjemedlemmar (valfritt)</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                {persons.map(person => <label key={person.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={participantIds.includes(person.id)} onChange={e => setParticipantIds(ids => e.target.checked ? [...ids, person.id] : ids.filter(id => id !== person.id))} />{person.name}
                </label>)}
              </div>
            </fieldset>
            {formError && <p role="alert" style={{ color: "#b42318" }}>{formError}</p>}
            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" disabled={saving} style={{ background: "#315e9c", color: "#fff", border: 0, borderRadius: 10, padding: "12px 20px", cursor: "pointer" }}>{saving ? "Sparar..." : editingId ? "Spara ändringar" : "Spara aktivitet"}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} style={{ background: "var(--control)", border: 0, borderRadius: 10, padding: "12px 20px", cursor: "pointer" }}>Avbryt</button>
            </div>
          </form>
        </section>}
        <section className="calendar-panel" style={{ background: "var(--surface)", borderRadius: 20, padding: 22, marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
            <button onClick={() => navigate(-1)} aria-label={"Föregående " + (view === "month" ? "månad" : view === "week" ? "vecka" : "dag")} style={navStyle}>‹</button>
            <h2 className="month-heading" style={{ textTransform: "capitalize", margin: 0, fontSize: 22, textAlign: "center" }}>{view === "month" ? monthLabel.format(month) : view === "day" ? new Date(selected + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" }) : calendarDays[0].toLocaleDateString("sv-SE", { day: "numeric", month: "short" }) + " – " + calendarDays[6].toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}</h2>
            <button onClick={() => navigate(1)} aria-label={"Nästa " + (view === "month" ? "månad" : view === "week" ? "vecka" : "dag")} style={navStyle}>›</button>
          </div>
          <button type="button" onClick={() => { const now = new Date(); setSelected(dateKey(now)); setDayAgenda(true); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); }} style={{ ...navStyle, width: "auto", fontSize: 15, padding: "0 16px", marginBottom: 12 }}>Idag</button>
          <div><div className={"calendar-grid calendar-grid-" + view}>
            {view !== "day" && weekdays.map(day => <div className="weekday-label" key={day} style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", fontWeight: 700, padding: "8px 0" }}>{day}</div>)}
            {calendarDays.map(day => {
              const key = dateKey(day);
              const dayEvents = eventsByDay[key] ?? [];
              const inMonth = day.getMonth() === month.getMonth();
              const isSelected = key === selected;
              return (
                <div className={"calendar-cell" + (isSelected ? " selected-day" : "") + (key === dateKey(new Date()) ? " today" : "") + (!inMonth ? " outside-month" : "") + (day.getDay() === 0 || day.getDay() === 6 ? " weekend" : "")} key={key} style={{
                  minHeight: 84, padding: 6, borderRadius: 10,
                  border: isSelected ? "2px solid #3766b1" : "1px solid #e8edf4",
                  background: isSelected ? "var(--control)" : inMonth ? "var(--surface)" : "var(--control)",
                  color: inMonth ? "var(--text)" : "#9ca8b9",
                  display: "flex", flexDirection: "column", gap: 4
                }}>
                  <button type="button" onClick={() => selectDay(key)}
                    aria-current={key === dateKey(new Date()) ? "date" : undefined} aria-pressed={isSelected} aria-label={"Visa " + day.toLocaleDateString("sv-SE") + ", " + dayEvents.length + " aktiviteter"}
                    style={{ alignSelf: "flex-start", border: 0, background: "transparent", color: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "2px 4px" }}>
                    <span className="day-number">{day.getDate()}</span><span className="day-week-label"> {day.toLocaleDateString("sv-SE", { weekday: "long", month: "short" })}</span>
                  </button>
                  <div className="mobile-day-markers" aria-hidden="true">{dayEvents.slice(0, 4).map(event => <span key={event.id} style={{background: eventColor(event)}} />)}{dayEvents.length > 4 && <span className="more-marker">+</span>}</div>
                  {dayEvents.map(event => (
                    <button className="grid-event" type="button" key={event.id} onClick={() => showDetails(event)}
                      title={calendarTimeLabel(event.starts_at, event.ends_at, event.source) + " · " + event.title} aria-label={"Visa aktivitet: " + event.title + ", " + calendarTimeLabel(event.starts_at, event.ends_at, event.source)}
                      style={{ background: eventColor(event), color: "#244c82", border: 0, borderRadius: 4, padding: "4px 5px", fontSize: 11, textAlign: "left", cursor: "pointer", overflowWrap: "anywhere" }}>
                      <span style={{ display: "block", fontWeight: 700, marginBottom: 2 }}>{calendarTimeLabel(event.starts_at, event.ends_at, event.source)}</span>
                      {event.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div></div>
        </section>

        {viewingEvent && <section style={{ background: "var(--surface)", borderRadius: 20, padding: 24, marginTop: 18, border: "1px solid #c8d8f2" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0 }}>{viewingEvent.title}</h2>
            <button type="button" onClick={() => setViewingId(null)} style={{ border: 0, background: "var(--control)", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>Stäng ×</button>
          </div>
          {(() => {
            const start = calendarDate(viewingEvent.starts_at);
            const end = calendarDate(viewingEvent.ends_at);
            const fullDay = /^\d{4}-\d{2}-\d{2}$/.test(viewingEvent.starts_at) ||
              (["manual", "staging_seed", "ssf_stomprogram"].includes(viewingEvent.source) && start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 0 && end.getMinutes() === 0);
            const last = new Date(end);
            if (fullDay) last.setDate(last.getDate() - 1);
            const fmt = (d: Date) => d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
            const names = (eventParticipants[viewingEvent.id] ?? []).map(id => persons.find(p => p.id === id)?.name).filter(Boolean);
            return <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
              <div><strong>Datum:</strong> {fmt(start)}{dateKey(start) !== dateKey(last) ? " – " + fmt(last) : ""}</div>
              <div><strong>Tid:</strong> {fullDay ? "Heldag" : start.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }) + " – " + end.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}</div>
              <div><strong>Plats/ort:</strong> {viewingEvent.location || "Ej angiven"}</div>
              <div><strong>Deltagare:</strong> {names.length ? names.join(", ") : "Inga angivna"}</div>
              <div><strong>Källa:</strong> {viewingEvent.sourceLabel ?? viewingEvent.source}</div>
            </div>;
          })()}
          {["manual", "staging_seed"].includes(viewingEvent.source) && <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => void editEvent(viewingEvent)} style={{ padding: "10px 16px", border: 0, borderRadius: 9, background: "#315e9c", color: "#fff", cursor: "pointer" }}>Redigera</button>
            <button onClick={() => void deleteEvent(viewingEvent)} disabled={deletingId !== null} style={{ padding: "10px 16px", border: "1px solid #f3c6c6", borderRadius: 9, background: "var(--surface)", color: "#b42318", cursor: "pointer" }}>Radera</button>
          </div>}
        </section>}
        <section id="day-agenda" style={{ background: "var(--surface)", borderRadius: 20, padding: 24, marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>{showMonthAgenda
              ? "Aktiviteter i " + monthLabel.format(month)
              : "Aktiviteter " + new Date(selected + "T12:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}</h2>
            {view === "month" && dayAgenda && <button type="button" onClick={() => setDayAgenda(false)}>Visa hela månaden</button>}
          </div>
          {deleteError && <p role="alert" style={{ color: "#b42318" }}>{deleteError}</p>}
          {loading ? <p>Laddar aktiviteter...</p> : error ? <p role="alert" style={{ color: "#b42318" }}>{error}</p> :
            agendaEvents.length === 0 ? <div style={{ color: "var(--muted)" }}>
              <p>{showMonthAgenda ? "Inga aktiviteter i den här månaden med valt filter." : "Inga aktiviteter den här dagen."}</p>
              {calendarFilter === "races" ? <a href="/ski">Visa tävlingsförslag →</a> :
                <a href="#calendar-connections" onClick={() => {
                  const settings = document.getElementById("calendar-connections");
                  if (settings instanceof HTMLDetailsElement) settings.open = true;
                }}>Kontrollera kalenderkällor →</a>}
            </div> :
            agendaEvents.map(event => <article key={event.id} className="agenda-row">
              <span className="agenda-color" style={{background: eventColor(event)}} aria-hidden="true" />
              <button className="agenda-event" type="button" onClick={() => showDetails(event)} aria-label={"Visa information om " + event.title}>
                <span className="agenda-description"><strong>{event.title}</strong>{showMonthAgenda && <span>{calendarDate(event.starts_at).toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}</span>}{event.location && <span>{event.location}</span>}</span>
                <span className="agenda-time">{calendarTimeLabel(event.starts_at, event.ends_at, event.source).split("–").map((part, index) => <span key={index}>{part}</span>)}</span>
              </button>
            </article>)
          }
        </section>
        <details id="calendar-connections" style={{ background: "var(--control)", border: "1px solid #dce4ef", borderRadius: 18, padding: 20, marginTop: 28 }}>
          <summary style={{ fontWeight: 700, fontSize: 18, cursor: "pointer" }}>Kalenderanslutningar och information</summary>
          <ul style={{ color: "var(--muted)", paddingLeft: 22 }}>
            <li><a href="/connections#icloud">iCloud</a> · {showIcloud ? icloudStatus : "Dold"}</li>
            <li><a href="/connections#google">Google</a> · {showGoogle ? googleStatus : "Dold"}</li>
            <li><a href="/connections#sports">Föreningar</a> · {showSports ? sportsStatus : "Dolda"}</li>
          </ul>
          <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>Hantera vilka källor som hämtas och kontrollera deras status här. Filtren ovan ändrar bara vad som visas.</p>
        <details className="source-settings" style={{ background: "var(--surface)", borderRadius: 16, padding: 20, marginTop: 18 }}>
          <summary>Apple / iCloud</summary>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={showIcloud} onChange={e => setShowIcloud(e.target.checked)} />Visa iCloud-aktiviteter</label>
          <p role="status">{icloudStatus}</p>
          <p><a href="/onboarding#icloud">Anslut eller hantera privat iCloud-kalender →</a></p>
          <button type="button" disabled={icloudBusy} onClick={refreshIcloud} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "var(--surface)", cursor: "pointer" }}>{icloudBusy ? "Hämtar iCloud…" : "Uppdatera iCloud"}</button>
        </details>

        <details className="source-settings" style={{ background: "var(--surface)", borderRadius: 16, padding: 20, marginTop: 18 }}>
          <summary>Föreningskalendrar – Svenskalag och SportAdmin</summary>
          <p role="status" style={{ color: "var(--muted)" }}>{sportsStatus}</p>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={showSports} onChange={e => setShowSports(e.target.checked)}/>
            Visa föreningsaktiviteter i kalendern
          </label>
          <p><a href="/connections#sports">Välj eller ändra föreningskalendrar →</a></p>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Pilot: hämtas skrivskyddat när kalendern öppnas och var 15:e minut när sidan är aktiv. Återkommande aktiviteter kan saknas tills vi färdigställt tidszoner och upprepningar.</p>
        </details>

        <details className="source-settings" style={{ background: "var(--surface)", borderRadius: 16, padding: 20, marginTop: 18 }}>
          <summary>Google Kalender</summary>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><input type="checkbox" checked={showGoogle} onChange={e => setShowGoogle(e.target.checked)} /> Visa Google-aktiviteter i familjekalendern</label>
          <p style={{ color: "var(--muted)" }}>Välj rätt Google-kalender i anslutningarna. Aktiviteter visas skrivskyddat här, utan att kopieras till databasen.</p>
          <p><a href="/connections#google">Välj Google-kalender eller kontrollera anslutningen →</a></p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" disabled={googleBusy} onClick={async () => {
              setGoogleBusy(true); setGoogleStatus("");
              try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw Error("Logga in i Family Hub först.");
                const response = await fetch("/api/google/connect", {
                  method: "POST", headers: { Authorization: "Bearer " + session.access_token }
                });
                const result = await response.json();
                if (!response.ok || !result.url) throw Error(result.error ?? "Kunde inte starta Google.");
                window.location.assign(result.url);
              } catch (error) {
                setGoogleStatus(error instanceof Error ? error.message : "Google-anslutningen misslyckades.");
                setGoogleBusy(false);
              }
            }} style={{ padding: "10px 14px", borderRadius: 8, background: "#315e9c", color: "#fff", cursor: "pointer" }}>Anslut Google</button>
            <button type="button" disabled={googleBusy} onClick={() => void refreshGoogle()}
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "var(--surface)", cursor: "pointer" }}>
              {googleBusy ? "Hämtar Google…" : "Uppdatera Google Kalender"}
            </button>
          </div>
          {googleStatus && <p role="status">{googleStatus}</p>}
          {googlePreview.length > 0 && <ul>{googlePreview.slice(0, 20).map((item, index) => <li key={index}>{item.starts_at ? new Date(item.starts_at).toLocaleString("sv-SE") + " – " : ""}{item.title}</li>)}</ul>}
        </details>
        </details>
      </div>
      <style jsx>{`
        .family-calendar { --page:#f5f5f7; --surface:#fff; --text:#18181b; --muted:#6b6b73; --control:#ededf0; --line:#d8d8dd; --accent:#315e9c; --today:#c92d3b; color-scheme:light; }
        .family-calendar[data-theme="dark"] { --page:#000; --surface:#080808; --text:#f5f5f7; --muted:#a1a1aa; --control:#1c1c1e; --line:#303033; --accent:#8abaff; --today:#ff453a; color-scheme:dark; }
        @media(prefers-color-scheme:dark) {
          .family-calendar[data-theme="system"] { --page:#000; --surface:#080808; --text:#f5f5f7; --muted:#a1a1aa; --control:#1c1c1e; --line:#303033; --accent:#8abaff; --today:#ff453a; color-scheme:dark; }
        }
        .family-calendar a { color:var(--accent); }
        .family-calendar button { touch-action:manipulation; }
        .family-calendar button:focus-visible,.family-calendar summary:focus-visible,.family-calendar select:focus-visible { outline:3px solid var(--accent); outline-offset:3px; }
        .calendar-toolbar,.calendar-preferences { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .calendar-title { font-size:30px; margin:24px 0 16px; letter-spacing:-1px; }
        .toolbar-pill { display:flex; align-items:center; border:1px solid var(--line); border-radius:30px; background:var(--control); color:var(--text); min-height:48px; padding:0 18px; font-size:18px; font-weight:650; cursor:pointer; gap:8px; }
        .toolbar-actions { padding:0 4px; }
        .toolbar-actions button { display:grid; place-items:center; width:48px; min-height:46px; background:transparent; color:inherit; border:0; cursor:pointer; }
        .calendar-preferences { font-size:13px; color:var(--muted); }
        .calendar-preferences select { background:var(--control); color:var(--text); border:1px solid var(--line); padding:9px 6px; border-radius:10px; margin-left:5px; }
        .calendar-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:5px; }
        .calendar-grid-day { grid-template-columns:minmax(0,1fr); }
        .calendar-cell { border-color:var(--line)!important; }
        .day-week-label,.mobile-day-markers { display:none; }
        .source-settings summary { font-weight:700; cursor:pointer; min-height:44px; display:list-item; align-content:center; }
        .agenda-row { display:flex; align-items:stretch; gap:12px; padding:18px 0; border-top:1px solid var(--line); }
        .agenda-color { flex:0 0 4px; border-radius:5px; }
        .agenda-event { display:flex; flex:1; justify-content:space-between; align-items:flex-start; gap:16px; min-width:0; background:transparent; color:var(--text); border:0; text-align:left; padding:0; cursor:pointer; font:inherit; }
        .agenda-description { display:grid; gap:6px; min-width:0; overflow-wrap:anywhere; }
        .agenda-description strong { font-size:20px; line-height:1.3; }
        .agenda-description>span { color:var(--muted); font-size:15px; }
        .agenda-time { display:grid; gap:6px; text-align:right; font-size:17px; flex-shrink:0; max-width:40%; }
        .agenda-time>span+span { color:var(--muted); }
        @media(max-width:640px) {
          .family-calendar { padding: max(14px,env(safe-area-inset-top)) 16px max(24px,env(safe-area-inset-bottom))!important; background:var(--surface)!important; }
          .calendar-title { font-size:22px; margin:18px 0 12px; }
          .family-calendar nav { gap:5px!important; margin-top:14px!important; flex-wrap:nowrap!important; }
          .family-calendar nav button { padding:8px 10px!important; font-size:13px; flex:1; }
          .family-calendar button,.family-calendar summary { min-height:44px; }
          .family-calendar input,.family-calendar select { font-size:16px!important; }
          .calendar-panel { padding:0!important; border-radius:0!important; margin-top:24px!important; }
          .month-heading { font-size:28px!important; letter-spacing:-.7px; }
          .calendar-grid-month { gap:0; }
          .weekday-label { font-size:11px!important; }
          .calendar-grid-month .calendar-cell { position:relative; min-height:66px!important; padding:3px 0!important; gap:0!important; border:0!important; border-top:1px solid var(--line)!important; border-radius:0!important; background:transparent!important; color:var(--text)!important; }
          .calendar-grid-month .calendar-cell>button:first-child { width:100%; padding:0!important; font-size:25px!important; min-height:44px; }
          .calendar-grid-month .day-number { display:inline-grid; place-items:center; width:38px; height:38px; border-radius:50%; }
          .calendar-grid-month .weekend { color:var(--muted)!important; }
          .calendar-grid-month .today .day-number { color:var(--today); }
          .calendar-grid-month .selected-day .day-number { background:var(--text); color:var(--surface); }
          .calendar-grid-month .outside-month>button,.calendar-grid-month .outside-month .mobile-day-markers { opacity:.3; }
          .calendar-grid-month .grid-event { display:none; }
          .calendar-grid-month .mobile-day-markers { display:flex; justify-content:center; align-items:center; height:10px; gap:2px; pointer-events:none; }
          .mobile-day-markers span { width:7px; height:6px; border-radius:4px; }
          .mobile-day-markers .more-marker { font-size:10px; height:12px; line-height:10px; color:var(--muted); }
          #day-agenda { border-radius:0!important; padding:20px 0!important; margin-top:8px!important; }
          #day-agenda h2 { font-size:14px!important; color:var(--muted); font-weight:500; }
          .calendar-grid-week { grid-template-columns:minmax(0,1fr); gap:8px; }
          .calendar-grid-week .weekday-label { display:none; }
          .calendar-grid-week .day-week-label,.calendar-grid-day .day-week-label { display:inline; }
          .calendar-grid-week .grid-event,.calendar-grid-day .grid-event { font-size:14px!important; padding:10px!important; }
          .calendar-grid-week .calendar-cell>button:first-child,.calendar-grid-day .calendar-cell>button:first-child { font-size:15px!important; }
          .source-settings { padding:12px!important; overflow-wrap:anywhere; }
        }
      `}</style>
    </main>
  );
}

const inputStyle = { background: "var(--surface)", color: "var(--text)", display: "block", width: "100%", boxSizing: "border-box" as const, marginTop: 6, padding: 11, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 15 };

const navStyle = { color: "var(--text)", background: "var(--control)", border: "1px solid #e1e7ef", borderRadius: 10, fontSize: 27, width: 42, height: 42, cursor: "pointer" };
