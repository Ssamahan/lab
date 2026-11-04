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
  /* Waiting for a hung delete is how a repair turns into a blank page: whatever the
     promises do, the reload happens — after 1.6 s at the latest. */
  Promise.all(steps).then(clean,clean);
  setTimeout(clean,1600);
  try{ const b=document.getElementById('bootStatus'); if(b) b.textContent='Clearing the cache for this device…'; }catch(e){}
  return true;
})()) return;

const U=window.LSU;
const LINES=['Calibrating QC engines…','Verifying chain of custody…','Loading ISO 15189 register…','Rehydrating local register…','Arming offline cache…','Ready.'];
/* The splash is a first-run courtesy, not a toll gate. A device that has opened the
   console before shows it for a moment; a first visit gets the full animation. The
   difference is what "it takes longer to load" actually was on a phone. */
const FIRST_RUN=2100, RETURNING=380;
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
/* ——— Saying what the start actually cost ————————————————
   "It takes longer to load" is a fact about a device, a network and a build, and none of
   them can be argued with from a description. When the start passes 2.6 seconds, a small
   line appears in the corner with the number; pressing it lists the parts and how many
   bytes came down the wire. It is not a warning and it blocks nothing — it is the one
   measurement that turns a complaint into a fix. `?diag=1` shows it always. */
function startCost(){
  const total=Math.round(timings.reduce((a,x)=>a+x.ms,0));
  let bytes=0, requests=0;
  try{
    const res=performance.getEntriesByType?performance.getEntriesByType('resource'):[];
    const mine=res.filter(r=>r.name.indexOf(location.origin)===0);
    requests=mine.length;
    bytes=mine.reduce((a,r)=>a+(r.transferSize||r.encodedBodySize||0),0);
  }catch(e){}
  return {total,bytes,requests};
}
function showStartCost(){
  try{
    const c=startCost();
    const diag=/[?&]diag=1\b/.test(location.search);
    if(!diag && c.total<2600) return;
    if(document.getElementById('lsCost')) return;
    const kb=Math.round(c.bytes/1024);
    const box=document.createElement('div');
    box.id='lsCost';
    box.style.cssText='position:fixed;left:12px;bottom:12px;z-index:260;max-width:min(340px,92vw);'
      +'font:11.5px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;color:#B9AE99;'
      +'background:rgba(20,18,14,.94);border:1px solid #4A4335;border-radius:10px;padding:8px 10px;'
      +'box-shadow:0 8px 24px rgba(0,0,0,.35)';
    const detail=timings.map(t=>'  '+t.name+' · '+t.ms+' ms').join('\n');
    box.innerHTML='<div style="display:flex;gap:10px;align-items:baseline">'
      +'<span>started in <b style="color:#EFE7D6">'+(c.total/1000).toFixed(1)+' s</b>'
      +' · '+kb+' KB · '+c.requests+' files</span>'
      +'<button type="button" id="lsCostMore" style="margin-left:auto;background:none;border:0;color:#C9A84C;font:inherit;cursor:pointer;padding:0">details</button>'
      +'<button type="button" id="lsCostX" aria-label="Dismiss" style="background:none;border:0;color:#7C7362;font:inherit;cursor:pointer;padding:0 0 0 4px">×</button>'
      +'</div><pre id="lsCostPre" style="display:none;margin:6px 0 0;white-space:pre-wrap;font:inherit;color:#8C8371">'
      +U.esc(detail)+'</pre>';
    document.body.appendChild(box);
    box.querySelector('#lsCostX').onclick=()=>box.remove();
    box.querySelector('#lsCostMore').onclick=()=>{
      const pre=box.querySelector('#lsCostPre');
      pre.style.display=pre.style.display==='none'?'block':'none';
    };
  }catch(e){}
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
    /* If the register could not be read on the way in, it was copied aside rather than
       overwritten. Say it, once, in the words that matter: the copy exists and where. */
    try{
      const rec=LS.store.recovery&&LS.store.recovery();
      if(rec) setTimeout(()=>{
        try{
          UI.toast('This device\'s register could not be read ('+(rec.why||'unknown reason')+'). A copy of '+Math.round((rec.bytes||0)/1024)
            +' KB was kept'+(rec.kept?': '+rec.kept:'')+'. A fresh register was opened so the console can start.',{type:'warn',duration:20000,
            actions:[{label:'Got it',onClick:()=>{ try{ LS.store.clearRecovery(); }catch(e){} }}]});
        }catch(e){}
      },2200);
    }catch(e){}
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
        setTimeout(showStartCost,1200);
      }, wait);
    };
    mark('total to first screen',t0);
    reportTimings();
    jump();
    markOpened();
  }catch(err){
    console.error('Boot failed',err);
    finish();
    /* The register is the only thing here that cannot be downloaded again, so it is offered
       as a file BEFORE the one button that replaces it. Nothing else on this card destroys
       anything, and the repair page is one link away. */
    document.body.insertAdjacentHTML('beforeend','<div style="position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:24px;text-align:center;overflow:auto"><div style="max-width:480px">'
      +'<div style="font-family:var(--font-display);font-size:1.6rem;color:var(--text-strong);margin-bottom:10px">Lab Systems could not start</div>'
      +'<p style="color:var(--text-muted);font-size:13px;line-height:1.65;margin-bottom:16px">The register on this device did not open. It has not been changed. '
      +'Save a copy first — it is the one thing here that cannot be downloaded again.</p>'
      +'<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:14px">'
        +'<button type="button" data-save style="padding:9px 14px;border-radius:8px;background:#C9A84C;color:#241A06;font-weight:600;border:0;cursor:pointer">Save the register as a file</button>'
        +'<a href="reset.html" style="padding:9px 14px;border-radius:8px;background:none;color:var(--text);border:1px solid var(--border-strong);text-decoration:none">Repair this device</a>'
      +'</div>'
      +'<p style="color:var(--text-faint);font-size:11px;line-height:1.6;margin:0 0 12px;font-family:var(--font-mono);word-break:break-word">'+U.esc(err&&err.message||String(err))+'</p>'
      +'<button type="button" data-seed style="background:none;border:0;color:var(--text-faint);font-size:11px;text-decoration:underline;cursor:pointer">Replace it with a fresh register</button>'
      +'</div></div>');
    try{
      const card=document.body.lastElementChild;
      const save=card.querySelector('[data-save]');
      if(save) save.onclick=()=>{
        try{
          const raw=localStorage.getItem('labSystems.v1')||'{}';
          const a=document.createElement('a');
          a.href=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
          a.download='lab-register-backup-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.json';
          document.body.appendChild(a); a.click(); a.remove();
        }catch(e){ alert('Could not read the register: '+e.message); }
      };
      const seed=card.querySelector('[data-seed]');
      if(seed) seed.onclick=()=>{
        if(!confirm('Replace the register on this device with a fresh one? A copy is only kept if you saved it above.')) return;
        try{ localStorage.removeItem('labSystems.v1'); }catch(e){}
        location.reload();
      };
    }catch(e){}
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
    +'<p style="color:var(--text-muted);font-size:12.6px;line-height:1.65;margin:0">The address is answering — it is this browser that is holding an old or half-written copy of the build. Clearing it takes a second and does not touch the register stored on this device.</p>'
    +why
    +'<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px">'
      +'<button type="button" data-fresh style="padding:9px 14px;border-radius:8px;background:#C9A84C;color:#241A06;font-weight:600;border:0;cursor:pointer">Clear cache &amp; reload</button>'
      +'<button type="button" onclick="location.reload()" style="padding:9px 14px;border-radius:8px;background:none;color:var(--text);border:1px solid var(--border-strong);cursor:pointer">Reload</button>'
      +'<a href="reset.html" style="padding:9px 14px;border-radius:8px;background:none;color:var(--text);border:1px solid var(--border-strong);cursor:pointer;text-decoration:none">Repair this device</a>'
    +'</div>'
    +'<div style="font-size:10.4px;color:var(--text-faint);margin-top:12px">Your register stays on this device. Nothing is deleted by clearing the cache.</div>'
  +'</div>';
  boot.classList.remove('done');
  const b=boot.querySelector('[data-fresh]');
  if(b) b.onclick=()=>{ location.href=location.pathname+'?fresh=1'; };
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
/* The single-file bundle carries its own copy of every screen, so a stored copy of the
   build can only get in its way. It registers no worker at all. */
if(navigator.serviceWorker && location.protocol!=='file:' && !window.__LS_BUNDLE){
  let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloading) return; reloading=true;
    UI.toast('Lab Systems updated — reloading',{type:'info',duration:1200});
    setTimeout(()=>location.reload(),900);
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
  let asked=false;
  const check=async()=>{
    if(asked||document.hidden) return;
    asked=true;
    try{
      const res=await fetch('index.html?build='+Date.now(),{cache:'no-store'});
      if(!res.ok) return;
      const txt=await res.text();
      const m=/v(\d+\.\d+\.\d+)/.exec(txt);
      if(!m||!mine||m[1]===mine) return;
      LS.ui.toast('A newer build (v'+m[1]+') is live — this tab is running v'+mine+'. Reload to see it.',{type:'info',duration:15000,
        actions:[{label:'Reload now',onClick:()=>location.reload()}]});
    }catch(e){}
  };
  setTimeout(check,4000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ asked=false; setTimeout(check,1500); } });
})();
})();
