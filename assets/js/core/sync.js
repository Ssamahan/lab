/* ============================================================================
   LAB SYSTEMS · SYNC — shared register over Supabase (optional, off by default)
   ----------------------------------------------------------------------------
   The console is offline-first: the register lives in localStorage and saving
   never waits for the network. This module is the shared copy that lets a phone
   and a PC see the same work.

   Transport: Supabase REST (PostgREST) with the project URL + anon key that the
   laboratory pastes into Settings → Cloud sync. Table: see supabase/schema.sql.

   Conflict model: one document, revision numbers. A pull only replaces the local
   register when the device has nothing unpushed; otherwise the user is asked. A
   restore point is written before anything is overwritten.
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, S=LS.store;
const SY=window.LS.sync={};
const TABLE='lab_registers';
const ROW_ID='ruli-dh';
const DEVICE_KEY='labSystems.deviceId.v1';
const STATE_KEY='labSystems.syncState.v1';
let busy=false, timer=null, listeners=[];

function cfg(){ const c=S.settings().cloud||{}; return {url:(c.endpoint||'').replace(/\/+$/,''),key:c.anonKey||'',mode:c.mode||'push-pull',enabled:!!(c.url||c.endpoint)&&!!c.anonKey}; }
SY.config=cfg;
SY.configured=()=>{ const c=cfg(); return !!(c.url&&c.key); };

function deviceId(){
  try{ let d=localStorage.getItem(DEVICE_KEY); if(!d){ d='dev-'+Math.random().toString(36).slice(2,10); localStorage.setItem(DEVICE_KEY,d); } return d; }catch(e){ return 'dev-anon'; }
}
SY.deviceId=deviceId;

function state(){ try{ return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{}; }catch(e){ return {}; } }
function setState(patch){ const next=Object.assign(state(),patch); try{ localStorage.setItem(STATE_KEY,JSON.stringify(next)); }catch(e){} SY.emit(); return next; }
SY.state=state;

function headers(extra){
  const c=cfg();
  return Object.assign({
    'apikey':c.key,
    'Authorization':'Bearer '+c.key,
    'Content-Type':'application/json'
  }, extra||{});
}
function endpoint(path){ return cfg().url+'/rest/v1/'+path; }

/* ——— Low level ————————————————————————————————————— */
SY.ping=async function(){
  const c=cfg();
  if(!c.url||!c.key) return {ok:false, reason:'Add the project URL and the anon key first.'};
  try{
    const r=await fetch(endpoint(TABLE+'?select=id,revision,updated_at&limit=1'),{headers:headers()});
    if(r.status===404) return {ok:false, reason:'The table is missing — run supabase/schema.sql in the project.'};
    if(r.status===401||r.status===403) return {ok:false, reason:'The key was rejected. Check the anon key and its row-level policies.'};
    if(!r.ok) return {ok:false, reason:'Supabase answered '+r.status+'. '+((await r.text())||'').slice(0,140)};
    const rows=await r.json();
    return {ok:true, remote:rows[0]||null};
  }catch(e){
    return {ok:false, reason:'Could not reach Supabase — is this device online? ('+e.message+')'};
  }
};

SY.pull=async function(){
  const c=cfg(); if(!c.url||!c.key) throw new Error('Sync is not configured');
  const r=await fetch(endpoint(TABLE+'?id=eq.'+encodeURIComponent(ROW_ID)+'&select=id,data,revision,updated_at,device_id,updated_by'),{headers:headers()});
  if(r.status===404) throw new Error('The lab_registers table does not exist yet');
  if(!r.ok) throw new Error('Pull failed ('+r.status+') '+((await r.text())||'').slice(0,120));
  const rows=await r.json();
  return rows[0]||null;
};

SY.push=async function(opts){
  const c=cfg(); if(!c.url||!c.key) throw new Error('Sync is not configured');
  const db=S.db();
  const payload=[{id:ROW_ID, data:db, client_id:deviceId(), updated_by:(LS.auth.user&&LS.auth.user.name)||'device'}];
  const r=await fetch(endpoint(TABLE+'?on_conflict=id'),{
    method:'POST',
    headers:headers({'Prefer':'resolution=merge-duplicates,return=representation'}),
    body:JSON.stringify(payload)
  });
  if(!r.ok) throw new Error('Push failed ('+r.status+') '+((await r.text())||'').slice(0,160));
  const rows=await r.json();
  const row=rows[0]||{};
  setState({lastPushAt:U.nowISO(), lastRevision:row.revision||null, pushedRevision:row.revision||null, lastError:null});
  if(S.clearPending) S.clearPending();
  const st=S.settings(); st.cloud.lastSync=U.nowISO(); S.save(true);
  return row;
};

/* ——— Applying a remote register —————————————————————— */
function applyRemote(remote){
  if(!remote||!remote.data) return false;
  S.restorePoint();                 // the local copy is never lost
  S.importJSON(remote.data);
  setState({lastPullAt:U.nowISO(), lastRevision:remote.revision||null, lastError:null});
  SY.emit('pulled');
  return true;
}
SY.applyRemote=applyRemote;

function newer(remote){
  if(!remote) return false;
  const st=state();
  if(!st.lastRevision) return true;
  return Number(remote.revision||0) > Number(st.lastRevision||0);
}

/* Does this device hold edits the cloud has not seen? The store tracks a dirty
   counter on every commit; we compare it with the last successful push. */
function hasLocalChanges(){
  const pending=S.pendingChanges?S.pendingChanges():0;
  if(pending>0) return true;
  const st=state();
  return !st.lastPushAt;
}

/* ——— The sync cycle ————————————————————————————————— */
SY.sync=async function(opts){
  opts=opts||{};
  if(busy) return {ok:false, reason:'A sync is already running'};
  if(!SY.configured()) return {ok:false, reason:'Cloud sync is off — add the project URL and anon key.'};
  busy=true; setState({running:true});
  try{
    const c=cfg();
    const remote=await SY.pull();
    if(!remote){
      // nothing in the cloud yet — this device publishes the register
      await SY.push();
      UI.toast('Register published to the shared cloud',{type:'ok'});
      return {ok:true, action:'created'};
    }
    if(newer(remote)){
      if(c.mode==='push' && !opts.force){
        setState({running:false});
        return {ok:false, reason:'Cloud copy is newer but this device is set to push only.'};
      }
      if(hasLocalChanges() && !opts.force){
        const choice=await conflictChoice(remote);
        if(choice==='remote'){ applyRemote(remote); UI.toast('Register updated from the other device',{type:'ok'}); return {ok:true, action:'pulled'}; }
        if(choice==='local'){ await SY.push(); UI.toast('This device published its register',{type:'ok'}); return {ok:true, action:'pushed'}; }
        return {ok:false, reason:'Kept this device unchanged'};
      }
      applyRemote(remote);
      UI.toast('Register updated from the shared cloud',{type:'ok'});
      return {ok:true, action:'pulled'};
    }
    if(hasLocalChanges() || opts.force){
      await SY.push();
      return {ok:true, action:'pushed'};
    }
    setState({lastCheckAt:U.nowISO(), running:false});
    return {ok:true, action:'noop'};
  }catch(e){
    setState({running:false, lastError:e.message});
    return {ok:false, reason:e.message};
  }finally{
    busy=false; setState({running:false});
  }
};

/* Both copies changed at once: show what is at stake and let the operator choose.
   Nothing is overwritten until they do. */
function conflictChoice(remote){
  const localStamp=state().lastPushAt||'never';
  return UI.confirm({
    title:'Two devices changed the register',
    body:'<p class="small">The shared copy was updated '+U.relTime(remote.updated_at)+' by '+U.esc(remote.updated_by||'another device')+', and this device has changes the cloud has not seen ('+(state().lastPushAt?'last pushed '+U.relTime(localStamp):'never pushed')+').</p>'
      +'<p class="small" style="margin-top:8px">A snapshot of this device is taken before anything is replaced, so the other version can always be restored.</p>'
      +'<ul class="small" style="margin:10px 0 0 16px;line-height:1.7"><li><b>Use the other device</b> — pull the shared copy over this one.</li><li><b>Publish this device</b> — overwrite the shared copy with what is here.</li></ul>',
    confirm:'Publish this device', cancel:'Use the other device'
  }).then(ok=>ok?'local':'remote');
}

/* ——— Wiring ————————————————————————————————————— */
SY.schedule=function(delay){
  clearTimeout(timer);
  timer=setTimeout(()=>{ SY.sync({auto:true}).catch(()=>{}); }, delay||1500);
};
SY.start=function(){
  if(SY._started) return; SY._started=true;
  window.addEventListener('online',()=>{ if(SY.configured()) SY.schedule(800); });
  if(S.subscribe) S.subscribe(reason=>{ if(SY.configured() && reason!=='sync.pull') SY.schedule(1800); });
  if(SY.configured()) setTimeout(()=>{ SY.sync({auto:true}).catch(()=>{}); },1200);
};
SY.emit=function(kind){ listeners.forEach(fn=>{ try{ fn(kind,state()); }catch(e){} }); };
SY.onChange=function(fn){ listeners.push(fn); return ()=>{ listeners=listeners.filter(x=>x!==fn); }; };
SY.statusText=function(){
  const st=state();
  if(!SY.configured()) return 'Local only';
  if(st.running) return 'Syncing…';
  if(st.lastError) return 'Sync error';
  if(st.lastPushAt) return 'Synced '+U.relTime(st.lastPushAt);
  if(st.lastPullAt) return 'Pulled '+U.relTime(st.lastPullAt);
  return 'Connected · not yet synced';
};
})();
