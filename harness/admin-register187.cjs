'use strict';
// Run with LAB_PGLITE pointing to an externally installed @electric-sql/pglite.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.LAB_PGLITE);
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb $$;
   grant usage on schema auth to authenticated, anon;
   create table public.lab_registers(id text primary key,data jsonb not null,revision bigint not null,client_id text,updated_by text,updated_at timestamptz default now());
   create table public.lab_register_history(register_id text,revision bigint,data jsonb);
   create function public.test_history() returns trigger language plpgsql as $$ begin insert into public.lab_register_history values(old.id,old.revision,old.data); new.revision=old.revision+1; return new; end $$;
   create trigger version before update on public.lab_registers for each row execute function public.test_history();
   insert into public.lab_registers(id,data,revision) values ('ruli-dh','{"trainingExpenses":[{"amount":100}],"workingPlans":{"old":"keep"},"settings":{"security":"private"}}',85);
   insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');`);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/staff-access-foundation.sql'),'utf8'));
  await db.exec(`insert into public.lab_access_members(user_id,role,active) values
   ('11111111-1111-4111-8111-111111111111','Admin',true),
   ('22222222-2222-4222-8222-222222222222','Reviewer',true),
   ('33333333-3333-4333-8333-333333333333','Viewer',true);`);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/admin-register.sql'),'utf8'));
  async function identity(id,anonymous=false){await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.jwt',$2,false)",[id||'',JSON.stringify({is_anonymous:anonymous})]);await db.exec('set role authenticated');}
  const read=()=>db.query('select public.lab_admin_read_register() as value');
  const write=(revision,data)=>db.query('select public.lab_admin_write_register($1,$2::jsonb,$3) as value',[revision,JSON.stringify(data),'test-device']);
  const original={trainingExpenses:[{amount:100}],workingPlans:{old:'keep'},settings:{security:'private'}};
  await identity('22222222-2222-4222-8222-222222222222');await assert.rejects(read);await assert.rejects(()=>write(85,original));
  await identity('33333333-3333-4333-8333-333333333333');await assert.rejects(read);await assert.rejects(()=>write(85,original));
  await identity('11111111-1111-4111-8111-111111111111',true);await assert.rejects(read);await assert.rejects(()=>write(85,original));
  await identity('11111111-1111-4111-8111-111111111111');
  const current=(await read()).rows[0].value;assert.deepEqual(current.data,original);assert.equal(Number(current.revision),85);
  await assert.rejects(()=>write(84,{...original,workingPlans:{}}),'stale revision must fail');
  await assert.rejects(()=>write(85,{workingPlans:{}}),'partial register must fail');
  await assert.rejects(()=>write(85,[]),'non-object must fail');
  const changed={...original,workingPlans:{old:'keep',next:'draft'}};
  assert.equal(Number((await write(85,changed)).rows[0].value),86);
  await assert.rejects(()=>write(85,original),'concurrent stale write must fail');
  const after=(await read()).rows[0].value;assert.deepEqual(after.data,changed);assert.equal(Number(after.revision),86);
  await db.exec('reset role');
  const history=await db.query('select revision,data from public.lab_register_history');
  assert.equal(history.rows.length,1);assert.equal(Number(history.rows[0].revision),85);assert.deepEqual(history.rows[0].data,original);
  console.log('admin-register187: role checks, conflict handling, partial-write rejection and history passed');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
