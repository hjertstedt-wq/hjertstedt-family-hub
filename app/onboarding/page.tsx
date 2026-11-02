"use client";
import { useEffect, useState } from "react";
import { supabase } from "../supabase";

import { normalizeAppleAppPassword } from "../lib/integrations/apple-app-password";

type Calendar = { id: string; name: string };
const button: React.CSSProperties = { padding: "12px 16px", borderRadius: 10, border: "1px solid #c5d3e4", background: "#315e9c", color: "white", cursor: "pointer", fontWeight: 700 };
const field: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #bdcbe0", borderRadius: 9, marginTop: 7, marginBottom: 18 };
const panel: React.CSSProperties = { background: "white", border: "1px solid #e0e8f2", borderRadius: 18, padding: 24, marginTop: 18 };

export default function Onboarding() {
  const [name, setName] = useState("");
  const [home, setHome] = useState<{ id: string; name: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selected, setSelected] = useState("");
  const [connected, setConnected] = useState(false);
  const [calendarName, setCalendarName] = useState("");
  const [reconnect, setReconnect] = useState(false);

  async function request(path: string, method = "GET", body?: unknown) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw Error("Logga in i Family Hub först.");
    const response = await fetch(path, { method, headers: { Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw Error(result.error ?? "Anslutningen kunde inte slutföras.");
    return result;
  }
  function showConnection(data: { calendars?: Calendar[]; selectedId?: string; status?: string; calendarName?: string }) {
    setCalendars(data.calendars ?? []); setSelected(data.selectedId ?? "");
    setConnected(data.status === "active" || data.status === "choose_calendar");
    setCalendarName(data.calendarName ?? "");
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await request("/api/onboarding");
        if (!active) return;
        setHome(data.household); setName(data.household?.name ?? ""); setReady(data.icloudReady);
        const saved = data.connections?.find((item: { provider: string }) => item.provider === "icloud");
        if (saved) {
          setConnected(true); setCalendarName(saved.calendar_name ?? "");
          const discovery = await request("/api/icloud/discover");
          if (active) showConnection(discovery);
        }
      } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : "Kunde inte kontrollera anslutningarna."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  async function act(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await work(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Försök igen."); }
    finally { setBusy(false); }
  }
  return <main style={{ minHeight: "100vh", padding: "30px 16px 70px", background: "#f3f6fb", color: "#172b44", fontFamily: "Arial,sans-serif" }}>
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <nav><a href="/">Startsida</a> · <a href="/calendar">Kalender</a> · <a href="/connections">Alla anslutningar</a></nav>
      <p style={{ marginTop: 28, color: "#526a87", letterSpacing: 2, fontSize: 12 }}>FAMILY HUB · KOM IGÅNG</p>
      <h1 style={{ fontSize: "clamp(28px,6vw,42px)", marginBottom: 10 }}>Era kalendrar, på ett ställe</h1>
      <p style={{ lineHeight: 1.65 }}>Skapa ditt hushåll och välj var kalendern finns. Anslutningarna följer ditt Family Hub-konto mellan dator och telefon.</p>
      {loading && <p role="status">Kontrollerar ditt konto och säker lagring…</p>}
      {error && <div role="alert" style={{ ...panel, borderColor: "#e7b5b5", color: "#9b2929" }}>{error}<p><a href="/login">Gå till inloggningen</a> · <button type="button" onClick={() => window.location.reload()}>Försök igen</button></p></div>}
      {notice && <p role="status" style={panel}>{notice}</p>}
      <section style={panel} aria-labelledby="household-title">
        <h2 id="household-title">1. Ditt hushåll {home ? "✓" : ""}</h2>
        <p>Den som ansluter kalendern äger anslutningen. Automatisk delning med andra Family Hub-konton är ännu inte aktiverad.</p>
        <form onSubmit={event => { event.preventDefault(); void act(async () => {
          const result = await request("/api/onboarding", "POST", { name }); setHome(result.household);
          setNotice("Hushållet är sparat. Fortsätt med din kalender nedan.");
        }); }}>
          <label htmlFor="household-name">Hushållets namn</label>
          <input id="household-name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} style={field} placeholder="Exempelvis Familjen Andersson" />
          <button style={button} disabled={loading || busy || !ready}>{home ? "Spara hushållsnamn" : "Skapa mitt hushåll"}</button>
        </form>
      </section>
      <section id="icloud" style={panel} aria-labelledby="icloud-title">
        <h2 id="icloud-title">2. Anslut din kalender</h2>
        <h3>Apple / iCloud <span style={{ fontSize: 14, color: "#426d57" }}>{calendarName ? "· " + calendarName + " ansluten" : connected ? "· Välj kalender" : "· Inte ansluten"}</span></h3>
        <p style={{ lineHeight: 1.6 }}>För en privat eller delad iCloud-kalender. En delning måste först vara accepterad i Apple Kalender på ditt Apple-konto. Kalendern behöver inte göras offentlig.</p>
        {!ready && !loading && <p role="status">Administratören behöver aktivera säker lagring och kryptering innan iCloud kan anslutas. Inga Apple-uppgifter tas emot innan det är klart.</p>}
        {!home && ready && <p>Skapa hushållet i steg 1 först.</p>}
        {home && ready && (!connected || reconnect) && <>
          <ol style={{ lineHeight: 1.7 }}>
            <li>Öppna <a href="https://account.apple.com/" target="_blank" rel="noopener noreferrer">ditt Apple-konto</a>.</li>
            <li>Välj Inloggning och säkerhet → Appspecifika lösenord. Skapa ett för Family Hub. Tvåfaktorsautentisering krävs.</li>
            <li>Ange kontoadress och det nya appspecifika lösenordet nedan. <strong>Ange aldrig ditt vanliga Apple-lösenord.</strong></li>
          </ol>
          <p><a href="https://support.apple.com/sv-se/102654" target="_blank" rel="noopener noreferrer">Apples instruktioner för appspecifika lösenord</a></p>
          <form onSubmit={event => { event.preventDefault(); void act(async () => {
            try {
              const normalized = normalizeAppleAppPassword(password);
              if (!normalized) throw Error("Det appspecifika lösenordet ska innehålla 16 bokstäver. Du kan klistra in det med eller utan bindestreck eller mellanslag.");
              const result = await request("/api/icloud/connection", "POST", { username, password: normalized, consent });
              showConnection(result); setReconnect(false);
              setNotice(result.status === "active" ? "Family hittades och är ansluten. Öppna kalendern för att läsa aktiviteterna." : "Apple-kontot är anslutet. Välj kalender nedan.");
            } finally { setPassword(""); }
          }); }}>
            <label htmlFor="apple-account">Apple-kontots e-postadress</label>
            <input id="apple-account" type="email" autoComplete="off" required maxLength={254} value={username} onChange={e => setUsername(e.target.value)} style={field} />
            <label htmlFor="apple-app-password">Appspecifikt lösenord</label>
            <input id="apple-app-password" type="password" autoComplete="off" required maxLength={128} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="apple-password-format" placeholder="xxxx-xxxx-xxxx-xxxx" value={password} onChange={e => setPassword(e.target.value)} style={field} />
            <p id="apple-password-format" style={{ fontSize: 13 }}>16 bokstäver. Klistra in med eller utan bindestreck eller mellanslag.</p>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>Appen gör endast läsningar. Apples appspecifika lösenord kan ge bredare behörigheter än enbart kalenderläsning. Det lagras krypterat på servern och visas aldrig igen. Du kan återkalla det hos Apple när som helst.</p>
            <label style={{ display: "flex", alignItems: "start", gap: 9, lineHeight: 1.5, marginBottom: 18 }}><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} />Jag godkänner att Family Hub sparar anslutningen krypterat och läser den kalender jag väljer för mitt konto.</label>
            <button style={button} disabled={busy || !consent}>{busy ? "Ansluter…" : "Anslut privat iCloud-kalender"}</button>
          </form>
        </>}
        {connected && <div>
          {calendars.length > 0 && <form onSubmit={event => { event.preventDefault(); void act(async () => {
            const result = await request("/api/icloud/connection", "PATCH", { calendarId: selected });
            setCalendarName(result.calendarName); setNotice("Kalendern är vald och sparad för ditt konto.");
          }); }}>
            <label htmlFor="icloud-calendar">Kalender att visa</label>
            <select id="icloud-calendar" required value={selected} onChange={e => setSelected(e.target.value)} style={field}>
              <option value="">Välj kalender…</option>
              {calendars.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.name} · {calendar.id.slice(0, 8)}</option>)}
            </select>
            <button style={button} disabled={busy || !selected}>Visa vald kalender</button>
          </form>}
          <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" disabled={busy} onClick={() => setReconnect(true)}>Uppdatera Apple-anslutning</button>
            <button type="button" disabled={busy} onClick={() => void act(async () => {
              await request("/api/icloud/connection", "DELETE"); showConnection({}); setReconnect(false);
              setNotice("Anslutningen och dess sparade uppgifter är borttagna. Återkalla även det appspecifika lösenordet hos Apple om det inte ska användas mer.");
            })}>Koppla från iCloud och radera anslutningen</button>
          </p>
        </div>}
        <hr style={{ margin: "26px 0", border: 0, borderTop: "1px solid #e3e9f2" }} />
        <h3>Andra kalenderkällor</h3>
        <p>Välj den tjänst där kalendern faktiskt ligger. Apple Kalender kan visa både iCloud- och Google-kalendrar.</p>
        <p><a href="/connections#google">Anslut Google Kalender</a> · <a href="/connections#sports">Svenskalag eller SportAdmin</a></p>
        <p style={{ fontSize: 13 }}>Google-godkännande och föreningskalendrar använder ännu pilotflöden. De är inte fullständigt synkroniserade mellan enheter.</p>
      </section>
      <section style={panel}><h2>3. Se era aktiviteter</h2><p>iCloud-händelser visas skrivskyddat. Kalendern hämtar om aktiviteter när perioden ändras eller du väljer Uppdatera.</p><a href="/calendar" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Öppna kalendern →</a></section>
    </div>
  </main>;
}
