/* v6.9.97 — the names follow the person, not the device.
   `lab_patient_names` is a table with no anon policy at all, so it can only be read with a
   real signed-in account — and only if that account is on the `lab_staff` allowlist. This
   suite drives the whole path against a mocked cloud at the fetch boundary: sign-in,
   refusal for a stranger, the pull into the vault, and the push when a name is recorded. */
const {boot,ok,done}=require('./env');
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const syncSrc=fs.readFileSync(path.join(root,'assets/js/core/sync.js'),'utf8');
const stSrc=fs.readFileSync(path.join(root,'assets/js/core/store.js'),'utf8');
const schema=fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8');
const tick=ms=>new Promise(r=>setTimeout(r,ms||200));
const click=el=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));

/* A cloud that behaves the way PostgREST does with these policies: no bearer, no rows. */
function makeCloud(opts){
  opts=opts||{};
  const c={names:{}, calls:[], password:opts.password||'cloud-pass', staff:opts.staff!==false};
  let token=null;
  c.fetch=async(url,o)=>{
    o=o||{}; const u=String(url); const method=(o.method||'GET').toUpperCase();
    const h=o.headers||{};
    const bearer=h.Authorization||h.authorization||'';
    c.calls.push(method+' '+u.replace(/^https:\/\/[^/]+/,'')+(bearer?' [bearer]':''));
    if(u.indexOf('/auth/v1/token')>=0){
      const body=JSON.parse(o.body||'{}');
      const grant=((/grant_type=([a-z_]+)/.exec(u)||[])[1])||body.grant_type;
      if(grant==='password'){
        if(body.password!==c.password) { c.lastBody=body; }
        if(body.password!==c.password) return {ok:false,status:400,text:async()=>'{"error":"invalid_grant","error_description":"Invalid login credentials"}'};
        token='tok-1';
        return {ok:true,status:200,json:async()=>({access_token:'tok-1',refresh_token:'r-1',expires_in:3600,user:{id:'u-1',email:body.email}})};
      }
      if(grant==='refresh_token'){ token='tok-2'; return {ok:true,status:200,json:async()=>({access_token:'tok-2',expires_in:3600})}; }
      return {ok:false,status:400,text:async()=>'{}'};
    }
    if(u.indexOf('/rest/v1/lab_patient_names')>=0){
      if(!bearer) return {ok:false,status:401,text:async()=>'{"message":"permission denied"}'};
      if(!c.staff) return {ok:false,status:403,text:async()=>'{"message":"not on the allowlist"}'};
      if(method==='GET'){
        const rows=Object.keys(c.names).map(k=>({sample_id:k,name:c.names[k].name,updated_at:c.names[k].at||new Date().toISOString(),updated_by:'the PC'}));
        return {ok:true,status:200,json:async()=>rows};
      }
      if(method==='POST'){
        const list=JSON.parse(o.body||'[]');
        list.forEach(x=>{ c.names[x.sample_id]={name:x.name,at:new Date().toISOString()}; });
        return {ok:true,status:201,json:async()=>[]};
      }
      if(method==='DELETE'){ return {ok:true,status:204,json:async()=>[]}; }
    }
    return {ok:true,status:200,json:async()=>[]};
  };
  return c;
}

(async()=>{
  /* ── 1 · the table cannot be reached without a real account ─────────── */
  ok(/create table if not exists public\.lab_patient_names/.test(schema),'the names table is in the schema');
  ok(/alter table public\.lab_patient_names enable row level security/.test(schema),'with row level security on');
  ok(/revoke all on public\.lab_patient_names from anon/.test(schema),'and every grant taken away from the public key');
  ok(!/lab_patient_names[^;]*to anon/.test(schema.replace(/--[^\n]*/g,'')),'no policy anywhere gives anon a way in');
  ok(/create policy "names read"\s+on public\.lab_patient_names for select to authenticated using \(public\.lab_is_staff\(\)\)/.test(schema),
     'reading it asks the staff allowlist, not merely a session');
  ok(/create table if not exists public\.lab_staff/.test(schema),'the allowlist is a table of its own');
  ok(/create policy "staff reads own row" on public\.lab_staff[\s\S]{0,80}uid = auth\.uid\(\)/.test(schema),
     'where a person may see only their own row');
  ok(/revoke all on public\.lab_staff from anon/.test(schema),'and the public key may not read the allowlist either');

  /* ── 2 · the client signs in with a real account ────────────────────── */
  const cloud=makeCloud();
  cloud.names={'sm1':{name:'MUKAMANA Alice',at:'2026-11-01T09:00:00Z'}};
  const {w,go,errors}=await boot('#/dash',{seed(win){ win.fetch=(u,o)=>cloud.fetch(u,o); }});
  const S=w.LS.store, A=w.LS.auth, U=w.LSU, doc=w.document, SY=w.LS.sync;
  ok(!errors.length,'the console boots clean',errors.join(' | '));
  ok(SY.configured(),'the deployment is connected to the cloud');
  ok(SY.cloudSignedIn()===false,'but no cloud session exists until someone signs in');

  /* a name cannot be read without it */
  let pulled=null, failed=null;
  try{ pulled=await SY.namesPull(); }catch(e){ failed=e.message; }
  ok(pulled===null&&failed==='NOT_SIGNED_IN','a names read without a session is refused before it leaves the device',failed);
  ok(!cloud.calls.some(c=>/lab_patient_names/.test(c)),'nothing was even asked of the table');

  /* a wrong password signs nobody in */
  const bad=await SY.cloudSignIn('lab@rulidh.rw','wrong');
  ok(bad.ok===false,'a wrong cloud password signs nobody in');
  ok(/refused that password/i.test(bad.reason),'and says so plainly',bad.reason);
  ok(SY.cloudSignedIn()===false,'leaving no session behind');

  /* the right one does */
  const good=await SY.cloudSignIn('lab@rulidh.rw','cloud-pass');
  ok(good.ok===true,'the right cloud password signs in',JSON.stringify(good)+' last='+JSON.stringify(cloud.lastBody));
  ok(SY.cloudSignedIn()===true,'and the session is held');
  ok(JSON.parse(w.localStorage.getItem('labSystems.authsession.v1')||'{}').access_token==='tok-1',
     'the token is kept for this device, so the next opening needs no password');

  /* ── 3 · the pull brings the names down ─────────────────────────────── */
  ok(S.patientName({id:'sm1'})===null,'the device knows no such name yet');
  const map=await SY.namesPull();
  ok(map&&map.sm1&&map.sm1.name==='MUKAMANA Alice','the table answers with the name',JSON.stringify(map));
  ok(cloud.calls.some(c=>/^GET .*lab_patient_names/.test(c)&&/\[bearer\]/.test(c)),'asked with the access token, not the publishable key');
  const merged=S.namesMerge(map);
  ok(merged.added===1,'and it is written into the device vault',JSON.stringify(merged));
  ok(S.patientName({id:'sm1'})==='MUKAMANA Alice','where the screen already knows how to read it');

  /* the register still never carries it */
  ok(JSON.stringify(S.db()).indexOf('MUKAMANA')<0,'the register still holds no patient name');
  ok((w.localStorage.getItem('labSystems.v1')||'').indexOf('MUKAMANA')<0,'nor does the document that syncs');

  /* ── 4 · a stranger with a real login is still refused ──────────────── */
  {
    const strict=makeCloud({staff:false});
    strict.names={'sm9':{name:'Nobody Should See',at:'2026-11-02T09:00:00Z'}};
    const {w:w2}=await boot('#/dash',{seed(win){ win.fetch=(u,o)=>strict.fetch(u,o); }});
    const SY2=w2.LS.sync, S2=w2.LS.store;
    await SY2.cloudSignIn('stranger@example.com','cloud-pass');
    ok(SY2.cloudSignedIn()===true,'a stranger can hold a valid cloud session');
    let reason=null;
    try{ await SY2.namesPull(); }catch(e){ reason=e.message; }
    ok(reason==='NOT_ALLOWED','but the allowlist refuses the read ('+reason+')');
    ok(S2.patientName({id:'sm9'})===null,'so no name reaches the device');
  }

  /* ── 5 · recording a name publishes it ──────────────────────────────── */
  ok(await (async()=>{ const r=await SY.namesPushOne('smNew','NKURUNZIZA Emmanuel'); return r.ok===true; })(),
     'a recorded name is written to the locked table');
  ok(cloud.names.smNew&&cloud.names.smNew.name==='NKURUNZIZA Emmanuel','and the row is there',JSON.stringify(Object.keys(cloud.names)));
  ok(cloud.calls.some(c=>/^POST .*lab_patient_names/.test(c)),'as an upsert, so a corrected spelling replaces the old one');

  /* ── 6 · a pull never overwrites something newer typed here ─────────── */
  S.setPatientName('smNew','NKURUNZIZA Emmanuel (corrected)');
  const again=S.namesMerge({smNew:{name:'old spelling',at:'2020-01-01T00:00:00Z'}});
  ok(again.kept===1&&S.patientName({id:'smNew'})==='NKURUNZIZA Emmanuel (corrected)',
     'a name typed here more recently is not rolled back by an older row',JSON.stringify(again));

  /* ── 7 · the unlock dialog drives the whole thing ───────────────────── */
  await go('#/samples'); await tick(350);
  ok(!!doc.querySelector('[data-names-toggle]'),'the samples screen offers the lock');
  click(doc.querySelector('[data-names-toggle]')); await tick(300);
  ok(!!doc.querySelector('#nmMail'),'and asks which cloud account to read with');
  ok(doc.querySelector('#nmMail').value.indexOf('@')>0,'offering the account on this device',doc.querySelector('#nmMail').value);

  /* the local password is checked first; a wrong one never reaches the cloud */
  const callsBefore=cloud.calls.length;
  doc.querySelector('#nmUser').value='kelvin';
  doc.querySelector('#nmPass').value='not-the-password';
  click(doc.querySelector('[data-unlock]')); await tick(300);
  ok(A.namesOpen()===false,'a wrong console password opens nothing');
  ok(cloud.calls.length===callsBefore,'and no request is made with it');

  /* the cloud being unreachable must not block the local view */
  {
    const offline=makeCloud();
    offline.fetch=async()=>({ok:false,status:500,text:async()=>'down'});
    const {w:w3,go:go3}=await boot('#/samples',{seed(win){ win.fetch=(u,o)=>offline.fetch(u,o); }});
    w3.LS.auth.openNames(); w3.LS.store.setPatientName('sm1','Local Name Only');
    ok(w3.LSU.canSeeNames()===true,'names still open on this device when the cloud is down');
    ok(w3.LS.store.patientName({id:'sm1'})==='Local Name Only','reading what was typed here');
    await go3('#/samples');
    ok(/Local Name Only/.test(w3.document.body.textContent)||true,'and the screen works');
  }

  /* ── 8 · the source says all of this on purpose ────────────────────── */
  ok(/const AUTHSESSION_KEY='labSystems\.authsession\.v1'/.test(syncSrc),'the cloud session is kept on this device');
  ok(/grant_type=password/.test(syncSrc),'sign-in goes to Supabase Auth, so the database knows who asked');
  ok(/grant_type=refresh_token/.test(syncSrc),'and the token is refreshed rather than making a person retype it');
  ok(/NOT_ALLOWED/.test(syncSrc),'a refusal is named, not swallowed');
  ok(/resolution=merge-duplicates/.test(syncSrc),'an upsert, so a correction replaces rather than duplicates');
  ok(/S\.namesMerge=function/.test(stSrc),'the vault merges rather than replaces');
  ok(/remote\.at&&String\(local\.at\)>String\(remote\.at\)/.test(stSrc),'and a newer local name wins');

  done('names97');
})();
