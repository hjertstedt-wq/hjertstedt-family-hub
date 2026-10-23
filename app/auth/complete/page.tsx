"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

export default function AuthComplete() {
  const [message, setMessage] = useState("Slutför inloggningen...");

  useEffect(() => {
    let active = true;
    async function finish() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      // Remove the one-time code from the browser address as soon as it is read.
      window.history.replaceState({}, "", "/auth/complete");
      if (!code) {
        if (active) setMessage("Inloggningskoden saknas. Begär en ny inloggningslänk.");
        return;
      }
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (active) setMessage("Inloggningslänken kunde inte användas. Begär en ny länk.");
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (active) setMessage("Sessionen kunde inte sparas. Prova en ny inloggningslänk.");
          return;
        }
        window.location.replace("/calendar");
      } catch {
        if (active) setMessage("Inloggningen kunde inte slutföras. Försök igen.");
      }
    }
    void finish();
    return () => { active = false; };
  }, []);

  return <main style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
    <h1>Hjertstedt Family Hub</h1>
    <p role="status">{message}</p>
    <a href="/login">Till inloggningen</a>
  </main>;
}
