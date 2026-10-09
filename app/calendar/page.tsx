"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";

type Person = { id: string; name: string };

type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  category: string;
  source: string;
};

const familyColor = (name: string) => name.toLowerCase().includes("elsa") ? "#dceafd" : name.toLowerCase().includes("alva") ? "#fce3ed" : name.toLowerCase().includes("magdalena") ? "#f3e8ff" : "#dcf3e6";
const addDays = (date: Date, count: number) => { const next = new Date(date); next.setDate(next.getDate() + count); return next; };
const weekdays = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const monthLabel = new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" });
const dateKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
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
  const [personFilter, setPersonFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  useEffect(() => {
    async function loadEvents() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/login");
        return;
      }
      const { data, error: queryError } = await supabase
        .from("calendar_events")
        .select("id,title,starts_at,ends_at,location,category,source")
        .order("starts_at", { ascending: true });
      if (queryError) setError(queryError.message);
      else setEvents(data ?? []);
      const { data: family } = await supabase.from("persons").select("id,name").order("name");
      setPersons(family ?? []);
      const { data: links } = await supabase.from("event_persons").select("event_id,person_id");
      const participants: Record<string, string[]> = {};
      for (const link of links ?? []) (participants[link.event_id] ??= []).push(link.person_id);
      setEventParticipants(participants);
      setLoading(false);
    }
    void loadEvents();
  }, [router]);

  const visibleEvents = useMemo(() => events.filter(event => {
    if (personFilter !== "all" && !(eventParticipants[event.id] ?? []).includes(personFilter)) return false;
    const query = search.trim().toLocaleLowerCase("sv-SE");
    if (!query) return true;
    return [event.title, event.location ?? "", dateKey(new Date(event.starts_at)), new Date(event.starts_at).toLocaleDateString("sv-SE")].some(value => value.toLocaleLowerCase("sv-SE").includes(query));
  }), [events, eventParticipants, personFilter, search]);
  const eventColor = (event: CalendarEvent) => {
    const member = persons.find(p => (eventParticipants[event.id] ?? []).includes(p.id));
    return member ? familyColor(member.name) : "#e5e7eb";
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
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [month, view, selected]);

  const eventsByDay = useMemo(() => {
    const result: Record<string, CalendarEvent[]> = {};
    for (const event of visibleEvents) {
      const start = new Date(event.starts_at);
      const end = new Date(event.ends_at);
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

  const selectedEvents = eventsByDay[selected] ?? [];
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
      ? supabase.from("calendar_events").update(payload).eq("id", editingId).eq("source", "manual")
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
    if (event.source !== "manual") return;
    setEditingId(event.id);
    setRepeatWeeks(1);
    setFormError("");
    setFormSuccess("");
    setTitle(event.title);
    setLocation(event.location ?? "");
    const start = new Date(event.starts_at);
    const end = new Date(event.ends_at);
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
    if (event.source !== "manual" || deletingId) return;
    if (!window.confirm('Vill du verkligen radera "' + event.title + '"? Aktiviteten tas bort permanent.')) return;
    setDeletingId(event.id);
    setDeleteError("");
    const { data, error: removeError } = await supabase.from("calendar_events")
      .delete().eq("id", event.id).eq("source", "manual").select("id");
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
  const viewingEvent = events.find(event => event.id === viewingId);
  const showDetails = (event: CalendarEvent) => {
    setSelected(dateKey(new Date(event.starts_at)));
    setViewingId(event.id);
    setShowForm(false);
  };
  const moveMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelected(dateKey(next));
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f4f6fa", padding: "32px 16px", fontFamily: "Arial, sans-serif", color: "#17253b" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto" }}>
        <button onClick={() => router.push("/")} style={{ border: 0, background: "transparent", color: "#345e9b", cursor: "pointer", padding: 0 }}>
          ← Tillbaka till familjen
        </button>
        <h1 style={{ fontSize: 34, marginBottom: 6 }}>Familjens kalender</h1>
        <p style={{ color: "#64748b", marginTop: 0 }}>Gemensam översikt över familjens aktiviteter.</p>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
          <button onClick={() => { chooseDate(selected); }} style={{ background: "#315e9c", color: "white", border: 0, borderRadius: 10, padding: "13px 18px", fontWeight: 700, cursor: "pointer" }}>+ Lägg till aktivitet</button>
        </div>
        <section aria-label="Kalenderfilter" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {(["month", "week", "day"] as const).map(mode => <button key={mode} type="button" onClick={() => setView(mode)} aria-pressed={view === mode} style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid #cbd5e1", background: view === mode ? "#315e9c" : "white", color: view === mode ? "white" : "#17253b", cursor: "pointer" }}>{mode === "month" ? "Månad" : mode === "week" ? "Vecka" : "Dag"}</button>)}
          </div>
          <select aria-label="Filtrera familjemedlem" value={personFilter} onChange={e => setPersonFilter(e.target.value)} style={{ ...inputStyle, width: "auto", marginTop: 0 }}>
            <option value="all">Hela familjen</option>
            {persons.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          <input aria-label="Sök aktiviteter" placeholder="Sök namn, plats eller datum" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: "min(100%, 260px)", marginTop: 0 }} />
        </section>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
          {persons.map(person => <span key={person.id} style={{ fontSize: 12, borderRadius: 8, background: familyColor(person.name), padding: "5px 9px" }}>{person.name}</span>)}
        </div>
        {formSuccess && <p role="status" style={{ color: "#246b45" }}>{formSuccess}</p>}
        {showForm && <section style={{ background: "white", borderRadius: 20, padding: 24, marginTop: 18 }}>
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
              <button type="submit" disabled={saving} style={{ background: "#315e9c", color: "white", border: 0, borderRadius: 10, padding: "12px 20px", cursor: "pointer" }}>{saving ? "Sparar..." : editingId ? "Spara ändringar" : "Spara aktivitet"}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} style={{ background: "#f2f5fa", border: 0, borderRadius: 10, padding: "12px 20px", cursor: "pointer" }}>Avbryt</button>
            </div>
          </form>
        </section>}
        <section style={{ background: "white", borderRadius: 20, padding: 22, marginTop: 26 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
            <button onClick={() => moveMonth(-1)} aria-label="Föregående månad" style={navStyle}>‹</button>
            <h2 style={{ textTransform: "capitalize", margin: 0, fontSize: 22, textAlign: "center" }}>{monthLabel.format(month)}</h2>
            <button onClick={() => moveMonth(1)} aria-label="Nästa månad" style={navStyle}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: view === "day" ? "minmax(0, 1fr)" : "repeat(7, minmax(0, 1fr))", gap: 5 }}>
            {view !== "day" && weekdays.map(day => <div key={day} style={{ textAlign: "center", fontSize: 12, color: "#64748b", fontWeight: 700, padding: "8px 0" }}>{day}</div>)}
            {calendarDays.map(day => {
              const key = dateKey(day);
              const dayEvents = eventsByDay[key] ?? [];
              const inMonth = day.getMonth() === month.getMonth();
              const isSelected = key === selected;
              return (
                <div key={key} style={{
                  minHeight: 84, padding: 6, borderRadius: 10,
                  border: isSelected ? "2px solid #3766b1" : "1px solid #e8edf4",
                  background: isSelected ? "#eef4ff" : inMonth ? "#fff" : "#f7f8fb",
                  color: inMonth ? "#17253b" : "#9ca8b9",
                  display: "flex", flexDirection: "column", gap: 4
                }}>
                  <button type="button" onClick={() => chooseDate(key)}
                    aria-label={"Lägg till aktivitet " + day.toLocaleDateString("sv-SE")}
                    style={{ alignSelf: "flex-start", border: 0, background: "transparent", color: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "2px 4px" }}>
                    {day.getDate()} <span style={{ fontSize: 11, opacity: 0.65 }}>+</span>
                  </button>
                  {dayEvents.map(event => (
                    <button type="button" key={event.id} onClick={() => showDetails(event)}
                      title={event.title} aria-label={"Visa aktivitet: " + event.title}
                      style={{ background: eventColor(event), color: "#244c82", border: 0, borderRadius: 4, padding: "4px 5px", fontSize: 11, textAlign: "left", cursor: "pointer", overflowWrap: "anywhere" }}>
                      {event.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        {viewingEvent && <section style={{ background: "white", borderRadius: 20, padding: 24, marginTop: 18, border: "1px solid #c8d8f2" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0 }}>{viewingEvent.title}</h2>
            <button type="button" onClick={() => setViewingId(null)} style={{ border: 0, background: "#f2f5fa", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>Stäng ×</button>
          </div>
          {(() => {
            const start = new Date(viewingEvent.starts_at);
            const end = new Date(viewingEvent.ends_at);
            const fullDay = start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 0 && end.getMinutes() === 0;
            const last = new Date(end);
            if (fullDay) last.setDate(last.getDate() - 1);
            const fmt = (d: Date) => d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
            const names = (eventParticipants[viewingEvent.id] ?? []).map(id => persons.find(p => p.id === id)?.name).filter(Boolean);
            return <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
              <div><strong>Datum:</strong> {fmt(start)}{dateKey(start) !== dateKey(last) ? " – " + fmt(last) : ""}</div>
              <div><strong>Tid:</strong> {fullDay ? "Heldag" : start.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }) + " – " + end.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}</div>
              <div><strong>Plats/ort:</strong> {viewingEvent.location || "Ej angiven"}</div>
              <div><strong>Deltagare:</strong> {names.length ? names.join(", ") : "Inga angivna"}</div>
              <div><strong>Källa:</strong> {viewingEvent.source}</div>
            </div>;
          })()}
          {viewingEvent.source === "manual" && <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => void editEvent(viewingEvent)} style={{ padding: "10px 16px", border: 0, borderRadius: 9, background: "#315e9c", color: "white", cursor: "pointer" }}>Redigera</button>
            <button onClick={() => void deleteEvent(viewingEvent)} disabled={deletingId !== null} style={{ padding: "10px 16px", border: "1px solid #f3c6c6", borderRadius: 9, background: "white", color: "#b42318", cursor: "pointer" }}>Radera</button>
          </div>}
        </section>}
        <section style={{ background: "white", borderRadius: 20, padding: 24, marginTop: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Aktiviteter {new Date(selected + "T12:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}</h2>
          {deleteError && <p role="alert" style={{ color: "#b42318" }}>{deleteError}</p>}
          {loading ? <p>Laddar aktiviteter...</p> : error ? <p role="alert" style={{ color: "#b42318" }}>{error}</p> :
            selectedEvents.length === 0 ? <p style={{ color: "#64748b" }}>Inga aktiviteter denna dag ännu.</p> :
            selectedEvents.map(event => <article key={event.id} style={{ borderTop: "1px solid #e8edf4", padding: "14px 0" }}>
              <button type="button" onClick={() => showDetails(event)} style={{ border: 0, background: "transparent", padding: 0, fontWeight: 700, color: "#315e9c", cursor: "pointer", textAlign: "left" }}>{event.title} → Visa information</button>
              <div style={{ color: "#64748b", fontSize: 14, marginTop: 5 }}>{new Date(event.starts_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}–{new Date(event.ends_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}{event.location ? " · " + event.location : ""}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
                <small style={{ color: "#8492a6" }}>Källa: {event.source}</small>
                {event.source === "manual" && (
                  <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" disabled={saving || deletingId !== null} onClick={() => void editEvent(event)}
                    style={{ color: "#315e9c", border: "1px solid #c5d5ee", background: "#fff", borderRadius: 8, padding: "7px 11px", cursor: "pointer" }}>
                    Redigera
                  </button>
                  <button type="button" disabled={deletingId !== null} onClick={() => void deleteEvent(event)}
                    aria-label={"Radera " + event.title}
                    style={{ color: "#b42318", border: "1px solid #f3c6c6", background: "#fff", borderRadius: 8, padding: "7px 11px", cursor: deletingId ? "wait" : "pointer" }}>
                    {deletingId === event.id ? "Raderar..." : "Radera"}
                  </button>
                  </div>
                )}
              </div>
            </article>)
          }
        </section>
      </div>
    </main>
  );
}

const inputStyle = { display: "block", width: "100%", boxSizing: "border-box" as const, marginTop: 6, padding: 11, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 15 };

const navStyle = { background: "#f2f5fa", border: "1px solid #e1e7ef", borderRadius: 10, fontSize: 27, width: 42, height: 42, cursor: "pointer" };
