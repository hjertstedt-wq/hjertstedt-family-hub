"use client";

import { useState } from "react";
import { supabase } from "../supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function login() {
    setMessage("Skickar inloggningslänk...");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
  emailRedirectTo: `${window.location.origin}/auth/callback`,
},
    });

    if (error) {
      setMessage("Fel: " + error.message);
    } else {
      setMessage("Kontrollera din e-post – inloggningslänken är skickad.");
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
      <h1>Hjertstedt Family Hub</h1>
      <h2>Logga in</h2>

      <p>Logga in för att komma åt familjens hubb.</p>

      <input
        type="email"
        placeholder="E-postadress"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          padding: 12,
          width: 300,
          marginRight: 10,
        }}
      />

      <button
        onClick={login}
        style={{
          padding: 12,
          cursor: "pointer",
        }}
      >
        Skicka inloggningslänk
      </button>

      {message && <p>{message}</p>}
    </main>
  );
}
