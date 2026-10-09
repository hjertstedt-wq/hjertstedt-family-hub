import Link from "next/link";
const SOURCE="https://ta.skidor.com/EventCalendar.aspx?orgid=80";
type Item={id:number;name:string;start:string;end:string;age:string;kind:string;club:string};
const events:Item[]=[
{id:47840,name:"Reg 5 U16 Juvass v42",start:"2026-10-17",end:"2026-10-20",age:"U16",kind:"Träningsläger",club:"Region 5"},
{id:47841,name:"Reg 5 U16 SNÖ i Oslo",start:"2026-11-14",end:"2026-11-15",age:"U16",kind:"Träningsläger",club:"Region 5"},
{id:47842,name:"Reg 5 U16 Stöten",start:"2026-12-05",end:"2026-12-08",age:"U16",kind:"Träningsläger",club:"Region 5"},
{id:47843,name:"Reg 5 U16 Stöten – USM-deltävling",start:"2027-01-22",end:"2027-01-24",age:"U16",kind:"USM-deltävling",club:"Region 5"},
{id:47846,name:"Reg 5 U12–U16 fartläger Fjätervålen",start:"2027-02-11",end:"2027-02-14",age:"U14/U16",kind:"Träningsläger",club:"Region 5"},
{id:47850,name:"Götalandsmästerskapen GM",start:"2027-03-06",end:"2027-03-07",age:"Kontrollera klass",kind:"Tävling",club:"Östergötlands Skidförbund"},
{id:47847,name:"Götalandsfinal LVC",start:"2027-03-12",end:"2027-03-14",age:"Kontrollera klass",kind:"Tävling",club:"Norrköpings SK"},
{id:47848,name:"Reg 5 Regionsfinal MVC",start:"2027-03-13",end:"2027-03-14",age:"Kontrollera klass",kind:"Tävling",club:"Norrköpings SK"},
{id:47867,name:"Frida Hansdotter Cup",start:"2027-03-20",end:"2027-03-21",age:"Kontrollera klass",kind:"Tävling",club:"Högby Alpina SLK"}
];
export default function SourcePage(){
return <main style={{fontFamily:"Arial,sans-serif",background:"#f4f6fa",minHeight:"100vh",padding:"24px 14px",color:"#17253b"}}><div style={{maxWidth:850,margin:"auto"}}>
<Link href="/ski">← Till skidmodulen</Link><h1>Svenska Skidförbundet – tävlingar och läger</h1>
<p>Urval från den officiella tävlingskalendern. Uppgifterna är en källöversikt, inte en automatisk synkronisering. Åldersklass och anmälningsvillkor måste kontrolleras för tävlingar där det inte framgår tydligt.</p>
<p><a href={SOURCE} target="_blank" rel="noopener noreferrer">Öppna officiell tävlingskalender ↗</a></p>
<p><Link href="/ski">Gå till godkännandevyn →</Link></p>
<div style={{display:"grid",gap:12}}>{events.map(e=><article key={e.id} style={{background:"white",borderRadius:12,padding:16}}>
<strong>{e.name}</strong><p style={{margin:"8px 0",color:"#475569"}}>{e.start}{e.end!==e.start?" – "+e.end:""} · {e.kind} · {e.age}</p>
<p style={{margin:"6px 0",fontSize:13}}>{e.club}</p>
<a href={SOURCE} target="_blank" rel="noopener noreferrer">Visa i källkalendern ↗</a>
</article>)}</div></div></main>;
}