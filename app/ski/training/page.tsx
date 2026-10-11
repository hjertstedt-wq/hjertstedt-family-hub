"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

type Person={id:string;name:string};
type Session={id:string;title:string;starts_at:string;ends_at:string;location:string|null;description:string|null};
const field:React.CSSProperties={padding:11,border:"1px solid #cbd5e1",borderRadius:9,width:"100%",boxSizing:"border-box",fontSize:16};
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
export default function SkiTrainingPage(){
 const [people,setPeople]=useState<Person[]>([]);
 const [sessions,setSessions]=useState<Session[]>([]);
 const [links,setLinks]=useState<Record<string,string[]>>({});
 const [name,setName]=useState("Alpint träningsläger");
 const [date,setDate]=useState(today());
 const [days,setDays]=useState(1);
 const [start,setStart]=useState("09:00");
 const [end,setEnd]=useState("12:00");
 const [place,setPlace]=useState("");
 const [kind,setKind]=useState("Snöträning");
 const [notes,setNotes]=useState("");
 const [selected,setSelected]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true);
 async function load(){
  const [p,e,l]=await Promise.all([
   supabase.from("persons").select("id,name").order("name"),
   supabase.from("calendar_events").select("id,title,starts_at,ends_at,location,description").eq("category","ski_training").order("starts_at",{ascending:true}).limit(300),
   supabase.from("event_persons").select("event_id,person_id")
  ]);
  if(p.error||e.error||l.error)setError(p.error?.message||e.error?.message||l.error?.message||"Kunde inte läsa träningspass");
  else{
   const children=(p.data??[]).filter(x=>/elsa|alva/i.test(x.name));
   setPeople(children);setSessions(e.data??[]);
   const mapped:Record<string,string[]>={};
   for(const link of l.data??[])(mapped[link.event_id]??=[]).push(link.person_id);
   setLinks(mapped);
   setSelected(prev=>prev.length?prev:children.map(x=>x.id));
  }
  setLoading(false);
 }
 useEffect(()=>{let active=true;void supabase.auth.getUser().then(({data})=>{if(!active)return;if(!data.user){window.location.replace("/login");return;}void load();});return()=>{active=false;};},[]);
 async function save(e:React.FormEvent){
  e.preventDefault();setError("");setNotice("");
  if(!selected.length){setError("Välj Elsa, Alva eller båda.");return;}
  if(!name.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(days)||days<1||days>14||start>=end){setError("Ange 1–14 dagar och en sluttid efter starttiden.");return;}
  setBusy(true);
  const created:string[]=[];
  try{
   for(let i=0;i<days;i++){
    const day=new Date(date+"T12:00:00");day.setDate(day.getDate()+i);
    const stamp=[day.getFullYear(),String(day.getMonth()+1).padStart(2,"0"),String(day.getDate()).padStart(2,"0")].join("-");
    const starts=new Date(stamp+"T"+start+":00");
    const ends=new Date(stamp+"T"+end+":00");
    const {data:record,error:insertError}=await supabase.from("calendar_events").insert({
      title:days>1?name.trim()+" – pass "+(i+1):name.trim(),
      starts_at:starts.toISOString(),ends_at:ends.toISOString(),
      location:place.trim()||null,category:"ski_training",source:"manual",
      description:kind+(notes.trim()?" · "+notes.trim():"")
    }).select("id").single();
    if(insertError||!record)throw new Error(insertError?.message||"Kunde inte spara pass");
    created.push(record.id);
    const {error:linkError}=await supabase.from("event_persons").insert(selected.map(person_id=>({event_id:record.id,person_id})));
    if(linkError)throw new Error(linkError.message);
   }
   setNotice(created.length+" träningspass sparade i familjekalendern.");await load();
  }catch(err){
   if(created.length){
    const {error:rollbackError}=await supabase.from("calendar_events").delete().in("id",created);
    if(rollbackError){setError("Delvis sparat: "+created.length+" pass skapades men kunde inte återställas automatiskt. Kontrollera kalendern innan du försöker igen. "+rollbackError.message);return;}
   }
   setError("Kunde inte skapa hela lägret. Eventuella nyskapade pass har återställts. "+(err instanceof Error?err.message:"Okänt fel"));
  }finally{setBusy(false);}
 }
 return <main style={{minHeight:"100vh",background:"#f4f6fa",padding:"20px 14px",fontFamily:"Arial,sans-serif",color:"#17253b"}}>
  <div style={{maxWidth:850,margin:"0 auto"}}>
   <a href="/ski" style={{color:"#315e9c"}}>← Alpint – tävlingar</a>
   <h1>Alpint – träning och läger</h1>
   <p>Planera ett träningspass eller skapa ett läger med ett pass per dag. Aktiviteterna läggs i familjekalendern och kopplas till valda åkare.</p>
   {error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}
   {notice&&<p role="status" style={{color:"#166534"}}>{notice}</p>}
   <section style={{background:"white",borderRadius:16,padding:20}}>
    <h2>Nytt träningspass eller läger</h2>
    <form onSubmit={save} style={{display:"grid",gap:13}}>
     <label>Rubrik<input required value={name} onChange={e=>setName(e.target.value)} style={field}/></label>
     <label>Typ<select value={kind} onChange={e=>setKind(e.target.value)} style={field}>{["Snöträning","Slalom","Storslalom","Super-G","Störtlopp","Fysträning","Teknikträning","Träningsläger","Övrigt"].map(x=><option key={x}>{x}</option>)}</select></label>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
      <label>Första datum<input type="date" required value={date} onChange={e=>setDate(e.target.value)} style={field}/></label>
      <label>Antal dagar<input type="number" min={1} max={14} required value={days} onChange={e=>setDays(Number(e.target.value))} style={field}/></label>
      <label>Starttid<input type="time" required value={start} onChange={e=>setStart(e.target.value)} style={field}/></label>
      <label>Sluttid<input type="time" required value={end} onChange={e=>setEnd(e.target.value)} style={field}/></label>
     </div>
     <label>Plats<input value={place} onChange={e=>setPlace(e.target.value)} placeholder="Backe, ort eller anläggning" style={field}/></label>
     <label>Anteckningar<textarea value={notes} onChange={e=>setNotes(e.target.value)} style={field} rows={3}/></label>
     <fieldset style={{border:"1px solid #e2e8f0",borderRadius:10}}><legend>Deltagare</legend>
      {people.map(p=><label key={p.id} style={{display:"inline-flex",alignItems:"center",gap:8,margin:"8px 20px 8px 0"}}><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,p.id]:old.filter(x=>x!==p.id))}/>{p.name}</label>)}
      {!people.length&&<p>Inga Elsa-/Alva-profiler hittades i databasen. Kontrollera familjens personer.</p>}
     </fieldset>
     <button disabled={busy||!people.length} style={{background:"#315e9c",color:"white",border:0,borderRadius:10,padding:14,fontSize:16}}>{busy?"Sparar...":"Spara träningspass"}</button>
    </form>
   </section>
   <section style={{background:"white",borderRadius:16,padding:20,marginTop:16}}>
    <h2>Planerade alpina träningar</h2>
    {loading?<p>Laddar...</p>:sessions.length===0?<p>Inga träningspass registrerade ännu.</p>:sessions.map(s=><article key={s.id} style={{borderTop:"1px solid #e2e8f0",padding:"12px 0"}}>
     <strong>{s.title}</strong><div>{new Date(s.starts_at).toLocaleString("sv-SE",{dateStyle:"medium",timeStyle:"short"})}–{new Date(s.ends_at).toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"})}</div>
     <div style={{fontSize:14,color:"#64748b"}}>{s.location||"Plats saknas"} · {s.description||""}</div>
     <div style={{fontSize:14}}>Deltagare: {people.filter(p=>(links[s.id]??[]).includes(p.id)).map(p=>p.name).join(", ")||"Ej angivna"}</div>
    </article>)}
   </section>
  </div>
 </main>;
}
