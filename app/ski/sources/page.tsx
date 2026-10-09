"use client";
import { useEffect,useState } from "react";
const SOURCE="https://ta.skidor.com/EventCalendar.aspx?orgid=80";
type Item={id:string;name:string;age:string;kind:string;organizer:string};
const candidates:Item[]=[
{id:"reg5-juvass",name:"Region 5 – Juvass",age:"U16",kind:"Träningsläger",organizer:"Region 5"},
{id:"reg5-sno",name:"Region 5 – SNÖ Oslo",age:"U16",kind:"Träningsläger",organizer:"Region 5"},
{id:"reg5-stoten",name:"Region 5 – Stöten",age:"U16",kind:"Träningsläger",organizer:"Region 5"},
{id:"reg5-usm",name:"Region 5 – USM-deltävling",age:"U16",kind:"Tävling",organizer:"Region 5"},
{id:"reg5-fart",name:"Region 5 – fartläger Fjätervålen",age:"U14/U16",kind:"Träningsläger",organizer:"Region 5"},
{id:"gm",name:"Götalandsmästerskapen",age:"Åldersklass ej verifierad",kind:"Tävling",organizer:"Kontrollera arrangör"},
{id:"lvc",name:"Götalandsfinal LVC",age:"Åldersklass ej verifierad",kind:"Tävling",organizer:"Kontrollera arrangör"},
{id:"mvc",name:"Region 5 – Regionsfinal MVC",age:"Åldersklass ej verifierad",kind:"Tävling",organizer:"Region 5"},
{id:"fhc",name:"Frida Hansdotter Cup",age:"Åldersklass ej verifierad",kind:"Tävling",organizer:"Kontrollera arrangör"}
];
type Check={reachable:boolean;checkedAt:string};
export default function SourcePage(){
 const [check,setCheck]=useState<Check|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 async function refresh(){
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/ski/source-status",{cache:"no-store"});
   if(!r.ok)throw Error("Kunde inte kontrollera källan");
   const data=await r.json();
   setCheck(data.sources?.[0]??null);
  }catch(e){setError(e instanceof Error?e.message:"Källkontroll misslyckades");}
  finally{setBusy(false);}
 }
 useEffect(()=>{void refresh();const interval=setInterval(()=>{void refresh();},60*60*1000);return()=>clearInterval(interval);},[]);
 return <main style={{fontFamily:"Arial,sans-serif",background:"#f4f6fa",minHeight:"100vh",padding:"24px 14px",color:"#17253b"}}><div style={{maxWidth:900,margin:"auto"}}>
 <a href="/ski">← Till skidmodulen</a><h1>Preliminär tävlings- och lägerlista</h1>
 <p>Detta är en bevakningslista med möjliga aktiviteter, inte verifierade anmälningar eller tävlingsdatum. Datum och plats visas först när vi kan styrka dem mot källan. En aktivitet kan ändras eller utgå.</p>
 <section style={{background:"white",padding:18,borderRadius:12,marginBottom:16}}>
 <strong>Källstatus</strong><p>{check?(check.reachable?"Skidförbundets webbplats svarar":"Källan kunde inte nås"):"Ingen aktuell kontroll ännu"}</p>
 {check&&<p style={{fontSize:13,color:"#64748b"}}>Senast kontrollerad: {new Date(check.checkedAt).toLocaleString("sv-SE")}</p>}
 <p style={{fontSize:13}}>Anslutningen kontrolleras varje timme medan denna sida är öppen. Detta verifierar endast webbplatsens tillgänglighet, inte tävlingsuppgifterna. Automatisk datumverifiering är ännu inte ansluten.</p>
 {error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}
 <button disabled={busy} onClick={()=>void refresh()} style={{padding:10,borderRadius:8,border:0,background:"#315e9c",color:"white"}}>{busy?"Kontrollerar…":"Kontrollera källa"}</button>
 <p><a href={SOURCE} target="_blank" rel="noopener noreferrer">Öppna officiella tävlingskalendern ↗</a></p>
 </section>
 <div style={{display:"grid",gap:12}}>{candidates.map(e=><article key={e.id} style={{background:"white",borderRadius:12,padding:18}}>
 <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><strong>{e.name}</strong><span style={{background:"#f1f5f9",borderRadius:12,padding:"5px 10px",fontSize:13}}>Ej fastställd</span></div>
 <p style={{color:"#475569"}}>{e.kind} · {e.age}</p>
 <p>Datum: <strong>Ej verifierat</strong> · Plats: <strong>Ej verifierad</strong></p>
 <p style={{fontSize:13,color:"#64748b"}}>Preliminär bevakningspost · {e.organizer}. Uppgifterna behöver kontrolleras.</p>
 </article>)}</div>
 <p style={{marginTop:18}}><a href="/ski/import">Importera verifierade aktiviteter via kalenderfil →</a></p>
 </div></main>;
}