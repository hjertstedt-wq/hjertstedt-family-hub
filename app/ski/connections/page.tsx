"use client";
import { useState } from "react";
type Connection={name:string;kind:string;status:string;url:string;notes:string};
const sources:Connection[]=[
 {name:"Svenska Skidförbundet – TA",kind:"Alpina tävlingar",status:"Källkontroll finns; import via ICS",url:"https://ta.skidor.com/EventCalendar.aspx?orgid=80",notes:"Verifiera datum och klass i officiell tävlingskalender innan godkännande."},
 {name:"Region 5 – alpint",kind:"Träningsläger och tävlingar",status:"Manuell bevakning",url:"https://www.skidor.com/",notes:"Använd officiella region- och klubbkalendrar. Lägg inte in obekräftade tider."},
 {name:"Svenskalag",kind:"Elsas fotboll",status:"Väntar på lagkalenderlänk",url:"https://www.svenskalag.se/",notes:"Endast fotboll: 2011, 2012 och junior damer; filtrera Elsa anmäld."},
 {name:"SportsAdmin",kind:"Alvas aktiviteter",status:"Väntar på förenings- eller kalenderlänk",url:"https://www.sportsadmin.se/",notes:"Koppla via godkänd kalenderdelning/export om tillgänglig; dela aldrig lösenord."},
 {name:"Apple iCloud – Family",kind:"Familjens kalender",status:"Läsanslutning finns i staging",url:"/calendar",notes:"Båda Family-kalendrarna. Skrivskyddad integration."}
];
export default function Connections(){
 const [copied,setCopied]=useState(false);
 const request="För att ansluta Svenskalag och SportsAdmin till Hjertstedt Family Hub behöver vi respektive kalenderprenumeration (ICS/webcal) eller en officiell delningslänk. Skicka endast kalenderns delningslänk via en säker kanal – inga kontolösenord.";
 return <main style={{background:"#f4f6fa",minHeight:"100vh",padding:"24px 14px",fontFamily:"Arial,sans-serif",color:"#17253b"}}><div style={{maxWidth:860,margin:"auto"}}>
 <a href="/ski">← Alpint</a><h1>Aktivitetskällor och anslutningar</h1>
 <p>Här ser du vad som redan är anslutet och vad som kräver en kalenderlänk eller godkänd åtkomst. Vi importerar inte okända datum automatiskt.</p>
 <div style={{display:"grid",gap:12}}>{sources.map(s=><section key={s.name} style={{background:"white",padding:18,borderRadius:14}}>
 <h2 style={{fontSize:19,marginTop:0}}>{s.name}</h2><p>{s.kind}</p><p><strong>Status:</strong> {s.status}</p><p style={{color:"#64748b",fontSize:14}}>{s.notes}</p><a href={s.url} target={s.url.startsWith("/")?"_self":"_blank"} rel="noreferrer" style={{color:"#315e9c"}}>Öppna källa →</a>
 </section>)}</div>
 <section style={{background:"white",padding:18,borderRadius:14,marginTop:16}}>
 <h2>Förbered kalenderdelning</h2><p>Be föreningen om en kalenderprenumeration eller använd exportfunktionen i deras app. Lösenord ska aldrig delas.</p>
 <button onClick={()=>{void navigator.clipboard.writeText(request).then(()=>setCopied(true));}} style={{padding:12,borderRadius:10,background:"#315e9c",border:0,color:"white"}}>{copied?"Text kopierad":"Kopiera förfrågan om kalenderlänk"}</button>
 <p><a href="/ski/import">Importera officiell kalenderfil (.ics) →</a></p>
 </section>
 </div></main>;
}
