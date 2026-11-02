import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
process.env.TZ='Europe/Stockholm';
const module={exports:{}};
new Function('module','exports',ts.transpileModule(readFileSync(new URL('../app/lib/calendar-dates.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module,module.exports);
const {calendarTimeLabel}=module.exports;
test('provisional race windows do not invent midnight start times in winter or summer time',()=>{
 for(const [start,end] of [['2027-01-21T23:00:00Z','2027-01-24T23:00:00Z'],['2027-04-04T22:00:00Z','2027-04-11T22:00:00Z']]) assert.equal(calendarTimeLabel(start,end,'ssf_stomprogram'),'Heldag · tider ej fastställda');
 assert.equal(calendarTimeLabel('2027-01-22T09:00:00+01:00','2027-01-22T12:00:00+01:00','ssf_stomprogram'),'09:00–12:00');
 assert.equal(calendarTimeLabel('2027-01-22T00:00:00+01:00','2027-01-23T00:00:00+01:00','icloud'),'00:00–00:00');
});
