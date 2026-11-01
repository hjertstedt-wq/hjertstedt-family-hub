"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { publicSportsFeeds, readSelectedSportsFeeds, saveSelectedSportsFeeds, saveTemporarySportsFeed } from "../lib/integrations/pilot-sports";

type Provider = "svenskalag" | "sportadmin";
type Activity = { uid: string; title: string; starts_at: string; ends_at: string | null; location: string | null };
const shell: React.CSSProperties = { minHeight: "100vh", background: "#f3f6fb", color: "#172b44", fontFamily: "Arial,sans-serif", padding: "24px 16px 70px" };
const panel: React.CSSProperties = { background: "white", padding: 24, borderRadius: 18, boxShadow: "0 3px 18px #172b4410", marginBottom: 17 };
const action: React.CSSProperties = { border: 0, padding: "12px 17px", borderRadius: 10, background: "#315e9c", color: "white", fontWeight: 700, cursor: "pointer" };
const secondary: React.CSSProperties = { ...action, background: "#eaf1fb", color: "#234876" };
const guidance: React.CSSProperties = { color: "#586a7f", lineHeight: 1.6 };
const verifiedFeeds = publicSportsFeeds;

export default function ConnectionsPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [userId, setUserId] = useState("");
  const [enabledFeeds, setEnabledFeeds] = useState<string[]>([]);
  const [previewReady, setPreviewReady] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [google, setGoogle] = useState("");
  const [source, setSource] = useState<Provider>("svenskalag");
  const [link, setLink] = useState("");
  const [results, setResults] = useState<Activity[]>([]);
  const [stats, setStats] = useState("");
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setAuthenticated(Boolean(data.user));
      if (data.user) { setUserId(data.user.id); setEnabledFeeds(readSelectedSportsFeeds(data.user.id)); }
    });
    const code = new URLSearchParams(window.location.search).get("google");
    if (code === "connected_temporarily") setGoogle("Google godkänd för denna webbläsare. Läs in Familj för att testa.");
    else if (code) setGoogle("Google-anslutningen kunde inte slutföras (" + code + "). Kontrollera anslutningen.");
  }, []);

  function togglePublicFeed(feedId: string) {
    if (!userId) return;
    const selected = enabledFeeds.includes(feedId)
      ? enabledFeeds.filter(id => id !== feedId) : [...enabledFeeds, feedId];
    try {
      saveSelectedSportsFeeds(userId, selected);
      setEnabledFeeds(selected);
      setNotice("Valet har sparats i den här webbläsaren. Öppna Familjekalendern för att se aktiviteterna.");
    } catch { setNotice("Det gick inte att spara kalenderinställningen i webbläsaren."); }
  }

  function displayTemporaryFeed() {
    if (!userId || !previewReady) return;
    const known = verifiedFeeds.find(feed => feed.url === link.trim() && feed.provider === source);
    if (known) {
      if (!enabledFeeds.includes(known.id)) togglePublicFeed(known.id);
      else setNotice("Kalendern visas redan i Family Hub.");
      return;
    }
    try {
      saveTemporarySportsFeed(userId, {
        provider: source, url: link.trim(),
        label: source === "sportadmin" ? "Alva – IK Östria Lambohov" : "Egen Svenskalag-kalender",
        member: source === "sportadmin" ? "alva" : "both"
      });
      setNotice("Kalendern kan nu visas i Family Hub under den här webbläsarsessionen. Privata prenumerationslänkar sparas inte permanent.");
    } catch { setNotice("Kunde inte aktivera prenumerationen i den här webbläsaren."); }
  }

  async function token(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw Error("Logga in i Family Hub först.");
    return session.access_token;
  }
  async function connectGoogle() {
    setBusy("google"); setGoogle("");
    try {
      const bearer = await token();
      const response = await fetch("/api/google/connect", { method: "POST", headers: { Authorization: "Bearer " + bearer } });
      const data = await response.json();
      if (!response.ok || !data.url) throw Error(data.error ?? "Kunde inte öppna Google.");
      window.location.assign(data.url);
    } catch (error) {
      setGoogle(error instanceof Error ? error.message : "Google-anslutningen misslyckades.");
      setBusy("");
    }
  }
  async function checkGoogle() {
    setBusy("google"); setGoogle("");
    try {
      const bearer = await token();
      const response = await fetch("/api/google/family", { headers: { Authorization: "Bearer " + bearer }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Kunde inte läsa Google.");
      if (data.status !== "preview") {
        setGoogle(data.status === "not_found" ? "Ingen Google-kalender med namnet Familj hittades." : "Det finns flera kalendrar som heter Familj.");
      } else {
        setGoogle("Google-kalendern " + data.calendar.name + ": " + (data.events?.length ?? 0) + " kommande aktiviteter. Läsningen är tillfällig; permanent synkronisering är inte klar.");
      }
    } catch (error) { setGoogle(error instanceof Error ? error.message : "Google-kontrollen misslyckades."); }
    finally { setBusy(""); }
  }
  async function previewFeed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("feed"); setNotice(""); setResults([]); setStats(""); setPreviewReady(false);
    try {
      const bearer = await token();
      const response = await fetch("/api/integrations/feed-preview", {
        method: "POST", headers: { Authorization: "Bearer " + bearer, "Content-Type": "application/json" },
        body: JSON.stringify({ source, url: link.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Kunde inte läsa kalendern.");
      setResults(data.events ?? []);
      setPreviewReady(true);
      setStats(data.supported + " av " + data.total + " kalenderposter kunde förhandsgranskas" +
        (data.skipped ? " (" + data.skipped + " kräver ytterligare stöd för upprepning eller tidszon)" : "") + ".");
      setNotice("Detta är en förhandsgranskning. Aktiviteter sparas inte ännu och ingen löpande prenumeration har skapats.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Kalendern kunde inte läsas."); setPreviewReady(false); }
    finally { setBusy(""); }
  }
  return <main style={shell}><div style={{ maxWidth: 940, margin: "0 auto" }}>
    <nav style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 28 }}>
      <a href="/" style={{ color: "#315e9c" }}>← Familjens startsida</a>
      <a href="/calendar" style={{ color: "#315e9c" }}>Familjekalender</a>
      <a href="/ski" style={{ color: "#315e9c" }}>Tävlingskalender</a>
    </nav>
    <h1 style={{ fontSize: "clamp(28px,5vw,43px)", marginBottom: 12 }}>Koppla familjens kalendrar</h1>
    <p style={{ ...guidance, maxWidth: 730, marginBottom: 30 }}>En plats för familjens aktiviteter. Vi testar läsning från varje källa separat innan vi aktiverar automatisk import och synkronisering. Inga kontolösenord från andra tjänster ska anges här.</p>
    {!authenticated && <p role="alert" style={{ color: "#ad2d2d" }}>Logga in för att prova anslutningarna. <a href="/login">Gå till inloggningen</a>.</p>}
    <section style={panel}>
      <h2 style={{ marginTop: 0 }}>Google Kalender</h2>
      <p style={guidance}>Godkänn läsbehörighet hos Google. Appen kan prova kalendern <strong>Familj</strong>. Vi sparar inte ditt Google-lösenord eller ändrar händelser.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={action} disabled={!authenticated || Boolean(busy)} onClick={() => void connectGoogle()}>Anslut Google</button>
        <button type="button" style={secondary} disabled={!authenticated || Boolean(busy)} onClick={() => void checkGoogle()}>{busy === "google" ? "Kontrollerar…" : "Läs kalendern Familj"}</button>
      </div>
      {google && <p role="status">{google}</p>}
      <p style={{ ...guidance, fontSize: 13 }}>Google-anslutningen gäller tills den tillfälliga behörigheten går ut. Långvarig säker synkronisering och frånkoppling byggs i nästa steg.</p>
    </section>
    <section style={panel}>
      <h2 style={{ marginTop: 0 }}>Apple Kalender / iCloud – valfritt för andra familjer</h2>
      <p style={guidance}>Er familj använder inte iCloud som kalenderkälla. Därför hämtar Family Hub inga Apple-aktiviteter automatiskt. En framtida familj som använder iCloud ska kunna lägga till <strong>sitt eget</strong> konto frivilligt.</p>
      <p style={{ ...guidance, fontSize: 14, marginBottom: 0 }}>Status: separat och privat iCloud-anslutning är under utveckling. Ingen Apple-koppling är aktiverad för den här familjen.</p>
    </section>
    <section id="sports" style={panel}>
      <h2 style={{ marginTop: 0 }}>Fotboll och föreningsaktiviteter</h2>
      <p style={guidance}>Välj de offentliga lagkalendrar du vill <strong>visa direkt i familjekalendern</strong>. Du kan också prova en personlig kalenderlänk från SportAdmin för Alvas IK Östria Lambohov.</p>
      <p style={{ ...guidance, fontSize: 13, background: "#fff8e8", borderRadius: 10, padding: 12 }}>Pilot: valen sparas än så länge endast för ditt konto i den här webbläsaren. De är inte ännu delade mellan familjens telefoner. Aktiviteterna visas skrivskyddat och hämtas på nytt när kalendern öppnas.</p>
      <h3 style={{ fontSize: 16 }}>Hittade kalenderkällor – snabbval</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 10, marginBottom: 18 }}>
        {verifiedFeeds.map(feed => <div key={feed.id} style={{ padding: 13, borderRadius: 12, background: "#f3f7fc", border: "1px solid #d8e3f1" }}>
          <div style={{ fontWeight: 700, marginBottom: 9 }}>{feed.label}</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" disabled={!authenticated || Boolean(busy)} style={{ ...(enabledFeeds.includes(feed.id) ? action : secondary), padding: "9px 12px" }} onClick={() => togglePublicFeed(feed.id)}>
              {enabledFeeds.includes(feed.id) ? "✓ Visas i kalendern – ta bort" : "Visa i familjekalendern"}
            </button>
            <button type="button" style={{ ...secondary, padding: "9px 12px" }} disabled={Boolean(busy)} onClick={() => {
              setSource(feed.provider); setLink(feed.url); setResults([]); setStats(""); setPreviewReady(false); setNotice("Länken är ifylld. Välj Förhandsgranska nedan för att testa källan.");
            }}>Förhandsgranska</button>
            <a href={feed.sourcePage} target="_blank" rel="noopener noreferrer" style={{ color: "#315e9c", fontSize: 13 }}>Officiell källa</a>
          </div>
        </div>)}
      </div>
      <form onSubmit={previewFeed} style={{ display: "grid", gap: 13 }}>
        <label htmlFor="provider" style={{ fontWeight: 700 }}>Kalenderkälla</label>
        <select id="provider" value={source} onChange={e => { setSource(e.target.value as Provider); setLink(""); setResults([]); setStats(""); setNotice(""); setPreviewReady(false); }} style={{ padding: 13, borderRadius: 10, border: "1px solid #becde0", maxWidth: 450 }}>
          <option value="svenskalag">Svenskalag – exempelvis Elsas lag</option>
          <option value="sportadmin">SportAdmin – exempelvis Alvas lag</option>
        </select>
        <label htmlFor="calendar-link" style={{ fontWeight: 700 }}>Prenumerationslänk (webcal:// eller https://)</label>
        <input id="calendar-link" type="url" inputMode="url" required value={link} onChange={e => { setLink(e.target.value); setPreviewReady(false); }} placeholder={source === "svenskalag" ? "https://cal.svenskalag.se/…" : "https://publicweb.sportadmin.se/webcal?id=…"} style={{ padding: 13, borderRadius: 10, border: "1px solid #becde0", width: "100%", boxSizing: "border-box" }} />
        <p style={{ ...guidance, fontSize: 14, margin: 0 }}>{source === "svenskalag"
          ? "Öppna lagets kalender på Svenskalag, välj Prenumerera och kopiera webcal-länken."
          : "Öppna SportAdmin → Mer → Kalenderprenumerationer och kopiera länken för Alvas profil. I vissa versioner finns prenumerationen under Aktiviteter → kalenderikonen. Länken kan börja med publicweb.sportadmin.se eller cal.sportadmin.se."}</p>
        <div><button type="submit" disabled={!authenticated || !link.trim() || Boolean(busy)} style={action}>{busy === "feed" ? "Läser kalendern…" : "Förhandsgranska aktiviteter"}</button></div>
      </form>
      {previewReady && <p><button type="button" style={action} disabled={!authenticated || Boolean(busy)} onClick={displayTemporaryFeed}>Visa förhandsgranskad kalender i Family Hub</button></p>
      {notice && <p role="status" style={{ marginTop: 16 }}>{notice}</p>}
      {stats && <p><strong>{stats}</strong></p>}
      {results.length > 0 && <div style={{ maxHeight: 390, overflowY: "auto", marginTop: 16 }}>
        <h3>Aktiviteter från {source === "svenskalag" ? "Svenskalag" : "SportAdmin"}</h3>
        {results.map((item, i) => <article key={item.uid + "-" + i} style={{ borderBottom: "1px solid #e6ebf2", padding: "10px 0" }}>
          <strong>{item.title}</strong>
          <div style={{ fontSize: 13, color: "#586a7f" }}>{item.starts_at.replace("T", " ")} · {item.location || "Plats saknas"}</div>
        </article>)}
      </div>}
      <p style={{ ...guidance, fontSize: 13 }}>Prenumerationslänken kan vara privat. Klistra den endast i appen, inte i vår chatt. Personliga länkar används bara tillfälligt under webbläsarsessionen; offentliga lagkalendrar kan aktiveras ovan.</p>
      <p><a href="/calendar" style={{ ...action, textDecoration: "none", display: "inline-block" }}>Öppna min familjekalender →</a></p>
    </section>
    <section style={panel}>
      <h2 style={{ marginTop: 0 }}>⛷ Alpina tävlingar – Elsa U16 och Alva U14</h2>
      <p style={guidance}>Separat tävlingskalender med möjliga tävlingar från Svenska Skidförbundet och Region 5. Ej verifierade datum hålls tydligt åtskilda från faktiska familjeaktiviteter. Du kan godkänna förslag individuellt.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <a href="/ski" style={{ ...action, textDecoration: "none" }}>Öppna tävlingskalendern</a>
        <a href="/ski/sources" style={{ ...secondary, textDecoration: "none" }}>Kontrollera officiella källor</a>
        <a href="/ski/import" style={{ ...secondary, textDecoration: "none" }}>Importera tävlingsfil</a>
      </div>
    </section>
    <p style={{ ...guidance, fontSize: 13 }}>Hjertstedt Family Hub – stagingpilot. Denna version visar valda föreningskalendrar direkt i kalendern, men sparar inte inställningarna gemensamt för hela familjen. Automatisk kontosynkronisering och hantering av återkommande källposter återstår.</p>
  </div></main>;
}
