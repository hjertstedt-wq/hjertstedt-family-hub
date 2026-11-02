import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';

test('repeat race selection preserves existing participant links without UPDATE privileges',async()=>{
 const pg=new PGlite();
 try {
  await pg.exec(`create role member;
   create table race(id int primary key,category text);
   create table participant(event_id int references race(id),person_id int,primary key(event_id,person_id));
   insert into race values(1,'ski_candidate');
   insert into participant values(1,10);
   alter table participant enable row level security;
   create policy own_read on participant for select to member using(person_id=10);
   create policy own_insert on participant for insert to member with check(person_id=10);
   grant select,insert,update on participant to member;
   grant select,update on race to member;`);
  // This reproduces the live RLS error: conflict UPDATE requires a policy the
  // relationship table deliberately does not provide.
  await assert.rejects(pg.transaction(async tx=>{
   await tx.exec('set local role member');
   await tx.exec('insert into participant values(1,10) on conflict(event_id,person_id) do update set person_id=excluded.person_id');
  }),e=>e.code==='42501');
  await pg.transaction(async tx=>{
   await tx.exec('set local role member');
   for(let i=0;i<2;i++) await tx.exec('insert into participant values(1,10) on conflict(event_id,person_id) do nothing');
   await tx.exec("update race set category='ski_approved' where id=1");
   assert.equal((await tx.query('select * from participant')).rows.length,1);
   assert.equal((await tx.query('select category from race')).rows[0].category,'ski_approved');
  });
  await assert.rejects(pg.transaction(async tx=>{
   await tx.exec('set local role member');
   await tx.exec('insert into participant values(1,20) on conflict(event_id,person_id) do nothing');
  }),e=>e.code==='42501');
 } finally {await pg.close();}
});
