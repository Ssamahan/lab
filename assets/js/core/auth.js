/* ============================================================================
   LAB SYSTEMS · AUTH — roles, sessions, 2FA, login history
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU; const A={}; window.LS=window.LS||{}; LS.auth=A;
const SESSION_KEY='labSystems.session.v2';
/* Passwords are stored as SHA-256 hashes, never as text. This is a local gate in a
   browser-only console — it keeps credentials out of a public repository and out of the
   page source, but it is not a substitute for a server-side identity provider. Rotate a
   password in Security Center when in doubt; the hash changes, the file never does. */
function sha256(str){
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
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
A.hash=sha256;

const USERS=[
  {id:'u1', name:'Kelvin SAMAHANI', role:'Admin', username:'kelvin', passHash:'5ca8c32632e47d5798b694cf033982a0758b3f92538ac3993f5c1d08cd7b8c99', email:'rulidhlab@gmail.com', staffId:'s1', title:'Laboratory Manager', twoFactor:false},
  {id:'u2', name:'Aurelie YANSONEYE', role:'Manager', username:'aurelie', passHash:'ec4745e166d26bc36af27e6ab352c1e848eb73afded08a7b1fceb215b2ac5028', email:'aurelieyansoneye@gmail.com', staffId:'s4', title:'HIV Lab Quality Corp', twoFactor:false},
  {id:'u3', name:'Jean Paul NSENGIYUMVA', role:'Technologist', username:'jeanpaul', passHash:'ec4745e166d26bc36af27e6ab352c1e848eb73afded08a7b1fceb215b2ac5028', email:'nsengiyuma4@gmail.com', staffId:'s6', title:'Lab Quality Manager', twoFactor:true},
  {id:'u4', name:'District Reviewer', role:'Viewer', username:'viewer', passHash:'d5202e6904b89534425e3e52d9173445bf493805ad2c40edddd1529d497cde18', email:'pbf@gakenke.gov.rw', staffId:null, title:'PBF assessment team', twoFactor:false},
  {id:'u5', name:'Gakenke Review Panel', role:'Reviewer', username:'reviewer', passHash:'c60d771b500d1b4f8a1c8438b0e0f8d89ee8bac756a768efd4057b7011a367d5', email:'review@gakenke.gov.rw', staffId:null, title:'District review panel', twoFactor:false}
];
A.users=USERS;
/* A VISITOR is a real Viewer, not an account: the register opens read-only with
   export and download, and three surfaces are never mounted — Training Revenue,
   the Settings tab and the Data & sync tab. No password, no write, no cloud. */
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
  Admin:['view','edit','approve','revenue','staff','settings','security','export','delete'],
  Manager:['view','edit','approve','revenue','export'],
  Technologist:['view','edit','export'],
  /* Reviewers read the register and can act on what they are asked to verify —
     they sign off assessments but never see revenue, security or settings. */
  Reviewer:['view','edit','approve','export'],
  Viewer:['view','export'],
  'Read-only':['view']
};
const ROLE_KEY='labSystems.roles.v1';
function savedRoles(){ try{ return JSON.parse(localStorage.getItem(ROLE_KEY)||'{}')||{}; }catch(e){ return {}; } }
function persistRoles(){ const map={}; USERS.forEach(u=>{ map[u.id]={role:u.role, twoFactor:!!u.twoFactor}; }); try{ localStorage.setItem(ROLE_KEY,JSON.stringify(map)); }catch(e){} }
A.applySavedRoles=function(){
  const map=savedRoles();
  USERS.forEach(u=>{ const o=map[u.id]; if(!o) return; if(o.role && A.ROLES.indexOf(o.role)>=0) u.role=o.role; if(typeof o.twoFactor==='boolean') u.twoFactor=o.twoFactor; });
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
A.login=function({username,password,code,remember}){
  const u=USERS.find(x=>x.username.toLowerCase()===String(username||'').trim().toLowerCase());
  if(!u) return {ok:false, reason:'No account matches that username.'};
  const given=sha256(String(password==null?'':password));
  if(u.passHash?u.passHash!==given:u.password!==password){ A.logAttempt(false, u); return {ok:false, reason:'Incorrect password.'}; }
  if(u.password){ u.passHash=given; delete u.password; }   /* migrate a record left in plain text */
  /* The one-time code is a local placeholder: no OTP provider is wired in yet, so the
     value is fixed here rather than published in the page. Do not treat it as a factor. */
  if(u.twoFactor && code!=='123456') return {ok:false, reason:'2FA is enabled — enter the 6-digit code sent to your device.', needCode:true};
  A.user=u;
  A.session={userId:u.id, started:Date.now(), last:Date.now(), expires:Date.now()+1000*60*60*24, persist:!!remember, method: code?'password+otp':'password'};
  try{ (remember?localStorage:sessionStorage).setItem(SESSION_KEY,JSON.stringify(A.session)); }catch(e){}
  A.logAttempt(true,u);
  const db=LS.store.db();
  const hist=(db.loginHistory||[]); hist.unshift({id:U.uid('lh'), ts:U.nowISO(), device:navigator.userAgent.indexOf('Mobile')>=0?'Mobile browser':'Desktop browser', ok:true, where:'Africa/Kigali'});
  db.loginHistory=hist.slice(0,20);
  LS.store.audit({action:'auth.login', entity:'security', entityId:u.id, detail:u.name+' signed in · '+u.role});
  LS.store.save();
  return {ok:true, user:u};
};
A.logAttempt=function(ok,u){
  try{
    const db=LS.store.db();
    db.loginHistory=db.loginHistory||[];
    db.loginHistory.unshift({id:U.uid('lh'), ts:U.nowISO(), device:navigator.userAgent.indexOf('Mobile')>=0?'Mobile browser':'Desktop browser', ok:ok, where:'Africa/Kigali', user:u?u.username:''});
    db.loginHistory=db.loginHistory.slice(0,20);
    LS.store.save();
  }catch(e){}
};
A.logout=function(){
  const who=A.user&&A.user.name;
  A.user=null; A.session=null;
  try{ localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); }catch(e){}
  LS.store.audit({action:'auth.logout', entity:'security', detail:(who||'User')+' signed out'});
  LS.store.save();
};
A.setPassword=function(userId,next){
  const u=USERS.find(x=>x.id===userId); if(!u) return false;
  if(!next||String(next).length<8) return false;
  u.passHash=sha256(String(next)); delete u.password; LS.store.audit({action:'security.password.change', entity:'security', entityId:userId, detail:'Password rotated'}); LS.store.save(); return true;
};
A.toggle2FA=function(userId,on){
  const u=USERS.find(x=>x.id===userId); if(!u) return false;
  u.twoFactor=!!on; LS.store.audit({action:'security.2fa', entity:'security', entityId:userId, detail:'2FA '+(on?'enabled':'disabled')}); LS.store.save(); return true;
};
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
  const panels={pass:screen.querySelector('#authPassPanel'), otp:screen.querySelector('#authOtpPanel')};
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
  const submit=()=>{
    const res=A.login({username:usr.value,password:pwd.value,code:(screen.querySelector('#authCode')||{}).value,remember:screen.querySelector('#authRemember').checked});
    if(!res.ok){ err.textContent=res.reason; err.hidden=false; if(res.needCode && codeWrap) codeWrap.hidden=false; return; }
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
