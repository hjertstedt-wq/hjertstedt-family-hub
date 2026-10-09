import Link from "next/link";
const SOURCE="https://ta.skidor.com/EventCalendar.aspx?orgid=80";
export default function SourcePage(){
return <main style={{fontFamily:"Arial,sans-serif",background:"#f4f6fa",minHeight:"100vh",padding:"24px 14px",color:"#17253b"}}><div style={{maxWidth:850,margin:"auto",background:"white",borderRadius:16,padding:24}}>
<Link href="/ski">← Till skidmodulen</Link><h1>Svenska Skidförbundet – tävlingar och läger</h1>
<p>Den tidigare exempelöversikten har tagits bort eftersom tävlingsdatum och event-ID inte var verifierade mot den officiella källan. Vi visar inga obekräftade datum som faktiska tävlingar.</p>
<p><a href={SOURCE} target="_blank" rel="noopener noreferrer">Öppna Skidförbundets officiella tävlingskalender ↗</a></p>
<p><Link href="/ski/import">Importera verifierad kalenderfil (.ics) →</Link></p>
<p><Link href="/ski/status">Kontrollera källans anslutning →</Link></p>
<p>Automatisk synkronisering är ännu inte ansluten. När den finns kommer vi visa källa, kontrolltid och datumändringar för varje aktivitet.</p>
</div></main>;
}