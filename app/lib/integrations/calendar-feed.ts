import { createHash } from "node:crypto";

export type FeedEvent = { uid: string; title: string; starts_at: string; ends_at: string | null; location: string | null; revision_hash: string };
function unfold(text: string) { return text.replace(/\r?\n[ \t]/g, ""); }
function decode(text: string) { return text.replace(/\\[nN]/g, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\"); }
function date(value: string): string | null {
 const v=value.trim();
 if (/^\d{8}$/.test(v)) return v.slice(0,4)+"-"+v.slice(4,6)+"-"+v.slice(6,8)+"T00:00:00";
 const m=v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
 return m?m[1]+"-"+m[2]+"-"+m[3]+"T"+m[4]+":"+m[5]+":"+m[6]+(m[7]||""):null;
}
export function parseCalendarFeed(input: string): FeedEvent[] {
 if(input.length>3_000_000 || !input.includes("BEGIN:VCALENDAR")) throw Error("invalid_calendar");
 const events:FeedEvent[]=[];
 for(const match of unfold(input).matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/g)){
  const block=match[1];const lines=block.split(/\r?\n/);
  const field=(key:string)=>lines.find(l=>l.split(":",1)[0].split(";")[0].toUpperCase()===key)?.split(":").slice(1).join(":")??"";
  const uid=field("UID"),start=date(field("DTSTART")),end=date(field("DTEND"));
  if(!uid||!start||field("RECURRENCE-ID")||field("RRULE")) continue; // never silently misrepresent recurring feeds
  const title=decode(field("SUMMARY"))||"Aktivitet";
  const location=decode(field("LOCATION"))||null;
  events.push({uid,title,starts_at:start,ends_at:end,location,revision_hash:createHash("sha256").update(block).digest("hex")});
 }
 return events;
}
export function validateFeedUrl(raw: string): URL {
 const url=new URL(raw);
 if(url.protocol!=="https:"||url.username||url.password||url.port)throw Error("invalid_feed_url");
 const host=url.hostname.toLowerCase();
 if(!/^(?:[a-z0-9-]+\.)+(?:se|com|net|org)$/.test(host))throw Error("invalid_feed_host");
 if(["localhost","127.0.0.1","169.254.169.254"].includes(host))throw Error("invalid_feed_host");
 return url;
}
