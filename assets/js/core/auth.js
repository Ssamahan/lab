/* ============================================================================
   LAB SYSTEMS · AUTH — roles, sessions, 2FA (real TOTP), login history
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU; const C=window.LSC; const A={}; window.LS=window.LS||{}; LS.auth=A;
const SESSION_KEY='labSystems.session.v2';
/* Passwords are stored as salted PBKDF2-HMAC-SHA256 (310 000 iterations), derived in
   assets/js/core/crypto.js over WebCrypto. Earlier builds stored one unsalted SHA-256
   pass here in a public repository — equivalent to publishing the password with a
   puzzle printed next to it. Every seeded hash below is a fresh PBKDF2 record of a
   password that is NOT in this file; the laboratory manager distributes the new
   passwords out of band. The old single-pass hash is kept only to recognise and retire
   records saved on existing devices: the first sign-in with an old-format hash migrates
   it and requires a new password before the console opens. */
function legacySha256(str){
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x2e1b2138,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const bytes=[]; for(const ch of String(str)){
    const c=ch.codePointAt(0);
    if(c<0x80) bytes.push(c);
    else if(c<0x800) bytes.push(0xc0|c>>6,0x80|c&63);
    else if(c<0x10000) bytes.push(0xe0|c>>12,0x80|(c>>6)&63,0x80|c&63);
    else bytes.push(0xf0|c>>18,0x80|(c>>12)&63,0x80|(c>>6)&63,0x80|c&63);
  }
  const bitLen=bytes.length*8;
  bytes.push(0x80);
  while(bytes.length%64!==56) bytes.push(0);
  const hi=Math.floor(bitLen/4294967296), lo=bitLen>>>0;
  bytes.push(hi>>>24&255,hi>>>16&255,hi>>>8&255,hi&255,lo>>>24&255,lo>>>16&255,lo>>>8&255,lo&255);
  const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let off=0;off<bytes.length;off+=64){
    const w=new Array(64).fill(0);
    for(let i=0;i<16;i++) w[i]=bytes[off+i*4]<<24|bytes[off+i*4+1]<<16|bytes[off+i*4+2]<<8|bytes[off+i*4+3];
    for(let i=16;i<64;i++){
      const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3);
      const s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,h]=H;
    for(let i=0;i<64;i++){
      const S1=rotr(e,6)^rotr(e,11)^rotr(e,25);
      const ch=(e&f)^(~e&g);
      const t1=(h+S1+ch+K[i]+w[i])>>>0;
      const S0=rotr(a,2)^rotr(a,13)^rotr(a,22);
      const maj=(a&b)^(a&c)^(b&c);
      const t2=(S0+maj)>>>0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
  }
  return H.map(x=>('00000000'+x.toString(16)).slice(-8)).join('');
}
/* Kept for one purpose only: recognising and retiring the old-format hash on devices
   that saved one. New code must never produce it. */
A.hash=legacySha256;

const USERS=[
  /* passHash records are `pbkdf2$310000$<salt>$<hash>` — never a plain-text or bare
     SHA-256 password. Emails are deliberately absent: this file downloads to every
     visitor of a public URL, and staff contact details belong in the laboratory's
     own channels, not in a bundle. */
  {id:'u1', name:'Kelvin SAMAHANI', role:'Admin', username:'kelvin', passHash:'pbkdf2$310000$7369ce287d633f2be733620d9bec6392$e962aeac468a189d19eefd19110e2658e1694699e1c9ae3424e4d2419c6f46ca', email:'', staffId:'s1', title:'Laboratory Manager', twoFactor:false},
  {id:'u2', name:'Aurelie YANSONEYE', role:'Manager', username:'aurelie', passHash:'pbkdf2$310000$76981a1fbf58d46c7bf99503400d439b$e923bec0b847d34b6038bb573d45d7fa2d3f4207b875c4e68b7fb65cd93dd686', email:'', staffId:'s4', title:'HIV Lab Quality Corp', twoFactor:false},
  {id:'u3', name:'Jean Paul NSENGIYUMVA', role:'Technologist', username:'jeanpaul', passHash:'pbkdf2$310000$21225adaee4c34f5f0dc0dba551f1f32$5b48c7b871bd357e46c09c5a5fc351caed07e9bfb27c98db83779cc2dc08b484', email:'', staffId:'s6', title:'Lab Quality Manager', twoFactor:true},
  {id:'u4', name:'District Reviewer', role:'Viewer', username:'viewer', passHash:'pbkdf2$310000$7789c3bbd32275e03d46abccd4838086$e9c21f7b0967d4fcbd1dd0d2be6f0c88c552355465f893b168dd88b08b3e8824', email:'', staffId:null, title:'PBF assessment team', twoFactor:false},
  {id:'u5', name:'Gakenke Review Panel', role:'Reviewer', username:'reviewer', passHash:'pbkdf2$310000$ad36d71e4eff6be157cb362a28df70d7$e291679730b4d74a644511951bf6b9e8e18031766558d910f2ce8f280224fb3a', email:'', staffId:null, title:'District review panel', twoFactor:false}
];
A.users=USERS;
/* A VISITOR is a real Viewer, not an account: the register opens read-only with
   export and download, and three surfaces are never mounted — Training Revenue,
   the Settings tab and the Data & sync tab. No password, no write, no cloud —
   and the register this role reads is redacted first (see store.js). */
A.VISITOR={id:'u0', name:'Visitor', role:'Viewer', username:'visitor', email:'', staffId:null,
  title:'Public visitor · read only', twoFactor:false, visitor:true};
A.isVisitor=function(){ return !!(A.user && A.user.visitor); };
A.enterAsVisitor=function(){
  A.user=A.VISITOR;
  A.session={userId:'u0', visitor:true, started:Date.now(), last:Date.now(),
    expires:Date.now()+1000*60*60*8, persist:false, method:'visitor'};
  try{ sessionStorage.setItem(SESSION_KEY, JSON.stringify(A.session)); }catch(e){}
  return A.user;
};
A.ROLES=['Admin','Manager','Technologist','Reviewer','Viewer'];
A.user=null;
A.session=null;

const PERMS={
  Admin:['view','edit','approve','revenue','staff','settings','security','export','delete','patient_names'],
  Manager:['view','edit','approve','revenue','export','patient_names'],
  /* Bench staff may see a patient name, once they have re-entered their own password. */
  Technologist:['view','edit','export','patient_names'],
  /* Reviewers read the register and can act on what they are asked to verify —
     they sign off assessments but never see revenue, security or settings. */
  Reviewer:['view','edit','approve','export'],
  Viewer:['view','export'],
  'Read-only':['view']
};
const ROLE_KEY='labSystems.roles.v1';
function savedRoles(){ try{ return JSON.parse(localStorage.getItem(ROLE_KEY)||'{}')||{}; }catch(e){ return {}; } }
/* ——— A changed password has to survive the reload ————————————
   Roles and 2FA were saved here and passwords were not: `setPassword` wrote the new
   hash into the array in memory, and the next reload put the seeded hash back. The
   effect was vicious — sign in with the password you set, then be told "Incorrect
   password" the moment a second check asked for it, which is exactly what the patient
   names ask for. The hash is part of the same record now, and so is the TOTP secret. */
function persistRoles(){
  const map={};
  USERS.forEach(u=>{ map[u.id]={role:u.role, twoFactor:!!u.twoFactor, passHash:u.passHash||null, totpSecret:u.totpSecret||null}; });
  try{ localStorage.setItem(ROLE_KEY,JSON.stringify(map)); }catch(e){}
}
A.applySavedRoles=function(){
  const map=savedRoles();
  USERS.forEach(u=>{
    const o=map[u.id]; if(!o) return;
    if(o.role && A.ROLES.indexOf(o.role)>=0) u.role=o.role;
    if(typeof o.twoFactor==='boolean') u.twoFactor=o.twoFactor;
    /* Both record formats are accepted on read; the legacy one is retired at login. */
    if(o.passHash && (C.isModern(o.passHash)||C.isLegacy(o.passHash))) u.passHash=o.passHash;
    if(o.totpSecret && /^[A-Z2-7]{16,64}$/i.test(String(o.totpSecret))) u.totpSecret=String(o.totpSecret).toUpperCase();
  });
};
/* Admin-only: change what an account may do. The session keeps working, the
   next permission check simply answers differently. */
A.setRole=function(id, role){
  const u=USERS.find(x=>x.id===id); if(!u) return {ok:false, reason:'Unknown account.'};
  if(A.ROLES.indexOf(role)<0) return {ok:false, reason:'Unknown role.'};
  if(u.id==='u1' && role!=='Admin') return {ok:false, reason:'The owner account must stay Admin.'};
  if(!A.user || A.user.role!=='Admin') return {ok:false, reason:'Only an Admin can change roles.'};
  const from=u.role; u.role=role; persistRoles();
  LS.store.audit({action:'auth.role_change', entity:'users', entityId:u.id, actor:A.user.name, role:A.user.role, detail:u.name+' · '+from+' → '+role});
  LS.store.save();
  return {ok:true, from, to:role};
};
A.setTwoFactor=function(id, on){
  const u=USERS.find(x=>x.id===id); if(!u) return false;
  if(on && !u.totpSecret) return false;   /* turning 2FA on requires enrolment — see A.enrollTwoFactor */
  u.twoFactor=!!on; persistRoles();
  LS.store.audit({action:on?'auth.2fa_enabled':'auth.2fa_disabled', entity:'users', entityId:u.id, actor:A.user&&A.user.name, role:A.user&&A.user.role, detail:u.name});
  LS.store.save();
  return true;
};
A.can=function(action){
  if(!A.user) return false;
  if(A.user.role==='Admin') return true;
  return (PERMS[A.user.role]||['view']).indexOf(action)>=0;
};
A.init=function(){
  A.applySavedRoles();
  let s=null;
  try{ s=JSON.parse(localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY)||'null'); }catch(e){}
  if(s && s.expires && s.expires>Date.now()){
    A.session=s;
    A.user=s.visitor?A.VISITOR:(USERS.find(u=>u.id===s.userId)||null);
    if(A.user) A.touch();
  } else { A.session=null; A.user=null; }
  return A.user;
};
A.touch=function(){
  if(!A.session) return;
  A.session.last=Date.now();
  A.session.expires=Date.now()+1000*60*60*24;
  try{
    if(A.session.persist) localStorage.setItem(SESSION_KEY,JSON.stringify(A.session));
    else sessionStorage.setItem(SESSION_KEY,JSON.stringify(A.session));
  }catch(e){}
};
/* Re-entering a password for one action, without signing in again. The same check the
   login screen makes, nothing stored, and the answer says only yes or no. This is what
   stands in front of the patient names: a session left open on a bench PC is not, by
   itself, permission to read who the specimens belong to. */
A.verifyCredentials=async function(username,password){
  const u=USERS.find(x=>x.username.toLowerCase()===String(username||'').trim().toLowerCase());
  if(!u) return {ok:false, reason:'No account matches that username.'};
  const good=await checkPassword(u,password);
  if(!good) return {ok:false, reason:'Incorrect password.'};
  return {ok:true, user:u};
};
/* ——— Password verification, and retiring the old hash format ————————
   A legacy record verifies against the old single-pass SHA-256, then is re-derived
   with PBKDF2 and a fresh salt immediately, on this device, and saved. The caller is
   told the record was legacy so the sign-in flow can require a new password — the old
   hash (and its published twin in an old build) must not keep working. */
async function checkPassword(u,password){
  const given=String(password==null?'':password);
  if(C.isModern(u.passHash)) return C.verifyPassword(given,u.passHash);
  if(C.isLegacy(u.passHash)){
    const same=legacySha256(given)===u.passHash;
    if(same){
      u.passHash=await C.hashPassword(given); persistRoles();
      LS.store.audit({action:'security.password.migrated', entity:'users', entityId:u.id, actor:u.name, detail:'Old-format password hash replaced with PBKDF2 on this device'});
      LS.store.save();
    }
    return same;
  }
  return false;
}
/* ——— Names revealed, for a while ————————————————————————
   Opened by re-entering a password, closed by pressing Hide, by leaving the screen, or by
   fifteen minutes passing with the tab in front. Kept in memory and in sessionStorage for
   this tab only, so closing the browser ends it. */
const NAMES_KEY='labSystems.names.open.v1';
const NAMES_WINDOW=15*60*1000;
let namesUntil=0, namesBy=null;
try{
  const saved=JSON.parse(sessionStorage.getItem(NAMES_KEY)||'null');
  if(saved&&saved.until>Date.now()){ namesUntil=saved.until; namesBy=saved.by||null; }
}catch(e){}
function persistNames(){
  try{
    if(namesUntil>0) sessionStorage.setItem(NAMES_KEY,JSON.stringify({until:namesUntil,by:namesBy}));
    else sessionStorage.removeItem(NAMES_KEY);
  }catch(e){}
}
/* ——— Whether showing the names asks for the password again ————————
   Default: it does not. Somebody already signed in as Admin, Manager or Technologist
   presses Show names and the column fills, audited, for fifteen minutes. A shared
   bench PC can be set to ask every time, in Security Center, and the choice is saved
   with the rest of the settings. */
A.askNamesPassword=function(){
  try{
    const s=LS.store.settings();
    return !!(s&&s.security&&s.security.askNamesPassword);
  }catch(e){ return false; }
};
A.setNamesPasswordPolicy=function(on){
  if(!A.can('settings')&&!A.can('security')) return {ok:false, reason:'Only an Admin can change this.'};
  LS.store.commit(d=>{ d.settings.security=d.settings.security||{}; d.settings.security.askNamesPassword=!!on; },
    {action:'security.names_policy',entity:'settings',detail:'Patient names '+(on?'require my password again':'open for a signed-in staff member')});
  return {ok:true, on:!!on};
};
A.namesOpen=function(){
  if(!A.can('patient_names')) return false;
  /* Kelvin requested names remain visible for his signed-in session. */
  if(A.user&&A.user.id==='u1') return true;
  if(!(namesUntil>Date.now())){ namesUntil=0; namesBy=null; return false; }
  return true;
};
A.namesUntil=function(){ return A.namesOpen()?namesUntil:0; };
A.namesRemainingMin=function(){ return A.namesOpen()?Math.max(0,Math.ceil((namesUntil-Date.now())/60000)):0; };
A.openNames=function(){
  if(!A.can('patient_names')) return false;
  namesUntil=Date.now()+NAMES_WINDOW; namesBy=A.user?A.user.username:null;
  persistNames(); return true;
};
A.closeNames=function(){ namesUntil=0; namesBy=null; persistNames(); };

/* ——— Trying passwords, and making trying slow —————————————————
   All authentication is local, so nothing stops a script from hammering the form except
   the form itself. Failures stack per account on this device: after the third the sign-in
   waits a minute, then two, five, fifteen. The counter is honest about the wait instead
   of pretending the password was wrong. */
const ATTEMPTS_KEY='labSystems.attempts.v1';
const DELAYS_MIN=[0,0,1,2,5,15];
function attempts(){ try{ return JSON.parse(localStorage.getItem(ATTEMPTS_KEY)||'{}')||{}; }catch(e){ return {}; } }
function saveAttempts(a){ try{ localStorage.setItem(ATTEMPTS_KEY,JSON.stringify(a)); }catch(e){} }
function attemptKey(username){ return String(username||'').trim().toLowerCase(); }
function failWait(username){
  const a=attempts(); const rec=a[attemptKey(username)];
  if(!rec||!rec.until||rec.until<=Date.now()) return 0;
  return Math.ceil((rec.until-Date.now())/1000);
}
function recordFailure(username){
  const a=attempts(); const k=attemptKey(username);
  const rec=a[k]||{count:0};
  rec.count=(Number(rec.count)||0)+1;
  const delay=DELAYS_MIN[Math.min(rec.count,DELAYS_MIN.length)-1]||0;
  rec.until=delay>0?Date.now()+delay*60000:0;
  rec.last=U.nowISO();
  a[k]=rec; saveAttempts(a);
  return delay;
}
function clearFailures(username){
  const a=attempts(); delete a[attemptKey(username)]; saveAttempts(a);
}
A.failWait=failWait;

A.login=async function({username,password,code,remember}){
  const wait=failWait(username);
  if(wait>0) return {ok:false, reason:'Too many tries. Wait '+(wait>=60?Math.ceil(wait/60)+' minutes':wait+' seconds')+' before the next attempt.', throttled:true};
  const u=USERS.find(x=>x.username.toLowerCase()===String(username||'').trim().toLowerCase());
  if(!u) return {ok:false, reason:'No account matches that username.'};
  const wasLegacy=C.isLegacy(u.passHash);
  const good=await checkPassword(u,password);
  if(!good){ const delay=recordFailure(username); A.logAttempt(false,u);
    return {ok:false, reason:delay?('Too many tries. Wait '+delay+' minute'+(delay===1?'':'s')+' before the next attempt.'):'Incorrect password.'}; }
  /* A retired-format record just proved itself: the password works but it is the one
     that used to sit hashed in a public file. The console opens only after a new one. */
  if(wasLegacy){
    return {ok:false, needRotate:true, username:String(username||'').trim(), password:String(password==null?'':password), remember:!!remember,
      reason:'The old password format is being retired on this device. Choose a new password to continue.'};
  }
  /* 2FA is a real TOTP code from an authenticator app (see crypto.js). An account with
     the flag but no secret yet — set before real codes existed, or on a device that has
     never enrolled — enrols now, at sign-in, and the first code confirms it. */
  if(u.twoFactor && u.totpSecret){
    const okCode=await C.totpVerify(u.totpSecret, code);
    if(!okCode){ const delay=recordFailure(username); A.logAttempt(false,u);
      return {ok:false, reason:'That code did not match. Codes rotate every 30 seconds — try the current one.', needCode:true}; }
  } else if(u.twoFactor && !u.totpSecret){
    const secret=C.newTotpSecret();
    return {ok:false, needEnroll:true, username:String(username||'').trim(), password:String(password==null?'':password), remember:!!remember,
      secret:secret, otpauth:C.otpauthUri(secret, u.username, 'Lab Systems'),
      reason:'Two-step verification is on for this account. Add the key to an authenticator app, then enter its first code.'};
  }
  clearFailures(username);
  return finishLogin(u,{remember:!!remember, otp:!!code});
};
/* Completing the enrolment started by A.login (or Security Center): the code proves the
   app on the phone reads the same 30-second clock, so the secret is only then saved. */
A.confirmEnrollment=async function({username,password,code,secret,remember}){
  const u=USERS.find(x=>x.username.toLowerCase()===String(username||'').trim().toLowerCase());
  if(!u||!secret) return {ok:false, reason:'Enrolment expired — sign in again.'};
  const good=await checkPassword(u,password);
  if(!good){ recordFailure(username); return {ok:false, reason:'Incorrect password.'}; }
  const okCode=await C.totpVerify(secret, code);
  if(!okCode) return {ok:false, reason:'That code did not match the key shown. Check the app and try the current code.', needEnroll:true};
  u.totpSecret=String(secret).toUpperCase(); u.twoFactor=true; persistRoles();
  LS.store.audit({action:'auth.2fa_enrolled', entity:'users', entityId:u.id, actor:u.name, detail:'Authenticator app enrolled · 6-digit codes every 30s'});
  LS.store.save();
  clearFailures(username);
  return finishLogin(u,{remember:!!remember, otp:true});
};
/* Forced rotation: the first sign-in on a device that still holds an old-format hash
   ends here — the account keeps working only after a new password exists. */
A.completeRotation=async function({username,password,newPassword,remember}){
  const u=USERS.find(x=>x.username.toLowerCase()===String(username||'').trim().toLowerCase());
  if(!u) return {ok:false, reason:'No account matches that username.'};
  if(!(await checkPassword(u,password))) { recordFailure(username); return {ok:false, reason:'Incorrect password.'}; }
  const set=await A.setPassword(u.id,newPassword,{actor:u.name});
  if(!set.ok) return {ok:false, reason:set.reason};
  clearFailures(username);
  return finishLogin(u,{remember:!!remember, otp:false});
};
function finishLogin(u,{remember,otp}){
  A.user=u;
  A.session={userId:u.id, started:Date.now(), last:Date.now(), expires:Date.now()+1000*60*60*24, persist:!!remember, method: otp?'password+totp':'password'};
  try{ (remember?localStorage:sessionStorage).setItem(SESSION_KEY,JSON.stringify(A.session)); }catch(e){}
  A.logAttempt(true,u);
  const db=LS.store.db();
  const hist=(db.loginHistory||[]); hist.unshift({id:U.uid('lh'), ts:U.nowISO(), device:navigator.userAgent.indexOf('Mobile')>=0?'Mobile browser':'Desktop browser', ok:true, where:'Africa/Kigali'});
  db.loginHistory=hist.slice(0,50);
  LS.store.audit({action:'auth.login', entity:'security', entityId:u.id, detail:u.name+' signed in · '+u.role});
  LS.store.save();
  return {ok:true, user:u};
}
A.logAttempt=function(ok,u){
  try{
    const db=LS.store.db();
    db.loginHistory=db.loginHistory||[];
    db.loginHistory.unshift({id:U.uid('lh'), ts:U.nowISO(), device:navigator.userAgent.indexOf('Mobile')>=0?'Mobile browser':'Desktop browser', ok:ok, where:'Africa/Kigali', user:u?u.username:''});
    db.loginHistory=db.loginHistory.slice(0,50);
    LS.store.save();
  }catch(e){}
};
A.logout=function(){
  if(LS.privateNames) LS.privateNames.signOut();
  const who=A.user&&A.user.name;
  A.user=null; A.session=null;
  try{ localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); }catch(e){}
  LS.store.audit({action:'auth.logout', entity:'security', detail:(who||'User')+' signed out'});
  LS.store.save();
};
A.setPassword=async function(userId,next,opts){
  const u=USERS.find(x=>x.id===userId); if(!u) return {ok:false, reason:'Unknown account.'};
  const value=String(next==null?'':next);
  if(value.length<8) return {ok:false, reason:'Use at least 8 characters.'};
  /* Two accounts must never share a password: one leak would be two doors. Hashes are
     compared, never the passwords themselves — this device never sees a plain list. */
  const record=await C.hashPassword(value);
  for(const other of USERS){
    if(other.id===u.id) continue;
    if(other.passHash && await C.verifyPassword(value, other.passHash))
      return {ok:false, reason:'That password is already in use by another account. Choose a different one.'};
  }
  u.passHash=record; persistRoles();
  LS.store.audit({action:'security.password.change', entity:'security', entityId:userId, actor:(opts&&opts.actor)||(A.user&&A.user.name), detail:'Password rotated · PBKDF2, 310,000 iterations'});
  LS.store.save();
  return {ok:true};
};
/* ——— Enrolment from Security Center ————————————————————————
   A pending secret lives only in memory: the account keeps working exactly as before
   until an authenticator app proves it can read the same clock. */
const pendingEnroll={};
A.enrollTwoFactor=function(userId){
  const u=USERS.find(x=>x.id===userId); if(!u) return null;
  const secret=C.newTotpSecret();
  pendingEnroll[userId]=secret;
  return {secret:secret, otpauth:C.otpauthUri(secret, u.username, 'Lab Systems')};
};
A.confirmTwoFactor=async function(userId, code){
  const u=USERS.find(x=>x.id===userId); if(!u) return {ok:false, reason:'Unknown account.'};
  const secret=pendingEnroll[userId];
  if(!secret) return {ok:false, reason:'No enrolment is open. Press “Set up 2FA” again.'};
  if(!(await C.totpVerify(secret, code))) return {ok:false, reason:'That code did not match the key shown. Codes rotate every 30 seconds.'};
  u.totpSecret=secret; u.twoFactor=true; delete pendingEnroll[userId]; persistRoles();
  LS.store.audit({action:'auth.2fa_enrolled', entity:'users', entityId:userId, actor:A.user&&A.user.name, detail:'Authenticator app enrolled'});
  LS.store.save();
  return {ok:true};
};
A.disableTwoFactor=function(userId){
  const u=USERS.find(x=>x.id===userId); if(!u) return {ok:false, reason:'Unknown account.'};
  u.twoFactor=false; delete pendingEnroll[userId]; delete u.totpSecret; persistRoles();
  LS.store.audit({action:'auth.2fa_disabled', entity:'users', entityId:userId, actor:A.user&&A.user.name, detail:'Authenticator enrolment removed'});
  LS.store.save();
  return {ok:true};
};
/* Legacy one-line toggle kept so nothing else breaks; enabling without a secret is
   refused — that was exactly the decorative 2FA this file used to carry. */
A.toggle2FA=async function(userId,on){ return on?{ok:false, reason:'Use “Set up 2FA” — an authenticator app must be enrolled first.'}:A.disableTwoFactor(userId); };

A.guard=function(action){
  if(A.can(action||'edit')) return true;
  LS.ui.toast('Your role ('+A.user.role+') is read-only for this action. Ask the Lab Manager for access.',{type:'warn'});
  return false;
};

/* ——— Auth screen wiring ————————————————— */
A.mount=function(onSuccess){
  const screen=document.getElementById('auth');
  if(!screen) return;
  screen.hidden=false;
  const tabs=U.$$('[data-auth-tab]',screen);
  const panels={pass:screen.querySelector('#authPassPanel'), otp:screen.querySelector('#authOtpPanel'), rotate:screen.querySelector('#authRotatePanel')};
  let mode='pass';
  const setMode=m=>{ mode=m; tabs.forEach(t=>t.classList.toggle('on',t.dataset.authTab===m)); Object.keys(panels).forEach(k=>{ if(panels[k]) panels[k].hidden=k!==m; }); };
  tabs.forEach(t=>t.onclick=()=>setMode(t.dataset.authTab));
  const form=screen.querySelector('#authForm');
  const err=screen.querySelector('#authErr');
  const codeWrap=screen.querySelector('#authCodeWrap');
  const pwd=screen.querySelector('#authPass');
  const usr=screen.querySelector('#authUser');
  const showPw=screen.querySelector('#authShowPw');
  if(showPw) showPw.onclick=()=>{ pwd.type=pwd.type==='password'?'text':'password'; showPw.innerHTML=U.ic(pwd.type==='password'?'eye':'eye-off',15); };
  const say=(m)=>{ err.textContent=m; err.hidden=!m; };
  /* Staged state held in memory for one sign-in only: never written anywhere. */
  let pendingRotate=null, pendingEnroll=null;
  const submit=async()=>{
    say('');
    const remember=screen.querySelector('#authRemember')&&screen.querySelector('#authRemember').checked;
    try{
      if(mode==='rotate' && pendingRotate){
        const np=screen.querySelector('#authNewPass'), nc=screen.querySelector('#authNewPass2');
        if(!np||np.value!==nc.value){ say('The two new passwords do not match.'); return; }
        if(np.value===pendingRotate.password){ say('The new password must be different from the one being retired.'); return; }
        const res=await A.completeRotation({username:pendingRotate.username, password:pendingRotate.password, newPassword:np.value, remember});
        if(!res.ok){ say(res.reason||'The password was not changed.'); return; }
        pendingRotate=null; done(res); return;
      }
      if(mode==='otp' && pendingEnroll){
        const code=(screen.querySelector('#authCode')||{}).value;
        const res=await A.confirmEnrollment({username:pendingEnroll.username, password:pendingEnroll.password, code:code, secret:pendingEnroll.secret, remember});
        if(!res.ok){ say(res.reason||'The code was not accepted.'); return; }
        pendingEnroll=null; done(res); return;
      }
      const res=await A.login({username:usr.value, password:pwd.value, code:(screen.querySelector('#authCode')||{}).value, remember});
      if(res.needRotate){
        pendingRotate={username:res.username, password:res.password, remember:res.remember};
        setMode('rotate'); say(''); return;
      }
      if(res.needEnroll){
        pendingEnroll={username:res.username, password:res.password, secret:res.secret, remember:res.remember};
        const sec=screen.querySelector('#authSecretKey'), uri=screen.querySelector('#authSecretUri'), box=screen.querySelector('#authEnrollBox');
        if(sec) sec.value=res.secret;
        if(uri) uri.textContent=res.otpauth;
        if(box) box.hidden=false;
        setMode('otp'); say(res.reason||''); return;
      }
      if(!res.ok){ say(res.reason||'Sign-in failed.'); if(res.needCode && codeWrap) codeWrap.hidden=false; return; }
      done(res);
    }catch(e){ say(e&&e.message?e.message:'Sign-in failed.'); }
  };
  const done=(res)=>{
    err.hidden=true;
    screen.style.transition='opacity .3s ease'; screen.style.opacity='0';
    setTimeout(()=>{ screen.hidden=true; screen.style.opacity='1'; onSuccess&&onSuccess(res.user); },300);
  };
  form.addEventListener('submit',e=>{ e.preventDefault(); submit(); });
  const sso=U.$$('[data-sso]',screen);
  sso.forEach(b=>b.onclick=()=>LS.ui.toast('SSO ('+b.dataset.sso+') is configured per deployment. Use password sign-in for this console.',{type:'info'}));
};
A.renderUserChip=function(){
  const u=A.user; if(!u) return;
  U.$$('[data-user-name]').forEach(e=>e.textContent=u.name);
  U.$$('[data-user-role]').forEach(e=>e.innerHTML=u.role);
  U.$$('[data-user-initials]').forEach(e=>{ e.innerHTML=U.initials(u.name); });
  U.$$('[data-user-title]').forEach(e=>e.textContent=u.title);
  U.$$('[data-role-badge]').forEach(e=>{ e.outerHTML=LS.ui.roleBadge(u.role).replace('class="role-badge','data-role-badge class="role-badge'); });
};
})();
