import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const sources=[
 {id:"ski_federation",name:"Svenska Skidförbundets tävlingskalender",url:"https://ta.skidor.com/EventCalendar.aspx?orgid=80"},
];
export async function GET(){
 const checks=await Promise.all(sources.map(async source=>{
   try{
     const controller=new AbortController();
     const timeout=setTimeout(()=>controller.abort(),8000);
     try{
       const response=await fetch(source.url,{method:"GET",cache:"no-store",signal:controller.signal,headers:{"User-Agent":"HjertstedtFamilyHub/3.1"}});
       const type=response.headers.get("content-type")||"";
       return {id:source.id,name:source.name,url:source.url,reachable:response.ok&&type.includes("text/html"),httpStatus:response.status,checkedAt:new Date().toISOString(),syncActive:false};
     }finally{clearTimeout(timeout);}
   }catch{return {id:source.id,name:source.name,url:source.url,reachable:false,httpStatus:null,checkedAt:new Date().toISOString(),syncActive:false};}
 }));
 return NextResponse.json({sources:checks,note:"Anslutningskontroll är inte synkronisering av tävlingar."},{headers:{"Cache-Control":"no-store"}});
}