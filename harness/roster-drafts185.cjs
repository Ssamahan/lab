'use strict';
// Isolated PostgreSQL-compatible integration test. Install @electric-sql/pglite
// outside the repository and set LAB_PGLITE to its package directory to run.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require(process.env.LAB_PGLITE);
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb $$;
   grant usage on schema auth to authenticated, anon;
   create table public.lab_registers(id text primary key,data jsonb not null,revision bigint not null);
   insert into public.lab_registers values ('ruli-dh','{"trainingExpenses":[{"amount":100}],"workingPlans":{"old":"keep"}}',85);
   insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');`);
  await db.exec(fs.readFileSync('../supabase/staff-access-foundation.sql','utf8'));
  await db.exec(`insert into public.lab_access_members(user_id,role,active) values
   ('11111111-1111-4111-8111-111111111111','Admin',true),
   ('22222222-2222-4222-8222-222222222222','Reviewer',true),
   ('33333333-3333-4333-8333-333333333333','Viewer',true);`);
  await db.exec(fs.readFileSync('../supabase/roster-drafts.sql','utf8'));
  async function identity(id,anonymous=false){
   await db.exec('reset role');
   await db.query("select set_config('test.uid',$1,false),set_config('test.jwt',$2,false)",[id||'',JSON.stringify({is_anonymous:anonymous})]);
   await db.exec('set role authenticated');
  }
  const save=(kind,period,payload)=>db.query('select public.lab_submit_roster_draft($1,$2,$3::jsonb) as id',[kind,period,JSON.stringify(payload)]);
  const read=()=>db.query('select * from public.lab_list_roster_drafts()');
  await identity('22222222-2222-4222-8222-222222222222');
  const result=await save('working_plan','2026-11',{staff:[{name:'Example',codes:['D']}],meta:{draft:true}});
  assert(result.rows[0].id);assert.equal((await read()).rows.length,1);
  await save('weekly_roster','2026-11-02',{allocations:{}});
  assert.equal((await read()).rows.length,2);
  const operation='55555555-5555-4555-8555-555555555555';
  const saveOnce=(id,payload)=>db.query('select public.lab_submit_roster_draft_once($1,$2,$3,$4::jsonb) as id',[id,'working_plan','2026-11',JSON.stringify(payload)]);
  const first=await saveOnce(operation,{staff:[{name:'Example'}]});
  const retry=await saveOnce(operation,{staff:[{name:'Example'}]});
  assert.equal(first.rows[0].id,retry.rows[0].id);
  await assert.rejects(()=>saveOnce(operation,{staff:[]}));
  await assert.rejects(()=>saveOnce(null,{}));
  assert.equal((await read()).rows.length,3);
  await assert.rejects(()=>save('working_plan','2026-13',{}));
  await assert.rejects(()=>save('weekly_roster','2026-11-03',{}));
  await assert.rejects(()=>save('equipment','2026-11',{}));
  await assert.rejects(()=>save('working_plan','2026-11',[]));
  await assert.rejects(()=>save('working_plan','2026-11',{data:'x'.repeat(262145)}));
  await assert.rejects(()=>db.query('select * from public.lab_roster_drafts'));
  await assert.rejects(()=>db.query('delete from public.lab_roster_drafts'));
  await identity('33333333-3333-4333-8333-333333333333');
  assert.equal((await read()).rows.length,3);await assert.rejects(()=>save('working_plan','2026-11',{}));
  await identity('11111111-1111-4111-8111-111111111111');
  await save('working_plan','2026-12',{staff:[]});
  await identity('22222222-2222-4222-8222-222222222222',true);
  await assert.rejects(()=>read());await assert.rejects(()=>save('working_plan','2026-11',{}));
  await identity('44444444-4444-4444-8444-444444444444');
  await assert.rejects(()=>read());await assert.rejects(()=>save('working_plan','2026-11',{}));
  await db.exec('reset role');
  const register=await db.query("select data,revision from public.lab_registers where id='ruli-dh'");
  assert.deepEqual(register.rows[0].data,{trainingExpenses:[{amount:100}],workingPlans:{old:'keep'}});
  assert.equal(Number(register.rows[0].revision),85);
  console.log('roster-drafts185: role enforcement, draft isolation, validation and register preservation passed');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
