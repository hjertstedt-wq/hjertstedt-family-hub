const region = "https://www.skidor.com/download/18.df057a419e48ccf6df54dc/1779350909998/Signerat%20protokoll%20Alpint%20G%C3%B6talandsting%202026_alpint.pdf";
const stomprogram = "https://www.skidor.com/idrotter/alpint/tavling/tavlingskalender--stomprogram";

const schedule: [id: string, title: string, from: string, until: string, location: string, age: string, status: string, url: string, titlePattern: RegExp][] = [
  ["funas-winter-opening-2027", "Funäs Winter Opening", "01-05", "01-07", "Funäsdalen", "U16", "Tävlingsdagarna publicerade", "https://www.funas.se/sv/evenemang-i-funasdalen", /funäs.*winter opening|funäs.*winter games/i],
  ["winter-games-vemdalen-2027", "SkiStar Winter Games Vemdalen", "01-08", "01-11", "Vemdalen", "U14/U16", "Tävlingshelg publicerad", "https://www.svenskalag.se/vifalpina/sida/125080/winter-games-2027", /winter\s*games/i],
  ["region5-gs-usm-kval-2027", "Region 5 USM-kval GS – Stöten", "01-22", "01-25", "Stöten", "U16", "Preliminärt · grendagar och tider ej bekräftade", region, /usm|kval/i],
  ["region5-sl-usm-kval-2027", "Region 5 USM-kval SL – Högheden", "02-05", "02-08", "Högheden", "U16", "Preliminärt · grendagar och tider ej bekräftade", region, /usm|kval/i],
  ["region5-fjater-fart-2027", "Fartläger Fjätervålen – Region 5", "02-11", "02-15", "Fjätervålen", "U14/U16", "Lägerdatum publicerade · tävlingsdagar ej bekräftade", "https://www.norrkopingssk.se/sida/131504/lagerinbjudningar", /fart|fjätervålen/i],
  ["winter-games-hammarby-2027", "SkiStar Winter Games Hammarbybacken", "02-14", "02-15", "Hammarbybacken", "U14", "U14-dagen publicerad", "https://www.difalpin.se/sida/124597/skistar-winter-games-2026", /winter\s*games/i],
  ["region5-lvc-final-2027", "Lilla Världscupens regionfinal – Yxbacken", "03-12", "03-15", "Yxbacken", "U14", "Preliminärt · grendagar och tider ej bekräftade", region, /lvc|lilla världscup/i],
  ["usm-final-2027-funasdalen", "USM-final 2027 – Funäsdalen", "04-05", "04-12", "Funäsdalen", "U16", "SSF:s planeringsvecka · grendagar och start ej bekräftade", stomprogram, /usm/i],
  ["guldhjalmen-2027", "Guldhjälmen – Duved", "04-12", "04-19", "Duved", "U16", "Preliminärt vecka 15 · exakta tävlingsdagar ej publicerade", "https://www.vitesse.se/sida/90011/tavlingsprogram", /guldhjälmen/i],
  ["winter-games-salen-2027", "SkiStar Winter Games Sälen", "04-17", "04-19", "Lindvallen", "U14", "Ungdomshelg enligt SSF · klassdag och tider ej bekräftade", stomprogram, /winter\s*games/i]
];

export const seasonSuggestions = schedule.map(([externalId, title, from, until, location, age, status, url, titlePattern]) => ({
  id: externalId,
  external_id: externalId,
  title: title,
  starts_at: "2027-" + from + "T00:00:00+" + (from.startsWith("04") ? "02:00" : "01:00"),
  ends_at: "2027-" + until + "T00:00:00+" + (until.startsWith("04") ? "02:00" : "01:00"),
  location: location,
  category: "ski_candidate",
  source: "ssf_stomprogram",
  description: age + " · " + status,
  url: url,
  titlePattern
}));

type SavedEvent = {
  title: string; location: string | null; starts_at: string; ends_at: string; external_id?: string | null;
};

export function matchesSeasonSuggestion(event: SavedEvent, suggestion: typeof seasonSuggestions[number]) {
  if (event.external_id === suggestion.external_id || event.external_id?.startsWith(suggestion.external_id + "-")) return true;
  const locationMatches = [suggestion.location, ...(suggestion.id === "region5-lvc-final-2027" ? ["Norrköping"] : [])]
    .some(location => (event.title + " " + (event.location ?? "")).toLocaleLowerCase("sv-SE").includes(location.toLocaleLowerCase("sv-SE")));
  return suggestion.titlePattern.test(event.title) &&
    (locationMatches || !/winter-games|usm-kval/.test(suggestion.id)) &&
    Date.parse(event.starts_at) < Date.parse(suggestion.ends_at) &&
    Date.parse(event.ends_at) > Date.parse(suggestion.starts_at);
}
