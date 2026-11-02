import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import ICAL from 'ical.js';
const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const js = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('module','exports','require',js)(module,module.exports,name => mocks[name] ?? require(name));
  return module.exports;
}
class IntegrationError extends Error { constructor(code,message,status=503) { super(message); this.code=code; this.status=status; } }
const adapter = load('app/lib/server/icloud.ts', { './integration-store': { IntegrationError } });
const normalizer = load('app/lib/server/icloud-events.ts', { 'ical.js': { default: ICAL } });
const crypto = load('app/lib/server/integration-crypto.ts');
const ics = body => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n' + body.replaceAll('\n','\r\n') + '\r\nEND:VCALENDAR';
const range = [new Date('2026-11-01T00:00:00Z'),new Date('2026-12-01T00:00:00Z')];

test('encrypted credentials are randomized and bound to tenant, owner and provider', () => {
  const old = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = 'cd'.repeat(32);
  try {
    const value = { username:'test@example.com', password:'aaaa-bbbb-cccc-dddd' };
    const encrypted = crypto.encryptConfig(value, 'alice:home1:icloud');
    assert.doesNotMatch(encrypted, /test|aaaa-bbbb/);
    assert.notEqual(encrypted, crypto.encryptConfig(value, 'alice:home1:icloud'));
    assert.deepEqual(crypto.decryptConfig(encrypted, 'alice:home1:icloud'), value);
    for(const context of ['bob:home1:icloud','alice:home2:icloud','alice:home1:google']) assert.throws(() => crypto.decryptConfig(encrypted, context));
    assert.throws(() => crypto.decryptConfig(encrypted.slice(0,-4)+'xxxx', 'alice:home1:icloud'));
  } finally { if(old === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY=old; }
});
test('Apple transport only permits HTTPS calendar endpoints and safe redirects', async () => {
  for(const url of ['http://caldav.icloud.com','https://evil.test','https://caldav.icloud.com.evil.test','https://user:pass@caldav.icloud.com','https://127.0.0.1','https://caldav.icloud.com:444']) assert.throws(() => adapter.appleUrl(url));
  assert.equal(adapter.appleUrl('https://p123-caldav.icloud.com/123/calendars/').hostname,'p123-caldav.icloud.com');
  let requests=0;
  const transport = adapter.appleTransport(async () => { requests++; return new Response(null,{status:302,headers:{location:'https://evil.test/steal'}}); });
  await assert.rejects(transport('https://caldav.icloud.com',{method:'PROPFIND',headers:{Authorization:'Basic secret'}}));
  assert.equal(requests,1);
});
test('transport forbids writes, caps responses, rejects XML entities and redacts Apple authentication failures', async () => {
  let requests=0;
  const transport=adapter.appleTransport(async()=>{ requests++; return new Response('forbidden credentials', {status:401}); });
  await assert.rejects(transport('https://caldav.icloud.com',{method:'PUT'})); assert.equal(requests,0);
  await assert.rejects(transport('https://caldav.icloud.com',{method:'REPORT'}), e => e.code === 'apple_auth_failed' && !e.message.includes('credentials'));
  await assert.rejects(adapter.appleTransport(async()=> new Response('<!DOCTYPE x [<!ENTITY leak "secret">]>'))('https://caldav.icloud.com'));
  await assert.rejects(adapter.appleTransport(async()=>new Response('x'.repeat(8_000_001)))('https://caldav.icloud.com'),e=>e.status===413);
});
test('private iCloud events expand weekly repeats, EXDATE, moved overrides and cancellations', () => {
  const data=ics(`BEGIN:VEVENT
UID:series
DTSTART:20261102T170000Z
DTEND:20261102T180000Z
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE:20261109T170000Z
SUMMARY:Training
END:VEVENT
BEGIN:VEVENT
UID:series
RECURRENCE-ID:20261116T170000Z
DTSTART:20261117T180000Z
DTEND:20261117T190000Z
SUMMARY:Moved training
END:VEVENT
BEGIN:VEVENT
UID:series
RECURRENCE-ID:20261123T170000Z
DTSTART:20261123T170000Z
DTEND:20261123T180000Z
STATUS:CANCELLED
END:VEVENT`);
  const result=normalizer.normalizeIcloud([{data}],'family',...range);
  assert.deepEqual(result.events.map(e=>e.starts_at),['2026-11-02T17:00:00.000Z','2026-11-17T18:00:00.000Z']);
  assert.equal(result.events[1].title,'Moved training');
  assert.equal(result.events[0].source,'icloud');
  assert.equal(normalizer.normalizeIcloud([{data}],'family',...range).events[0].id,result.events[0].id);
});
test('all-day events keep their date and exclusive end; floating time stays local', () => {
  const data=ics(`BEGIN:VEVENT
UID:all-day
DTSTART;VALUE=DATE:20261103
DTEND;VALUE=DATE:20261105
SUMMARY:Holiday
END:VEVENT
BEGIN:VEVENT
UID:floating
DTSTART:20261105T170000
DTEND:20261105T180000
END:VEVENT`);
  const result=normalizer.normalizeIcloud([{data}],'family',...range);
  assert.equal(result.events[0].starts_at,'2026-11-03');
  assert.equal(result.events[0].ends_at,'2026-11-05');
  assert.equal(result.events[1].starts_at,'2026-11-05T17:00:00');
});
test('embedded timezones convert to UTC, including Swedish DST transitions', () => {
  const data=ics(`BEGIN:VTIMEZONE
TZID:Europe/Stockholm
BEGIN:DAYLIGHT
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
END:DAYLIGHT
BEGIN:STANDARD
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:dst
DTSTART;TZID=Europe/Stockholm:20261019T180000
DTEND;TZID=Europe/Stockholm:20261019T190000
RRULE:FREQ=WEEKLY;COUNT=3
END:VEVENT`);
  const result=normalizer.normalizeIcloud([{data}],'family',new Date('2026-10-01Z'),new Date('2026-12-01Z'));
  assert.deepEqual(result.events.map(e=>e.starts_at),['2026-10-19T16:00:00.000Z','2026-10-26T17:00:00.000Z','2026-11-02T17:00:00.000Z']);
});
test('unknown timezones are reported rather than silently shifted', () => {
  const data=ics('BEGIN:VEVENT\nUID:unknown\nDTSTART;TZID=Unknown/Zone:20261103T170000\nDTEND;TZID=Unknown/Zone:20261103T180000\nEND:VEVENT');
  const result=normalizer.normalizeIcloud([{data}],'family',...range);
  assert.equal(result.skipped,1); assert.equal(result.events.length,0);
});

test('a recurrence exception moved into the visible window is retained', () => {
  const data=ics(`BEGIN:VEVENT
UID:moved-in
DTSTART:20261201T170000Z
DTEND:20261201T180000Z
RRULE:FREQ=DAILY;COUNT=2
END:VEVENT
BEGIN:VEVENT
UID:moved-in
RECURRENCE-ID:20261201T170000Z
DTSTART:20261115T170000Z
DTEND:20261115T180000Z
SUMMARY:Moved earlier
END:VEVENT`);
  const result=normalizer.normalizeIcloud([{data}],'family',...range);
  assert.equal(result.events.length,1);
  assert.equal(result.events[0].title,'Moved earlier');
});
test('date-only values render as local midnight and as Heldag', () => {
  const dates=load('app/lib/calendar-dates.ts');
  const original=process.env.TZ;
  try {
    for(const zone of ['Europe/Stockholm','America/Los_Angeles']) {
      process.env.TZ=zone;
      const start=dates.calendarDate('2026-11-03');
      assert.equal(start.getDate(),3); assert.equal(start.getHours(),0);
      assert.equal(dates.calendarTimeLabel('2026-11-03','2026-11-05'),'Heldag');
    }
  } finally { if(original === undefined) delete process.env.TZ; else process.env.TZ=original; }
});

test('iCloud API authenticates, validates app passwords, selects Family and never returns secrets', async () => {
  let saved=null, failStorage=false, writes=0;
  let calendars=[{url:'https://p01-caldav.icloud.com/123/Family/',displayName:'Family',components:['VEVENT']}];
  const store={
    IntegrationError,
    integrationUser: async request => { if(!request.headers.get('authorization')) throw new IntegrationError('not_authenticated','Logga in',401); return 'alice'; },
    claimIcloudAttempt: async()=>{},
    connection: async()=>{ if(failStorage) throw new IntegrationError('storage_not_ready','Säker lagring krävs'); return {home:{id:'homeA'},config:saved}; },
    saveConnection: async(_request,_user,home,config)=>{assert.equal(home,'homeA');saved=config;writes++;},
    household: async()=>({id:'homeA'}),
    db: async()=>{saved=null;},
    reply: (body,status=200)=>Response.json(body,{status}),
    failure: error=>Response.json({status:error.code??'provider_unavailable',error:error.message},{status:error.status??502})
  };
  const api=load('app/api/icloud/connection/route.ts',{
    '../../../lib/server/integration-store':store,
    '../../../lib/server/icloud':{...adapter,openIcloud:async()=>({calendars})}
  });
  const request=(body,authenticated=true)=>new Request('https://staging.example/api/icloud/connection',{
    method:'POST',headers:authenticated?{Authorization:'Bearer test'}:{},body:JSON.stringify(body)
  });
  const valid={username:'test@example.com',password:'aaaa-bbbb-cccc-dddd',consent:true};
  assert.equal((await api.POST(request(valid,false))).status,401);
  assert.equal((await api.POST(request({...valid,password:'regular-password'}))).status,400);
  assert.equal((await api.POST(request({...valid,consent:false}))).status,400);
  assert.equal(writes,0);
  failStorage=true;
  assert.equal((await api.POST(request(valid))).status,503);
  assert.equal(writes,0);failStorage=false;
  const result=await api.POST(request(valid));
  const body=await result.json();
  assert.equal(body.status,'active');assert.equal(body.calendarName,'Family');
  assert.equal(saved.calendarUrl,calendars[0].url);
  assert.doesNotMatch(JSON.stringify(body),/aaaa-bbbb|test@example|https:/);
  assert.equal((await api.PATCH(request({calendarId:'foreign'}))).status,404);
  assert.equal(writes,1);
  calendars.push({...calendars[0],url:'https://p01-caldav.icloud.com/123/another/'});
  assert.equal((await (await api.POST(request(valid))).json()).status,'choose_calendar');
  assert.equal(saved.calendarUrl,undefined);
  await api.DELETE(request({}));assert.equal(saved,null);
});
