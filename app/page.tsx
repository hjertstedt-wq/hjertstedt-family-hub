
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
      const { data: { session }, error: authError } =
        await supabase.auth.getSession();

      if (authError || !session) {
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

  const colors = ["#dce8f7", "#f8e2df", "#e3e5fb", "#dcefe6"];

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f4f6fa",
      padding: "24px 16px 60px",
      fontFamily: "Arial, sans-serif",
      color: "#17253b"
    }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <header style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 28
        }}>
          <div>
            <p style={{
              fontSize: 12,
              letterSpacing: 2,
              color: "#64748b",
              fontWeight: 700
            }}>
              HJERTSTEDT FAMILY HUB
            </p>
            <h1 style={{
              fontSize: "clamp(28px, 5vw, 42px)",
              margin: "8px 0"
            }}>
              Hej, familjen!
            </h1>
            <p style={{ color: "#64748b" }}>
              Er gemensamma plats för vardagen.
            </p>
          </div>
          <button onClick={logout} style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "12px 16px",
            cursor: "pointer"
          }}>
            Logga ut
          </button>
        </header>

        <section style={{
          background: "white",
          borderRadius: 20,
          padding: 24,
          marginBottom: 20
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20
          }}>
            <h2 style={{ margin: 0 }}>Familjen</h2>
            <span style={{ color: "#64748b", fontSize: 14 }}>
              {persons.length} personer
            </span>
          </div>

          {error && <p role="alert" style={{ color: "#c62828" }}>{error}</p>}

          {loading ? (
            <p>Laddar familjen...</p>
          ) : persons.length === 0 ? (
            <p>Inga familjemedlemmar hittades.</p>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14
            }}>
              {persons.map((person, index) => (
                <div
  key={person.id}
  onClick={() => {
    if (editingId !== person.id) {
      window.location.href = `/person/${person.id}`;
    }
  }}
  style={{
                  background: "#f4f6fa",
                  borderRadius: 16,
                  padding: 20,
                  textAlign: "center"
                }}>
                  <div style={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    background: colors[index % colors.length],
                    display: "grid",
                    placeItems: "center",
                    fontSize: 26,
                    fontWeight: 700,
                    margin: "0 auto 14px"
                  }}>
                    {(person.name || "?").charAt(0).toUpperCase()}
                  </div>

                  {editingId === person.id ? (
                    <div>
                      <input
                        aria-label="Namn"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: 10,
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          marginBottom: 10
                        }}
                      />
                      <button
                        disabled={saving || !editName.trim()}
                        onClick={() => savePerson(person.id)}
                      >
                        {saving ? "Sparar..." : "Spara"}
                      </button>
                      {" "}
                      <button
                        disabled={saving}
                        onClick={() => setEditingId(null)}
                      >
                        Avbryt
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 style={{ margin: "0 0 6px" }}>
                        {person.name}
                      </h3>
                      <p style={{
                        color: "#64748b",
                        fontSize: 12,
                        overflowWrap: "anywhere"
                      }}>
                        {person.email || "Familjemedlem"}
                      </p>
                      <button
                        onClick={(e) => {
  e.stopPropagation();
  window.location.href = `/person/${person.id}`;
}}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#365b90",
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 8
                        }}
                      >
                        Redigera profil →
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16
        }}>
          {[
            {
              {
  icon: "📅",
  title: "Kalender",
  text: "Familjens gemensamma aktiviteter",
  href: "/calendar"
},
            },
            {
              icon: "⚽",
              title: "Elsas fotboll",
              text: "Träningar, matcher och anmälningar"
            },
            {
              icon: "✨",
              title: "AI-assistent",
              text: "Fråga om familjens aktiviteter"
            },
            {
              icon: "⚙️",
              title: "Inställningar",
              text: "Familjens konton och anslutningar"
            }
          ].map((item) => (
            <section key={item.title} style={{
              background: "white",
              borderRadius: 20,
              padding: 24,
              minHeight: 145
            }}>
              <div style={{ fontSize: 30 }}>{item.icon}</div>
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>
                {item.title}
              </h2>
              <p style={{
                color: "#64748b",
                fontSize: 14,
                lineHeight: 1.5
              }}>
                {item.text}
              </p>
              <small style={{ color: "#8492a6" }}>
                Kommer snart
              </small>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}


