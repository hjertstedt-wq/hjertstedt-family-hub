import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("iCloud events and discovery both enforce the pilot authorization guard",()=>{
 for(const path of ["app/api/icloud/events/route.ts","app/api/icloud/discover/route.ts"]){
  const code=source(path);
  assert.match(code,/import\s*\{\s*requirePilotIcloudUser\s*\}/);
  assert.match(code,/const denied=await requirePilotIcloudUser\(req\)/);
  assert.match(code,/if\(denied\)return denied/);
  assert.ok(code.indexOf("if(denied)return denied")<code.indexOf("process.env.ICLOUD_APPLE_ID"),"Authorization must precede credential access");
 }
});
test("iCloud guard denies unrelated authenticated users and anonymous callers",()=>{
 const code=source("app/api/icloud/pilot-auth.ts");
 assert.match(code,/!bearer\|\|!base\|\|!key/);
 assert.match(code,/user\.id!==PILOT_USER_ID/);
 assert.match(code,/status:403/);
 assert.match(code,/status:401/);
 assert.match(code,/cache:"no-store"/);
});
test("no provider password entry in commercial connection screen",()=>{
 const code=source("app/connections/page.tsx");
 assert.doesNotMatch(code,/<input[^>]*type=["']password["']/i);
 assert.match(code,/providers\.filter/);
});
test("alpine training validates limits and exposes partial rollback failure",()=>{
 const code=source("app/ski/training/page.tsx");
 assert.match(code,/days>14/);
 assert.match(code,/selected\.length/);
 assert.match(code,/rollbackError/);
 assert.match(code,/Delvis sparat/);
});
