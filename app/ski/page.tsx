"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Person = { id: string; name: string };
type Race = { id: string; title: string; starts_at: string; ends_at: string; location: string | null; category: string; source: string; description: string | null };
const key = (date: Date) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
const styles: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #cbd5e1", borderRadius: 10, fontSize: 16 };

export default function SkiPage() {
  const [persons,setPersons] = useState<Person[]>([]);
  const [races,setRaces] = useState<Race[]>([]);
  const [links,setLinks] = useState<Record<string,string[]>>({});
  const [filter,setFilter] = useState("all");
  const [title,setTitle] = useState("");
  const [date,setDate] = useState(key(new Date()));
  const [endDate,setEndDate] = useState(key(new Date()));
  const [place,setPlace] = useState("");
  const [discipline,setDiscipline] = useState("SL");
  const [group,setGroup] = useState("both");
  const [busy,setBusy] = useState<string|null>(null);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [loading,setLoading] = useState(true);
  const children = useMemo(()=>persons.filter(p=>/elsa|alva/i.test(p.name)),[persons]);
  const reload = async () => {
    const [a,b,c] = await Promise.all([
      supabase.from("persons").select("id,name").order("name"),
      supabase.from("calendar_events").select("id,title,starts_at,ends_at,location,category,source,description").in("category",["ski_candidate","ski_approved"]).order("starts_at"),
      supabase.from("event_persons").select("event_id,person_id")
    ]);
    if (a.error || b.error || c.error) setError("Kunde inte läsa tävlingskalendern: "+(a.error?.message||b.error?.message||c.error?.message));
    else {
      setPersons(a.data??[]); setRaces(b.data??[]);
      const next: Record<string,string[]> = {};
      for(const item of c.data??[]) (next[item.event_id]??=[]).push(item.person_id);
      setLinks(next);
    }
    setLoading(false);
  };
  useEffect(()=>{let active=true;void supabase.auth.getUser().then(({data})=>{if(!active)return;if(!data.user){window.location.replace("/login");return;}void reload();});return()=>{active=false;};},[]);
  const selected = races.filter(r=>{
    if(filter==="all")return true;
    if(filter==="approved")return r.category==="ski_approved";
    if(filter==="candidate")return r.category==="ski_candidate";
    const name=persons.find(p=>p.id===filter)?.name.toLowerCase()??"";
    return (links[r.id]??[]).includes(filter) || (r.category==="ski_candidate" && (r.description??"").includes(name.includes("elsa")?"U16":"U14") || (r.description??"").includes("U14/U16"));
  });
  async function addRace(e: React.FormEvent) {
    e.preventDefault();setError("");setNotice("");setBusy("create");
    const start=new Date(date+"T09:00:00");
    const end=new Date(endDate+"T17:00:00");
    if(!title.trim()||end<start){setError("Kontrollera namn och datum.");setBusy(null);return;}
    const klass=group==="both"?"U14/U16":group==="elsa"?"U16":"U14";
    const {error:saveError}=await supabase.from("calendar_events").insert({title:title.trim(),starts_at:start.toISOString(),ends_at:end.toISOString(),location:place.trim()||null,category:"ski_candidate",source:"manual",description:klass+" · "+discipline});
    if(saveError)setError("Kunde inte lägga till tävlingen: "+saveError.message);
    else {setNotice("Tävlingen är tillagd som förslag – inte i familjekalendern.");setTitle("");setPlace("");await reload();}
    setBusy(null);
  }
  async function approve(race:Race, ids:string[]) {
    setError("");setNotice("");setBusy(race.id);
    if(!ids.length){setError("Välj Elsa eller Alva innan du godkänner.");setBusy(null);return;}
    const {error:linkError}=await supabase.from("event_persons").upsert(ids.map(person_id=>({event_id:race.id,person_id})),{onConflict:"event_id,person_id"});
    if(linkError){setError("Kunde inte koppla deltagare: "+linkError.message);setBusy(null);return;}
    const {error:updateError}=await supabase.from("calendar_events").update({category:"ski_approved"}).eq("id",race.id);
    if(updateError)setError("Deltagarna sparades men tävlingen kunde inte godkännas: "+updateError.message);
    else setNotice("Tävlingen visas nu i huvudkalendern.");
    await reload();setBusy(null);
  }
  async function unapprove(race:Race) {
    setError("");setNotice("");setBusy(race.id);
    const {error:changeError}=await supabase.from("calendar_events").update({category:"ski_candidate"}).eq("id",race.id);
    if(changeError)setError("Kunde inte ta bort godkännandet: "+changeError.message);
    else {
      const {error:removeError}=await supabase.from("event_persons").delete().eq("event_id",race.id);
      if(removeError)setError("Godkännandet togs bort men deltagarkopplingen kunde inte rensas: "+removeError.message);
      else setNotice("Tävlingen finns kvar som förslag, men inte i huvudkalendern.");
    }
    await reload();setBusy(null);
  }
  return <main style={{minHeight:"100vh",background:"#f4f6fa",padding:"24px 14px",fontFamily:"Arial, sans-serif",color:"#17253b"}}>
    <div style={{maxWidth:960,margin:"auto"}}>
      <a href="/" style={{color:"#315e9c"}}>← Till familjen</a>
      <h1>Alpint – tävlingar</h1>
      <p style={{color:"#64748b"}}>Elsa · U16 · NSK / Region 5 &nbsp;|&nbsp; Alva · U14 · NSK / Region 5</p>
      <p>Förslag ligger separat. Först när du godkänner en tävling visas den i familjens huvudkalender.</p>
      {error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}
      {notice&&<p role="status" style={{color:"#166534"}}>{notice}</p>}
      <section style={{background:"white",padding:20,borderRadius:16,marginBottom:18}}>
        <h2>Registrera tävlingsförslag</h2>
        <p style={{fontSize:13,color:"#64748b"}}>Manuell registrering tills officiella tävlingsflöden är anslutna.</p>
        <form onSubmit={addRace} style={{display:"grid",gap:12}}>
          <label>Tävling <input required value={title} onChange={e=>setTitle(e.target.value)} style={styles} placeholder="Tävlingsnamn" /></label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>
            <label>Startdatum<input required type="date" value={date} onChange={e=>{setDate(e.target.value);if(e.target.value>endDate)setEndDate(e.target.value);}} style={styles}/></label>
            <label>Slutdatum<input required type="date" min={date} value={endDate} onChange={e=>setEndDate(e.target.value)} style={styles}/></label>
          </div>
          <label>Ort / anläggning<input value={place} onChange={e=>setPlace(e.target.value)} style={styles}/></label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
            <label>Disciplin<select value={discipline} onChange={e=>setDiscipline(e.target.value)} style={styles}><option>SL</option><option>GS</option><option>SG</option><option>DH</option><option>Kombination</option><option>Träningsläger</option></select></label>
            <label>Åldersklass<select value={group} onChange={e=>setGroup(e.target.value)} style={styles}><option value="both">U14 och U16</option><option value="elsa">U16 – Elsa</option><option value="alva">U14 – Alva</option></select></label>
          </div>
          <button disabled={busy!==null} style={{background:"#315e9c",color:"white",border:0,borderRadius:10,padding:13,cursor:"pointer"}}>Lägg till som förslag</button>
        </form>
      </section>
      <section style={{background:"white",padding:20,borderRadius:16}}>
        <h2>Tävlingsöversikt</h2>
        <select aria-label="Filtrera tävlingar" value={filter} onChange={e=>setFilter(e.target.value)} style={{...styles,maxWidth:300,marginBottom:14}}>
          <option value="all">Alla tävlingar</option><option value="candidate">Möjliga tävlingar</option><option value="approved">Godkända tävlingar</option>
          {children.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {loading?<p>Laddar...</p>:selected.length===0?<p>Inga tävlingar hittades. Officiella tävlingsflöden är ännu inte anslutna.</p>:
          <div style={{display:"grid",gap:12}}>{selected.map(r=>{
            const allowed=children.filter(p=>r.description?.includes("U14/U16")||r.description?.includes(/elsa/i.test(p.name)?"U16":"U14"));
            const assigned=children.filter(p=>(links[r.id]??[]).includes(p.id));
            return <article key={r.id} style={{border:"1px solid #e2e8f0",borderRadius:12,padding:15}}>
              <strong>{r.title}</strong>
              <div style={{fontSize:14,color:"#475569",marginTop:7}}>{new Date(r.starts_at).toLocaleDateString("sv-SE")} – {new Date(r.ends_at).toLocaleDateString("sv-SE")} · {r.location||"Ort ej angiven"} · {r.description||"Klass ej angiven"}</div>
              <p style={{fontSize:13}}>{r.category==="ski_approved"?"Godkänd för "+assigned.map(p=>p.name).join(", "):"Möjlig tävling – inte i familjekalendern"}</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {r.category==="ski_candidate"?allowed.map(p=><button key={p.id} disabled={busy!==null} onClick={()=>void approve(r,[p.id])} style={{padding:"10px 12px",border:0,borderRadius:8,background:"#dcf3e6",cursor:"pointer"}}>Godkänn för {p.name}</button>):<>
                  {allowed.filter(p=>!assigned.some(a=>a.id===p.id)).map(p=><button key={p.id} disabled={busy!==null} onClick={()=>void approve(r,[p.id])} style={{padding:"10px 12px",border:0,borderRadius:8,background:"#dcf3e6",cursor:"pointer"}}>Lägg till {p.name}</button>)}
                  <button disabled={busy!==null} onClick={()=>void unapprove(r)} style={{padding:"10px 12px",border:"1px solid #cbd5e1",borderRadius:8,background:"white",cursor:"pointer"}}>Ta bort från huvudkalendern</button>
                </>}
              </div>
            </article>;
          })}</div>}
      </section>
    </div>
  </main>;
}
