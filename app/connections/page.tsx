"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type Provider = "svenskalag" | "sportadmin";
type Activity = { uid: string; title: string; starts_at: string; ends_at: string | null; location: string | null };
const shell: React.CSSProperties = { minHeight: "100vh", background: "#f3f6fb", color: "#172b44", fontFamily: "Arial,sans-serif", padding: "24px 16px 70px" };
const panel: React.CSSProperties = { background: "white", padding: 24, borderRadius: 18, boxShadow: "0 3px 18px #172b4410", marginBottom: 17 };
const action: React.CSSProperties = { border: 0, padding: "12px 17px", borderRadius: 10, background: "#315e9c", color: "white", fontWeight: 700, cursor: "pointer" };
const secondary: React.CSSProperties = { ...action, background: "#eaf1fb", color: "#234876" };
const guidance: React.CSSProperties = { color: "#586a7f", lineHeight: 1.6 };

export default function ConnectionsPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [apple, setApple] = useState("");
  const [google, setGoogle] = useState("");
  const [source, setSource] = useState<Provider>("svenskalag");
  const [link, setLink] = useState("");
  const [results, setResults] = useState<Activity[]>([]);
  const [stats, setStats] = useState("");
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setAuthenticated(Boolean(data.user)));
    const code = new URLSearchParams(window.location.search).get("google");
    if (code === "connected_temporarily") setGoogle("Google godkänd för denna webbläsare. Läs in Familj för att testa.");
    else if (code) setGoogle("Google-anslutningen kunde inte slutföras (" + code + "). Kontrollera anslutningen.");
  }, []);

  async function token(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw Error("Logga in i Family Hub först.");
    return session.access_token;
  }
  async function checkApple() {
    setBusy("apple"); setApple("");
    try {
      const bearer = await token();
      const response = await fetch("/api/icloud/discover", { headers: { Authorization: "Bearer " + bearer }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "iCloud-kalendrar kunde inte läsas.");
      setApple("Hittade " + (data.calendars?.length ?? 0) + " kalendrar: " +
        (data.calendars ?? []).map((c: { name: string }) => c.name).filter(Boolean).join(", ") +
        ". Kalender och Family visas i kalenderöversikten när de går att läsa.");
    } catch (error) { setApple(error instanceof Error ? error.message : "iCloud-kontrollen misslyckades."); }
    finally { setBusy(""); }
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
    event.preventDefault(); setBusy("feed"); setNotice(""); setResults([]); setStats("");
    try {
      const bearer = await token();
      const response = await fetch("/api/integrations/feed-preview", {
        method: "POST", headers: { Authorization: "Bearer " + bearer, "Content-Type": "application/json" },
        body: JSON.stringify({ source, url: link.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Kunde inte läsa kalendern.");
      setResults(data.events ?? []);
      setStats(data.supported + " av " + data.total + " kalenderposter kunde förhandsgranskas" +
        (data.skipped ? " (" + data.skipped + " kräver ytterligare stöd för upprepning eller tidszon)" : "") + ".");
      setNotice("Detta är en förhandsgranskning. Aktiviteter sparas inte ännu och ingen löpande prenumeration har skapats.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Kalendern kunde inte läsas."); }
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
      <h2 style={{ marginTop: 0 }}> Apple Kalender / iCloud</h2>
      <p style={guidance}>Pilotkopplingen använder de befintliga iCloud-inställningarna. Vi läser kalendrarna Kalender och Family, utan att ändra något hos Apple.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={action} disabled={!authenticated || Boolean(busy)} onClick={() => void checkApple()}>{busy === "apple" ? "Kontrollerar…" : "Kontrollera mina iCloud-kalendrar"}</button>
        <a href="/calendar" style={{ ...secondary, textDecoration: "none" }}>Visa aktiviteter</a>
      </div>
      {apple && <p role="status">{apple}</p>}
      <p style={{ ...guidance, fontSize: 13 }}>Observera: denna pilotkoppling är knuten till familjens befintliga Apple-konto. Separata privata Apple-kopplingar för framtida kunder återstår.</p>
    </section>
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
      <h2 style={{ marginTop: 0 }}>Fotboll och föreningsaktiviteter</h2>
      <p style={guidance}>Svenskalag och SportAdmin erbjuder prenumerationskalendrar. Kopiera länken från rätt lag eller barn och prova den här. Vi testar riktiga aktiviteter innan vi slår på import.</p>
      <form onSubmit={previewFeed} style={{ display: "grid", gap: 13 }}>
        <label htmlFor="provider" style={{ fontWeight: 700 }}>Kalenderkälla</label>
        <select id="provider" value={source} onChange={e => { setSource(e.target.value as Provider); setLink(""); setResults([]); setStats(""); setNotice(""); }} style={{ padding: 13, borderRadius: 10, border: "1px solid #becde0", maxWidth: 450 }}>
          <option value="svenskalag">Svenskalag – exempelvis Elsas lag</option>
          <option value="sportadmin">SportAdmin – exempelvis Alvas lag</option>
        </select>
        <label htmlFor="calendar-link" style={{ fontWeight: 700 }}>Prenumerationslänk (webcal:// eller https://)</label>
        <input id="calendar-link" type="url" inputMode="url" required value={link} onChange={e => setLink(e.target.value)} placeholder={source === "svenskalag" ? "webcal://cal.svenskalag.se/…" : "webcal://cal.sportadmin.se/…"} style={{ padding: 13, borderRadius: 10, border: "1px solid #becde0", width: "100%", boxSizing: "border-box" }} />
        <p style={{ ...guidance, fontSize: 14, margin: 0 }}>{source === "svenskalag"
          ? "Öppna lagets kalender på Svenskalag, välj Prenumerera och kopiera webcal-länken."
          : "Öppna SportAdmin-appen → Aktiviteter → kalenderikonen Prenumerera. Kopiera kalenderlänken om appen visar den."}</p>
        <div><button type="submit" disabled={!authenticated || !link.trim() || Boolean(busy)} style={action}>{busy === "feed" ? "Läser kalendern…" : "Förhandsgranska aktiviteter"}</button></div>
      </form>
      {notice && <p role="status" style={{ marginTop: 16 }}>{notice}</p>}
      {stats && <p><strong>{stats}</strong></p>}
      {results.length > 0 && <div style={{ maxHeight: 390, overflowY: "auto", marginTop: 16 }}>
        <h3>Aktiviteter från {source === "svenskalag" ? "Svenskalag" : "SportAdmin"}</h3>
        {results.map((item, i) => <article key={item.uid + "-" + i} style={{ borderBottom: "1px solid #e6ebf2", padding: "10px 0" }}>
          <strong>{item.title}</strong>
          <div style={{ fontSize: 13, color: "#586a7f" }}>{item.starts_at.replace("T", " ")} · {item.location || "Plats saknas"}</div>
        </article>)}
      </div>}
      <p style={{ ...guidance, fontSize: 13 }}>Prenumerationslänken kan vara privat. Klistra den endast i appen, inte i vår chatt. Förhandsgranskningen sparar varken länken eller aktiviteterna.</p>
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
    <p style={{ ...guidance, fontSize: 13 }}>Hjertstedt Family Hub – stagingpilot. Automatisk synkronisering, personkoppling och flerfamiljskonton aktiveras efter säkerhets- och databasgranskning.</p>
  </div></main>;
}
