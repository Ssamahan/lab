'use strict';
// Run with LAB_PGLITE pointing to an externally installed @electric-sql/pglite.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.LAB_PGLITE);
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb $$;
   grant usage on schema auth to authenticated,anon;
   create table public.lab_registers(id text primary key,data jsonb not null,revision bigint not null,updated_at timestamptz default now());
   insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');`);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/staff-access-foundation.sql'),'utf8'));
  await db.exec(`insert into public.lab_access_members(user_id,role,active) values
   ('11111111-1111-4111-8111-111111111111','Admin',true),
   ('22222222-2222-4222-8222-222222222222','Reviewer',true),
   ('33333333-3333-4333-8333-333333333333','Viewer',true);`);
  const input={staff:[{id:'s1',name:'Staff',role:'Technician',status:'active',phone:'123',email:'s@example.org',security:{secret:'private-settings'}}],
   trainings:[{id:'t1',title:'VHF',start:'2026-11-01',organizer:'RBC',attendees:['s1',{private:'private-attendee'}],description:'private-note',income:999}],
   equipment:[{id:'e1',name:'Centrifuge',status:'active',serial:'123',note:'private-note',services:[{patient:'private'}]}],
   trainingExpenses:[{amount:999}],settings:{security:'private-settings'},samples:[{patientName:'private-patient'}]};
  await db.query("insert into public.lab_registers(id,data,revision) values ('ruli-dh',$1::jsonb,85)",[JSON.stringify(input)]);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/staff-read.sql'),'utf8'));
  async function identity(id,anonymous=false){await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.jwt',$2,false)",[id||'',JSON.stringify({is_anonymous:anonymous})]);await db.exec('set role authenticated');}
  const read=()=>db.query('select public.lab_staff_read_catalog() as data');
  await db.exec('set role anon');await assert.rejects(read);
  await identity('33333333-3333-4333-8333-333333333333');
  const result=(await read()).rows[0].data;
  assert.equal(Number(result.revision),85);assert.equal(result.data.trainings[0].title,'VHF');
  assert.deepEqual(result.data.trainings[0].attendees,['s1']);assert.equal(result.data.staff[0].phone,'123');
  assert.equal(result.data.equipment[0].name,'Centrifuge');
  assert(!JSON.stringify(result).includes('private'));assert(!JSON.stringify(result).includes('999'));
  assert.deepEqual(Object.keys(result.data).sort(),['equipment','staff','trainings']);
  await identity('22222222-2222-4222-8222-222222222222');assert.equal((await read()).rows[0].data.data.trainings[0].id,'t1');
  await identity('11111111-1111-4111-8111-111111111111',true);await assert.rejects(read);
  await identity('44444444-4444-4444-8444-444444444444');await assert.rejects(read);
  await db.exec('reset role');await db.query("update public.lab_registers set data=$1::jsonb",[JSON.stringify({staff:{unexpected:'private'},trainings:null,equipment:'private'})]);
  await identity('33333333-3333-4333-8333-333333333333');
  assert.deepEqual((await read()).rows[0].data.data,{staff:[],trainings:[],equipment:[]});
  console.log('staff-read189: staff-only allowlisted catalog excludes revenue, settings and private fields');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
