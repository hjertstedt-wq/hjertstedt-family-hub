import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('migration enforces real PostgreSQL owner isolation, anonymous denial and atomic rate limits', async t => {
  const pg = new PGlite();
  const alice = '11111111-1111-4111-8111-111111111111';
  const bob = '22222222-2222-4222-8222-222222222222';
  const homeA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const homeB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  try {
    await pg.exec(`create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      revoke create on schema public from public;
      insert into auth.users values('${alice}'),('${bob}');`);
    await pg.exec(readFileSync(new URL('../supabase/migrations/20261102_private_calendar_onboarding.sql',import.meta.url),'utf8'));
    async function asUser(id, work, role='authenticated') {
      return pg.transaction(async tx => {
        await tx.exec('set local role '+role);
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);
        return work(tx);
      });
    }
    await asUser(alice,tx => tx.query('insert into public.hub_households(id,name) values($1,$2)',[homeA,'Family A']));
    await asUser(bob,tx => tx.query('insert into public.hub_households(id,name) values($1,$2)',[homeB,'Family B']));
    await t.test('each user can only read their owned household', async()=>{
      const own=await asUser(alice,tx=>tx.query('select name from public.hub_households'));
      assert.deepEqual(own.rows,[{name:'Family A'}]);
      await assert.rejects(asUser(alice,tx=>tx.query('insert into public.hub_households(owner_id,name) values($1,$2)',[bob,'spoofed'])));
      assert.equal((await asUser(bob,tx=>tx.query('update public.hub_households set name=$1 where id=$2 returning id',['stolen',homeA]))).rows.length,0);
    });
    await asUser(alice,tx=>tx.query('insert into public.hub_calendar_connections(household_id,provider,encrypted_config,status) values($1,$2,$3,$4)',[homeA,'icloud','ciphertext'.repeat(10),'active']));
    await t.test('another account cannot read, overwrite, delete or insert into the connection',async()=>{
      assert.equal((await asUser(bob,tx=>tx.query('select * from public.hub_calendar_connections'))).rows.length,0);
      assert.equal((await asUser(bob,tx=>tx.query('delete from public.hub_calendar_connections where household_id=$1 returning *',[homeA]))).rows.length,0);
      assert.equal((await asUser(bob,tx=>tx.query('update public.hub_calendar_connections set status=$1 where household_id=$2 returning *',['choose_calendar',homeA]))).rows.length,0);
      await assert.rejects(asUser(bob,tx=>tx.query('insert into public.hub_calendar_connections(household_id,provider,encrypted_config,status) values($1,$2,$3,$4)',[homeA,'icloud','fake'.repeat(20),'active'])));
      assert.equal((await asUser(alice,tx=>tx.query('select * from public.hub_calendar_connections'))).rows.length,1);
    });
    await t.test('anonymous sessions cannot access either table or rate-limit RPC',async()=>{
      for(const query of ['select * from public.hub_households','select * from public.hub_calendar_connections','select public.hub_claim_icloud_attempt()']) {
        await assert.rejects(asUser('',tx=>tx.query(query),'anon'));
      }
    });
    await t.test('provider budget is shared across devices but isolated by account',async()=>{
      const results=[];
      for(let i=0;i<7;i++) results.push((await asUser(alice,tx=>tx.query('select public.hub_claim_icloud_attempt() as allowed'))).rows[0].allowed);
      assert.deepEqual(results,[true,true,true,true,true,true,false]);
      assert.equal((await asUser(bob,tx=>tx.query('select public.hub_claim_icloud_attempt() as allowed'))).rows[0].allowed,true);
      await assert.rejects(asUser(alice,tx=>tx.query('update public.hub_integration_limits set attempts=0')));
      await pg.query("update public.hub_integration_limits set window_start=now()-interval '2 minutes' where user_id=$1",[alice]);
      assert.equal((await asUser(alice,tx=>tx.query('select public.hub_claim_icloud_attempt() as allowed'))).rows[0].allowed,true);
    });
    await t.test('disconnect erases owned credentials and account deletion cascades',async()=>{
      await asUser(alice,tx=>tx.query('delete from public.hub_calendar_connections where household_id=$1',[homeA]));
      assert.equal((await asUser(alice,tx=>tx.query('select * from public.hub_calendar_connections'))).rows.length,0);
      await pg.query('delete from auth.users where id=$1',[alice]);
      assert.equal((await pg.query('select * from public.hub_households where id=$1',[homeA])).rows.length,0);
    });
  } finally { await pg.close(); }
});
