/* ============================================================================
   LAB SYSTEMS · BOOT — splash choreography, init, service worker, recovery
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU;
const LINES=['Calibrating QC engines…','Verifying chain of custody…','Loading ISO 15189 register…','Rehydrating local register…','Arming offline cache…','Ready.'];
const SPLASH_MIN=2100;
let done=false;

function finish(){
  if(done) return; done=true;
  const boot=document.getElementById('boot');
  if(boot){ boot.classList.add('done'); setTimeout(()=>boot.remove(),700); }
}
function init(){
  const t0=performance.now();
  try{
    LS.store.init();
    LS.i18n.init();
    try{ if(window.LS.sync) LS.sync.start(); }catch(e){ console.warn('sync start',e); }
    LS.auth.init();
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
    jump();
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
// watchdog: never trap the user behind the splash
setTimeout(finish,6500);

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,60));
else setTimeout(init,60);

/* Service worker — offline-first, and never stale. The new build takes control
   as soon as it installs; the page reloads once so the user is not left running
   yesterday's JavaScript (that is what makes a fixed Close button look broken). */
if(navigator.serviceWorker && location.protocol!=='file:'){
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
})();
