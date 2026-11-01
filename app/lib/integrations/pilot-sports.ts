// Temporary pilot catalogue of PUBLIC club calendar subscription URLs.
// No personal tokens are stored here. Once per-family source records are
// available in Supabase, replace the browser-only selection with RLS-backed data.
export type SportsMember = "elsa" | "alva" | "both";
export type SportsProvider = "svenskalag" | "sportadmin";
export type PublicSportsFeed = {
  id: string;
  label: string;
  url: string;
  sourcePage: string;
  provider: SportsProvider;
  member: SportsMember;
};

export const publicSportsFeeds: readonly PublicSportsFeed[] = [
  {
    id: "hjulsbro", label: "Elsa – Hjulsbro IK F-2011/12",
    url: "https://cal.svenskalag.se/28145",
    sourcePage: "https://www.svenskalag.se/hjulsbroik-fotboll-f-2011-12/kalender",
    provider: "svenskalag", member: "elsa"
  },
  {
    id: "nsk-u16", label: "Elsa – NSK U16",
    url: "https://cal.svenskalag.se/59688",
    sourcePage: "https://www.norrkopingssk.se/norrkopingssk-u16/kalender",
    provider: "svenskalag", member: "elsa"
  },
  {
    id: "nsk-u14", label: "Alva – NSK U14",
    url: "https://cal.svenskalag.se/59687",
    sourcePage: "https://www.norrkopingssk.se/norrkopingssk-u14/kalender",
    provider: "svenskalag", member: "alva"
  },
  {
    id: "nsk-training", label: "NSK – gemensam träning",
    url: "https://cal.svenskalag.se/109110",
    sourcePage: "https://www.norrkopingssk.se/norrkopingssk-nsktraning/kalender",
    provider: "svenskalag", member: "both"
  }
];

const selectedPrefix = "hfh-staging-public-sports-v1:";
const temporaryPrefix = "hfh-staging-temporary-sports-v1:";

export function readSelectedSportsFeeds(userId: string): string[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(selectedPrefix + userId) ?? "[]");
    if (!Array.isArray(stored)) return [];
    const validIds = new Set(publicSportsFeeds.map(feed => feed.id));
    return [...new Set(stored.filter((id): id is string => typeof id === "string" && validIds.has(id)))];
  } catch { return []; }
}

export function saveSelectedSportsFeeds(userId: string, ids: readonly string[]) {
  if (!userId || typeof window === "undefined") return;
  const allowed = new Set(publicSportsFeeds.map(feed => feed.id));
  window.localStorage.setItem(selectedPrefix + userId, JSON.stringify([...new Set(ids.filter(id => allowed.has(id)))]));
}

export type TemporarySportsFeed = { provider: SportsProvider; label: string; url: string; member: SportsMember };

export function readTemporarySportsFeed(userId: string): TemporarySportsFeed | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const data: unknown = JSON.parse(window.sessionStorage.getItem(temporaryPrefix + userId) ?? "null");
    if (!data || typeof data !== "object") return null;
    const candidate = data as Partial<TemporarySportsFeed>;
    if ((candidate.provider !== "sportadmin" && candidate.provider !== "svenskalag") ||
        typeof candidate.url !== "string" || candidate.url.length > 1800 ||
        typeof candidate.label !== "string" ||
        (candidate.member !== "elsa" && candidate.member !== "alva" && candidate.member !== "both")) return null;
    return { provider: candidate.provider, url: candidate.url, label: candidate.label, member: candidate.member };
  } catch { return null; }
}

export function saveTemporarySportsFeed(userId: string, value: TemporarySportsFeed | null) {
  if (!userId || typeof window === "undefined") return;
  const key = temporaryPrefix + userId;
  if (value === null) window.sessionStorage.removeItem(key);
  else window.sessionStorage.setItem(key, JSON.stringify(value));
}
