"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Event = { id:string; title:string; starts_at:string; ends_at:string; location:string|null; source?:string };
const members = [
  { name:"Oskar", role:"Förälder", color:"#dcf3e6" },
  { name:"Magdalena", role:"Förälder", color:"#f3e8ff" },
  { name:"Elsa", role:"Barn", color:"#dceafd" },
  { name:"Alva", role:"Barn", color:"#fce3ed" },
];
export default function FamilyAssistant() {
  const [events,setEvents]=useState<Event[]>([]);
  const [status,setStatus]=useState("Laddar familjens aktiviteter...");
  const [view,setView]=useState<"week"|"fortnight">("week");
  useEffect(()=>{
    let active=true;
    async function load(){
      const {data:{session}}=await supabase.auth.getSession();
      if(!session){window.location.replace("/login");return;}
      const [db,cloud]=await Promise.all([
        supabase.from("calendar_events").select("id,title,starts_at,ends_at,location,source").neq("category","ski_candidate").gte("ends_at",new Date().toISOString()).order("starts_at").limit(500),
        fetch("/api/icloud/events",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"}).then(async r=>r.ok?await r.json():{events:[],error:"iCloud kunde inte hämtas"}).catch(()=>({events:[],error:"iCloud kunde inte hämtas"}))
      ]);
      if(!active)return;
      const combined=[...(db.data??[]),...(cloud.events??[])].filter((e:Event)=>e.starts_at&&e.ends_at);
      const unique=new Map<string,Event>();
      for(const e of combined){const key=[e.title.toLowerCase().trim(),e.starts_at,e.ends_at].join("|");if(!unique.has(key))unique.set(key,e);}
      setEvents([...unique.values()].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)));
      setStatus(cloud.error?"Visar tillgängliga aktiviteter. "+cloud.error:"Aktiviteter uppdaterade från Family Hub och iCloud.");
    }
    void load();
    return ()=>{active=false;};
  },[]);
  const horizon=view==="week"?7:14;
  const upcoming=useMemo(()=>{const now=Date.now(),end=now+horizon*86400000;return events.filter(e=>new Date(e.ends_at).getTime()>=now&&new Date(e.starts_at).getTime()<end);},[events,horizon]);
  const conflicts=useMemo(()=>{
    const found:{a:Event;b:Event}[]=[];
    for(let i=0;i<upcoming.length;i++)for(let j=i+1;j<upcoming.length;j++){
      const a=upcoming[i],b=upcoming[j];
      if(new Date(a.starts_at)<new Date(b.ends_at)&&new Date(b.starts_at)<new Date(a.ends_at)) found.push({a,b});
      if(found.length>=12)return found;
    }
    return found;
  },[upcoming]);
  const fmt=(s:string)=>new Date(s).toLocaleString("sv-SE",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  return <main style={{background:"#f4f6fa",minHeight:"100vh",padding:"24px 14px",fontFamily:"Arial,sans-serif",color:"#17253b"}}>
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <a href="/" style={{color:"#315e9c"}}>← Familjens startsida</a>
      <h1>Familjens översikt</h1>
      <p>Familjeprofiler och smart planeringshjälp. Inga kalenderaktiviteter ändras.</p>
      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
        {members.map(m=><div key={m.name} style={{background:m.color,borderRadius:14,padding:18}}><strong>{m.name}</strong><div>{m.role}</div></div>)}
      </section>
      <section style={{background:"white",padding:20,borderRadius:16,marginTop:20}}>
        <h2>Smart familjeassistent</h2>
        <p role="status">{status}</p>
        <label>Planeringsperiod <select value={view} onChange={e=>setView(e.target.value as "week"|"fortnight")} style={{marginLeft:8,padding:8}}><option value="week">7 dagar</option><option value="fortnight">14 dagar</option></select></label>
        <h3>{upcoming.length} kommande aktiviteter</h3>
        <p>{conflicts.length===0?"Inga tidsöverlappningar upptäckta.":conflicts.length+" möjliga tidsöverlappningar. Kontrollera om olika familjemedlemmar berörs."}</p>
        {conflicts.map(({a,b},i)=><div key={i} style={{borderLeft:"3px solid #eab308",padding:"8px 12px",margin:"8px 0",background:"#fffaf0"}}><strong>{a.title}</strong> och <strong>{b.title}</strong><div style={{fontSize:13}}>{fmt(a.starts_at)} / {fmt(b.starts_at)}</div></div>)}
        <h3>Aktiviteter</h3>
        {upcoming.slice(0,35).map(e=><div key={e.id} style={{padding:"10px 0",borderBottom:"1px solid #e5e7eb"}}><strong>{e.title}</strong><div style={{fontSize:13,color:"#64748b"}}>{fmt(e.starts_at)} {e.location?" · "+e.location:""}</div></div>)}
        <p style={{fontSize:13,color:"#64748b"}}>Assistenten använder kalenderregler, inte en generativ AI-modell. Överlappningar innebär inte alltid en verklig konflikt. Återkommande iCloud-händelser kan ännu behöva kompletteras.</p>
      </section>
      <p><a href="/calendar" style={{color:"#315e9c"}}>Öppna familjekalendern →</a></p>
    </div>
  </main>;
}
