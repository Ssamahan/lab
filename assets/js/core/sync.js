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

/* The only thing the console needs is the PROJECT address:
     https://abcdefgh.supabase.co
   People paste all sorts of things — the REST endpoint shown under "API", a link to
   the dashboard, an address with no scheme. Sent unchanged, `…/rest/v1` ends up in
   front of `/auth/v1/token`, PostgREST answers that path with
   `404 PGRST125 Invalid path specified in request URL`, and it looks like a password
   problem when it is only a pasted path. So the address is reduced to its origin. */
function baseUrl(raw){
  let u=String(raw||'').trim().replace(/\s+/g,'');
  if(!u) return '';
  if(!/^https?:\/\//i.test(u)) u='https://'+u;
  let parsed;
  try{ parsed=new URL(u); }catch(e){ return u.replace(/\/+$/,''); }
  /* a project on a custom domain keeps its path prefix; a supabase.co host does not */
  let path=parsed.pathname.replace(/\/+$/,'');
  if(/\/(rest|auth|storage|realtime|graphql|functions)\/v[0-9]+/i.test(path)){
    path=path.replace(/\/(rest|auth|storage|realtime|graphql|functions)\/v[0-9]+.*$/i,'');
  }
  if(/supabase\.(co|in)$/i.test(parsed.hostname)) path='';
  return parsed.origin+path;
}
SY.baseUrl=baseUrl;

function cfg(){ const c=S.settings().cloud||{};
  return {url:baseUrl(c.endpoint), raw:(c.endpoint||''), key:(c.anonKey||'').trim(),
    email:(c.email||'').trim(), password:c.password||'', anonAuth:!!c.anonAuth,
    mode:c.mode||'push-pull', enabled:!!c.endpoint&&!!c.anonKey}; }
SY.config=cfg;
SY.configured=()=>{ const c=cfg(); return !!(c.url&&c.key); };

function deviceId(){
  try{ let d=localStorage.getItem(DEVICE_KEY); if(!d){ d='dev-'+Math.random().toString(36).slice(2,10); localStorage.setItem(DEVICE_KEY,d); } return d; }catch(e){ return 'dev-anon'; }
}
SY.deviceId=deviceId;

function state(){ try{ return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{}; }catch(e){ return {}; } }
function setState(patch){ const next=Object.assign(state(),patch); try{ localStorage.setItem(STATE_KEY,JSON.stringify(next)); }catch(e){} SY.emit(); return next; }
SY.state=state;

/* Supabase row-level policies grant the table to the `authenticated` role, so the
   API key alone is not enough — the console needs a session. Two honest ways to get
   one, and neither is the login you use on supabase.com:

     1. a user created in Authentication → Users (email + password), or
     2. an anonymous session (Authentication → Sign In / Providers → Allow anonymous
        sign-ins), which Supabase treats as `authenticated` but which anyone holding
        the publishable key could also create.

   The session is kept in localStorage so a page reload reuses it instead of minting a
   new anonymous user every time (anonymous sign-ups are rate limited per IP). An
   expiring session is refreshed with its refresh token before the password is used. */
const SESSION_KEY='labSystems.syncSession.v1';
let session={token:null, exp:0, who:null, refresh:null, anonymous:false};
function loadSession(){
  try{ const j=JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); if(j&&j.token) session=Object.assign(session,j); }catch(e){}
  return session;
}
function saveSession(){
  try{ localStorage.setItem(SESSION_KEY,JSON.stringify(session)); }catch(e){}
}
function forgetSession(){ session={token:null,exp:0,who:null,refresh:null,anonymous:false}; try{ localStorage.removeItem(SESSION_KEY); }catch(e){} }
SY.forgetSession=forgetSession;
loadSession();

function adopt(j, fallbackWho){
  session.token=j.access_token||null;
  session.refresh=j.refresh_token||session.refresh||null;
  session.anonymous=!!(j.user&&j.user.is_anonymous);
  session.who=(j.user&&j.user.email)||fallbackWho||(session.anonymous?'anonymous':null);
  session.exp=Date.now()+Math.max(60,(j.expires_in||3600)-90)*1000;
  saveSession(); SY.emit();
  return session.token;
}

async function authError(r, body, c, mode){
  let msg=body.slice(0,180), code='';
  try{ const j=JSON.parse(body); msg=j.error_description||j.msg||j.error||j.message||msg; code=j.code||j.code_error||''; }catch(e){}
  if(r.status===404||code==='PGRST125'){
    return authErr('Supabase sign-in failed (404) — there is no auth service at '+c.url+'/auth/v1/token. Either the project address is wrong, or it has a path on the end (use only https://<project>.supabase.co).');
  }
  if(/email_not_confirmed/i.test(code)||/email not confirmed/i.test(msg)){
    return authErr('Supabase found that user but it was never confirmed, so it refuses the sign-in. In Authentication → Users open the user and press Confirm, or untick "Confirm email" in Authentication → Sign In / Providers → Email. Supabase only shows the "Auto Confirm User" switch while email confirmations are ON.');
  }
  if(r.status===422&&/anonymous/i.test(msg)){
    return authErr('Supabase refused an anonymous session — turn it on: dashboard → Authentication → Sign In / Providers → Allow anonymous sign-ins. Or tick the email-and-password route instead.');
  }
  if(r.status===400&&/invalid login credentials/i.test(msg)){
    return authErr('Supabase does not recognise that email and password. This is the app user from Authentication → Users, not the login you use on supabase.com. Create one there (Add user → Auto confirm) or switch to an anonymous session.');
  }
  if(r.status===422&&/email/i.test(msg)){
    return authErr('Supabase rejected the sign-in: '+msg+'. Use a real-looking address such as lab@rulidh.rw.');
  }
  if(r.status===401&&/api key/i.test(msg)){
    return authErr('Supabase sign-in failed (401) — the API key was not accepted. Copy the publishable key again; it must not carry a trailing space or quote.');
  }
  const err=new Error('Supabase sign-in failed ('+r.status+') — '+msg);
  err.auth=true;
  return err;
}
function authErr(msg){ const e=new Error(msg); e.auth=true; return e; }

/* 1 — anonymous session. POST /auth/v1/signup with an empty body. */
async function anonymousSignIn(){
  const c=cfg();
  const r=await fetch(c.url+'/auth/v1/signup',{
    method:'POST',
    headers:{'apikey':c.key,'Content-Type':'application/json'},
    body:'{}'
  });
  const body=await r.text();
  if(!r.ok) throw await authError(r, body, c, 'anonymous');
  let j={}; try{ j=JSON.parse(body); }catch(e){}
  if(!j.access_token) throw authErr('Supabase created no session for the anonymous sign-in. Turn on Allow anonymous sign-ins in Authentication → Sign In / Providers.');
  return adopt(j);
}

/* 2 — refresh an expiring session with its refresh token. Never throws: a failed
   refresh just means "sign in again". */
async function refreshSession(){
  const c=cfg();
  if(!session.refresh) return null;
  try{
    const r=await fetch(c.url+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',
      headers:{'apikey':c.key,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:session.refresh})
    });
    if(!r.ok) return null;
    const j=await r.json();
    return adopt(j, session.who);
  }catch(e){ return null; }
}

async function signIn(force){
  const c=cfg();
  if(!force && session.token && Date.now()<session.exp) return session.token;
  if(!force && session.refresh && Date.now()>=session.exp){
    const t=await refreshSession();
    if(t) return t;
  }
  if(c.anonAuth) return anonymousSignIn();
  if(!c.email||!c.password) return null;
  const r=await fetch(c.url+'/auth/v1/token?grant_type=password',{
    method:'POST',
    headers:{'apikey':c.key,'Content-Type':'application/json'},
    body:JSON.stringify({email:c.email, password:c.password})
  });
  const body=await r.text();
  if(!r.ok) throw await authError(r, body, c, 'password');
  let j={}; try{ j=JSON.parse(body); }catch(e){}
  return adopt(j, c.email);
}
SY.signIn=signIn;
SY.session=()=>session;
/* Supabase now issues two key shapes. The legacy anon key is a JWT and may travel in
   both headers; the new `sb_publishable_…` / `sb_secret_…` keys are opaque strings
   that belong in `apikey` ONLY — send one as a Bearer token and the gateway rejects
   the request as an invalid JWT. `sb_secret_…` bypasses row-level security and must
   never be pasted into a browser at all. */
function keyKind(k){
  k=k||'';
  if(/^sb_publishable_/.test(k)) return 'publishable';
  if(/^sb_secret_/.test(k)) return 'secret';
  if(/^eyJ/.test(k)) return 'jwt';
  return k?'other':'none';
}
SY.keyKind=keyKind;
async function headers(extra){
  const c=cfg();
  const h={'apikey':c.key, 'Content-Type':'application/json'};
  let sessionJWT=null;
  if((c.email&&c.password)||c.anonAuth) sessionJWT=await signIn(false);   /* a real sign-in error must be seen */
  /* Authorization carries the signed-in user's JWT and nothing else. With no session
     only a legacy anon JWT may double as the bearer; a publishable key may not. */
  if(sessionJWT) h.Authorization='Bearer '+sessionJWT;
  else if(keyKind(c.key)==='jwt') h.Authorization='Bearer '+c.key;
  return Object.assign(h, extra||{});
}
/* One retry with a fresh token: access tokens expire after an hour. */
async function request(path, opts){
  opts=opts||{};
  const send=async()=>fetch(endpoint(path), Object.assign({},opts,{headers:await headers(opts.extra)}));
  let r=await send();
  if((r.status===401||r.status===403) && ((cfg().email&&cfg().password)||cfg().anonAuth)){
    try{ forgetSession(); await signIn(true); r=await send(); }catch(e){}
  }
  return r;
}
function endpoint(path){ return cfg().url+'/rest/v1/'+path; }

/* ——— Low level ————————————————————————————————————— */
SY.ping=async function(){
  const c=cfg();
  if(!c.url||!c.key) return {ok:false, reason:'Add the project URL and the API key first.'};
  if(keyKind(c.key)==='secret') return {ok:false, reason:'That is the secret key (sb_secret_…). It bypasses every access rule, so it must never be in a browser. Copy the publishable key instead.'};
  try{
    /* Test connection must prove the login, not reuse a token from an hour ago. */
    if(c.email&&c.password){ forgetSession(); await signIn(true); }
    else if(c.anonAuth) await signIn(false);
    const r=await request(TABLE+'?select=id,revision,updated_at&limit=1');
    if(r.status===404){
      /* PostgREST answers 404 both for "no such table" (PGRST205) and for a path that
         does not exist. The body tells us which: a missing table is a five-second fix,
         a wrong address is not, and they must not read the same. */
      const body=(await r.text())||'';
      const missing=/PGRST20[0-9]|Could not find the table|relation .* does not exist/i.test(body);
      if(missing) return {ok:false, tableMissing:true, reason:'Your project answered and accepted the key — but the table lab_registers does not exist yet. Open Supabase → SQL Editor → New query, paste the schema, press Run, then test again. The SQL is in the app: press "Copy the table SQL" below.'};
      return {ok:false, reason:'Supabase answered 404 at '+c.url+' — the address must be only https://<project>.supabase.co, with no path. ('+body.slice(0,120)+')'};
    }
    if(r.status===401||r.status===403) return {ok:false, reason:'Supabase said no ('+r.status+'). '+(cfg().email?'Check the login email and password from Authentication → Users, and that schema.sql was run.':'The table only allows signed-in users, so fill the login email and password as well — or the publishable key runs as anonymous.')};
    if(!r.ok) return {ok:false, reason:'Supabase answered '+r.status+'. '+((await r.text())||'').slice(0,140)};
    const rows=await r.json();
    return {ok:true, remote:rows[0]||null};
  }catch(e){
    if(e&&e.auth) return {ok:false, reason:e.message};
    if(/^Supabase (sign-in failed|refused|does not recognise|rejected|created no session)/.test(e.message||'')) return {ok:false, reason:e.message};
    return {ok:false, reason:'Could not reach Supabase — is this device online? ('+e.message+')'};
  }
};

SY.pull=async function(){
  const c=cfg(); if(!c.url||!c.key) throw new Error('Sync is not configured');
  const r=await request(TABLE+'?id=eq.'+encodeURIComponent(ROW_ID)+'&select=id,data,revision,updated_at,device_id,updated_by');
  if(r.status===404) throw new Error('The lab_registers table does not exist yet');
  if(!r.ok) throw new Error('Pull failed ('+r.status+') '+((await r.text())||'').slice(0,120));
  const rows=await r.json();
  return rows[0]||null;
};

SY.push=async function(opts){
  const c=cfg(); if(!c.url||!c.key) throw new Error('Sync is not configured');
  const db=S.db();
  const payload=[{id:ROW_ID, data:db, client_id:deviceId(), updated_by:(LS.auth.user&&LS.auth.user.name)||'device'}];
  const r=await request(TABLE+'?on_conflict=id',{
    method:'POST',
    extra:{'Prefer':'resolution=merge-duplicates,return=representation'},
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

/* The schema lives in the repository and is served next to the app, so the setup screen
   can hand the operator the exact SQL without them opening GitHub. */
SY.schemaSQL=async function(){
  const paths=['supabase/schema.sql','./supabase/schema.sql','/lab/supabase/schema.sql'];
  for(const p of paths){
    try{
      const r=await fetch(p,{cache:'no-cache'});
      if(r.ok){ const t=await r.text(); if(/create table/i.test(t)) return t; }
    }catch(e){}
  }
  return null;
};
SY.diagnose=SY.diagnose; /* keep name */
/* ——— Setup diagnosis ————————————————————————————————
   "Test connection" answers one question. This answers all of them at once, in the
   order they fail, so a setup mistake is named instead of guessed at. `/auth/v1/settings`
   is a public endpoint: it reports whether email confirmations are on and whether
   anonymous sign-ins are allowed, without revealing anything about the data. */
SY.diagnose=async function(){
  const c=cfg(), out=[];
  const row=(label,ok,detail)=>out.push({label:label, ok:!!ok, detail:detail||''});
  if(!c.url||!c.key){ row('Project address and key',false,'Fill in the project URL and the publishable key first.'); return out; }
  row('Project address',true,c.url+(baseUrl(c.raw)!==String(c.raw||'').trim()?'  (repaired from "'+String(c.raw).trim()+'")':''));

  let settings=null;
  try{
    const r=await fetch(c.url+'/auth/v1/settings',{headers:{'apikey':c.key}});
    if(r.ok){ settings=await r.json(); row('Auth service reachable',true,''); }
    else row('Auth service reachable',false,'GET '+c.url+'/auth/v1/settings answered '+r.status+'. Check the project address and the publishable key.');
  }catch(e){ row('Auth service reachable',false,'Network: '+e.message); }

  if(settings){
    if(settings.mailer_autoconfirm){
      row('Email confirmation',true,'Confirmations are OFF in this project, so every new user is confirmed automatically — that is why there is no "Auto Confirm user" switch to look for.');
    } else {
      row('Email confirmation',false,'Confirmations are ON, so a new user waits for a confirmation that never comes. Tick "Auto Confirm User" in the Add-user dialog, or open the user and press Confirm.');
    }
    const anon=!!(settings.external&&settings.external.anonymous_users);
    row('Anonymous sign-ins',anon,anon?'Allowed — the "Anonymous session" route will work.':'Off. Turn on Authentication → Sign In / Providers → Allow anonymous sign-ins, or use a project user.');
    if(settings.disable_signup && !anon) row('Sign-ups',false,'Sign-ups are disabled and there is no anonymous route, so only a user you create in Authentication → Users can sign in.');
  }

  if(c.email&&c.password){
    try{ forgetSession(); await signIn(true); row('Project user sign-in',true,(session.who||c.email)+' — accepted'); }
    catch(e){ row('Project user sign-in',false,e.message); }
  } else if(c.anonAuth){
    try{ await signIn(false); row('Anonymous session',true,'Session created'); }
    catch(e){ row('Anonymous session',false,e.message); }
  } else {
    row('Session',false,'Neither a project user nor an anonymous session is configured. Fill the email and password, or tick "Anonymous session".');
  }

  /* Probe the table with whatever credential we hold, so a failed sign-in still shows
     whether the table itself exists — those are two different mistakes. */
  try{
    const h={'apikey':c.key};
    if(session.token) h.Authorization='Bearer '+session.token;
    else if(keyKind(c.key)==='jwt') h.Authorization='Bearer '+c.key;
    const r=await fetch(endpoint(TABLE+'?select=id&limit=1'),{headers:h});
    if(r.status===404){
      const body=(await r.text().catch(()=>''))||'';
      if(/PGRST20[0-9]|Could not find the table|does not exist/i.test(body)) row('Table lab_registers',false,'The table does not exist yet. SQL Editor → New query → paste the schema → Run.');
      else row('Table lab_registers',false,'Answered 404 for a path that is not a table — check the project address has no path on the end ('+c.url+').');
    }
    else if(r.status===401||r.status===403) row('Table lab_registers',false,'The table answered '+r.status+': it exists, but this request was not signed in.');
    else if(r.ok){ const rows=await r.json(); row('Table lab_registers',true,rows.length?'The shared register exists and is readable.':'Empty and ready for the first push.'); }
    else row('Table lab_registers',false,'Answered '+r.status+'.');
  }catch(e){ row('Table lab_registers',false,e.auth?e.message:'Network: '+e.message); }

  const bad=out.filter(x=>!x.ok).length;
  setState({diagnosedAt:U.nowISO()});
  return out;
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
