
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../supabase";

type Profile = {
  id: string;
  name: string;
  email: string | null;
  birth_date: string | null;
  phone: string | null;
  notes: string | null;
};

export default function PersonPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("persons")
        .select("id,name,email,birth_date,phone,notes")
        .eq("id", id)
        .single();

      if (error) setMessage(error.message);
      else setProfile(data);

      setLoading(false);
    }

    if (id) load();
  }, [id, router]);

  async function save() {
    if (!profile || !profile.name.trim()) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("persons")
      .update({
        name: profile.name.trim(),
        email: profile.email || null,
        birth_date: profile.birth_date || null,
        phone: profile.phone || null,
        notes: profile.notes || null
      })
      .eq("id", profile.id);

    setMessage(error ? "Fel: " + error.message : "Profilen är sparad!");
    setSaving(false);
  }

  function field(
    label: string,
    key: "name" | "email" | "birth_date" | "phone" | "notes",
    type = "text"
  ) {
    if (!profile) return null;

    return (
      <label style={{ display: "block", marginBottom: 20 }}>
        <span style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
          {label}
        </span>
        {key === "notes" ? (
          <textarea
            value={profile.notes ?? ""}
            onChange={(e) =>
              setProfile({ ...profile, notes: e.target.value })
            }
            rows={4}
            style={inputStyle}
          />
        ) : (
          <input
            type={type}
            value={profile[key] ?? ""}
            onChange={(e) =>
              setProfile({ ...profile, [key]: e.target.value })
            }
            style={inputStyle}
          />
        )}
      </label>
    );
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f4f6fa",
      padding: "32px 16px",
      fontFamily: "Arial, sans-serif",
      color: "#17253b"
    }}>
      <div style={{ maxWidth: 650, margin: "0 auto" }}>
        <button
          onClick={() => router.push("/")}
          style={{ marginBottom: 24, cursor: "pointer" }}
        >
          ← Tillbaka till familjen
        </button>

        {loading ? (
          <p>Laddar profil...</p>
        ) : profile ? (
          <section style={{
            background: "white",
            borderRadius: 20,
            padding: 28
          }}>
            <h1>{profile.name}</h1>
            <p style={{ color: "#64748b", marginBottom: 28 }}>
              Familjeprofil
            </p>

            {field("Namn", "name")}
            {field("E-post", "email", "email")}
            {field("Födelsedatum", "birth_date", "date")}
            {field("Telefonnummer", "phone", "tel")}
            {field("Anteckningar", "notes")}

            <button
              onClick={save}
              disabled={saving || !profile.name.trim()}
              style={{
                background: "#17253b",
                color: "white",
                padding: "14px 24px",
                border: "none",
                borderRadius: 10,
                cursor: "pointer"
              }}
            >
              {saving ? "Sparar..." : "Spara profil"}
            </button>

            {message && <p role="status">{message}</p>}
          </section>
        ) : (
          <p role="alert">{message || "Profilen kunde inte hittas."}</p>
        )}
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontSize: 16
};
