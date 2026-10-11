import {NextRequest,NextResponse} from "next/server";

// Temporary pilot-only authorization until household-scoped credential storage exists.
// Never authorize a shared Apple account based only on a valid login.
const PILOT_USER_ID="36364d8d-0b8f-463a-8b86-fc11d2de4479";
export async function requirePilotIcloudUser(req:NextRequest):Promise<NextResponse|null>{
 const bearer=req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!bearer||!base||!key)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  const auth=await fetch(base.replace(/\/$/,"")+"/auth/v1/user",{headers:{Authorization:"Bearer "+bearer,apikey:key},cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!auth.ok)return NextResponse.json({error:"Unauthorized"},{status:401});
  const user=await auth.json();
  if(!user?.id)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(user.id!==PILOT_USER_ID)return NextResponse.json({error:"Forbidden"},{status:403});
  return null;
 }catch{return NextResponse.json({error:"Authentication unavailable"},{status:503});}
}
