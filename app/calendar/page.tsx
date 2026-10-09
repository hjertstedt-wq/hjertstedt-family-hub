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

const weekdays = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const monthLabel = new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" });
const dateKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [persons, setPersons] = useState<Person[]>([]);
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
      setLoading(false);
    }
    void loadEvents();
  }, [router]);

  const calendarDays = useMemo(() => {
    const firstWeekday = (month.getDay() + 6) % 7;
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - firstWeekday);
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [month]);

  const eventsByDay = useMemo(() => {
    const result: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
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
  }, [events]);

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
    setEditingId(null);
    setTitle("");
    setLocation("");
    setParticipantIds([]);
    setAllDay(false);
    setEventDate(key);
    setEndDate(key);
    setFormError("");
    setShowForm(true);
  };
  const editEvent = async (event: CalendarEvent) => {
    if (event.source !== "manual") return;
    setEditingId(event.id);
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
      setFormSuccess("Aktiviteten har raderats.");
    }
    setDeletingId(null);
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 5 }}>
            {weekdays.map(day => <div key={day} style={{ textAlign: "center", fontSize: 12, color: "#64748b", fontWeight: 700, padding: "8px 0" }}>{day}</div>)}
            {calendarDays.map(day => {
              const key = dateKey(day);
              const dayEvents = eventsByDay[key] ?? [];
              const inMonth = day.getMonth() === month.getMonth();
              const isSelected = key === selected;
              return (
                <button key={key} onClick={() => chooseDate(key)} aria-pressed={isSelected} style={{
                  minHeight: 80, textAlign: "left", padding: 7, borderRadius: 10, cursor: "pointer",
                  border: isSelected ? "2px solid #3766b1" : "1px solid #e8edf4",
                  background: isSelected ? "#eef4ff" : inMonth ? "#fff" : "#f7f8fb",
                  color: inMonth ? "#17253b" : "#9ca8b9"
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{day.getDate()}</span>
                  {dayEvents.slice(0, 2).map(event => <div key={event.id} style={{ marginTop: 5, background: "#dce8fb", color: "#244c82", borderRadius: 4, padding: "3px 4px", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</div>)}
                  {dayEvents.length > 2 && <div style={{ fontSize: 10, marginTop: 4 }}>+{dayEvents.length - 2} till</div>}
                </button>
              );
            })}
          </div>
        </section>

        <section style={{ background: "white", borderRadius: 20, padding: 24, marginTop: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Aktiviteter {new Date(selected + "T12:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}</h2>
          {deleteError && <p role="alert" style={{ color: "#b42318" }}>{deleteError}</p>}
          {loading ? <p>Laddar aktiviteter...</p> : error ? <p role="alert" style={{ color: "#b42318" }}>{error}</p> :
            selectedEvents.length === 0 ? <p style={{ color: "#64748b" }}>Inga aktiviteter denna dag ännu.</p> :
            selectedEvents.map(event => <article key={event.id} style={{ borderTop: "1px solid #e8edf4", padding: "14px 0" }}>
              <strong>{event.title}</strong>
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
