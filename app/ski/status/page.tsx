"use client";
import { useEffect,useState } from "react";
type Source={id:string;name:string;url:string;reachable:boolean;httpStatus:number|null;checkedAt:string;syncActive:boolean};
export default function SkiStatus(){
 const [sources,setSources]=useState<Source[]>([]);const [error,setError]=useState("");const [loading,setLoading]=useState(true);
 async function refresh(){setLoading(true);setError("");try{const response=await fetch("/api/ski/source-status",{cache:"no-store"});if(!response.ok)throw Error("Servern svarade inte.");const json=await response.json();setSources(json.sources||[]);}catch(e){setError(e instanceof Error?e.message:"Kunde inte kontrollera källan.");}setLoading(false);}
 useEffect(()=>{void refresh();},[]);
 return <main style={{minHeight:"100vh",background:"#f4f6fa",fontFamily:"Arial,sans-serif",padding:24,color:"#17253b"}}><div style={{maxWidth:740,margin:"auto",background:"white",padding:24,borderRadius:16}}>
 <a href="/ski">← Till skidmodulen</a><h1>Skidkällor – driftstatus</h1>
 <p>Här ser du om den officiella kalendern går att nå. Att en källa svarar innebär <strong>inte</strong> att automatisk import är aktiverad.</p>
 {error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}
 {loading?<p>Kontrollerar...</p>:sources.map(source=><section key={source.id} style={{border:"1px solid #e2e8f0",padding:16,borderRadius:12,marginBottom:12}}>
 <h2 style={{fontSize:18}}>{source.name}</h2>
 <p>Anslutning: <strong>{source.reachable?"Källan svarar":"Kunde inte verifieras"}</strong></p>
 <p>Automatisk synkronisering: <strong>Inte ansluten</strong></p>
 <p style={{fontSize:13,color:"#64748b"}}>Kontrollerad: {new Date(source.checkedAt).toLocaleString("sv-SE")}</p>
 <a href={source.url} target="_blank" rel="noopener noreferrer">Öppna originalkalendern ↗</a>
 </section>)}
 <button onClick={()=>void refresh()} disabled={loading} style={{padding:12,borderRadius:10,border:0,background:"#315e9c",color:"white"}}>Kontrollera igen</button>
 </div></main>;
}