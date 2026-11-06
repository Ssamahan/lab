/* v6.9.108 — "Module took longer than 25 seconds to render", reported from a Windows
   Chrome tab on v6.9.105 while the Command Center was open.

   That message measured the wall clock, not the work. A laptop that was shut, a tab
   Chrome froze to save memory, a phone coming back from the lock screen — the twenty-five
   seconds ran out while the module was doing nothing wrong, and the panel the reader was
   looking at was replaced by an error card. This suite holds the new behaviour: patience
   counted in time the tab was actually awake, a notice instead of a destroyed screen, and
   a module download that stalls saying exactly that. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms||120));
const click=el=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));

(async()=>{
  const {w,go}=await boot('#/dash');
  const SH=w.LS.shell, doc=w.document, U=w.LSU;
  ok(!!SH,'the shell is running');

  /* ── a normal screen costs nothing and leaves nothing behind ───────── */
  ok(!!doc.querySelector('#app h1'),'the Command Center drew');
  ok(!doc.getElementById('routeGuard'),'and no notice is left over from a previous wait');
  ok(SH._patience()===null,'the patience clock stops the moment a module is on screen',JSON.stringify(SH._patience()));
  const tm=SH.timings&&SH.timings.dash;
  ok(!!tm,'the time each screen took is recorded',JSON.stringify(tm));
  ok(tm&&tm.loadMs>=0&&tm.renderMs>=0,'both the download and the drawing of it',JSON.stringify(tm));
  ok(tm&&tm.renderMs<25000,'and the render is nowhere near the old limit',tm&&tm.renderMs+'ms');

  /* ── patience, not wall clock ──────────────────────────────────────── */
  /* the real module is loaded once first, so the stub below is not overwritten by it */
  await go('#/roadmap'); await tick(200);
  const realNow=w.Date.now;
  let fake=realNow();
  w.Date.now=()=>fake;
  let release=null;
  w.LS.modules.roadmap={render:()=>new Promise(r=>{ release=r; })};
  go('#/roadmap');
  await tick(120);
  const g=SH._patience();
  ok(!!g&&g.id==='roadmap','a screen that is still drawing has a clock running',JSON.stringify(g));
  ok(g&&g.visibleMs<3000,'which starts at nothing',g&&g.visibleMs+'ms');
  ok(doc.getElementById('page').dataset.route==='roadmap','the route belongs to the screen being drawn');
  ok(!/could not render/i.test(doc.body.innerHTML),'with no error card over it');

  /* the machine sleeps for two minutes: the timer does not run, so that time is not spent */
  fake+=120000;
  SH._guard.tick();
  const afterSleep=SH._patience();
  ok(afterSleep.visibleMs<3000,'two minutes asleep are not charged to the module',afterSleep.visibleMs+'ms visible');
  ok(afterSleep.hiddenMs>100000,'they are recorded as time the tab was not drawing',Math.round(afterSleep.hiddenMs/1000)+'s');
  ok(!afterSleep.fired,'so no notice is raised for a laptop that was closed',String(afterSleep.fired));
  ok(!doc.getElementById('routeGuard'),'and nothing is put in front of the reader');

  /* a frozen background tab behaves the same way */
  fake+=9000;
  SH._guard.tick();
  const afterFrozen=SH._patience();
  ok(afterFrozen.visibleMs<3000,'a tab that was frozen for nine seconds does not spend the budget',afterFrozen.visibleMs+'ms');

  /* awake but genuinely slow: now the budget is spent, one second at a time */
  for(let i=0;i<13;i++){ fake+=2000; SH._guard.tick(); }
  const fired=SH._patience();
  ok(fired.visibleMs>=25000,'twenty-five seconds of a tab that is awake and drawing',fired.visibleMs+'ms');
  ok(fired.fired===true,'raises the notice',String(fired.fired));
  const notice=doc.getElementById('routeGuard');
  ok(!!notice,'as a notice, in place, instead of replacing the screen');
  ok(/Still drawing Premium Roadmap/.test(notice.textContent),'that names the screen',notice.textContent.slice(0,60));
  ok(/Nothing is lost/.test(notice.textContent),'and says the register is untouched');
  ok(/asleep|background/.test(notice.textContent),'and names the likely cause, with the seconds it was asleep');
  const secs=(notice.textContent.match(/about (\d+) seconds/)||[])[1];
  ok(Number(secs)>=120,'as a figure, not a guess',secs+'s');
  ok(!!notice.querySelector('[data-rg-wait]'),'with a way to keep waiting');
  ok(!!notice.querySelector('[data-rg-reload]'),'a way to reload');
  ok(!!notice.querySelector('[data-rg-home]'),'a way back to the Command Center');
  ok(!!notice.querySelector('[data-rg-diag]'),'and diagnostics to copy');
  ok(!!doc.querySelector('#pageInner'),'the place the screen will draw into is still there, not an error card');
  ok(!/could not render/i.test(doc.body.innerHTML),'no error card was shown',doc.querySelector('#page').textContent.slice(0,80));

  click(notice.querySelector('[data-rg-wait]'));
  await tick(40);
  ok(!doc.getElementById('routeGuard'),'"Keep waiting" puts it away, and the screen keeps working');

  /* the module arrives after all — and the notice does not come back with it */
  release();
  await tick(300);
  ok(SH._patience()===null,'the clock stops when the screen finally draws');
  ok(!doc.getElementById('routeGuard'),'and no notice is left on a screen that drew');
  ok(SH.timings.roadmap&&SH.timings.roadmap.renderMs>=0,'the screen that arrived was recorded as drawn',JSON.stringify(SH.timings.roadmap));
  ok(!/could not render/.test(doc.querySelector('#page').textContent),'and nothing was left saying it failed');
  delete w.LS.modules.roadmap;

  /* ── a navigation cancels the previous wait ────────────────────────── */
  w.LS.modules.roadmap={render:()=>new Promise(()=>{})};
  go('#/roadmap'); await tick(80);
  for(let i=0;i<14;i++){ fake+=2000; const t=SH._guard; if(t&&t.tick) t.tick(); }
  ok(!!doc.getElementById('routeGuard'),'a stuck screen raises the notice');
  const back=go('#/dash');
  await back; await tick(250);
  ok(!doc.getElementById('routeGuard'),'opening another module takes the notice away');
  ok(SH._patience()===null,'and cancels its clock, so it cannot fire later',JSON.stringify(SH._patience()));
  ok(!!doc.querySelector('#app h1'),'with the new screen drawn');
  delete w.LS.modules.roadmap;
  w.Date.now=realNow;

  /* ── a module file that never arrives says so, by name ─────────────── */
  SH.moduleWaitMs=120;                      /* the same code path, at a size a test can wait for */
  const realAppend=doc.head.appendChild.bind(doc.head);
  let swallowed=0, stalling=true;
  doc.head.appendChild=function(el){
    if(el&&el.tagName==='SCRIPT'&&/design\.js/.test(el.src||'')){ swallowed++; if(stalling) return el; }
    return realAppend(el);
  };
  await go('#/design'); await tick(500);
  const failCard=doc.querySelector('#page');
  ok(swallowed>=1,'the module file was requested',String(swallowed));
  ok(/did not arrive within/.test(failCard.textContent),'and a stall is reported as a stall, not as a slow screen');
  ok(/Design System/.test(failCard.textContent),'naming the screen');
  ok(/register on this device is untouched/.test(failCard.textContent),'and saying the data is safe');
  ok(!/took longer than/i.test(failCard.textContent),'the old wall-clock sentence is gone for good');
  ok(!!failCard.querySelector('[data-retry]'),'with a Retry');

  /* Retry re-fetches: the module that failed is not treated as already loaded */
  stalling=false;                        /* the network comes back */
  click(failCard.querySelector('[data-retry]'));
  await tick(700);
  ok(swallowed>=3,'Retry asks the server again rather than reusing the failure',String(swallowed));
  ok(!/already loaded|Module not registered/.test(doc.querySelector('#page').textContent),'and does not treat the failed file as loaded');
  ok(!/did not arrive within/.test(doc.querySelector('#page').textContent),'and the screen draws on the second attempt');
  ok(!!SH.timings.design,'the retry recorded its timings too',JSON.stringify(SH.timings.design));

  /* ── a real exception still fails, and still offers Retry ──────────── */
  w.LS.modules.roadmap={render:()=>{ throw new Error('module blew up'); }};
  await go('#/roadmap'); await tick(300);
  const errCard=doc.querySelector('#page');
  ok(/could not render/.test(errCard.textContent),'an exception is still caught by the module boundary');
  ok(!doc.getElementById('routeGuard'),'and the patience notice is cleared with it');
  ok(/module blew up/.test(errCard.textContent||''),'the card repeats the actual reason in words, not a status code');
  ok(!/UA:|navigator|at render \(/.test(errCard.textContent||''),'while the stack and user agent stay behind the copy button');
  delete w.LS.modules.roadmap;

  /* ── a tab left open for weeks is told a newer build exists ─────────── */
  const bootSrc=require('fs').readFileSync(require('path').join(__dirname,'..','assets','js','core','boot.js'),'utf8');
  ok(/setInterval\(check,10\*60\*1000\)/.test(bootSrc),'the version check repeats every ten minutes, not once');
  ok(/warned===m\[1\]/.test(bootSrc),'and says the newer build once, not every ten minutes');

  /* ── nothing is left hard-coded to the old promise ─────────────────── */
  const shell=require('fs').readFileSync(require('path').join(__dirname,'..','assets','js','core','shell.js'),'utf8');
  ok(shell.indexOf('took longer than 25 seconds')<0,'the 25-second wall-clock message no longer exists');
  ok(/WAKE_GAP/.test(shell)&&/RENDER_BUDGET/.test(shell),'patience is a budget of awake seconds');
  ok(/document\.hidden/.test(shell),'that knows when the tab is not visible');
  ok(/if\(page\.dataset\.route!==id\)\{ return; \}/.test(shell),'and a late module cannot paint over a newer screen');

  done('guard108');
})().catch(e=>{ console.log('  ✗ suite threw: '+(e&&e.stack||e)); done('guard108'); });
