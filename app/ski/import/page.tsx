"use client";
import { useState } from "react";
import { supabase } from "../../supabase";
export default function ImportSki() {
  const [ics,setIcs]=useState("");
  const [age,setAge]=useState("U14/U16");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [preview,setPreview]=useState<{title:string;date:string}[]>([]);
  async function submit(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setMessage("");
    try {
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw Error("Logga in först.");
      const lines=ics.replace(/\r\n/g,"\n").replace(/\n[ \t]/g,"").split("\n");
      const blocks:string[][]=[];let current:string[]|null=null;
      for(const line of lines) {
        if(line==="BEGIN:VEVENT")current=[];
        else if(line==="END:VEVENT"&&current){blocks.push(current);current=null;}
        else if(current)current.push(line);
      }
      const get=(lines:string[],key:string)=>lines.find(line=>line.split(":")[0].split(";")[0].toUpperCase()===key)?.split(":").slice(1).join(":").trim()||"";
      const parse=(s:string)=>{
        if(!/^\d{8}(T\d{6}Z?)?$/.test(s))return null;
        const day=s.slice(0,4)+"-"+s.slice(4,6)+"-"+s.slice(6,8);
        if(s.length===8)return new Date(day+"T09:00:00").toISOString();
        const time=s.slice(9,11)+":"+s.slice(11,13)+":"+s.slice(13,15);
        return new Date(day+"T"+time+(s.endsWith("Z")?"Z":"")).toISOString();
      };
      const records=blocks.flatMap(lines=>{
        try{
          const title=get(lines,"SUMMARY"),uid=get(lines,"UID");
          const start=parse(get(lines,"DTSTART")),end=parse(get(lines,"DTEND"));
          if(!title||!uid||!start)return [];
          const finish=end||new Date(new Date(start).getTime()+3600000).toISOString();
          if(new Date(finish)<=new Date(start))return [];
          return [{title,starts_at:start,ends_at:finish,location:get(lines,"LOCATION")||null,category:"ski_candidate",source:"ski_ics",external_id:uid,description:age+" · Kalenderimport"}];
        }catch{return [];}
      });
      if(!records.length)throw Error("Inga giltiga poster med UID, datum och namn hittades.");
      const unique=[...new Map(records.map(item=>[item.external_id,item])).values()];
      const {data:existing,error:readError}=await supabase.from("calendar_events").select("id,external_id,starts_at,ends_at,title,location,category").eq("source","ski_ics").in("external_id",unique.map(item=>item.external_id));
      if(readError)throw readError;
      const known=new Set((existing||[]).map(item=>item.external_id));
      setPreview(unique.map(item=>({title:item.title,date:new Date(item.starts_at).toLocaleDateString("sv-SE")})));
      const fresh=unique.filter(item=>!known.has(item.external_id));
      if(fresh.length){const {error}=await supabase.from("calendar_events").insert(fresh);if(error)throw error;}
      let changed=0;
      const failures:string[]=[];
      for(const item of unique.filter(item=>known.has(item.external_id))){
        const old=(existing||[]).find(row=>row.external_id===item.external_id);
        if(!old)continue;
        if(old.title===item.title&&old.starts_at===item.starts_at&&old.ends_at===item.ends_at&&old.location===item.location)continue;
        // Keep approved events unchanged until the family explicitly reviews changes.
        if(old.category==="ski_approved"){failures.push(item.title+" har ändrats i källan och behöver granskas manuellt.");continue;}
        const {error:updateError}=await supabase.from("calendar_events").update({title:item.title,starts_at:item.starts_at,ends_at:item.ends_at,location:item.location}).eq("id",old.id).eq("category","ski_candidate");
        if(updateError)failures.push(item.title+": "+updateError.message);else changed++;
      }
      setMessage(fresh.length+" nya förslag, "+changed+" uppdaterade förslag, "+(unique.length-fresh.length-changed)+" redan kända. "+failures.join(" "));
      setIcs("");
    }catch(error){setMessage(error instanceof Error?error.message:"Importen misslyckades.");}
    setBusy(false);
  }
  return <main style={{fontFamily:"Arial,sans-serif",background:"#f4f6fa",minHeight:"100vh",padding:24,color:"#17253b"}}>
    <div style={{maxWidth:720,margin:"auto",background:"white",padding:24,borderRadius:16}}>
      <a href="/ski">← Till tävlingarna</a>
      <h1>Importera alpintävlingar</h1>
      <p>Importera en iCalendar-export (.ics) som förslag. Inga tävlingar förs över till huvudkalendern utan godkännande.</p>
      <p>Denna import är manuell. Automatisk synkronisering kräver att vi ansluter en officiell källa.</p>
      <form onSubmit={submit} style={{display:"grid",gap:16}}>
        <label>Åldersklass<br/><select value={age} onChange={e=>setAge(e.target.value)} style={{padding:12,width:"100%"}}><option>U14/U16</option><option>U14</option><option>U16</option></select></label>
        <label>Klistra in innehållet från .ics-filen<textarea required value={ics} onChange={e=>setIcs(e.target.value)} rows={12} style={{width:"100%",boxSizing:"border-box",padding:12}} placeholder="BEGIN:VCALENDAR..."/></label>
        <button disabled={busy} style={{padding:14,background:"#315e9c",color:"white",border:0,borderRadius:10}}>{busy?"Importerar...":"Importera tävlingar"}</button>
      </form>
      {message&&<p role="status">{message}</p>}
      {preview.length>0&&<section><h2>Senast lästa aktiviteter</h2><ul>{preview.slice(0,25).map((item,i)=><li key={i}>{item.date} – {item.title}</li>)}</ul></section>}
    </div>
  </main>;
}