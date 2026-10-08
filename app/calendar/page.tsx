
"use client";

import { useEffect, useState } from "react";
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

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEvents() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("calendar_events")
        .select("id,title,starts_at,ends_at,location,category,source")
        .order("starts_at", { ascending: true });

      if (error) setError(error.message);
      else setEvents(data ?? []);

      setLoading(false);
    }

    loadEvents();
  }, [router]);

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f4f6fa",
      padding: "30px 16px",
      fontFamily: "Arial, sans-serif",
      color: "#17253b"
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <button onClick={() => router.push("/")}>
          ← Tillbaka till familjen
        </button>

        <h1>Familjens kalender</h1>
        <p>Alla familjens aktiviteter på ett ställe.</p>

        <section style={{
          background: "white",
          borderRadius: 18,
          padding: 24,
          marginTop: 24
        }}>
          {loading ? (
            <p>Laddar aktiviteter...</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : events.length === 0 ? (
            <p>
              Inga aktiviteter ännu.
              Här kommer Google Kalender, Svenskalag,
              SportAdmin och alpina tävlingskalendern att visas.
            </p>
          ) : (
            events.map((event) => (
              <div key={event.id} style={{
                padding: 16,
                borderBottom: "1px solid #e2e8f0"
              }}>
                <strong>{event.title}</strong>
                <p>
                  {new Date(event.starts_at).toLocaleString("sv-SE")}
                </p>
                <p>{event.location || "Ingen plats angiven"}</p>
                <small>Källa: {event.source}</small>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
