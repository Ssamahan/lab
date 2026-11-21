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
   insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/staff-access-foundation.sql'),'utf8'));
  await db.exec(`insert into public.lab_access_members(user_id,role,active) values
   ('11111111-1111-4111-8111-111111111111','Admin',true),('22222222-2222-4222-8222-222222222222','Reviewer',true);`);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/public-snapshot.sql'),'utf8'));
  async function identity(id,anonymous=false){await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.jwt',$2,false)",[id||'',JSON.stringify({is_anonymous:anonymous})]);await db.exec('set role authenticated');}
  const read=()=>db.query('select public.lab_read_public_snapshot() as snapshot');
  const publish=(revision,data,reviewed=true)=>db.query('select public.lab_publish_public_snapshot($1,$2::jsonb,$3) as revision',[revision,JSON.stringify(data),reviewed]);
  const safe={trainings:[{id:'t1',title:'Biosafety training',start:'2026-01-01',end:'2026-01-02',location:'Ruli'}],equipment:[{id:'e1',name:'Microscope',status:'active'}]};
  await db.exec('set role anon');assert.equal((await read()).rows[0].snapshot,null);
  await assert.rejects(()=>db.query('select * from public.lab_public_snapshot'));
  await assert.rejects(()=>publish(0,safe));
  await identity('22222222-2222-4222-8222-222222222222');await assert.rejects(()=>publish(0,safe));
  await identity('11111111-1111-4111-8111-111111111111',true);await assert.rejects(()=>publish(0,safe));
  await identity('11111111-1111-4111-8111-111111111111');
  await assert.rejects(()=>publish(0,safe,false));
  await assert.rejects(()=>publish(0,{...safe,patients:['private']}));
  await assert.rejects(()=>publish(0,{...safe,trainings:[{title:'Training',attendees:['private']}]}));
  await assert.rejects(()=>publish(0,{...safe,equipment:[{name:'Microscope',status:{secret:'private'}}]}));
  await assert.rejects(()=>publish(0,{...safe,equipment:[{name:' '.repeat(3)}]}));
  assert.equal(Number((await publish(0,safe)).rows[0].revision),1);
  await assert.rejects(()=>publish(0,{trainings:[],equipment:[]}));
  assert.deepEqual((await read()).rows[0].snapshot.data,safe);
  const updated={trainings:[],equipment:[{name:'Centrifuge'}]};
  assert.equal(Number((await publish(1,updated)).rows[0].revision),2);
  await assert.rejects(()=>publish(1,safe));
  await db.exec('reset role; set role anon');
  const publicResult=(await read()).rows[0].snapshot;assert.deepEqual(publicResult.data,updated);assert.equal(Number(publicResult.revision),2);
  await assert.rejects(()=>db.query('update public.lab_public_snapshot set data=\'{}\'::jsonb'));
  console.log('public-snapshot188: empty default, role checks, allowlist, review and CAS passed');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
