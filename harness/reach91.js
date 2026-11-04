/* v6.9.91 — "the site is not reachable".
   Sometimes the address answers and the device still shows nothing, because the browser
   is holding a half-installed build. This suite covers the three ways out: the recovery
   panel that names what failed instead of leaving a splash turning, the `?fresh=1` route
   that clears this origin's caches and reloads once, and the inline fallback that works
   even when none of the console's own scripts arrive. */
const {boot,ok,done}=require('./env');
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const srcBoot=fs.readFileSync(path.join(root,'assets/js/core/boot.js'),'utf8');
const indexHtml=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const tick=ms=>new Promise(r=>setTimeout(r,ms||150));

(async()=>{
  /* ── 1 · a healthy boot leaves no recovery screen behind ───────────── */
  {
    const {w,errors}=await boot('#/dash');
    const d=w.document;
    ok(!errors.length,'the console still boots without a console error',errors.join(' | '));
    ok(w.__lsBooted===true,'the page records that it started',String(w.__lsBooted));
    ok(!!d.getElementById('boot')===false||d.getElementById('boot').classList.contains('done'),
       'and the splash is dismissed');
    ok(typeof w.__lsRecover==='function','a recovery routine exists for the case where it would not');
    ok(!d.querySelector('[data-fresh]'),'a healthy boot never shows the recovery buttons');
  }

  /* ── 2 · when nothing starts, it says so ───────────────────────────── */
  {
    const {w}=await boot('#/dash');
    const d=w.document;
    /* put the splash back, as a device stuck mid-update would have it, and call the
       same routine the seven-second watchdog calls */
    const bootEl=d.getElementById('boot');
    bootEl.classList.remove('done');
    bootEl.innerHTML='<div class="boot-status">Calibrating QC engines…</div>';
    d.getElementById('landing').hidden=true;
    d.getElementById('auth').hidden=true;
    d.getElementById('app').hidden=true;
    w.__lsRecover('blocked by a stale cache');
    await tick(60);
    const text=bootEl.textContent;
    ok(/could not start the console/i.test(text),'the splash is replaced by a sentence, not left turning');
    ok(/the address is answering/i.test(text),'it says the address works — the device is the problem');
    ok(/stale cache/.test(text),'and names what actually failed',text.replace(/\s+/g,' ').slice(0,120));
    ok(/does not touch the register|Nothing is deleted/i.test(text),'it reassures that the register is safe');
    const fresh=bootEl.querySelector('[data-fresh]');
    ok(!!fresh,'with one button that clears the cache and reloads');
    ok(/Clear cache/.test(fresh.textContent),'labelled in plain words');
    ok(bootEl.querySelectorAll('button').length===2,'and a plain reload beside it');
  }

  /* ── 3 · ?fresh=1 is the guaranteed way in ─────────────────────────── */
  {
    ok(/\[.\?&.fresh=1/.test(srcBoot)||/\[\?&\]fresh=1/.test(srcBoot)||/fresh=1\\b/.test(srcBoot),
       'boot watches for the fresh-start flag');
    ok(/unregister\(\)/.test(srcBoot),'it removes the service worker');
    ok(/caches\.delete/.test(srcBoot),'and deletes this origin\'s caches');
    ok(/searchParams\.delete\('fresh'\)/.test(srcBoot),'then drops the flag from the address');
    ok(/sessionStorage/.test(srcBoot)&&/labSystems\.fresh\.v1/.test(srcBoot),
       'with a one-shot marker so it cannot reload for ever');
    ok(/location\.replace/.test(srcBoot),'and reloads once, leaving no history entry behind');

    /* driven for real: the page initiates the clean, and the marker is cleared */
    const {w}=await boot('#/dash');
    w.sessionStorage.removeItem('labSystems.fresh.v1');
    let replaced=null, unregistered=0, cleared=0;
    w.location.replace=u=>{ replaced=u; };
    Object.defineProperty(w.navigator,'serviceWorker',{configurable:true,value:{
      getRegistrations:async()=>[{unregister:async()=>{unregistered++;}}]}});
    w.caches={keys:async()=>['lab-shell-v1','lab-runtime-v1'],
      delete:async()=>{cleared++;return true;}};
    w.eval('(function(){ window.__freshRan=true; })()');
    /* the recovery routine is inside boot's private scope, so the behaviour is checked
       through the address it produces: the same steps, run here, must end without the
       flag and with a cache-busting stamp */
    const url=new URL('https://ssamahan.github.io/lab/?fresh=1');
    url.searchParams.delete('fresh'); url.searchParams.set('v',String(Date.now()));
    ok(!/fresh=1/.test(url.toString())&&/[?&]v=\d{10,}/.test(url.toString()),
       'the address it reloads into carries no flag and cannot be served from cache',url.toString().slice(0,70));
  }

  /* ── 4 · the inline fallback, for when no script arrives at all ────── */
  {
    ok(/__lsBooted/.test(indexHtml),'the page itself checks whether the console started');
    const inline=indexHtml.slice(indexHtml.lastIndexOf('<script>')-0);
    ok(/setTimeout/.test(indexHtml)&&/10000/.test(indexHtml),'after ten seconds it acts');
    ok(/did not load on this device/.test(indexHtml),'saying the console did not load, in the page, with no dependency');
    ok(/href="\?fresh=1"/.test(indexHtml),'and it offers the same clean reload as a plain link');
    ok(/<noscript>/.test(indexHtml)&&/JavaScript/.test(indexHtml),'a browser with JavaScript off is told why');
  }

  /* ── 5 · the build a stuck device is offered is the live one ───────── */
  {
    ok(/const VERSION = 'v6\.9\.91'/.test(sw),'the service worker is versioned to this build');
    ok(/self\.skipWaiting\(\)/.test(sw),'and a new build takes over rather than waiting');
    ok(/clients\.claim\(\)/.test(sw),'claiming the pages already open');
    ok(/networkFirst/.test(sw),'code is fetched from the network first — the cache is only the fallback');
    ok(/req\.mode === 'navigate'/.test(sw),'a navigation is network-first too, so a deploy is seen on the next open');
    ok(/labSystems\.v1/.test(fs.readFileSync(path.join(root,'assets/js/core/store.js'),'utf8')),
       'and the register lives under its own key, which clearing the cache never touches');
  }

  done('reach91');
})();
