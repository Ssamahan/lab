/* Patient-name sync uses a separate, server-authorized Supabase project.
   Passwords and tokens stay in memory, never in the shared register. */
(function(){
'use strict';
const P=LS.privateNames={}, S=LS.store;
const URL='https://xakoyknvkktpcmyecoxx.supabase.co';
const KEY='sb_publishable_LP464vGRnwj3g-i6FtgxcA_WOU1R3k7'; // public key, NOT a secret
const META='labSystems.privateNames.baseline.v1';
let token=null, expires=0, busy=null, timer=null, ticker=null, resolving=false, rerun=false, conflicts=[], message='Private name sync: not signed in';
function showStatus(){document.querySelectorAll('[data-private-status]').forEach(el=>{el.textContent=message;});}
/* Only unmistakable display placeholders are treated as missing, never arbitrary names. */
function missingName(value){
  return value==null || (typeof value==='string' && (!value.trim() || /^[-–—]$/.test(value.trim()) || value.trim()===window.LSU.CONFIDENTIAL));
}
function allowed(){ return !!(LS.auth.user && LS.auth.user.id==='u1' && !(LS.auth.isVisitor&&LS.auth.isVisitor())); }
function baselines(){ try{const m=JSON.parse(localStorage.getItem(META)||'{}'); return m&&typeof m==='object'?m:{};}catch(e){return {};}}
function saveBase(m){ try{localStorage.setItem(META,JSON.stringify(m));return true;}catch(e){return false;} }
function guard(){ if(!allowed()||!token||Date.now()>=expires) throw Error('Sign in to private names again.'); }
function headers(){ guard(); return {'apikey':KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json'}; }
async function request(path,opts){
  const ac=new AbortController(), timeout=setTimeout(()=>ac.abort(),25000);
  try{
    const r=await fetch(URL+path,Object.assign({},opts,{signal:ac.signal,cache:'no-store'}));
    if(!r.ok){ if(r.status===401||r.status===403) throw Error('Private names sign-in or permission was rejected.'); throw Error('Private names server returned '+r.status+'.'); }
    return await r.json();
  }catch(e){ if(e.name==='AbortError') throw Error('Private names connection timed out. Local names remain on this device.'); throw e; }
  finally{clearTimeout(timeout);}
}
function uuid(){
  if(!crypto||!crypto.getRandomValues) throw Error('Secure random IDs are not available on this device.');
  const a=new Uint8Array(16);crypto.getRandomValues(a);a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
  const h=Array.from(a,x=>x.toString(16).padStart(2,'0')).join(''); return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
async function heads(){
  const all=[]; let offset=0;
  for(;;){
    guard(); const page=await request('/rest/v1/rpc/private_name_heads?limit=500&offset='+offset,{method:'POST',headers:headers(),body:'{}'});
    if(!Array.isArray(page)||page.length>500) throw Error('Unexpected private names response.');
    all.push(...page); if(page.length<500) return all; offset+=page.length;
  }
}
async function append(id,name,parent){
  const data=await request('/rest/v1/rpc/private_name_append',{method:'POST',headers:headers(),
    body:JSON.stringify({p_entry:uuid(),p_sample:id,p_name:name,p_parent:parent||null})});
  if(!data||!['saved','already_saved','conflict'].includes(data.status)) throw Error('Unexpected private names save response.');
  return data;
}
P.signIn=async function(email,password){
  if(!allowed()) throw Error('Sign in as Kelvin in the app first.');
  P.signOut();
  const j=await request('/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email:String(email).trim(),password:String(password)})});
  if(!allowed()||!j.access_token||!j.user||j.user.is_anonymous) throw Error('A private names account is required.');
  token=j.access_token; expires=Date.now()+Math.max(0,(Number(j.expires_in)||3600)-30)*1000;
  message='Private names connected';showStatus();
  // Verify server authorization before calling this a successful connection.
  try{ await heads(); }catch(e){ P.signOut(); throw e; }
  ticker=setInterval(()=>{ if(!P.connected()){if(token){message='Private names session expired; sign in again';showStatus();}return;} if(document.visibilityState!=='hidden') P.schedule(); },60000);
  return P.sync();
};
P.signOut=function(){token=null;expires=0;conflicts=[];message='Private name sync: not signed in';if(timer) clearTimeout(timer);timer=null;if(ticker)clearInterval(ticker);ticker=null;rerun=false;showStatus();};
P.connected=()=>allowed()&&!!token&&Date.now()<expires;
P.status=()=>message;
P.conflicts=()=>conflicts.map(c=>Object.assign({},c));
P.isMissingName=missingName;
P.sync=async function(){
  guard(); if(resolving) throw Error('A name conflict is being reviewed.'); if(busy) return busy;
  const session=token;
  busy=(async()=>{
    const remote=await heads(); guard(); if(session!==token) throw Error('Private names session changed.');
    const byId=new Map();remote.forEach(x=>{if(x&&typeof x.sample_id==='string') byId.set(x.sample_id,x);});
    const base=baselines(), samples=(S.db().samples||[]), issues=[];let pushed=0,pulled=0;
    for(const sample of samples){
      guard();if(session!==token) throw Error('Private names session changed.');
      if(!sample||!sample.id) continue;
      const id=String(sample.id), r=byId.get(id), local=S.patientName(sample), prior=base[id];
      if(missingName(local)){
        if(r && !missingName(r.patient_name)){
          /* A previous real baseline plus a placeholder might be an intentional edit;
             do not silently overwrite it. A placeholder with no real baseline is missing. */
          const localEntry=S.names()[id];
          const previous=(localEntry&&Array.isArray(localEntry.previousNames)?localEntry.previousNames.slice():[]);
          if(prior&&prior.name&&!previous.includes(prior.name)) previous.push(prior.name);
          const historical=previous.filter(n=>!missingName(n)&&n!==r.patient_name);
          if((local && prior && !missingName(prior.name)) || historical.length){
            issues.push({id,sampleId:sample.sampleId||id,local,remote:r.patient_name,entry:r.entry_id,previous:historical});continue;
          }
          if(!S.setPatientName(id,r.patient_name,{actor:'private names sync'})) throw Error('Could not save a name on this device; check storage.');
          base[id]={entry:r.entry_id,name:r.patient_name}; if(!saveBase(base)) throw Error('Could not save sync state on this device.');pulled++;
        }
        /* Never upload a dash or masking marker as a patient name. */
        continue;
      }
      if(r && local===r.patient_name){base[id]={entry:r.entry_id,name:r.patient_name}; if(!saveBase(base)) throw Error('Could not save sync state on this device.');continue;}
      if(r && (!prior||prior.entry!==r.entry_id||prior.name!==r.patient_name)){
        issues.push({id, sampleId:sample.sampleId||id,local,remote:r.patient_name,entry:r.entry_id});continue;
      }
      const result=await append(id,local,r?r.entry_id:null);
      guard();if(session!==token) throw Error('Private names session changed.');
      if(result.status==='conflict'){ issues.push({id,sampleId:sample.sampleId||id,local,remote:null,entry:null}); continue; }
      // Do not mark a later local edit as sent; its value will be picked up next time.
      base[id]={entry:result.entry_id,name:local};if(!saveBase(base)) throw Error('Name reached the private server, but sync state could not be saved locally.');pushed++;
    }
    conflicts=issues;message=issues.length?issues.length+' name conflict(s) need review':('Private names checked · '+pushed+' sent, '+pulled+' received');
    showStatus();return {pushed,pulled,conflicts:issues.length};
  })();
  try{return await busy;}catch(e){message=e.message||'Private names could not sync';showStatus();throw e;}finally{busy=null;if(rerun){rerun=false;P.schedule();}}
};
P.resolve=async function(id,choice){
  guard(); if(busy||resolving) throw Error('Wait for private names sync to finish.');
  resolving=true;
  try {
  const session=token, c=conflicts.find(x=>x.id===id), sample=(S.db().samples||[]).find(x=>x.id===id);
  if(!c||!sample||!c.entry||S.patientName(sample)!==c.local) throw Error('The record changed. Sync and review it again.');
  if(choice==='local'){
    if(missingName(c.local)) throw Error('The device value is a placeholder, not a name. Review the request form.');
    const result=await append(id,c.local,c.entry);
    guard(); if(session!==token) throw Error('Private names session changed.');
    if(result.status==='conflict') throw Error('The private copy changed. Sync and review it again.');
    const base=baselines();base[id]={entry:result.entry_id,name:c.local};if(!saveBase(base)) throw Error('Name saved remotely, but local sync state could not be saved.');
  }else if(choice==='remote'){
    if(missingName(c.remote)) throw Error('The private value is a placeholder, not a name. Review the request form.');
    const now=await heads(), current=now.find(x=>x.sample_id===id);
    guard(); if(session!==token) throw Error('Private names session changed.');
    if(!current||current.entry_id!==c.entry||S.patientName(sample)!==c.local) throw Error('The record changed. Sync and review it again.');
    if(!S.setPatientName(id,c.remote,{actor:'private names conflict review'})) throw Error('Could not save the selected name on this device.');
    const base=baselines();base[id]={entry:c.entry,name:c.remote};if(!saveBase(base)) throw Error('Could not save sync state on this device.');
  }else throw Error('Choose which name to use.');
  conflicts=conflicts.filter(x=>x.id!==id);
  } finally { resolving=false; }
  return P.sync();
};
P.schedule=function(){ if(!P.connected()) return; if(busy||resolving){rerun=true;return;} if(timer) clearTimeout(timer);timer=setTimeout(()=>{timer=null;P.sync().catch(()=>{});},1800); };
window.addEventListener('online',()=>P.schedule());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')P.schedule();});
})();
