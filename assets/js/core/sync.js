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

/* Deep links into the Supabase dashboard. The project reference is the first label of
   a *.supabase.co host, so the app can point straight at the switch that is missing
   instead of describing where it lives. Custom domains get no link. */
function projectRef(){
  const u=cfg().url; if(!u) return null;
  try{
    const h=new URL(u).hostname;
    const m=/\.supabase\.(co|in)$/i.test(h)?h.split('.')[0]:null;
    return m&&/^[a-z0-9]{10,}$/i.test(m)?m:null;
  }catch(e){ return null; }
}
SY.projectRef=projectRef;
SY.dashboardUrl=function(path){
  const ref=projectRef();
  return ref?'https://supabase.com/dashboard/project/'+ref+'/'+(path||''):null;
};
SY.authProvidersUrl=()=>SY.dashboardUrl('auth/providers');
SY.authUsersUrl=()=>SY.dashboardUrl('auth/users');
SY.sqlEditorUrl=()=>SY.dashboardUrl('sql/new');

/* A visitor reads the shared register with the public coordinates in shared.js —
   no account of their own, no settings saved on their device, and a mode that can
   only pull. That is why a fresh or incognito window shows the real PBF marks
   instead of the built-in sample register. */
function sharedForVisitor(){
  const v=window.LS_SHARED;
  if(!v||!v.endpoint||!v.key) return null;
  if(!(LS.auth&&LS.auth.isVisitor&&LS.auth.isVisitor())) return null;
  return v;
}
function cfg(){
  const vis=sharedForVisitor();
  if(vis) return {url:baseUrl(vis.endpoint), raw:vis.endpoint, key:String(vis.key).trim(),
    email:'', password:'', anonAuth:true, live:true, pollMs:15000, pushMs:700,
    mode:'pull', enabled:true, visitor:true};
  const c=S.settings().cloud||{};
  return {url:baseUrl(c.endpoint), raw:(c.endpoint||''), key:(c.anonKey||'').trim(),
    email:(c.email||'').trim(), password:c.password||'', anonAuth:!!c.anonAuth,
    live:c.live!==false, pollMs:Math.max(800,Number(c.pollMs)||2500), pushMs:Math.max(150,Number(c.pushMs)||700),
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
    return authErr('This project has anonymous sign-ins switched off, so Supabase refuses to create a session. Turn it on here: '
      +(SY.authProvidersUrl()||'Supabase dashboard → Authentication → Sign In / Providers')
      +' — the switch is called “Allow anonymous sign-ins”. Or fill in a project user email and password instead.');
  }
  if(r.status===422&&/signups? (are )?(not allowed|disabled)|signup is disabled/i.test(msg)){
    return authErr('This project has sign-ups disabled, so no session can be created from the app. Either turn on “Allow anonymous sign-ins” in Authentication → Sign In / Providers, or create a user in Authentication → Users and type its email and password.');
  }
  if(r.status===400&&/invalid login credentials/i.test(msg)){
    let anonymousAllowed=null;
    try{ const st=await SY.authSettings(false); if(st&&st.external) anonymousAllowed=!!st.external.anonymous_users; }catch(e){}
    const e=authErr('Supabase does not recognise that email and password. This is the app user from Authentication → Users, not the login you use on supabase.com. Create one there (Add user → Auto confirm), or use the same route as the other device — if that one runs on an anonymous session, this one needs the same.');
    e.badCredentials=true;
    e.anonymousAllowed=anonymousAllowed;
    return e;
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

/* `/auth/v1/settings` is public and reports the project's Auth switches. Asking it
   first turns "Anonymous sign-ins are disabled" from a surprise into a sentence with a
   link, and it costs one request that is cached for a minute. */
let settingsCache={at:0, val:null};
SY.authSettings=async function(force){
  const c=cfg();
  if(!c.url||!c.key) return null;
  if(!force && settingsCache.val && Date.now()-settingsCache.at<60000) return settingsCache.val;
  try{
    const r=await fetch(c.url+'/auth/v1/settings',{headers:{'apikey':c.key}});
    if(!r.ok) return settingsCache.val;
    const j=await r.json();
    settingsCache={at:Date.now(), val:j};
    return j;
  }catch(e){ return settingsCache.val; }
};

/* 1 — anonymous session. POST /auth/v1/signup with an empty body. */
async function anonymousSignIn(force){
  const c=cfg();
  /* An explicit test must not be answered from a minute-old cache: the operator may
     have flipped the toggle ten seconds ago. */
  const st=await SY.authSettings(!!force);
  if(st&&st.external&&st.external.anonymous_users===false){
    throw authErr('This project has anonymous sign-ins switched off, so Supabase refuses to create a session. Turn it on here: '
      +(SY.authProvidersUrl()||'Supabase dashboard → Authentication → Sign In / Providers')
      +' (the switch is called “Allow anonymous sign-ins”; it takes effect immediately). Or use the other route: create a user in Authentication → Users and type its email and password above.');
  }
  const r=await fetch(c.url+'/auth/v1/signup',{
    method:'POST',
    headers:{'apikey':c.key,'Content-Type':'application/json'},
    body:'{}'
  });
  const body=await r.text();
  if(!r.ok) throw await authError(r, body, c, 'anonymous');
  let j={}; try{ j=JSON.parse(body); }catch(e){}
  if(!j.access_token) throw authErr('Supabase answered but created no session. Check that “Allow anonymous sign-ins” is on in '
    +(SY.authProvidersUrl()||'Authentication → Sign In / Providers')+'.');
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
  if(c.anonAuth) return anonymousSignIn(force);
  if(!c.email||!c.password) return null;
  const r=await fetch(c.url+'/auth/v1/token?grant_type=password',{
    method:'POST',
    headers:{'apikey':c.key,'Content-Type':'application/json'},
    /* A password pasted from a note can carry a trailing space or newline; Supabase
       compares it exactly, so trim the invisible ends and keep everything else. */
    body:JSON.stringify({email:c.email, password:String(c.password).replace(/^[\s"']+|[\s"']+$/g,'')})
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
    else if(c.anonAuth) await signIn(true);
    const r=await request(TABLE+'?select=id,revision,updated_at&limit=1');
    if(r.status===404){
      /* PostgREST answers 404 both for "no such table" (PGRST205) and for a path that
         does not exist. The body tells us which: a missing table is a five-second fix,
         a wrong address is not, and they must not read the same. */
      const body=(await r.text())||'';
      const missing=/PGRST20[0-9]|Could not find the table|relation .* does not exist/i.test(body);
      if(missing) return {ok:false, tableMissing:true, reason:'Your project answered and accepted the key — but the table lab_registers does not exist yet. Open '+(SY.sqlEditorUrl()||'Supabase → SQL Editor')+' → New query, paste the schema, press Run, then test again. The app can copy the SQL: press "Copy the table SQL" below.'};
      return {ok:false, reason:'Supabase answered 404 at '+c.url+' — the address must be only https://<project>.supabase.co, with no path. ('+body.slice(0,120)+')'};
    }
    if(r.status===401||r.status===403) return {ok:false, reason:'Supabase said no ('+r.status+'). '+(cfg().email?'Check the login email and password from Authentication → Users, and that schema.sql was run.':'The table only allows signed-in users, so fill the login email and password as well — or the publishable key runs as anonymous.')};
    if(!r.ok) return {ok:false, reason:'Supabase answered '+r.status+'. '+((await r.text())||'').slice(0,140)};
    const rows=await r.json();
    return {ok:true, remote:rows[0]||null};
  }catch(e){
    if(e&&e.auth) return {ok:false, reason:e.message, badCredentials:!!e.badCredentials, anonymousAllowed:e.anonymousAllowed===undefined?null:e.anonymousAllowed};
    if(/^Supabase (sign-in failed|refused|does not recognise|rejected|created no session)/.test(e.message||'')) return {ok:false, reason:e.message};
    return {ok:false, reason:'Could not reach Supabase — is this device online? ('+e.message+')'};
  }
};

SY.pull=async function(){
  const c=cfg(); if(!c.url||!c.key) throw new Error('Sync is not configured');
  const q=s=>TABLE+'?id=eq.'+encodeURIComponent(ROW_ID)+'&select='+s;
  let r=await request(q(COLS_FULL));
  let body='';
  if(!r.ok){
    body=(await r.text())||'';
    if(missingColumn(r,body)){
      r=await request(q(COLS_LEAN));
      if(!r.ok) throw new Error('Pull failed ('+r.status+') '+((await r.text())||'').slice(0,140));
      const rows=await r.json();
      setState({schemaNote:'The table is missing the client_id column — run supabase/schema.sql again to add it.'});
      return noteRow(rows[0]||null);
    }
    body=body.slice(0,140);
  }
  if(r.status===404) throw new Error('The lab_registers table does not exist yet');
  if(!r.ok) throw new Error('Pull failed ('+r.status+') '+body);
  const rows=await r.json();
  return noteRow(rows[0]||null);
};

SY.push=async function(opts){
  if(LS.auth&&LS.auth.isVisitor&&LS.auth.isVisitor()) throw new Error('This is a read-only visitor view — nothing is published from here.');
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
/* ——— The visitor's read —————————————————————————————
   One pull, silent, and it reports what arrived so the strip can say it out loud.
   Nothing is written back: the role has no `edit`, push refuses, and the mode is
   `pull`, so three separate things would have to break before a visitor could
   overwrite the register. */
SY.visitorRead=async function(){
  if(!(LS.auth&&LS.auth.isVisitor&&LS.auth.isVisitor())) return {ok:false, reason:'not a visitor'};
  const v=sharedForVisitor();
  if(!v) return {ok:false, reason:'No shared register is configured for visitors.'};
  try{
    const row=await SY.pull();
    if(!row||!row.data) return {ok:true, empty:true, counts:SY.tally(null)};
    const before=SY.tally(S.db());
    applyRemote(row);
    const after=SY.tally(S.db());
    setState({lastPullAt:U.nowISO(), lastRevision:row.revision||null, lastError:null});
    return {ok:true, before:before, after:after, revision:row.revision||null,
      updated_at:row.updated_at||null, updated_by:row.updated_by||null};
  }catch(e){
    return {ok:false, reason:(e&&e.message)||'Could not read the shared register',
      anonymousAllowed:(e&&e.anonymousAllowed)===undefined?null:e.anonymousAllowed};
  }
};
/* One press — or one page becoming visible — asks the shared copy whether it moved and
   takes it if it did. Quiet by default; `loud` puts a toast up when the answer is
   'nothing new' too, so a phone can be checked without guessing. */
SY.refresh=async function(opts){
  opts=opts||{};
  if(!SY.configured()) return {ok:false, reason:'Cloud sync is off'};
  if(LS.auth&&LS.auth.isVisitor&&LS.auth.isVisitor()){
    const res=await SY.visitorSync();
    if(res&&res.ok) { try{ refreshScreen(); }catch(e){} }
    if(opts.loud&&res&&res.ok) UI.toast(res.action==='pulled'?'Register updated from the shared copy':'Already up to date',{type:'ok'});
    return res;
  }
  const res=await SY.sync({auto:true, quiet:!opts.loud});
  if(opts.loud&&res&&res.ok){
    const pulled=res.action==='pulled';
    UI.toast(pulled?'Register updated from the shared copy':(res.action==='noop'?'Already up to date':'Synced'),{type:'ok'});
  }
  return res;
};
/* 'Show me what the other device has' — an explicit pull that does not weigh local edits.
   A restore point of this device is written first (inside applyRemote), so the press can
   always be undone from Data & sync. This is what the freshness chip calls. */
SY.pullLatest=async function(){
  if(!SY.configured()) return {ok:false, reason:'Cloud sync is off'};
  try{
    const row=await SY.pull();
    if(!row||!row.data) return {ok:false, reason:'The shared copy is empty — there is nothing to read yet.'};
    const before=SY.tally(S.db());
    applyRemote(row);
    return {ok:true, action:'pulled', before:before, after:SY.tally(S.db()),
      revision:row.revision||null, updated_at:row.updated_at||null, updated_by:row.updated_by||null};
  }catch(e){
    return {ok:false, reason:(e&&e.message)||'Could not read the shared copy'};
  }
};
/* How stale is what is on this screen? Used by the header chip. */
SY.freshness=function(){
  const st=state();
  const at=st.lastPullAt||st.lastCheckAt||st.lastPushAt;
  if(!at) return {known:false, ms:null, text:'not synced yet'};
  const ms=Date.now()-new Date(at).getTime();
  return {known:true, ms:ms, at:at, text:U.relTime(at)};
};
/* A visitor's poll: ask for the revision, pull only when it moved. Reading the whole
   document every fifteen seconds would be wasteful and would fight the browser cache. */
SY.visitorSync=async function(){
  if(!(LS.auth&&LS.auth.isVisitor&&LS.auth.isVisitor())) return {ok:false, reason:'not a visitor'};
  const seen=Number(state().lastRevision||0);
  let v=null;
  try{ v=await SY.remoteVersion(); }catch(e){ return {ok:false, reason:(e&&e.message)||'Could not reach the shared copy'}; }
  if(!v) return {ok:true, action:'noop'};
  if(Number(v.revision||0)<=seen) { setState({lastCheckAt:U.nowISO()}); return {ok:true, action:'noop'}; }
  return SY.visitorRead();
};
SY.visitorReady=function(){ return !!sharedForVisitor(); };

/* ——— What is actually in each copy ———————————————————————————
   "My PBF marks are gone on the other browser" is always one question: what does the
   shared copy hold? These counts answer it without moving a record. A browser that has
   never been given the project URL and key can only show the built-in seed, so the
   counts differ for a reason the card can state. */
SY.tally=function(db){
  db=db||{};
  const n=a=>(a&&a.length)||0;
  const marks=((db.pbfVisits)||[]).reduce((t,v)=>{
    const a=(v&&v.answers)||{};
    Object.keys(a).forEach(k=>{ if(a[k]!=null&&a[k]!=='') t++; });
    return t;
  },0);
  return {samples:n(db.samples), staff:n(db.staff), leaves:n(db.leaves), referrals:n(db.referrals),
    equipment:n(db.equipment), trainings:n(db.trainings), pbfVisits:n(db.pbfVisits),
    pbfMarks:marks, pbfQuestions:n(db.pbfQuestions), audit:n(db.audit)};
};
SY.localTally=function(){ return SY.tally(S.db()); };

/* The shared copy, read in full once, for the comparison table. */
SY.remoteTally=async function(){
  const c=cfg(); if(!c.url||!c.key) return {ok:false, reason:'Cloud sync is off — add the project URL and the API key.', counts:null};
  try{
    const row=await SY.pull();
    if(!row||!row.data) return {ok:true, empty:true, counts:SY.tally(null), revision:null, updated_at:null};
    return {ok:true, counts:SY.tally(row.data), revision:row.revision||null,
      updated_at:row.updated_at||null, updated_by:row.updated_by||null,
      bytes:JSON.stringify(row.data).length};
  }catch(e){
    return {ok:false, reason:(e&&e.message)||'Could not read the shared copy', counts:null};
  }
};

/* Publish the WHOLE register on demand — every sample, every roster, every PBF mark.
   The automatic loop already pushes the whole document; this exists because "is it
   really all up there?" deserves a button that answers with the revision it wrote. */
SY.publishAll=async function(){
  return SY.push();
};

/* The other direction, named for what it does: replace this browser with the cloud. */
SY.replaceFromCloud=async function(){
  const row=await SY.pull();
  if(!row||!row.data) return {ok:false, reason:'The shared copy is empty — nothing to download.'};
  const before=SY.tally(S.db());
  applyRemote(row);
  return {ok:true, before:before, after:SY.tally(S.db()), revision:row.revision||null,
    updated_at:row.updated_at||null, updated_by:row.updated_by||null};
};

/* ——— Setup code —————————————————————————————————————
   Moving to another browser — a new phone, an incognito window, a second PC — needs the
   four values again. A code carries the non-secret ones (address, publishable key, mode,
   anonymous flag) as text the operator can carry himself. No password is ever in it. */
SY.setupCode=function(){
  const c=cfg(); if(!c.url||!c.key) return null;
  const pack={v:1,u:c.url,k:c.key,m:c.mode||'push-pull',a:!!c.anonAuth};
  try{ return btoa(unescape(encodeURIComponent(JSON.stringify(pack)))); }catch(e){ return null; }
};
SY.applySetupCode=function(code){
  let txt=String(code||'').trim();
  if(!txt) return {ok:false, reason:'Paste the code first.'};
  let pack=null;
  try{ pack=JSON.parse(decodeURIComponent(escape(atob(txt)))); }catch(e){ pack=null; }
  if(!pack){ try{ pack=JSON.parse(txt); }catch(e){} }   /* tolerate a raw JSON block */
  if(!pack||!pack.u||!pack.k) return {ok:false, reason:'That does not look like a setup code.'};
  const url=baseUrl(pack.u);
  if(!/^https?:\/\//i.test(String(url||''))) return {ok:false, reason:'The code has no usable project address.'};
  if(keyKind(pack.k)==='secret') return {ok:false, reason:'That code carries the secret key — never put it in a browser.'};
  return {ok:true, url:url, key:String(pack.k).trim(), mode:pack.m||'push-pull', anonAuth:!!pack.a};
};

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
    row('Anonymous sign-ins',anon,anon?'Allowed — the "Anonymous session" route will work.':'Off. Turn it on at '+(SY.authProvidersUrl()||'Authentication → Sign In / Providers → Allow anonymous sign-ins')+', or use a project user.');
    /* Anonymous sessions are real sessions: row-level security cannot tell them apart from
       a person. With the door open, anyone holding the publishable key could read or replace
       this register. Say so in the same breath as "it works", while there is still time. */
    if(anon){
      let patients=0;
      try{ patients=(S.db().samples||[]).filter(x=>x&&x.patientName).length; }catch(e){}   /* records, not names — every name is already 'Confidential' */
      row('Register privacy',patients===0,
        patients===0
          ? 'Anonymous sessions are on. This register holds no patient names yet — fine for now, but close this door before it does: create a user in Authentication → Users, switch every device to it, then turn Allow anonymous sign-ins off.'
          : 'Anonymous sessions are on and this register already holds '+patients+' patient name'+(patients===1?'':'s')+'. The publishable key is public by design, so anyone holding it could open a session and read or replace the register. Create a user in Authentication → Users, switch every device to it, then turn Allow anonymous sign-ins off.');
    }
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
  applyingRemote=true;
  try{
    S.restorePoint();               // the local copy is never lost
    S.importJSON(remote.data);
    if(S.clearPending) S.clearPending();   // this device now matches the cloud exactly
    setState({lastPullAt:U.nowISO(), lastRevision:remote.revision||null, lastError:null});
  }finally{ applyingRemote=false; }
  SY.emit('pulled');
  refreshScreen();
  return true;
}
/* A pulled change should be on screen at once — but never under the user's fingers.
   If a field has focus, the redraw waits for the field to lose it. */
let pendingRender=false;
function editable(el){
  if(!el) return false;
  const t=(el.tagName||'').toLowerCase();
  return t==='input'||t==='textarea'||t==='select'||el.isContentEditable;
}
function refreshScreen(){
  if(typeof document==='undefined') return;
  try{
    const active=document.activeElement;
    if(editable(active)){ pendingRender=true; return; }
    if(document.body.classList.contains('modal-open')) return;   // do not fight a dialog
    if(window.LS&&LS.shell&&LS.shell.route) LS.shell.route({keepScroll:true});
  }catch(e){}
}
if(typeof document!=='undefined'){
  document.addEventListener('focusout',()=>{
    if(!pendingRender) return;
    pendingRender=false;
    setTimeout(()=>{ if(!editable(document.activeElement)) refreshScreen(); },60);
  },true);
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
  /* The store counts commits that have not reached the cloud. That counter is the
     truth; "never pushed" is only a fallback for a register that has never synced and
     must not be treated as a pending edit once a pull has brought us up to date. */
  const pending=S.pendingChanges?S.pendingChanges():null;
  if(pending!==null) return pending>0;
  return !state().lastPushAt;
}

/* The table keeps the writing device in `client_id` (see supabase/schema.sql). Asking
   for a column that does not exist makes PostgREST answer 42703 and the whole pull fails,
   which is exactly what "column lab_registers.device_id does not exist" was. One list, in
   one place, and a fallback that still works on a table built from an older schema. */
const COLS_FULL='id,data,revision,updated_at,client_id,updated_by';
const COLS_LEAN='id,data,revision,updated_at,updated_by';
const COLS_VERSION='revision,updated_at,client_id,updated_by';
const COLS_VERSION_LEAN='revision,updated_at,updated_by';
function noteRow(row){
  if(!row) return row;
  /* accept either spelling so an old or a hand-made table keeps working */
  if(row.client_id==null && row.device_id!=null) row.client_id=row.device_id;
  if(row.device_id==null && row.client_id!=null) row.device_id=row.client_id;
  return row;
}
function missingColumn(r, body){
  return r.status===400 && /42703|does not exist/i.test(body||'');
}

/* The poll asks only for the revision: a few dozen bytes instead of the whole register.
   The full document is fetched only when the number moved. */
SY.remoteVersion=async function(){
  const c=cfg(); if(!c.url||!c.key) return null;
  const q=s=>TABLE+'?id=eq.'+encodeURIComponent(ROW_ID)+'&select='+s;
  let r=await request(q(COLS_VERSION));
  if(!r.ok){
    const body=(await r.text())||'';
    if(missingColumn(r,body)) r=await request(q(COLS_VERSION_LEAN));
  }
  if(r.status===404) return null;
  if(!r.ok) throw new Error('Version check failed ('+r.status+')');
  const rows=await r.json();
  return noteRow(rows[0]||null);
};

/* Replacing the register must not look like a local edit: without this flag the import
   would schedule a push straight back at the cloud (an echo loop between two devices). */
let applyingRemote=false;
/* ——— The sync cycle ————————————————————————————————— */
SY.sync=async function(opts){
  opts=opts||{};
  if(busy) return {ok:false, reason:'A sync is already running'};
  if(!SY.configured()) return {ok:false, reason:'Cloud sync is off — add the project URL and the API key.'};
  /* A visitor only ever reads — never through the staff cycle, which can push. */
  if(LS.auth&&LS.auth.isVisitor&&LS.auth.isVisitor()){
    busy=true;
    try{ return await SY.visitorSync(); }
    finally{ busy=false; }
  }
  if(opts.auto && typeof navigator!=='undefined' && navigator.onLine===false) return {ok:false, reason:'Offline'};
  busy=true; setState({running:true});
  const quiet=!!opts.quiet;
  try{
    const c=cfg();
    /* In a background poll, ask for the revision first and stop if nothing moved. */
    if(c.mode!=='push' && opts.auto){
      const v=await SY.remoteVersion();
      if(!v){                                   // nothing in the cloud yet
        if(hasLocalChanges()) { await SY.push(); return {ok:true, action:'created'}; }
        return {ok:true, action:'noop'};
      }
      const seen=Number(state().lastRevision||0);
      if(Number(v.revision||0)<=seen && !hasLocalChanges()){
        setState({lastCheckAt:U.nowISO(), running:false});
        return {ok:true, action:'noop'};
      }
    }
    const remote=await SY.pull();
    if(!remote){
      // nothing in the cloud yet — this device publishes the register
      await SY.push();
      if(!quiet) UI.toast('Register published to the shared cloud',{type:'ok'});
      return {ok:true, action:'created'};
    }
    if(newer(remote)){
      if(c.mode==='push' && !opts.force){
        setState({running:false});
        return {ok:false, reason:'Cloud copy is newer but this device is set to push only.'};
      }
      if(hasLocalChanges() && !opts.force){
        /* A background tick must never stop and ask: an edit typed here is the one the
           person can see, so it is published, and the other copy stays in restore points. */
        if(opts.auto && !state().lastPullAt){
          /* This browser has never held the shared register — it is showing the built-in
             seed. Publishing that over a real cloud copy is the one mistake that cannot
             be undone from here, so the background loop refuses and says why. */
          setState({running:false, conflictAt:U.nowISO(),
            conflictNote:'This browser has never received the shared register, so its own copy was NOT published over it. Open Data & sync and choose which one to keep.'});
          return {ok:false, reason:'This browser has never received the shared register'};
        }
        if(opts.auto){
          setState({conflictAt:U.nowISO(), conflictNote:'This device published over a newer cloud copy ('+(remote.updated_by||'another device')+').'});
          await SY.push();
          if(!quiet) UI.toast('Published this device — the other copy is in restore points',{type:'warn',duration:6000});
          return {ok:true, action:'pushed', conflict:true};
        }
        const choice=await conflictChoice(remote);
        if(choice==='remote'){ applyRemote(remote); UI.toast('Register updated from the other device',{type:'ok'}); return {ok:true, action:'pulled'}; }
        if(choice==='local'){ await SY.push(); UI.toast('This device published its register',{type:'ok'}); return {ok:true, action:'pushed'}; }
        return {ok:false, reason:'Kept this device unchanged'};
      }
      applyRemote(remote);
      if(!quiet) UI.toast('Register updated from the shared cloud',{type:'ok'});
      return {ok:true, action:'pulled'};
    }
    if(hasLocalChanges() || opts.force){
      await SY.push();
      return {ok:true, action:'pushed'};
    }
    setState({lastCheckAt:U.nowISO(), running:false});
    return {ok:true, action:'noop'};
  }catch(e){
    const msg=(e&&e.message)||'Sync did not finish';
    const schemaIssue=/42703|column .* does not exist/i.test(msg);
    setState({running:false, lastError:msg, schemaNote:schemaIssue?'The table does not match schema.sql — re-run it.':state().schemaNote});
    return {ok:false, reason:msg, schemaIssue:schemaIssue, badCredentials:!!(e&&e.badCredentials), anonymousAllowed:(e&&e.anonymousAllowed)===undefined?null:e.anonymousAllowed};
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
/* Two rhythms keep a room of devices on one register:

   • push — a local commit schedules a push after `pushMs` (0.7 s by default), so the
     change leaves the device almost as soon as the finger lifts;
   • poll — a background tick asks only for the revision number every `pollMs` (2.5 s),
     and pulls the document the moment it differs from the one this device last saw.

   Both are silent: no toasts, no dialogs, no redrawing under a focused field. Anything
   the person needs to know is shown once, at the moment it happens. */
SY.pushSoon=function(delay){
  if(LS.auth&&LS.auth.isVisitor&&LS.auth.isVisitor()) return;
  const c=cfg();
  clearTimeout(timer);
  timer=setTimeout(()=>{
    if(applyingRemote) return;
    SY.sync({auto:true, quiet:true}).catch(()=>{});
  }, delay==null?c.pushMs:delay);
};
SY.schedule=function(delay){ SY.pushSoon(delay); };

let liveTimer=null;
SY.liveState=function(){ return {on:!!liveTimer, busy:busy, last:state().lastCheckAt||null}; };
SY.startLive=function(){
  clearInterval(liveTimer);
  const c=cfg();
  if(!c.live||!SY.configured()){ liveTimer=null; SY.emit('live'); return; }
  liveTimer=setInterval(()=>{
    if(busy) return;
    if(typeof navigator!=='undefined' && navigator.onLine===false) return;
    if(typeof document!=='undefined' && document.visibilityState==='hidden') return;
    SY.sync({auto:true, quiet:true}).catch(()=>{});
  }, c.pollMs);
  SY.emit('live');
};
SY.stopLive=function(){ clearInterval(liveTimer); liveTimer=null; SY.emit('live'); };

/* Called whenever the session changes (sign in, sign out, enter as visitor): the loop is
   rebuilt from the current configuration instead of the one at boot. */
SY.restart=function(){
  SY.stopLive();
  if(SY.configured()) SY.startLive();
};
SY.start=function(){
  if(SY._started) return; SY._started=true;
  window.addEventListener('online',()=>{ if(SY.configured()){ SY.startLive(); SY.schedule(600); } });
  window.addEventListener('offline',()=>{});
  /* a tab that becomes visible again catches up immediately */
  if(typeof document!=='undefined'&&document.addEventListener){
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'&&SY.configured()) SY.sync({auto:true, quiet:true}).catch(()=>{});
    });
  }
  /* another tab of the same browser wrote to localStorage: take its copy */
  window.addEventListener('storage',ev=>{
    if(!ev||ev.key!==(S.STORAGE_KEY||'labSystems.v1')) return;
    try{ S.reloadFromStorage&&S.reloadFromStorage(); SY.emit('tab'); refreshScreen(); }catch(e){}
  });
  if(S.subscribe) S.subscribe(reason=>{
    if(applyingRemote) return;
    if(reason==='import'||reason==='reset') return;          /* those came from elsewhere */
    if(SY.configured()) SY.pushSoon();
  });
  if(SY.configured()) setTimeout(()=>{ SY.startLive(); SY.sync({auto:true, quiet:true}).catch(()=>{}); },1200);
  /* The privacy migration cleans the register on load. The shared copy must not keep
     the old names, so the cleaned register is published once, without being asked. */
  if(!(LS.auth&&LS.auth.isVisitor&&LS.auth.isVisitor()) && SY.configured()){
    setTimeout(()=>{
      try{
        const meta=S.db().meta||{};
        if(meta.patientNamesMasked && !meta.patientNamesPushed){
          SY.push().then(()=>{ S.commit(d=>{ d.meta.patientNamesPushed=true; },
            {action:'privacy.names.masked',entity:'samples',detail:'Patient names replaced with Confidential and published to the shared copy'}); }).catch(()=>{});
        }
      }catch(e){}
    },2500);
  }
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
/* One line for the header: what is true right now, not what happened last. */
SY.liveLabel=function(){
  if(!SY.configured()) return null;
  const st=state();
  if(typeof navigator!=='undefined'&&navigator.onLine===false) return {tone:'warn', text:'Offline — queued'};
  if(st.running) return {tone:'teal', text:'Syncing…'};
  if(st.lastError) return {tone:'rose', text:'Sync error'};
  if(liveTimer) return {tone:'teal', text:'Live · '+SY.statusText()};
  return {tone:'slate', text:SY.statusText()};
};
})();
