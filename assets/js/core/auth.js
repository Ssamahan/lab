/* ============================================================================
   LAB SYSTEMS · AUTH — roles, sessions, 2FA, login history
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU; const A={}; window.LS=window.LS||{}; LS.auth=A;
const SESSION_KEY='labSystems.session.v2';
const USERS=[
  {id:'u1', name:'Kelvin SAMAHANI', role:'Admin', username:'kelvin', password:'ruli2026', email:'rulidhlab@gmail.com', staffId:'s1', title:'Laboratory Manager', twoFactor:false},
  {id:'u2', name:'Aurelie YANSONEYE', role:'Manager', username:'aurelie', password:'lab2026', email:'aurelieyansoneye@gmail.com', staffId:'s4', title:'HIV Lab Quality Corp', twoFactor:false},
  {id:'u3', name:'Jean Paul NSENGIYUMVA', role:'Technologist', username:'jeanpaul', password:'lab2026', email:'nsengiyuma4@gmail.com', staffId:'s6', title:'Laboratory Technician', twoFactor:true},
  {id:'u4', name:'District Reviewer', role:'Read-only', username:'viewer', password:'view2026', email:'pbf@gakenke.gov.rw', staffId:null, title:'PBF assessment team', twoFactor:false}
];
A.users=USERS;
A.user=null;
A.session=null;

const PERMS={
  Admin:['view','edit','approve','revenue','staff','settings','security','export','delete'],
  Manager:['view','edit','approve','revenue','export'],
  Technologist:['view','edit','export'],
  'Read-only':['view']
};
A.can=function(action){
  if(!A.user) return false;
  if(A.user.role==='Admin') return true;
  return (PERMS[A.user.role]||['view']).indexOf(action)>=0;
};
A.init=function(){
  let s=null;
  try{ s=JSON.parse(localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY)||'null'); }catch(e){}
  if(s && s.expires && s.expires>Date.now()){
    A.session=s;
    A.user=USERS.find(u=>u.id===s.userId)||null;
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
  if(u.password!==password) { A.logAttempt(false, u); return {ok:false, reason:'Incorrect password. Demo credentials are shown beneath the form.'}; }
  if(u.twoFactor && code!=='123456') return {ok:false, reason:'2FA is enabled — enter the 6-digit code (demo: 123456).', needCode:true};
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
  u.password=next; LS.store.audit({action:'security.password.change', entity:'security', entityId:userId, detail:'Password rotated'}); LS.store.save(); return true;
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
  const demo=screen.querySelector('#authDemo');
  if(demo) demo.onclick=()=>{ usr.value='kelvin'; pwd.value='ruli2026'; submit(); };
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
