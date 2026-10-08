
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadFamily() {
      const { data: { session } } =
        await supabase.auth.getSession();

      if (!session) {
        window.location.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("persons")
        .select("id, name, email")
        .order("created_at", { ascending: true });

      if (error) setError(error.message);
      else setPersons(data ?? []);

      setLoading(false);
    }

    loadFamily();
  }, []);

  async function savePerson(id: string) {
    if (!editName.trim()) return;

    setSaving(true);
    setError("");

    const { data, error } = await supabase
      .from("persons")
      .update({ name: editName.trim() })
      .eq("id", id)
      .select("id, name, email")
      .single();

    if (error) {
      setError("Kunde inte spara: " + error.message);
    } else if (data) {
      setPersons((current) =>
        current.map((person) =>
          person.id === id ? data : person
        )
      );
      setEditingId(null);
    }

    setSaving(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  return (
    <main style={{
      padding: 32,
      fontFamily: "Arial, sans-serif",
      maxWidth: 800
    }}>
      <h1>Hjertstedt Family Hub</h1>
      <p>Systemet är anslutet och fungerar ✅</p>

      <button onClick={logout}>Logga ut</button>

      <h2>Familjen</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>Laddar familjen...</p>
      ) : (
        persons.map((person) => (
          <div key={person.id} style={{
            padding: 16,
            marginBottom: 12,
            border: "1px solid #ddd",
            borderRadius: 8
          }}>
            {editingId === person.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  aria-label="Namn"
                />
                <button
                  disabled={saving || !editName.trim()}
                  onClick={() => savePerson(person.id)}
                >
                  {saving ? "Sparar..." : "Spara"}
                </button>
                <button
                  disabled={saving}
                  onClick={() => setEditingId(null)}
                >
                  Avbryt
                </button>
              </>
            ) : (
              <>
                <strong>{person.name}</strong>
                {person.email && <p>{person.email}</p>}
                <button onClick={() => {
                  setEditName(person.name ?? "");
                  setEditingId(person.id);
                }}>
                  Redigera
                </button>
              </>
            )}
          </div>
        ))
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

