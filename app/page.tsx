"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type Person = {
  id: string;
  name: string | null;
  email: string | null;
};

export default function Home() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadFamily() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("persons")
        .select("id, name, email")
        .order("created_at", { ascending: true });

      if (error) {
        setError(error.message);
      } else {
        setPersons(data ?? []);
      }

      setLoading(false);
    }

    loadFamily();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
      <h1>Hjertstedt Family Hub</h1>

      <p>Systemet är anslutet och fungerar ✅</p>

      <button onClick={logout} style={{ padding: 10, cursor: "pointer" }}>
        Logga ut
      </button>

      <h2>Familjen</h2>

      {loading ? (
        <p>Laddar familjen...</p>
      ) : error ? (
        <p>❌ Kunde inte läsa familjemedlemmar: {error}</p>
      ) : persons.length > 0 ? (
        persons.map((person) => (
          <div key={person.id}>
            <strong>{person.name}</strong>
            {person.email && <span> – {person.email}</span>}
          </div>
        ))
      ) : (
        <p>Inga familjemedlemmar hittades.</p>
      )}

      <h2>Kalender</h2>
      <p>Familjens gemensamma kalender</p>

      <h2>Elsas fotboll</h2>
      <p>Träningar, matcher och anmälningar</p>

      <h2>AI-assistent</h2>
      <p>Fråga om familjens aktiviteter</p>
    </main>
  );
}
