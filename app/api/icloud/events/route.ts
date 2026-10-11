import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const trusted = (host: string) => host === "caldav.icloud.com" || /^p\d+-caldav\.icloud\.com$/i.test(host);
const tag = (xml: string, name: string) => xml.match(new RegExp("<(?:[\\w.-]+:)?" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?" + name + "\\s*>", "i"))?.[1] ?? "";
const parts = (xml: string, name: string) => [...xml.matchAll(new RegExp("<(?:[\\w.-]+:)?" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?" + name + "\\s*>", "gi"))].map(x => x[1]);
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const calendarName = (s: string) => s === "Family" || s === "Family ⚠️";
function parseDate(s: string): string | null {
  const v = s.trim();
  if (/^\d{8}$/.test(v)) return v.slice(0,4)+"-"+v.slice(4,6)+"-"+v.slice(6,8)+"T00:00:00";
  const m = v.match(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)(Z?)$/);
  return m ? m[1]+"-"+m[2]+"-"+m[3]+"T"+m[4]+":"+m[5]+":"+m[6]+(m[7] || "") : null;
}
function parseIcs(xml: string, source: string) {
  const ics = decode(tag(xml, "calendar-data")).replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const result: {id:string;title:string;starts_at:string;ends_at:string;location:string|null;source:string;category:string}[] = [];
  for (const [index, block] of [...ics.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/g)].entries()) {
    const lines = block[1].split(/\r?\n/);
    const field = (key: string) => lines.find(l => l.split(":",1)[0].split(";")[0].toUpperCase() === key)?.split(":").slice(1).join(":") ?? "";
    const start = parseDate(field("DTSTART")), end = parseDate(field("DTEND")) || start;
    if (!start || !end) continue;
    const uid = field("UID") || String(index);
    const title = field("SUMMARY").replace(/\\n/gi, " ").replace(/\\,/g,",").replace(/\\;/g,";");
    result.push({ id:"icloud:"+source+":"+uid+":"+(field("RECURRENCE-ID")||start),title:title||"Aktivitet",starts_at:start,ends_at:end,location:field("LOCATION")||null,source:"icloud",category:"icloud" });
  }
  return result;
}
export async function GET(req: NextRequest) {
  // Never expose a shared iCloud account to anonymous visitors.
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!bearer || !base || !key) return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const auth = await fetch(base.replace(/\/$/,"")+"/auth/v1/user",{headers:{Authorization:"Bearer "+bearer,apikey:key},cache:"no-store",signal:AbortSignal.timeout(8000)});
    if (!auth.ok) return NextResponse.json({error:"Unauthorized"},{status:401});
    const user = await auth.json();
    if (!user?.id) return NextResponse.json({error:"Unauthorized"},{status:401});
  } catch { return NextResponse.json({error:"Authentication unavailable"},{status:503}); }
  const appleId=process.env.ICLOUD_APPLE_ID,password=process.env.ICLOUD_APP_PASSWORD;
  if (!appleId||!password) return NextResponse.json({error:"iCloud not configured"},{status:503});
  const authHeader="Basic "+Buffer.from(appleId+":"+password).toString("base64");
  async function request(url:string,method:string,body:string,depth:string,redirects=0):Promise<string> {
    const parsed=new URL(url);
    if(parsed.protocol!=="https:"||!trusted(parsed.hostname)) throw Error("untrusted_host");
    const res=await fetch(url,{method,headers:{Authorization:authHeader,Depth:depth,"Content-Type":"application/xml; charset=utf-8"},body,redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(15000)});
    if(res.status>=300&&res.status<400){
      if(redirects>=4) throw Error("redirect_limit");
      const location=res.headers.get("location");
      if(!location) throw Error("redirect_missing");
      return request(new URL(location,url).href,method,body,depth,redirects+1);
    }
    if(!res.ok) throw Error("caldav_"+res.status);
    return res.text();
  }
  const resolve=(base:string,href:string) => { const u=new URL(decode(href),base);if(u.protocol!=="https:"||!trusted(u.hostname)) throw Error("untrusted_href");return u.href; };
  try {
    const root="https://caldav.icloud.com/";
    const principalXml=await request(root,"PROPFIND",'<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>',"0");
    const principal=resolve(root,tag(tag(principalXml,"current-user-principal"),"href"));
    const homeXml=await request(principal,"PROPFIND",'<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>',"0");
    const home=resolve(principal,tag(tag(homeXml,"calendar-home-set"),"href"));
    const list=await request(home,"PROPFIND",'<d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:resourcetype/></d:prop></d:propfind>',"1");
    const calendars=parts(list,"response").map(r=>({name:decode(tag(r,"displayname")),href:tag(r,"href"),type:tag(r,"resourcetype")})).filter(c=>calendarName(c.name)&&/calendar\b/i.test(c.type)&&c.href);
    const start=new Date();start.setMonth(start.getMonth()-1);
    const end=new Date();end.setMonth(end.getMonth()+6);
    const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
    const query='<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="'+stamp(start)+'" end="'+stamp(end)+'"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>';
    const all=[] as ReturnType<typeof parseIcs>;
    for(const cal of calendars){
      const xml=await request(resolve(home,cal.href),"REPORT",query,"1");
      for(const response of parts(xml,"response")) all.push(...parseIcs(response,cal.name));
    }
    const seen=new Set<string>();
    const events=all.filter(e=>{const key=[e.title.trim().toLowerCase(),e.starts_at,e.ends_at,e.location||""].join("|");if(seen.has(key))return false;seen.add(key);return true;});
    return NextResponse.json({status:"ok",calendars:calendars.map(c=>c.name),events},{headers:{"Cache-Control":"no-store"}});
  } catch(e){return NextResponse.json({error:"Kunde inte läsa aktiviteter från iCloud.",diagnostic:e instanceof Error&&/^(caldav_\d+|untrusted_host|untrusted_href|redirect_limit|redirect_missing)$/.test(e.message)?e.message:"read_failed"},{status:502});}
}
