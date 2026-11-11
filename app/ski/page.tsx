"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { eligibleForPerson } from "../lib/ski-eligibility";
import { matchesSeasonSuggestion, seasonSuggestions } from "../lib/ski-season-2027";

type Person = { id: string; name: string; family_id: string | null };
type Race = { id: string; title: string; starts_at: string; ends_at: string; location: string | null; category: string; source: string; description: string | null; external_id?: string | null };
const key = (date: Date) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
const seasonDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "medium" });
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
  const [selectedRaceIds,setSelectedRaceIds] = useState<string[]>([]);
  const children = useMemo(()=>persons.filter(p=>/elsa|alva/i.test(p.name)),[persons]);
  const reload = async () => {
    const [a,b,c] = await Promise.all([
      supabase.from("persons").select("id,name,family_id").order("name"),
      supabase.from("calendar_events").select("id,title,starts_at,ends_at,location,category,source,description,external_id").in("category",["ski_candidate","ski_approved"]).order("starts_at"),
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
  const suggestions = seasonSuggestions.filter(suggestion => !races.some(race => matchesSeasonSuggestion(race, suggestion)));
  const available = [...races, ...suggestions].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const selected = available.filter(r=>{
    if(filter==="all")return true;
    if(filter==="approved")return r.category==="ski_approved";
    if(filter==="candidate")return r.category==="ski_candidate";
    const name=persons.find(p=>p.id===filter)?.name.toLowerCase()??"";
    return (links[r.id]??[]).includes(filter) || (r.category==="ski_candidate" && eligibleForPerson(r.description,name));
  });
  async function saveSuggestion(race: Race, ids: string[]) {
    const suggestion = suggestions.find(item => item.id === race.id);
    if (!suggestion) return race.id;
    const familyId = children.find(person => person.id === ids[0])?.family_id;
    if (!familyId || ids.some(id => !children.some(person => person.id === id && person.family_id === familyId))) {
      throw Error("Deltagarna måste tillhöra samma familj.");
    }
    const externalId = suggestion.external_id + "-" + familyId;
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("family-hub:season:" + externalId));
    const hex = Array.from(new Uint8Array(hash).slice(0, 16), byte => byte.toString(16).padStart(2, "0")).join("");
    const id = hex.replace(/^(........)(....)(....)(....)(............)$/, "$1-$2-$3-$4-$5");
    const { error } = await supabase.from("calendar_events").upsert({
      id, family_id: familyId, external_id: externalId, title: suggestion.title,
      starts_at: suggestion.starts_at, ends_at: suggestion.ends_at, location: suggestion.location,
      category: suggestion.category, source: suggestion.source, description: suggestion.description
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw Error(error.message);
    return id;
  }

  async function saveApproval(race: Race, ids: string[]) {
    const id = await saveSuggestion(race, ids);
    const participants = ids.map(person_id => {
      const familyId = children.find(person => person.id === person_id)?.family_id;
      return { event_id: id, person_id, ...(familyId ? { family_id: familyId } : {}) };
    });
    const { error: linkError } = await supabase.from("event_persons")
      .upsert(participants, { onConflict: "event_id,person_id", ignoreDuplicates: true });
    if (linkError) throw Error("Kunde inte koppla deltagare: " + linkError.message);
    const {error:updateError}=await supabase.from("calendar_events").update({category:"ski_approved"}).eq("id",id).select("id").single();
    if (updateError) throw Error("Deltagarna sparades men tävlingen kunde inte godkännas: " + updateError.message);
    return id;
  }

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
  async function approve(race:Race, ids:string[], openCalendar = false) {
    setError("");setNotice("");setBusy(race.id);
    if(!ids.length || ids.some(id=>!children.some(p=>p.id===id&&eligibleForPerson(race.description,p.name)))){setError("Välj en deltagare som tävlingen gäller för.");setBusy(null);return;}
    try {
      const id = await saveApproval(race, ids);
      setNotice("Aktiviteten visas nu i huvudkalendern.");
      if (openCalendar) { window.location.assign("/calendar?filter=races&event=" + encodeURIComponent(id)); return; }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Kunde inte godkänna aktiviteten.");
    }
    await reload();setBusy(null);
  }
  async function approveSelected() {
    setError("");setNotice("");setBusy("bulk");
    const chosen=available.filter(r=>selectedRaceIds.includes(r.id)&&r.category==="ski_candidate");
    if(!chosen.length){setBusy(null);return;}
    const failures:string[]=[];
    let count=0;
    let firstApprovedId: string | null = null;
    for(const race of chosen){
      const eligible=children.filter(p=>eligibleForPerson(race.description,p.name));
      if(!eligible.length){failures.push(race.title+": oklar åldersklass");continue;}
      try {
        const id = await saveApproval(race, eligible.map(person => person.id));
        count++;
        firstApprovedId ??= id;
      } catch (failure) {
        failures.push(race.title + ": " + (failure instanceof Error ? failure.message : "Kunde inte spara."));
      }
    }
    setSelectedRaceIds([]);await reload();
    setNotice(count+" tävlingar godkända för matchande åldersklasser.");
    if(failures.length)setError("Vissa kunde inte godkännas: "+failures.join("; "));
    else if (firstApprovedId) { window.location.assign("/calendar?filter=races&event=" + encodeURIComponent(firstApprovedId)); return; }
    setBusy(null);
  }
  async function removeParticipant(race:Race, personId:string) {
    setBusy(race.id);setError("");setNotice("");
    const {error:removeError}=await supabase.from("event_persons").delete().eq("event_id",race.id).eq("person_id",personId);
    if(removeError)setError("Kunde inte ta bort deltagaren: "+removeError.message);
    else {
      const remaining=(links[race.id]??[]).filter(id=>id!==personId);
      if(!remaining.length){
        const {error:changeError}=await supabase.from("calendar_events").update({category:"ski_candidate"}).eq("id",race.id);
        if(changeError)setError("Deltagaren togs bort men tävlingen kunde inte återställas: "+changeError.message);
      }
      setNotice("Deltagandet har uppdaterats.");await reload();
    }
    setBusy(null);
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
      <p>Välj åkare på ett förslag för att lägga aktiviteten i huvudkalendern.</p>
      {error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}
      {notice&&<p role="status" style={{color:"#166534"}}>{notice}</p>}
      <section style={{background:"white",padding:20,borderRadius:16}}>
        <h2>Tävlingsöversikt</h2>
        <select aria-label="Filtrera tävlingar" value={filter} onChange={e=>setFilter(e.target.value)} style={{...styles,maxWidth:300,marginBottom:14}}>
          <option value="all">Alla tävlingar</option><option value="candidate">Möjliga tävlingar</option><option value="approved">Godkända tävlingar</option>
          {children.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {selectedRaceIds.length>0&&<div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:14}}>
          <strong>{selectedRaceIds.length} markerade</strong>
          <button disabled={busy!==null} onClick={()=>void approveSelected()} style={{padding:"10px 14px",background:"#dcf3e6",border:0,borderRadius:8,cursor:"pointer"}}>Lägg markerade i huvudkalendern för rätt åldersklass</button>
          <button onClick={()=>setSelectedRaceIds([])} style={{padding:10}}>Rensa val</button>
        </div>}
        {loading?<p>Laddar...</p>:selected.length===0?<p>Inga tävlingar matchar det valda filtret.</p>:
          <div style={{display:"grid",gap:12}}>{selected.map(r=>{
            const sourceLink = seasonSuggestions.find(item => matchesSeasonSuggestion(r, item))?.url;
            const allowed=children.filter(p=>eligibleForPerson(r.description,p.name));
            const assigned=children.filter(p=>(links[r.id]??[]).includes(p.id));
            return <article key={r.id} style={{border:"1px solid #e2e8f0",borderRadius:12,padding:15}}>
              {r.category==="ski_candidate"&&<label style={{display:"inline-flex",gap:8,alignItems:"center",marginRight:10}}>
                <input type="checkbox" checked={selectedRaceIds.includes(r.id)} onChange={e=>setSelectedRaceIds(old=>e.target.checked?[...old,r.id]:old.filter(id=>id!==r.id))}/> Markera
              </label>}
              <strong>{r.title}</strong>
              <div style={{fontSize:14,color:"#475569",marginTop:7}}>{seasonDate.format(new Date(r.starts_at))} – {seasonDate.format(new Date(Date.parse(r.ends_at) - (r.source === "ssf_stomprogram" ? 1 : 0)))} · {r.location||"Ort ej angiven"} · {r.description||"Klass ej angiven"}</div>
              {sourceLink && <p><a href={sourceLink} target="_blank" rel="noreferrer">Visa källa ↗</a></p>}
              <p style={{fontSize:13}}>{r.category==="ski_approved"?"Godkänd för "+assigned.map(p=>p.name).join(", "):"Möjlig tävling – inte i familjekalendern"}</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {r.category === "ski_approved" && <a href={"/calendar?filter=races&event=" + encodeURIComponent(r.id)} style={{padding:"10px 12px",borderRadius:8,background:"#315e9c",color:"white",textDecoration:"none"}}>Visa i huvudkalendern →</a>}
                {r.category==="ski_candidate"?allowed.map(p=><button key={p.id} disabled={busy!==null} onClick={()=>void approve(r,[p.id],true)} style={{padding:"10px 12px",border:0,borderRadius:8,background:"#dcf3e6",cursor:"pointer"}}>Välj för {p.name} → huvudkalendern</button>):<>
                  {allowed.filter(p=>!assigned.some(a=>a.id===p.id)).map(p=><button key={p.id} disabled={busy!==null} onClick={()=>void approve(r,[p.id])} style={{padding:"10px 12px",border:0,borderRadius:8,background:"#dcf3e6",cursor:"pointer"}}>Lägg till {p.name}</button>)}
                  {assigned.map(p=><button key={p.id} disabled={busy!==null} onClick={()=>void removeParticipant(r,p.id)} style={{padding:"10px 12px",border:"1px solid #cbd5e1",borderRadius:8,background:"white",cursor:"pointer"}}>Ta bort {p.name}</button>)}
                  <button disabled={busy!==null} onClick={()=>void unapprove(r)} style={{padding:"10px 12px",border:"1px solid #cbd5e1",borderRadius:8,background:"white",cursor:"pointer"}}>Ta bort från huvudkalendern</button>
                </>}
              </div>
            </article>;
          })}</div>}
      </section>
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
      <details style={{marginTop:18}}><summary>Kalenderkällor, träning och import</summary>
      <p><a href="/ski/connections" style={{color:"#315e9c",fontWeight:700}}>Anslut Skidförbundet, Region 5, Svenskalag och SportsAdmin →</a></p>
      <p><a href="/ski/training" style={{color:"#315e9c",fontWeight:700}}>Planera alpina träningar och flerdagarsläger för Elsa och Alva →</a></p>
      <p><a href="/ski/status" style={{color:"#315e9c",fontWeight:700}}>Kontrollera källor och synkroniseringsstatus →</a></p>
      <p><a href="/ski/sources" style={{color:"#315e9c",fontWeight:700}}>Visa relevanta tävlingar och läger från Skidförbundet →</a></p>
      <p><a href="/ski/import" style={{color:"#315e9c",fontWeight:700}}>Importera tävlingar från kalenderfil (.ics) →</a></p>
      </details>
    </div>
  </main>;
}
