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
  el.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ') return;
    const now=Date.now();
    if(now-last>GAP) n=0;
    last=now; n++;
    if(n<need) return;
    n=0; fn();
  });
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
  if(back) back.hidden=!signed;
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

L.backToConsole=function(){
  if(LS.auth&&LS.auth.user){ LS.shell.afterAuth(); return; }
  L.signIn();
};

/* ——— Wiring ————————————————————————————————— */
L.init=function(){
  gesture(document.getElementById('landBrand'),CLICKS_CREST,()=>L.signIn());
  gesture(document.getElementById('landProfile'),CLICKS_PROFILE,()=>L.signIn());

  const back=document.getElementById('landConsole');
  if(back) back.onclick=()=>L.backToConsole();
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
