import { NextRequest, NextResponse } from "next/server";
import { authenticatedUserId } from "../../google/session-auth";
import { parseCalendarFeed } from "../../../lib/integrations/calendar-feed";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
 const userId = await authenticatedUserId(req);
 if (!userId) return NextResponse.json({ error: "Logga in för att förhandsgranska kalendern." }, { status: 401 });
 try{
  const body=await req.text();
  const events=parseCalendarFeed(body);
  return NextResponse.json({status:"preview",count:events.length,events:events.slice(0,100),notice:"Endast förhandsgranskning. Inga aktiviteter har sparats. Återkommande händelser kräver separat hantering."},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Ogiltig kalenderfil eller för stor fil."},{status:400});}
}
