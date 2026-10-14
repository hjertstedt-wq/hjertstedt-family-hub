"use client";
import { useState } from "react";
import { supabase } from "../supabase";
type Event = {uid:string;title:string;starts_at:string;ends_at:string|null;location:string|null};
export default function ImportSourcesPage(){
 const [source,setSource]=useState("svenskalag");
 const [items,setItems]=useState<Event[]>([]);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 async function preview(file:File){
  setBusy(true);setMessage("");setItems([]);
  try{
   if(file.size>3_000_000)throw Error("Filen är för stor.");
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw Error("Logga in för att förhandsgranska.");
   const response=await fetch("/api/integrations/preview",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"text/calendar"},body:await file.text()});
   const data=await response.json();
   if(!response.ok)throw Error(data.error??"Kunde inte läsa kalenderfilen.");
   setItems(data.events??[]);
   setMessage(data.count+" engångsaktiviteter hittades. Inget har sparats. Återkommande aktiviteter ingår ännu inte.");
  }catch(e){setMessage(e instanceof Error?e.message:"Importen misslyckades.");}
  finally{setBusy(false);}
 }
 return <main style={{minHeight:"100vh",background:"#f4f6fa",padding:"28px 16px",fontFamily:"Arial,sans-serif",color:"#17253b"}}><div style={{maxWidth:820,margin:"auto"}}>
  <a href="/connections">← Anslutningar</a><h1>Importera idrottskalendrar</h1>
  <p>Testa kalenderfiler från Svenskalag eller SportAdmin. Förhandsgranskningen ändrar inga aktiviteter och lagrar inte filen i databasen.</p>
  <section style={{background:"white",borderRadius:16,padding:20}}>
   <label>Källa<select value={source} onChange={e=>setSource(e.target.value)} style={{display:"block",padding:12,margin:"10px 0",width:"100%",maxWidth:360}}><option value="svenskalag">Svenskalag</option><option value="sportadmin">SportAdmin</option><option value="skidor_ta">Skidförbundet – kalenderfil</option></select></label>
   <label>Välj en .ics-fil<input type="file" accept=".ics,text/calendar" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void preview(file);}} style={{display:"block",marginTop:12}} /></label>
   <p role="status">{busy?"Läser kalenderfil...":message}</p>
  </section>
  {items.length>0&&<section style={{background:"white",borderRadius:16,padding:20,marginTop:16}}><h2>Förhandsgranskning – {source}</h2><div style={{display:"grid",gap:10}}>{items.map((item,i)=><article key={item.uid+":"+i} style={{borderBottom:"1px solid #e2e8f0",paddingBottom:10}}><strong>{item.title}</strong><p style={{margin:"5px 0",fontSize:14}}>{item.starts_at} · {item.location??"Plats saknas"}</p></article>)}</div></section>}
  <p style={{color:"#64748b",fontSize:13}}>Automatisk synkronisering, sparande och stöd för återkommande händelser aktiveras först efter databas- och behörighetstest.</p>
 </div></main>;
}
