"use client";
import {useMemo,useState} from "react";
import {providers,type ProviderDefinition} from "../lib/providers";
import {supabase} from "../supabase";
const theme={ink:"#172b44",muted:"#62748b",accent:"#315e9c"};
function ProviderCard({provider}:{provider:ProviderDefinition}){
 const ready=provider.status==="partial";
 const label=provider.status==="planned"?"Kommer senare":provider.status==="available"?"Tillgänglig":"Delvis tillgänglig";
 return <article style={{background:"#fff",border:"1px solid #e8edf4",borderRadius:20,padding:20,boxShadow:"0 6px 24px rgba(24,47,79,.04)",display:"flex",flexDirection:"column",gap:14}}>
  <div style={{display:"flex",alignItems:"center",gap:13}}>
   <div aria-hidden="true" style={{height:54,width:54,flexShrink:0,display:"grid",placeItems:"center",borderRadius:16,background:"#edf3fb",fontSize:25,color:theme.accent}}>{provider.icon}</div>
   <div style={{flex:1}}><h3 style={{margin:0,fontSize:18}}>{provider.name}</h3><div style={{fontSize:13,color:theme.muted,marginTop:5}}>{provider.category}</div></div>
  </div>
  <p style={{margin:0,color:theme.ink,lineHeight:1.5}}>{provider.description}</p>
  <p style={{fontSize:13,color:theme.muted,lineHeight:1.5,margin:0,flex:1}}>{provider.explanation}</p>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
   <span style={{fontSize:12,borderRadius:20,padding:"7px 10px",background:ready?"#eaf4ee":"#f1f4f8",color:ready?"#216344":"#58677b"}}>{label}</span>
   {ready?<a href={provider.href} style={{textDecoration:"none",background:theme.accent,color:"white",padding:"11px 15px",borderRadius:11,fontSize:14,fontWeight:700}}>Utforska →</a>:<a href={provider.href} target={provider.href.startsWith("http")?"_blank":"_self"} rel="noreferrer" style={{color:theme.accent,fontSize:14,fontWeight:600}}>Läs mer ↗</a>}
  </div>
 </article>;
}
export default function ConnectionsPage(){
 const [category,setCategory]=useState("Alla");
 const [step,setStep]=useState(1);
 const [signedIn,setSignedIn]=useState<boolean|null>(null);
 useState(()=>{if(typeof window!=="undefined")void supabase.auth.getUser().then(({data})=>setSignedIn(Boolean(data.user)));});
 const visible=useMemo(()=>providers.filter(p=>category==="Alla"||p.category===category),[category]);
 return <main style={{background:"linear-gradient(180deg,#eaf2fd 0%,#f5f7fb 320px)",minHeight:"100vh",fontFamily:"Arial,sans-serif",color:theme.ink,padding:"24px 16px 70px"}}>
  <div style={{maxWidth:1050,margin:"0 auto"}}>
   <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:40}}><a href="/" style={{color:theme.ink,textDecoration:"none",fontWeight:800,fontSize:18}}>✦ Family Hub</a><a href="/calendar" style={{color:theme.accent,fontWeight:600,fontSize:14}}>Min kalender →</a></nav>
   <div style={{maxWidth:740}}>
    <div style={{fontSize:12,fontWeight:800,letterSpacing:2,color:theme.accent}}>KOM IGÅNG</div>
    <h1 style={{fontSize:"clamp(30px,5vw,48px)",letterSpacing:"-1.6px",lineHeight:1.1,margin:"13px 0 15px"}}>Hela familjens liv.<br/>En enda kalender.</h1>
    <p style={{fontSize:18,color:theme.muted,lineHeight:1.55}}>Samla skola, träning, tävlingar och familjeplaner. Välj tjänsterna ni använder så hjälper vi er vidare.</p>
   </div>
   <div style={{display:"flex",gap:10,margin:"30px 0 26px",flexWrap:"wrap"}}>
    {["Skapa familj","Anslut appar","Planera tillsammans"].map((s,i)=><button key={s} onClick={()=>setStep(i+1)} style={{border:"1px solid "+(step===i+1?"#315e9c":"#d7e1ef"),borderRadius:30,padding:"11px 15px",background:step===i+1?"#315e9c":"white",color:step===i+1?"white":theme.ink,fontWeight:700,cursor:"pointer"}}>{i+1}. {s}</button>)}
   </div>
   {step===1?<section style={{background:"white",borderRadius:20,padding:24,marginBottom:25}}>
    <h2 style={{marginTop:0}}>Din familj börjar här</h2><p style={{color:theme.muted}}>Skapa ett konto och lägg sedan till familjemedlemmar. Familjekonton för flera kunder är under utveckling.</p>
    <a href={signedIn?"/family":"/login"} style={{display:"inline-block",background:theme.accent,color:"white",borderRadius:12,padding:"13px 18px",textDecoration:"none",fontWeight:700}}>{signedIn?"Visa familjen":"Logga in"} →</a>
    <button onClick={()=>setStep(2)} style={{border:0,background:"transparent",color:theme.accent,padding:14,fontWeight:700,cursor:"pointer"}}>Se anslutningar →</button>
   </section>:step===3?<section style={{background:"white",borderRadius:20,padding:24,marginBottom:25}}><h2 style={{marginTop:0}}>Planera tillsammans</h2><p style={{color:theme.muted}}>Se familjens kommande aktiviteter, träningar och eventuella krockar.</p><a href="/family" style={{color:theme.accent,fontWeight:700}}>Öppna familjeöversikten →</a></section>:null}
   <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:15,flexWrap:"wrap",marginBottom:18}}><h2 style={{fontSize:24,margin:0}}>Välj dina tjänster</h2><div style={{display:"flex",gap:6}}>{["Alla","Kalendrar","Idrott"].map(c=><button key={c} onClick={()=>setCategory(c)} style={{border:"1px solid #dce5ef",background:category===c?theme.ink:"white",color:category===c?"white":theme.ink,borderRadius:20,padding:"9px 13px",cursor:"pointer"}}>{c}</button>)}</div></div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,290px),1fr))",gap:15}}>{visible.map(p=><ProviderCard key={p.id} provider={p}/>)}</div>
   <p style={{color:theme.muted,fontSize:13,marginTop:24}}>Vi visar bara funktioner som faktiskt finns. Inga externa kontolösenord lagras här. Fler direktanslutningar tillkommer efter verifiering med leverantörerna.</p>
  </div>
 </main>;
}
