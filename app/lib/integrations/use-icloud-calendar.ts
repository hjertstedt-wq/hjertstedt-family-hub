"use client";
import { useCallback, useEffect, useState } from "react";
import type { SportsMember } from "./pilot-sports";
import { supabase } from "../../supabase";
type Event = { sportsMember?: SportsMember; sourceLabel?: string; id: string; title: string; starts_at: string; ends_at: string; location: string | null; source: string; category: string };
export function useIcloudCalendar(start: string, end: string) {
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState("Kontrollerar iCloud…");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(current => current + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setEvents([]);
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw Error("Logga in för att läsa din iCloud-kalender.");
        const query = new URLSearchParams({ start, end });
        const response = await fetch("/api/icloud/events?" + query, {
          headers: { Authorization: "Bearer " + session.access_token }, signal: controller.signal, cache: "no-store"
        });
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok || data.status !== "active") throw Error(data.error ?? "Anslut din iCloud-kalender i Kom igång.");
        setEvents(data.events ?? []);
        setStatus((data.events?.length ?? 0) + " aktiviteter från ”" + data.calendarName + "” i den visade perioden." +
          (data.skipped ? " " + data.skipped + " poster kunde inte tolkas säkert." : ""));
      } catch (failure) {
        if (!controller.signal.aborted) setStatus(failure instanceof Error ? failure.message : "Kunde inte läsa iCloud.");
      } finally { if (!controller.signal.aborted) setBusy(false); }
    })();
    return () => controller.abort();
  }, [start, end, revision]);
  return { icloudEvents: events, icloudStatus: status, icloudBusy: busy, refreshIcloud: refresh };
}
