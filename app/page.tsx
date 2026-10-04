import { supabase } from "./supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: persons, error } = await supabase
    .from("persons")
    .select("id, name, email")
    .order("created_at", { ascending: true });

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
      <h1>Hjertstedt Family Hub</h1>

      <p>Systemet är anslutet och fungerar ✅</p>

      <h2>Familjen</h2>

      {error ? (
        <p>❌ Kunde inte läsa familjemedlemmar: {error.message}</p>
      ) : persons && persons.length > 0 ? (
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
