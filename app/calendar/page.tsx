"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";

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
                <button key={key} onClick={() => setSelected(key)} aria-pressed={isSelected} style={{
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
          {loading ? <p>Laddar aktiviteter...</p> : error ? <p role="alert" style={{ color: "#b42318" }}>{error}</p> :
            selectedEvents.length === 0 ? <p style={{ color: "#64748b" }}>Inga aktiviteter denna dag ännu.</p> :
            selectedEvents.map(event => <article key={event.id} style={{ borderTop: "1px solid #e8edf4", padding: "14px 0" }}>
              <strong>{event.title}</strong>
              <div style={{ color: "#64748b", fontSize: 14, marginTop: 5 }}>{new Date(event.starts_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}–{new Date(event.ends_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}{event.location ? " · " + event.location : ""}</div>
              <small style={{ color: "#8492a6" }}>Källa: {event.source}</small>
            </article>)
          }
        </section>
      </div>
    </main>
  );
}

const navStyle = { background: "#f2f5fa", border: "1px solid #e1e7ef", borderRadius: 10, fontSize: 27, width: 42, height: 42, cursor: "pointer" };
