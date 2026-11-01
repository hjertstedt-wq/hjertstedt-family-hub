"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.hash.replace(/^#/, ""));
      const code = url.searchParams.get("code");
      const authError = url.searchParams.get("error") ?? params.get("error");
      if (authError) {
        if (mounted) setError("Länken är ogiltig eller har gått ut. Begär en ny återställning.");
        return;
      }
      if (code) {
        window.history.replaceState({}, "", "/reset-password");
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (mounted) setError("Länken kunde inte verifieras: " + exchangeError.message + ". Öppna den i samma webbläsare som du begärde den.");
          return;
        }
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) setReady(Boolean(session));
    };
    void check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session) setReady(true);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin + "/reset-password",
    });
    setBusy(false);
    if (resetError) setError("Kunde inte skicka återställningsmejlet: " + resetError.message);
    else setMessage("Om kontot finns skickas ett återställningsmejl. Öppna länken i samma webbläsare där du begärde den.");
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 12) { setError("Använd minst 12 tecken."); return; }
    if (password !== confirm) { setError("Lösenorden stämmer inte överens."); return; }
    setBusy(true); setError(""); setMessage("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) { setError("Lösenordet kunde inte sparas: " + updateError.message); return; }
    setMessage("Lösenordet är sparat. Du kan nu logga in.");
    await supabase.auth.signOut();
    setReady(false);
    setPassword(""); setConfirm("");
  }

  const fieldStyle = { display: "block", width: "100%", boxSizing: "border-box" as const, padding: 12, margin: "8px 0 20px" };
  return <main style={{ minHeight: "100vh", background: "#f4f6fa", padding: "48px 16px", fontFamily: "Arial, sans-serif", color: "#17253b" }}>
    <section style={{ maxWidth: 440, margin: "0 auto", background: "white", borderRadius: 16, padding: 32 }}>
      <h1>Hjertstedt Family Hub</h1>
      <h2>{ready ? "Välj nytt lösenord" : "Återställ lösenord"}</h2>
      {ready ? <form onSubmit={savePassword}>
        <label htmlFor="password">Nytt lösenord (minst 12 tecken)</label>
        <input id="password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e => setPassword(e.target.value)} style={fieldStyle}/>
        <label htmlFor="confirm">Upprepa lösenordet</label>
        <input id="confirm" type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={e => setConfirm(e.target.value)} style={fieldStyle}/>
        <button type="submit" disabled={busy}>{busy ? "Sparar..." : "Spara lösenord"}</button>
      </form> : <form onSubmit={requestReset}>
        <p>Ange e-postadressen för ditt befintliga konto. Inget nytt konto skapas.</p>
        <label htmlFor="email">E-postadress</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} style={fieldStyle}/>
        <button type="submit" disabled={busy}>{busy ? "Skickar..." : "Skicka återställningsmejl"}</button>
      </form>}
      {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
      {message && <p role="status">{message}</p>}
      <p><a href="/login">Till inloggningen</a></p>
    </section>
  </main>;
}
