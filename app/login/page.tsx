"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("auth_error");
    if (params.get("reason") === "session_expired") setMessage("Din inloggning har gått ut. Logga in igen för att läsa familjens uppgifter.");
    if (error) setAuthError(error);
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data.user) window.location.replace("/");
    });
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setMessage(error.message === "Invalid login credentials"
        ? "Fel e-postadress eller lösenord. Kontot behöver ha ett lösenord registrerat i Supabase."
        : "Inloggningen misslyckades: " + error.message);
      setBusy(false);
      return;
    }
    window.location.replace("/");
  }

  async function sendMagicLink() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin + "/auth/callback", shouldCreateUser: false },
    });
    setMessage(error ? "Kunde inte skicka länken: " + error.message
      : "En inloggningslänk har skickats. Öppna den i samma webbläsare.");
    setBusy(false);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f4f6fa", padding: "48px 16px", fontFamily: "Arial, sans-serif", color: "#17253b" }}>
      <section style={{ maxWidth: 440, margin: "0 auto", background: "white", borderRadius: 16, padding: 32, boxShadow: "0 4px 24px #17253b12" }}>
        <h1>Hjertstedt Family Hub</h1>
        <h2>Logga in</h2>
        <p>Familjens kalender och aktiviteter på ett ställe.</p>
        <form onSubmit={login}>
          <label htmlFor="email">E-postadress</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}
            style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 12, margin: "8px 0 20px" }} />
          <label htmlFor="password">Lösenord</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}
            style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 12, margin: "8px 0 20px" }} />
          <button type="submit" disabled={busy} style={{ padding: 12, width: "100%", cursor: "pointer" }}>
            {busy ? "Vänta..." : "Logga in"}
          </button>
        </form>
        <p style={{ marginTop: 18 }}><a href="/reset-password">Glömt lösenordet? Skapa eller återställ lösenord</a></p>
        <details style={{ marginTop: 24 }}>
          <summary>Alternativ: inloggningslänk via mejl</summary>
          <p>Mejllänken kan kräva samma webbläsare som när den begärdes.</p>
          <button type="button" disabled={busy || !email.trim()} onClick={sendMagicLink}>Skicka mejllänk</button>
        </details>
        {authError && <p role="alert">Tidigare inloggningsfel: {authError}</p>}
        {message && <p role="status" style={{ marginTop: 20 }}>{message}</p>}
        <p style={{ fontSize: 13, color: "#52627a", marginTop: 28 }}>Pilotversion – nya familjekonton öppnas efter säkerhetstest.</p>
      </section>
    </main>
  );
}
