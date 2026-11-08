/* ============================================================================
   LAB SYSTEMS · BOOT — splash choreography, init, service worker, recovery
   ========================================================================== */
(function(){
'use strict';
/* ——— The way in when a device is stuck ————————————————————————
   A browser that was once shown a half-installed build can keep serving it from its
   own cache, and then the console appears not to exist at all: the address answers,
   nothing starts. `?fresh=1` is the answer that needs no explanation — it removes the
   service worker and every cache on this origin, then reloads once with a clean slate.
   It runs before anything else and returns, so nothing half-initialised is left. */
if((function freshRecovery(){
  if(!/[?&]fresh=1\b/.test(location.search)) return false;
  let already=false;
  try{ already=sessionStorage.getItem('labSystems.fresh.v1')==='1'; }catch(e){}
  if(already){ try{ sessionStorage.removeItem('labSystems.fresh.v1'); }catch(e){} return false; }
  try{ sessionStorage.setItem('labSystems.fresh.v1','1'); }catch(e){}
  const clean=()=>{
    const url=new URL(location.href);
    url.searchParams.delete('fresh');
    url.searchParams.set('v',String(Date.now()));
    location.replace(url.toString());
  };
  const steps=[];
  try{
    if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations)
      steps.push(navigator.serviceWorker.getRegistrations()
        .then(rs=>Promise.all(rs.map(r=>r.unregister().catch(()=>{})))).catch(()=>{}));
    if(window.caches&&caches.keys)
      steps.push(caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k).catch(()=>{})))).catch(()=>{}));
  }catch(e){}
  Promise.all(steps).then(clean,clean);
  try{ const b=document.getElementById('bootStatus'); if(b) b.textContent='Clearing the cache for this device…'; }catch(e){}
  return true;
})()) return;

const U=window.LSU;
const LINES=['Calibrating QC engines…','Verifying chain of custody…','Loading ISO 15189 register…','Rehydrating local register…','Arming offline cache…','Ready.'];
/* The splash is a first-run courtesy, not a toll gate. A device that has opened the
   console before shows it for a moment; a first visit gets the full animation. The
   difference is what "it takes longer to load" actually was on a phone. */
/* How long the opening animation is allowed to hold the page. It is an animation, not a
   loader — the console is ready long before it ends — so it must not be a reason to wait
   on a phone. A returning device barely sees it at all. */
const FIRST_RUN=900, RETURNING=220;
function hasOpenedBefore(){
  try{ return localStorage.getItem('labSystems.opened.v1')==='1'; }catch(e){ return false; }
}
function markOpened(){ try{ localStorage.setItem('labSystems.opened.v1','1'); }catch(e){} }
const SPLASH_MIN=hasOpenedBefore()?RETURNING:FIRST_RUN;
let done=false;
/* The first thing that went wrong in this page, in plain words. A blank console is
   almost always one thrown line, and naming it turns a mystery into a bug report. */
let firstError=null;
window.addEventListener('error',ev=>{
  if(firstError) return;
  const t=ev&&ev.target;
  if(t&&t.tagName==='SCRIPT') firstError='a script did not load: '+(t.src||'').split('/').pop();
  else firstError=(ev&&ev.message)||'a script threw while starting';
},true);
window.addEventListener('unhandledrejection',ev=>{
  if(firstError) return;
  firstError=(ev&&ev.reason&&(ev.reason.message||String(ev.reason)))||'a start-up promise was rejected';
});

function finish(){
  if(done) return; done=true;
  window.__lsBooted=true;
  const boot=document.getElementById('boot');
  if(boot){ boot.classList.add('done'); setTimeout(()=>boot.remove(),700); }
}
/* How long each part of the start took. Kept on the window so a slow device can be asked
   what was actually slow, and printed when the address carries ?diag=1. */
const timings=[];
function mark(name,t0){ timings.push({name,ms:Math.round((performance.now()-t0)*10)/10}); }
function stamp(name,fn){
  const t0=performance.now();
  try{ return fn(); }
  finally{ mark(name,t0); }
}
function reportTimings(){
  try{
    if(!/[?&]diag=1\b/.test(location.search)) return;
    const total=Math.round(timings.reduce((a,x)=>a+x.ms,0));
    console.info('[Lab Systems] start-up '+total+' ms\n'+timings.map(x=>'  '+x.name+': '+x.ms+' ms').join('\n'));
  }catch(e){}
}
function init(){
  const t0=performance.now();
  try{
    stamp('register loaded',()=>LS.store.init());
    stamp('language',()=>LS.i18n.init());
    try{ if(window.LS.sync) LS.sync.start(); }catch(e){ console.warn('sync start',e); }
    stamp('accounts',()=>LS.auth.init());
    /* Read the session at the moment the splash ends, not when it starts: a
       sign-in that completes during the animation must not be overruled. */
    const sessionUser=()=>LS.auth.user;
    /* Where the address bar points decides the first screen.
       - no session and a console route in the hash → the sign-in screen
       - #/signin or #/welcome                             → those screens
       - anything else, including a bare address           → the public overview
       A visitor therefore never meets a login wall to read about the department. */
    const hash=(location.hash||'').replace(/^#\/?/,'').split('?')[0];
    const wantsSignIn=/^(signin|login)$/i.test(hash);
    const wantsOverview=/^(welcome|overview|home)$/i.test(hash);
    const consoleRoute=!!(LS.shell&&LS.shell.ROUTES&&LS.shell.ROUTES[hash]);
    const jump=()=>{
      const wait=Math.max(0,SPLASH_MIN-(performance.now()-t0));
      setTimeout(()=>{
        finish();
        if(sessionUser()){
          if(wantsOverview){ if(LS.landing) LS.landing.show(); else LS.shell.afterAuth(); }
          else LS.shell.afterAuth();
        }
        else if(wantsSignIn){
          if(LS.landing) LS.landing.signIn();
          else { document.getElementById('auth').hidden=false; LS.auth.mount(()=>LS.shell.afterAuth()); }
        }
        /* A console link with no session opens the same page as a visitor:
           read-only, with the strip offering Sign in. Nobody meets a wall. */
        else if(consoleRoute){
          if(LS.landing) LS.landing.enterAsVisitor();
          else { LS.auth.enterAsVisitor(); LS.shell.afterAuth(); }
        }
        else {
          if(LS.landing) LS.landing.show();
          else { document.getElementById('auth').hidden=false; LS.auth.mount(()=>LS.shell.afterAuth()); }
        }
        // deep-link / saved view restore
        if(sessionUser() && consoleRoute) setTimeout(()=>LS.shell.route(),60);
      }, wait);
    };
    mark('total to first screen',t0);
    reportTimings();
    jump();
    markOpened();
  }catch(err){
    console.error('Boot failed',err);
    finish();
    document.body.insertAdjacentHTML('beforeend','<div style="position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:24px;text-align:center"><div style="max-width:460px"><div style="font-family:var(--font-display);font-size:1.6rem;color:var(--text-strong);margin-bottom:10px">Lab Systems could not start</div><p style="color:var(--text-muted);font-size:13px;line-height:1.6;margin-bottom:18px">The local register may be corrupt. Export it if possible, then restore the seed. Diagnostics: '+U.esc(err&&err.message||String(err))+'</p><button onclick="localStorage.removeItem(\'labSystems.v1\');location.reload()" style="padding:9px 14px;border-radius:8px;background:#C9A84C;color:#241A06;font-weight:600;border:0">Restore seed &amp; reload</button></div></div>');
  }
}
// rotating status lines
try{
  let i=0; const el=document.getElementById('bootStatus');
  const iv=setInterval(()=>{ if(!el||done){ clearInterval(iv); return; } i=(i+1)%LINES.length; el.style.opacity='0'; setTimeout(()=>{ el.textContent=LINES[i]; el.style.transition='opacity .3s'; el.style.opacity='1'; },180); },520);
}catch(e){}
/* ——— When the console does not start ——————————————————————
   The splash is removed on success. If it is still turning after seven seconds the page
   has not started at all — a build that threw, a script that never arrived, a cache with
   half of a version in it — and the honest thing is to say so and hand over the two
   actions that fix it, instead of an animation that looks like a site that is down. */
function started(){
  const shown=id=>{ const el=document.getElementById(id); return el&&!el.hidden; };
  return shown('landing')||shown('auth')||shown('app');
}
function recover(reason){
  if(started()){ finish(); return; }
  const boot=document.getElementById('boot');
  if(!boot) return;
  const why=reason?'<div style="font-family:var(--font-mono);font-size:11px;color:var(--text-faint);margin:10px 0 0;word-break:break-word">'+U.esc(reason)+'</div>':'';
  boot.innerHTML='<div style="max-width:460px;text-align:center;padding:24px">'
    +'<div style="font-family:var(--font-display);font-size:1.5rem;color:var(--text-strong);margin-bottom:8px">This device could not start the console</div>'
    +'<p style="color:var(--text-muted);font-size:12.6px;line-height:1.65;margin:0">A required part of the console did not start. The cause is not yet known. Do not clear browser data or reset the register.</p>'
    +why
    +'<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px">'
      +'<a href="check.html" style="padding:9px 14px;border-radius:8px;color:var(--gold)">Connection check</a>'
      +'<button type="button" onclick="location.reload()" style="padding:9px 14px;border-radius:8px;background:none;color:var(--text);border:1px solid var(--border-strong);cursor:pointer">Reload</button>'
    +'</div>'
  +'</div>';
  boot.classList.remove('done');
}
window.__lsRecover=recover;
window.LS_TIMINGS=timings;

// watchdog: never trap the user behind the splash
setTimeout(()=>{
  if(started()) finish();
  else recover(firstError||'the console did not finish starting within seven seconds');
},7000);

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,60));
else setTimeout(init,60);

/* Service worker — offline-first, and never stale. The new build takes control
   as soon as it installs; the page reloads once so the user is not left running
   yesterday's JavaScript (that is what makes a fixed Close button look broken). */
if(navigator.serviceWorker && location.protocol!=='file:'){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    // Do not discard an unfinished form or private-name session on update.
    try{ LS.ui.toast('An update is ready. Save your work and check pending changes before reloading.',{type:'info',duration:12000}); }catch(e){}
  });
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>{
      const check=()=>{ try{ reg.update(); }catch(e){} };
      check();
      setInterval(check,20*60*1000);
      document.addEventListener('visibilitychange',()=>{ if(!document.hidden) check(); });
      reg.addEventListener('updatefound',()=>{
        const sw=reg.installing;
        if(!sw) return;
        sw.addEventListener('statechange',()=>{ if(sw.state==='installed' && navigator.serviceWorker.controller){ try{ sw.postMessage({type:'SKIP_WAITING'}); }catch(e){} } });
      });
    }).catch(e=>console.warn('SW registration failed',e.message));
  });
}
/* ——— Bring the rest of the app down once the first screen is open ————————
   The service worker used to download every screen, the export engine and eleven fonts
   during install — about 2.5 MB on a first visit, competing with the page the person was
   waiting for. That is what a slow connection felt like. Now the shell arrives alone, and
   this asks for the rest a few seconds later, when nothing is being waited on, and only
   when the device is not on a metered connection or asking for less data. A device that
   never gets there has simply been online and offline in the old way: every screen it did
   visit is already cached. */
function warmTheRest(){
  try{
    const c=navigator.connection||{};
    if(c.saveData||/^(slow-)?2g$/.test(c.effectiveType||'')) return;
  }catch(e){}
  const send=()=>{ try{
    const sw=navigator.serviceWorker;
    if(!sw) return;
    if(sw.controller) sw.controller.postMessage({type:'WARM'});
    else sw.addEventListener('controllerchange',()=>{
      if(sw.controller) sw.controller.postMessage({type:'WARM'});
    },{once:true});
  }catch(e){} };
  if('requestIdleCallback' in window) setTimeout(()=>window.requestIdleCallback(send,{timeout:8000}),5000);
  else setTimeout(send,5000);
}
window.addEventListener('load',()=>{ setTimeout(warmTheRest,4000); });

/* Version / update prompt */
window.addEventListener('load',()=>{
  setTimeout(()=>{
    const st=document.getElementById('saveState');
    if(st) st.textContent='Local register ready';
  },1200);
});
/* ——— Is a newer build live? ————————————————————————————————
   A tab that is left open — a phone that was never closed — keeps running the
   JavaScript it loaded, so a module added in a later build simply is not there and
   the rail looks as though it never changed. The deployed page is asked once for
   its version a few seconds after load, and again whenever the tab comes back into
   view; if it disagrees with the build in memory the reader is told, by name, and
   given the reload rather than having to guess. */
(function watchVersion(){
  if(!navigator.onLine) return;
  const mine=LS.shell&&LS.shell.version?LS.shell.version():null;
  /* Asked again every ten minutes, not once. A tab can stay open for weeks — a phone
     that is never closed — and the point of this check is exactly that tab. */
  let lastAsk=0, warned=null;
  const check=async()=>{
    if(document.hidden) return;
    if(Date.now()-lastAsk<10*60*1000) return;
    lastAsk=Date.now();
    try{
      const res=await fetch('index.html?build='+Date.now(),{cache:'no-store'});
      if(!res.ok) return;
      const txt=await res.text();
      const m=/v(\d+\.\d+\.\d+)/.exec(txt);
      if(!m||!mine||m[1]===mine) return;
      if(warned===m[1]) return;               /* said once, not every ten minutes */
      warned=m[1];
      LS.ui.toast('A newer build (v'+m[1]+') is live — this tab is running v'+mine+'. Reload to see it.',{type:'info',duration:20000,
        actions:[{label:'Reload now',onClick:()=>location.reload()}]});
    }catch(e){}
  };
  setTimeout(check,4000);
  setInterval(check,10*60*1000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ lastAsk=0; setTimeout(check,1500); } });
})();
})();
