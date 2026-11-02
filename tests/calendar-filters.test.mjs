import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../app/lib/integrations/calendar-filters.ts',import.meta.url),'utf8');
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const module = {exports:{}};
new Function('module','exports',js)(module,module.exports);
const {matchesCalendarFilter:match} = module.exports;
const persons=[{id:'a',name:'Alva Test'},{id:'e',name:'Elsa Test'}];
const event=(overrides={})=>({id:'event',title:'Aktivitet',source:'manual',category:'general',...overrides});
const matches=(e,f,links={})=>match(e,f,persons,links);

test('all includes private, sports and approved races, never unapproved suggestions',()=>{
  for(const source of ['icloud','google','sportadmin','svenskalag','manual']) assert.equal(matches(event({source}),'all'),true);
  assert.equal(matches(event({category:'ski_candidate'}),'all'),false);
  assert.equal(matches(event({category:'ski_approved'}),'all'),true);
});
test('Family isolates private calendar sources; competitions isolate approved races',()=>{
  assert.equal(matches(event({source:'icloud'}),'family'),true);
  assert.equal(matches(event({source:'google'}),'family'),true);
  assert.equal(matches(event({source:'svenskalag',category:'sports_feed'}),'family'),false);
  assert.equal(matches(event({category:'ski_approved'}),'races'),true);
  for(const category of ['ski_candidate','ski_training','general','sports_feed']) assert.equal(matches(event({category}),'races'),false);
});
test('child filters use explicit participants, including approved competitions',()=>{
  const race=event({category:'ski_approved'});
  assert.equal(matches(race,'alva',{event:['a']}),true);
  assert.equal(matches(race,'elsa',{event:['a']}),false);
  assert.equal(matches(race,'elsa',{event:['a','e']}),true);
  assert.equal(matches(event({title:'Elsas tävling'}),'elsa',{event:['a']}),false);
});
test('sports assignments include shared training without depending on profile IDs',()=>{
  assert.equal(matches(event({category:'sports_feed',sportsMember:'alva'}),'alva'),true);
  assert.equal(matches(event({category:'sports_feed',sportsMember:'alva'}),'elsa'),false);
  for(const child of ['alva','elsa']) assert.equal(matches(event({category:'sports_feed',sportsMember:'both'}),child),true);
});
test('unassigned private posts match a child name, without guessing from unnamed posts',()=>{
  assert.equal(matches(event({source:'icloud',title:'Alva dansträning'}),'alva'),true);
  assert.equal(matches(event({source:'icloud',title:'ELSAS läger'}),'elsa'),true);
  assert.equal(matches(event({source:'icloud',title:'Fysio'}),'alva'),false);
  assert.equal(matches(event({source:'icloud',title:'Alvar fyller år'}),'alva'),false);
  assert.equal(matches(event({source:'icloud',title:'Elsa dans'}),'alva'),false);
});
