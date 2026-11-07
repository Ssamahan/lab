/* v6.9.109 — "the website is not readable still, and takes very long"

   Nothing was broken; too much was being downloaded before anything could be read. A
   first visit pulled the whole console — sixteen screens, the export engine, eleven font
   files — in the background *while* the page it was competing with was still arriving,
   and the public overview waited behind a 71 KB console stylesheet and a two-second
   animation it did not need. This suite holds the diet in place, and holds the address
   shape (`#/samples`) that makes a deep link work on a static host with no server. */
const fs=require('fs'), path=require('path');
const {boot,ok,done}=require('./env');
const ROOT=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const shellSrcHasDepGate=src=>/MODULE_DEPS\s*=\s*\{/.test(src)||/await Promise\.all\(deps\.map/.test(src);
const size=f=>fs.statSync(path.join(ROOT,f.split('?')[0])).size;
const tick=ms=>new Promise(r=>setTimeout(r,ms||200));

(async()=>{
  /* ── what a first visit has to download before anything is readable ── */
  const html=read('index.html');
  const shellSrcEarly=read('assets/js/core/shell.js');
  const blocking=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
  const noScript=html.replace(/<noscript>[\s\S]*?<\/noscript>/g,'');
  const css=[...noScript.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1]);
  const jsBytes=blocking.reduce((t,u)=>t+size(u),0);
  const cssBytes=css.reduce((t,u)=>t+size(u),0);

  ok(jsBytes<720*1024,'the code needed to open the console is under 720 KB',Math.round(jsBytes/1024)+' KB');
  ok(cssBytes<155*1024,'and the stylesheets it must wait for stay under 155 KB',Math.round(cssBytes/1024)+' KB');
  ok((jsBytes+cssBytes+size('index.html'))<900*1024,
    'a first screen is under 900 KB in total',Math.round((jsBytes+cssBytes+size('index.html'))/1024)+' KB');
  /* 6.9.111 — the export engine is back in the boot list. Deferring it made thirteen
     screens WAIT for 91 KB before their own file started; when that request hung, the
     screen never drew at all. A slow file must only slow itself. */
  ok(blocking.some(u=>/sheets\.js/.test(u)),'the export engine loads with the shell, in parallel, not in front of a screen');
  ok(!shellSrcHasDepGate(shellSrcEarly),'and no screen waits for an optional file before drawing');
  ok(!blocking.some(u=>/xlsxread\.js/.test(u)),'nor the spreadsheet reader');
  ok(blocking.some(u=>/store\.js/.test(u))&&blocking.some(u=>/boot\.js/.test(u)),'the register and the boot still are');

  /* ── the console stylesheet is blocking, on purpose ─────────────────
     6.9.109 deferred it to save 71 KB of waiting; 6.9.110 puts it back, because a
     deferred stylesheet that never swaps produces an unstyled console, and an unstyled
     console is an unreadable one. The bytes saved are worth less than that risk. */
  ok(/^<link rel="stylesheet" href="assets\/css\/modules\.css/m.test(noScript.trim().split('\n').filter(l=>/modules\.css/.test(l))[0]||''),
    'the console stylesheet is applied before the first screen is drawn');
  ok(!/rel="preload"[^>]+modules\.css/.test(html),'not deferred behind a script that might not run');
  ok(css.some(u=>/modules\.css/.test(u)),'and it is in the stylesheet list the browser waits for');

  /* ── the address shape: a hash, and why ────────────────────────────── */
  ok(/#\//.test(html+read('assets/js/core/shell.js')),'screens are addressed after a #');
  const shellSrc=read('assets/js/core/shell.js');
  ok(/location\.hash/.test(shellSrc),'which the browser never sends to the server');
  ok(!/history\.pushState/.test(shellSrc),'so there is no server rule to keep — GitHub Pages has no server');
  const {w,go}=await boot('#/samples');
  ok(w.location.hash==='#/samples','#/samples opens the samples screen directly',w.location.hash);
  const head=w.document.querySelector('#app h1')||w.document.querySelector('#page h1')||w.document.querySelector('#pageTitle');
  ok(!!head,'and the screen carries a heading',head&&head.textContent);
  ok(/sample|referr/i.test((head&&head.textContent)||'')||/Referred Samples/.test(w.document.body.textContent),
    'which is the samples screen',(head&&head.textContent)||'');

  /* ── the check page: a way to name the failure on a hostile network ── */
  const check=read('check.html');
  ok(/Connection check/.test(check),'there is a standalone connection check page');
  ok(!/<script src=/.test(check)&&!/<link rel="stylesheet"/.test(check),'that loads no script and no stylesheet of its own');
  ok(/assets\/js\/core\/shell\.js/.test(check)&&/assets\/js\/modules\/dash\.js/.test(check),'it asks for selected files the console needs');
  ok(/AbortController/.test(check),'and gives up on one that never answers, instead of waiting for ever');
  ok(!/caches\.delete/.test(check)&&!/unregister\(\)/.test(check),'without offering cache deletion during diagnosis');
  ok(!/labSystems\.v1[^)]*removeItem/.test(check),'and it never touches the register stored on the device');
  ok(check.length<20000,'in a file small enough to arrive on a broken connection',Math.round(check.length/1024)+' KB');

  /* ── the lazy core: export code arrives when a screen needs it ─────── */
  const SY=w.LS.store, SH=w.LS.shell, doc=w.document;
  ok(!!SH.ensureCore,'the shell can fetch extra core code on demand');
  ok(!!w.LS.sheets,'the export engine is loaded with the shell');
  const before=!!w.LS.sheets;
  const t0=Date.now();
  await SH.ensureCore('sheets');
  ok(!!w.LS.sheets,'asking for it loads it',String(Date.now()-t0)+'ms');
  const q1=SH.ensureCore('xlsx'), q2=SH.ensureCore('xlsx');
  ok(q1===q2,'two screens asking at once cost one download, not two');
  await q1;
  ok(before||!!w.LS.sheets,'and it stays loaded afterwards');
  await SH.ensureCore('xlsx');
  ok(!!w.LSXLSX,'the spreadsheet reader loads the same way');
  let failed=false;
  try{ await SH.ensureCore('nonsense'); }catch(e){ failed=true; }
  ok(!failed,'asking for something that does not exist is quietly ignored');

  /* the export engine is part of the shell again, so a screen may read LS.sheets as it
     executes — no gate, and nothing to wait for */
  ok(typeof w.LS.sheets==='object'&&typeof w.LS.sheets.monthlyXLSX==='function',
    'the export engine is present before any screen runs');

  /* a real roster visit still renders, and its export button still works */
  await go('#/roster'); await tick(500);
  ok(!/could not render/i.test(doc.getElementById('page').textContent),'the Working Plan still draws');
  ok(typeof w.LS.sheets.monthlyXLSX==='function','and can still produce the XLSX');
  const plan=w.LS.store.db().workingPlans;
  ok(!!plan,'with the plans on file');

  /* ── the service worker stops downloading the world on install ─────── */
  const sw=read('sw.js');
  const coreList=sw.slice(sw.indexOf('const CORE = ['),sw.indexOf('const LATER = ['));
  const laterList=sw.slice(sw.indexOf('const LATER = ['),sw.indexOf('const MODULES = ['));
  ok(!/modules\//.test(coreList),'no screen is precached during install');
  ok(/store\.js/.test(coreList)&&/index\.html/.test(coreList),'the shell and the register are, because boot needs them offline');
  ok(/sheets\.js/.test(coreList),'and the export engine is, because boot needs it');
  const coreCount=(coreList.match(/'\.\//g)||[]).length;
  ok(coreCount<32,'the install list is short enough to land on a phone connection',String(coreCount)+' files');
  ok(/const MODULES = \[/.test(sw)&&/moduleUrl/.test(sw),'the screens are still known by name');
  ok(/type === 'WARM'/.test(sw),'and are fetched on a WARM message instead');
  ok(/async function precache\(list, cacheName, size\)/.test(sw),'through one downloader, a few files at a time');
  ok(/precache\(CORE, SHELL, 4\)/.test(sw),'install takes only the shell, four at a time');
  ok(/precache\(targets, SHELL, 3\)/.test(sw),'and the warm pass is gentler still');

  /* how much that saves on a first visit */
  const modBytes=fs.readdirSync(path.join(ROOT,'assets/js/modules')).reduce((t,f)=>t+fs.statSync(path.join(ROOT,'assets/js/modules',f)).size,0);
  ok(modBytes>800*1024,'the screens alone are over 800 KB',Math.round(modBytes/1024)+' KB');
  const fonts=fs.readdirSync(path.join(ROOT,'assets/fonts')).filter(f=>/woff2$/.test(f));
  ok(fonts.length>8,'and there are '+fonts.length+' font files, of which the first screen needs two');

  /* ── the page asks for the rest only when it is told to ────────────── */
  const bootSrc=read('assets/js/core/boot.js');
  ok(/warmTheRest/.test(bootSrc),'the page warms the cache after the first screen');
  ok(/saveData/.test(bootSrc)&&/2g/.test(bootSrc),'but never on a metered or save-data connection');
  ok(/requestIdleCallback/.test(bootSrc),'and only when the browser has nothing better to do');
  ok(/type:'WARM'/.test(bootSrc),'by asking the worker, not by fetching screens itself');
  ok(/setTimeout\(warmTheRest,4000\)/.test(bootSrc),'four seconds after load, not during it');

  /* ── the opening animation is not a loader ────────────────────────── */
  const m=/const FIRST_RUN=(\d+), RETURNING=(\d+);/.exec(bootSrc);
  ok(!!m,'the splash has a fixed length');
  ok(m&&Number(m[1])<=1000,'a first visit is held under a second, not two',m&&m[1]+'ms');
  ok(m&&Number(m[2])<=300,'and a returning device barely at all',m&&m[2]+'ms');

  /* ── measured: what the console actually costs to open ────────────── */
  const ids=['dash','samples','stock','reports','training','revenue','roster','leave','eqa','pbf','quality','equipment','staff'];
  const slow=[];
  for(const id of ids){
    await go('#/'+id); await tick(60);
    const t=SH.timings[id];
    if(t&&t.renderMs>1500) slow.push(id+' '+t.renderMs+'ms');
  }
  ok(!slow.length,'no screen takes longer than a second and a half to draw',slow.join(' | '));
  ok(Object.keys(SH.timings).length>=ids.length,'every screen times itself',String(Object.keys(SH.timings).length));

  done('perf109');
})().catch(e=>{ console.log('  ✗ suite threw: '+(e&&e.stack||e)); done('perf109'); });
