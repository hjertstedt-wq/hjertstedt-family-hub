"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import {
  publicSportsFeeds,
  readSelectedSportsFeeds,
  readTemporarySportsFeed,
  type SportsMember,
  type SportsProvider
} from "./pilot-sports";

export type SportsCalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  category: string;
  source: string;
  sportsMember: SportsMember;
  sourceLabel: string;
};

type Feed = { provider: SportsProvider; member: SportsMember; label: string; url: string };
type PreviewEvent = {
  uid: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
};

export function useSportsCalendar() {
  const [events, setEvents] = useState<SportsCalendarEvent[]>([]);
  const [status, setStatus] = useState("Hämtar föreningskalendrar…");

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: { session } } = await supabase.auth.getSession();
        if (!user || !session) {
          if (active) setStatus("Logga in för att läsa föreningskalendrar.");
          return;
        }
        const selectedIds = new Set(readSelectedSportsFeeds(user.id));
        const publicSelected = publicSportsFeeds.filter(feed => selectedIds.has(feed.id));
        const temporary = readTemporarySportsFeed(user.id);
        const feeds: Feed[] = [
          ...publicSelected.map(({ provider, label, url, member }) => ({ provider, label, url, member })),
          ...(temporary ? [temporary] : [])
        ];

        if (!feeds.length) {
          if (active) {
            setEvents([]);
            setStatus("Inga föreningskalendrar valda. Öppna Anslut kalendrar för att välja.");
          }
          return;
        }

        const results = await Promise.all(feeds.map(async feed => {
          try {
            const response = await fetch("/api/integrations/feed-preview", {
              method: "POST",
              headers: {
                Authorization: "Bearer " + session.access_token,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ source: feed.provider, url: feed.url }),
              cache: "no-store"
            });
            if (!response.ok) throw Error("feed_unavailable");
            const json = await response.json() as { events?: PreviewEvent[]; skipped?: number };
            const parsed: SportsCalendarEvent[] = (json.events ?? []).map(e => ({
              id: "sports:" + feed.provider + ":" + feed.label + ":" + e.uid,
              title: e.title,
              starts_at: e.starts_at,
              ends_at: e.ends_at ?? e.starts_at,
              location: e.location,
              category: "sports_feed",
              source: feed.provider,
              sportsMember: feed.member,
              sourceLabel: feed.label
            }));
            return { feed, parsed, skipped: json.skipped ?? 0, failed: false };
          } catch {
            return { feed, parsed: [] as SportsCalendarEvent[], skipped: 0, failed: true };
          }
        }));

        if (!active) return;
        // Hide exact copies from overlapping team/federation calendars.
        const merged = new Map<string, SportsCalendarEvent>();
        let duplicateCount = 0;
        for (const result of results) {
          for (const event of result.parsed) {
            const key = event.title.trim().toLocaleLowerCase("sv-SE") + "|" +
              event.starts_at + "|" + (event.location ?? "").trim().toLocaleLowerCase("sv-SE");
            if (merged.has(key)) { duplicateCount++; continue; }
            merged.set(key, event);
          }
        }
        const failed = results.filter(result => result.failed).map(result => result.feed.label);
        const skipped = results.reduce((sum, result) => sum + result.skipped, 0);
        setEvents([...merged.values()]);
        setStatus(merged.size + " aktiviteter från " + (feeds.length - failed.length) + "/" + feeds.length +
          " föreningskalendrar." +
          (duplicateCount ? " " + duplicateCount + " möjliga dubbletter dolda." : "") +
          (skipped ? " " + skipped + " upprepningar eller tidszonsposter kunde inte läsas säkert." : "") +
          (failed.length ? " Kunde inte läsa: " + failed.join(", ") + "." : ""));
      } catch {
        if (active) setStatus("Det gick inte att kontrollera föreningskalendrarna just nu.");
      }
    }

    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15 * 60 * 1000);

    return () => { active = false; window.clearInterval(interval); };
  }, []);

  return { sportsEvents: events, sportsStatus: status };
}
