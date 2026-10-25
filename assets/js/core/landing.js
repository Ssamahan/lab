/* ============================================================================
   LAB SYSTEMS · PUBLIC OVERVIEW — the page anyone may read, no sign-in
   The console's sign-in screen is not linked from here: it opens after five
   clicks on the crest, three clicks on the profile button, or at #/signin.
   Nothing on this page comes from a patient record — only register counts.
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU; const L={}; window.LS=window.LS||{}; LS.landing=L;
const CLICKS_CREST=5, CLICKS_PROFILE=3, GAP=1500;

/* ——— Counting taps ————————————————————————————
   Buttons already fire click on Enter and Space, so a keyboard user reaches the
   same screen by pressing the same control the required number of times. */
function gesture(el,need,fn){
  if(!el) return;
  let n=0,last=0;
  el.addEventListener('click',()=>{
    const now=Date.now();
    if(now-last>GAP) n=0;
    last=now; n++;
    if(n<need) return;
    n=0; fn();
  });
  /* A <button> already turns Enter and Space into a click, so keyboard users count
     the same way — no second handler, which would count every press twice. */
}

/* ——— Real numbers, never invented ————————————— */
function fill(){
  const put=(sel,txt)=>{ U.$$(sel).forEach(e=>{ if(txt!==undefined&&txt!==null) e.textContent=txt; }); };
  let db=null, set=null;
  try{ db=LS.store.db(); set=LS.store.settings(); }catch(e){}
  if(db){
    const staff=(db.staff||[]).filter(s=>s.status==='active');
    const centres=(db.catalog&&db.catalog.healthCenters)||[];
    const tests=(db.catalog&&db.catalog.tests)||[];
    if(staff.length) put('[data-land-staff]',String(staff.length));
    if(centres.length) put('[data-land-centres]',String(centres.length));
    if(tests.length) put('[data-land-tests]',String(tests.length));
    const box=document.getElementById('landCentres');
    if(box && centres.length){
      box.innerHTML=centres.map(c=>'<span class="land-chip">'+U.esc(c.name)+'</span>').join('');
    }
  }
  if(set){
    if(set.phone) put('[data-land-phone]',set.phone);
    if(set.email) put('[data-land-email]',set.email);
  }
  U.$$('[data-land-icon]').forEach(e=>{
    const k=e.dataset.landIcon;
    if(k && !e.innerHTML.trim()) e.innerHTML=U.ic(k,18);
  });
}

/* ——— Screens ————————————————————————————————— */
L.show=function(){
  const land=document.getElementById('landing');
  if(!land) return;
  const auth=document.getElementById('auth'); if(auth) auth.hidden=true;
  const app=document.getElementById('app'); if(app) app.hidden=true;
  land.hidden=false;
  const signed=!!(LS.auth&&LS.auth.user);
  const back=document.getElementById('landConsole');
  if(back){
    back.hidden=!signed;
    back.textContent=(LS.auth&&LS.auth.isVisitor&&LS.auth.isVisitor())?'Back to the visitor view':'Back to the console';
  }
  fill();
  try{ window.scrollTo({top:0,behavior:'instant'}); }catch(e){ try{window.scrollTo(0,0);}catch(_){} }
};

L.signIn=function(){
  const land=document.getElementById('landing'); if(land) land.hidden=true;
  const app=document.getElementById('app'); if(app) app.hidden=true;
  const screen=document.getElementById('auth');
  if(!screen){ return; }
  screen.hidden=false;
  LS.auth.mount(()=>{
    const l=document.getElementById('landing'); if(l) l.hidden=true;
    LS.shell.afterAuth();
  });
  setTimeout(()=>{
    const u=document.getElementById('authUser');
    const p=document.getElementById('authPass');
    if(p&&p.value) p.value='';
    if(u&&!u.value) u.focus({preventScroll:true});
  },120);
};

/* Opening the console as a viewer: no account, no password, no writes — and the real
   shared register, read from the public coordinates in shared.js, so a fresh or
   incognito window shows the same samples, rosters and PBF marks as the PC. */
L.enterAsVisitor=async function(){
  if(!LS.auth.isVisitor||!LS.auth.isVisitor()) LS.auth.enterAsVisitor();
  const land=document.getElementById('landing'); if(land) land.hidden=true;
  const auth=document.getElementById('auth'); if(auth) auth.hidden=true;
  LS.shell.afterAuth();
  if(!LS.sync||!LS.sync.visitorReady||!LS.sync.visitorReady()){
    LS.shell.visitorStatus&&LS.shell.visitorStatus('Sample copy on this browser','');
    return {ok:false, reason:'no shared register'};
  }
  LS.shell.visitorStatus&&LS.shell.visitorStatus('Reading the shared register…','');
  let res={ok:false, reason:'Sync unavailable'};
  try{ res=await LS.sync.visitorRead(); }catch(e){ res={ok:false, reason:(e&&e.message)||'Could not read'}; }
  if(res.ok){
    LS.shell.visitorStatus&&LS.shell.visitorStatus('Shared register · '+(res.after?res.after.pbfMarks:0)+' PBF marks · read '+U.relTime(res.updated_at||U.nowISO()),'live');
    try{ LS.shell.route({keepScroll:true}); }catch(e){}
  } else {
    LS.shell.visitorStatus&&LS.shell.visitorStatus('Sample copy on this browser — shared register not read: '+res.reason,'bad');
  }
  return res;
};

L.backToConsole=function(){
  if(LS.auth&&LS.auth.user){ LS.shell.afterAuth(); return; }
  L.signIn();
};

/* ——— Wiring ————————————————————————————————— */
L.init=function(){
  gesture(document.getElementById('landBrand'),CLICKS_CREST,()=>L.signIn());
  /* The profile is two doors in one button: a single tap opens the register as a
     visitor, three quick taps open the staff sign-in screen. A tap waits briefly to
     see whether a second one is coming, so neither gesture can fire by accident. */
  (function profileTaps(el){
    if(!el) return;
    let n=0,last=0,timer=null;
    const reset=()=>{ n=0; };
    el.addEventListener('click',()=>{
      const now=Date.now();
      if(now-last>800) n=0;
      last=now; n++;
      clearTimeout(timer);
      if(n>=CLICKS_PROFILE){ reset(); L.signIn(); return; }
      timer=setTimeout(()=>{ if(n===1){ reset(); L.enterAsVisitor(); } },420);
    });
  })(document.getElementById('landProfile'));

  const back=document.getElementById('landConsole');
  if(back) back.onclick=()=>L.backToConsole();
  const enter=document.getElementById('landEnter');
  if(enter) enter.onclick=()=>L.enterAsVisitor();
  const authBack=document.getElementById('authBack');
  if(authBack) authBack.onclick=()=>L.show();

  U.$$('[data-land-go]').forEach(b=>{
    b.onclick=()=>{
      const el=document.getElementById(b.dataset.landGo);
      if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
    };
  });

  /* In the console the same crest opens the public page after five clicks. */
  gesture(document.querySelector('.rail-brand'),CLICKS_CREST,()=>L.show());
  fill();
};

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',L.init);
else L.init();
L.gesture=gesture;
})();
