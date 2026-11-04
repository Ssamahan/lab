/* v6.9.99 — a screen that does not arrive says so, and offers the cure.
   A report came back from a device running v6.9.88 with the dash showing
   "Module took longer than 25 seconds to render". Two things were wrong with that:
   the tab was ten builds behind the site and the panel never said so, and a script
   that never fires load OR error could hang a screen until the watchdog gave up.
   These checks pin the deadline, the naming of the two versions, and the one action
   that actually fixes a stale copy. */
const {boot,ok,done}=require('./env');
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const shellJs=fs.readFileSync(path.join(root,'assets/js/core/shell.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const V=pkg.version;

/* ——— 1 · nothing waits for ever ——————————————————————————————— */
ok(/const DEP_TIMEOUT=10000/.test(shellJs),'the deferred helpers have a ten-second deadline');
ok(/code:'LOAD_TIMEOUT'/.test(shellJs),'and a named failure, not a silent hang');
ok(/function loadScript\(id,file,bust,ms\)/.test(shellJs),'a module is loaded under its own deadline');
ok(/15000/.test(shellJs),'fifteen seconds, with a timer that clears on load and on error');
ok(/\.catch\(err=>loadScript\(id,r\.file,String\(Date\.now\(\)\)/.test(shellJs),
   'a module that does not arrive is asked for once more, past the cache');
ok(/&r='\+bust/.test(shellJs),'the retry carries a different address, so the cache cannot answer it');
ok(/sc\.onerror=\(\)=>\{ if\(settled\) return; settled=true; clearTimeout\(timer\);/.test(shellJs),
   'an error and a timeout are handled the same way');

/* ——— 2 · the panel names the two versions ————————————————————— */
ok(/This screen did not arrive/.test(shellJs),'a slow load is described as a load, not a render');
ok(/data-fresh/.test(shellJs),'and the panel carries the action that fixes it');
ok(/location\.pathname\+'\?fresh=1'/.test(shellJs),'which is a plain address, so it works even if the scripts are the thing that failed');
ok(/This tab is running v/.test(shellJs),'the live build is compared with the one in memory');
ok(/the usual cause of a screen not arriving/.test(shellJs),'and a mismatch is named as the usual cause');
ok(/not the register/.test(shellJs)&&/Nothing stored on this device is deleted/.test(shellJs),
   'the panel says plainly what clearing does not touch');

/* ——— 3 · a skeleton that is waiting says what it is waiting for —— */
ok(/SH\._slowTimer=setTimeout/.test(shellJs),'a skeleton gets a six-second check');
ok(/6000\)/.test(shellJs),'six seconds');
ok(/id='slowHint'/.test(shellJs),'and then a note above it');
ok(/data-slow-fresh/.test(shellJs),'with the same clear-and-reload action');
ok(/clearTimeout\(SH\._slowTimer\)/.test(shellJs),'which is cancelled the moment the screen renders');

(async()=>{
  const {w,go}=await boot('#/dash');
  const d=w.document, SH=w.LS.shell;

  /* ——— 4 · the panel, driven for real ——————————————————————— */
  const host=d.getElementById('page');
  /* jsdom ships no fetch; a browser does. The panel must work either way — the version
     comparison is an improvement on the message, never a requirement for drawing it. */
  const realFetch=w.fetch;
  w.fetch=async()=>({ok:true,text:async()=>'<div>v'+V+'</div>'});
  SH.fail(Object.assign(new Error('Could not load module: dash'),{code:'LOAD_TIMEOUT'}),'dash',host);
  await new Promise(r=>setTimeout(r,400));
  ok(/This screen did not arrive/.test(host.textContent),'a load timeout is titled as one');
  ok(/did not come back in time/.test(host.textContent),'and explains itself in a sentence');
  const fresh=host.querySelector('[data-fresh]');
  ok(!!fresh,'the clear-cache button is there');
  ok(!!host.querySelector('[data-retry]')&&!!host.querySelector('[data-diag]'),
     'retry and copy-diagnostics are still there');
  ok(/already running the current build/.test(host.querySelector('#failVer').textContent),
     'on a tab that matches the site, the panel says so rather than blaming the cache: '+host.querySelector('#failVer').textContent.slice(0,60));

  /* an older tab must be told which version it is running, by number */
  w.fetch=async()=>({ok:true,text:async()=>'<div>v9.9.9</div>'});
  SH.fail(new Error('boom'),'dash',host);
  await new Promise(r=>setTimeout(r,400));
  const line=host.querySelector('#failVer').textContent;
  ok(line.indexOf('v'+V)>=0&&line.indexOf('v9.9.9')>=0,'a stale tab is told both versions: '+line.slice(0,70));
  w.fetch=realFetch;

  /* ——— 5 · a working screen is unaffected ——————————————————— */
  await go('#/dash');
  ok(!!d.querySelector('#app h1, #app .page-head h1'),'the dashboard still renders');
  ok(!d.querySelector('#slowHint'),'and no waiting note is left behind');
  ok(!d.querySelector('#page [data-fresh]'),'and no failure panel is left behind');

  /* ——— 6 · the retry address is genuinely different —————————— */
  const seen=[];
  const realAppend=w.document.head.appendChild.bind(w.document.head);
  w.document.head.appendChild=(el)=>{ if(el&&el.tagName==='SCRIPT'&&/modules\//.test(el.src)) seen.push(el.src); return realAppend(el); };
  w.eval("delete LS.modules.roster;");
  try{ await w.LS.shell.go('roster'); }catch(e){}
  await new Promise(r=>setTimeout(r,900));
  w.document.head.appendChild=realAppend;
  const roster=seen.filter(u=>/roster\.js/.test(u));
  ok(roster.length>=1,'opening a screen asks for its file once, at this build: '+(roster[0]||'').split('/').pop());
  ok(roster.every(u=>u.indexOf('?v='+V)>=0),'always at the version in index.html');

  done('load99');
})();
