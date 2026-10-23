"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabase";

export default function AuthComplete() {
  const started = useRef(false);
  const [message, setMessage] = useState("Slutför inloggningen...");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    // React Strict Mode can run effects twice in development. A magic-link
    // authorization code is single-use, so exchange it at most once.
    if (started.current) return;
    started.current = true;

    async function finish() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      const description = url.searchParams.get("error_description");

      if (error) {
        setMessage("Supabase avvisade inloggningslänken.");
        setDetail([error, description].filter(Boolean).join(": "));
        return;
      }

      if (!code) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.replace("/calendar");
          return;
        }
        setMessage("Inloggningskoden saknas. Begär en ny inloggningslänk.");
        return;
      }

      // Remove the one-time code from the visible URL, without restarting the page.
      window.history.replaceState({}, "", "/auth/complete");
      try {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setMessage("Inloggningslänken kunde inte användas.");
          setDetail(exchangeError.message);
          return;
        }
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!session || sessionError) {
          setMessage("Sessionen kunde inte sparas.");
          setDetail(sessionError?.message ?? "Ingen session hittades efter kodväxlingen.");
          return;
        }
        window.location.replace("/calendar");
      } catch (cause) {
        setMessage("Inloggningen kunde inte slutföras.");
        setDetail(cause instanceof Error ? cause.message : "Okänt fel");
      }
    }
    void finish();
  }, []);

  return <main style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
    <h1>Hjertstedt Family Hub</h1>
    <p role="status">{message}</p>
    {detail && <p role="alert" style={{ color: "#b42318" }}>Teknisk orsak: {detail}</p>}
    <a href="/login">Till inloggningen</a>
  </main>;
}
