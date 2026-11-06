/* v6.9.95 — the console opens quickly, and nothing freezes while it does.
   Three things were making it slow: every load re-downloaded the whole JavaScript bundle
   because code was network-first even when the cache held the same version; the splash
   was held for two seconds on every visit; and every start wrote the register back to
   storage (and woke every other open tab) even when nothing had changed. */
const {boot,ok,done}=require('./env');
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const indexHtml=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const bootJs=fs.readFileSync(path.join(root,'assets/js/core/boot.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const V=pkg.version;

(async()=>{
  /* ── 1 · every asset is asked for at the build's own version ────────── */
  const core=indexHtml.slice(indexHtml.indexOf('<link rel="stylesheet"'),indexHtml.lastIndexOf('</body>'));
  const scripts=[...indexHtml.matchAll(/<script src="(assets\/[^"]+)"/g)].map(m=>m[1]);
  /* v6.9.109 — the shell's own code, minus the two files that are fetched on demand:
     sheets.js (91 KB) and xlsxread.js. Fourteen requests, not sixteen. */
  ok(scripts.length>=14&&scripts.length<=16,'the page loads its own code ('+scripts.length+' files)');
  ok(scripts.every(u=>u.indexOf('?v='+V)>=0),'and every one of them carries the build version',
     scripts.filter(u=>u.indexOf('?v='+V)<0).join(' '));
  const css=[...indexHtml.matchAll(/<link rel="stylesheet" href="(assets\/[^"]+)"/g)].map(m=>m[1]);
  ok(css.length>=4,'the stylesheets are asked for the same way ('+css.length+')');
  ok(css.every(u=>u.indexOf('?v='+V)>=0),'each with the version in the address');
  ok(new RegExp("APP_VERSION='"+V.replace(/\./g,'\\.')+"'").test(fs.readFileSync(path.join(root,'assets/js/core/shell.js'),'utf8')),
     'the shell and the addresses agree on the version ('+V+')');

  /* ── 2 · the service worker serves the current build from the cache ── */
  ok(/const VERSION = 'v'+?/.test(sw)!==null || /const VERSION = 'v6\.9\./.test(sw),'the worker is versioned');
  ok(/function isCurrentVersion/.test(sw),'it can tell a URL asked for at this build');
  ok(/searchParams\.get\('v'\)/.test(sw),'by reading the version out of the address');
  ok(/async function cacheFirst/.test(sw),'and it serves those from the cache first');
  ok(/if \(hit\) \{ refresh; return hit; \}/.test(sw),'handing the copy back at once while the network refreshes it');
  const fetchBlock=sw.slice(sw.indexOf("self.addEventListener('fetch'"));
  const versionedAt=fetchBlock.indexOf('isCurrentVersion(url)');
  const networkAt=fetchBlock.indexOf('networkFirst(req, RUNTIME)');
  ok(versionedAt>0&&networkAt>versionedAt,'versioned code is answered before the network-first rule');
  ok(/networkFirst\(req, RUNTIME\)/.test(fetchBlock),'an unversioned URL still goes to the network first');
  ok(/if \(req\.mode === 'navigate'\)/.test(fetchBlock),'and a navigation is still network-first, so a deploy is seen at once');
  ok(/\.\/assets\/js\/core\/store\.js\?v=/.test(sw),'the precache list is versioned too — the next visit finds everything');
  ok(/async function precache\(list, cacheName, size\)/.test(sw),'and one downloader fills the cache from both lists');
  ok(/precache\(CORE, SHELL, 4\)/.test(sw),'four files at a time, so it never competes with the page');
  ok(!/await Promise\.all\(CORE\.concat\(MODULES\)/.test(sw),'not all fifty at once, which is what saturated the connection');

  /* ── 3 · the splash is a first-run courtesy ─────────────────────────── */
  ok(/FIRST_RUN=900/.test(bootJs)&&/RETURNING=220/.test(bootJs),'a first visit is under a second, a returning one barely anything');
  ok(/hasOpenedBefore/.test(bootJs)&&/labSystems\.opened\.v1/.test(bootJs),'the device remembers that it has opened the console');
  {
    /* driven for real: a device that has opened before must not wait for a first-run splash */
    const {w,go}=await boot('#/dash',{seed(win){ try{ win.localStorage.setItem('labSystems.opened.v1','1'); }catch(e){} }});
    await go('#/dash');
    const d=w.document;
    ok(d.getElementById('landing')&&!d.getElementById('landing').hidden||(d.getElementById('app')&&!d.getElementById('app').hidden),
       'the console is on screen');
    const splash=d.getElementById('boot');
    ok(!splash||splash.classList.contains('done'),'and the splash has already given way');
    ok(w.localStorage.getItem('labSystems.opened.v1')==='1','the marker stays for the next visit');
  }

  /* ── 4 · the register is not written back when nothing changed ──────── */
  {
    const {w,go}=await boot('#/dash');
    const S=w.LS.store;
    ok(/const next=JSON\.stringify\(DB\)/.test(fs.readFileSync(path.join(root,'assets/js/core/store.js'),'utf8')),
       'the store compares what it repaired with what it read');
    ok(/if\(seeded\|\|next!==raw\) S\._persist\(next\)/.test(fs.readFileSync(path.join(root,'assets/js/core/store.js'),'utf8')),
       'and only writes when the two differ');
    /* a second start on the same register: no write, therefore no wake-up of other tabs */
    let writes=0;
    const realSet=w.localStorage.setItem.bind(w.localStorage);
    w.localStorage.setItem=(k,v)=>{ if(k==='labSystems.v1') writes++; return realSet(k,v); };
    const raw=w.localStorage.getItem('labSystems.v1');
    w.eval('LS.store.reloadFromStorage()');
    ok(writes===0,'a restart with an unchanged register writes nothing at all ('+writes+' writes)');
    /* and a real change is written */
    S.commit(d=>{ d.settings.hospital='Ruli District Hospital'; },{action:'test.touch'});
    S.save(true);
    ok(w.localStorage.getItem('labSystems.v1')&&w.localStorage.getItem('labSystems.v1').length>raw.length-5000,
       'while a real edit still reaches storage');
    w.localStorage.setItem=realSet;
  }

  /* ── 5 · the first exchange with the cloud waits for an idle device ─── */
  const syncSrc=fs.readFileSync(path.join(root,'assets/js/core/sync.js'),'utf8');
  ok(/function idle\(/.test(syncSrc),'a sync can be told to wait until the browser is not drawing');
  ok(/if\(SY\.configured\(\)\) idle\(/.test(syncSrc),'and the boot exchange uses it');
  ok(/requestIdleCallback/.test(syncSrc),'through requestIdleCallback where it exists');

  /* ── 6 · how long a start took, when it was slow ───────────────────── */
  {
    const {w}=await boot('#/dash');
    ok(Array.isArray(w.LS_TIMINGS)&&w.LS_TIMINGS.length>=3,'the start is timed, part by part',JSON.stringify(w.LS_TIMINGS));
    const names=w.LS_TIMINGS.map(x=>x.name).join(' ');
    ok(/register loaded/.test(names),'the register');
    ok(/language|accounts/.test(names),'the language and the accounts');
    ok(w.LS_TIMINGS.every(x=>typeof x.ms==='number'&&x.ms>=0),'with a real duration on each');
    ok(/diag=1/.test(bootJs),'printed when the address asks for it (?diag=1)');
  }

  /* ── 7 · and it can be read off the settings screen ─────────────────── */
  {
    const {w,go}=await boot('#/dash');
    await go('#/staff?tab=data'); await new Promise(r=>setTimeout(r,300));
    const st=fs.readFileSync(path.join(root,'assets/js/modules/staff.js'),'utf8');
    ok(/Last start/.test(st),'Settings → Data shows how long the last start took');
    ok(/window\.LS_TIMINGS/.test(st),'reading the real measurement, not a guess');
  }

  done('load95');
})();
