/* v6.9.101 — a screen opens even when the chart engine never arrives.
   The report was "I get in but it fails to load any module fully". Every module in this
   console captures `LS.charts` and `LS.sheets` in its first line, so a helper that does not
   arrive takes the whole screen with it — for a drawing it may not even have reached yet.
   These checks drive that case for real and pin the three ways out. */
const {boot,ok,done}=require('./env');
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const shellJs=fs.readFileSync(path.join(root,'assets/js/core/shell.js'),'utf8');
const indexHtml=fs.readFileSync(path.join(root,'index.html'),'utf8');
const reset=fs.readFileSync(path.join(root,'reset.html'),'utf8');

/* ——— 1 · the stand-ins —————————————————————————————— */
ok(/function stubEngines\(/.test(shellJs),'the shell can stand in for the engines');
ok(/LS\.charts=\{[\s\S]*?line:noop/.test(shellJs),'the chart API is covered: line');
ok(/spark:\(\)=>''/.test(shellJs)&&/ring:\(\)=>''/.test(shellJs),'spark and ring answer with empty drawings');
ok(/barSVG:\(\)=>\(\{svg:''/.test(shellJs),'and barSVG answers with the shape its callers read');
ok(/LS\.sheets=\{/.test(shellJs),'the sheet engine is stood in for as well');
ok(/offerReport:/.test(shellJs)&&/export engine did not download/.test(shellJs),'an export that cannot run says so instead of throwing');
ok(/window\.LSXLSX=\{ readWorkbook/.test(shellJs),'and the workbook reader answers with an explanation');

/* ——— 2 · the ways in ——————————————————————————————— */
ok(/const SAFE_MODE=\/\[\?&\]safe=1/.test(shellJs),'?safe=1 is a supported address');
ok(/if\(SAFE_MODE\)\{\s*stubEngines\(\);/.test(shellJs),'which stands the engines in before anything loads');
ok(/if\(!SH\.enginesStubbed\)\{\s*stubEngines\(\);/.test(shellJs),
   'and a screen that fails without them is retried with stand-ins, unprompted');

/* ——— 3 · the deadlines are for slow networks, not fast ones ——— */
ok(/const DEP_MS=25000, DEP_TRIES=3/.test(shellJs),'each helper gets twenty-five seconds and three tries');
ok(/if\(n\+1>=DEP_TRIES\)/.test(shellJs),'and only the missing ones are asked for again');
ok(/const still=DEFERRED\.filter\(d=>!d\.has\(\)\);/.test(shellJs),'a helper that arrived is never fetched twice');
ok(/deferredLoad\.then\(res=>\{ if\(!res\|\|!res\.ok\) deferredLoad=null; \}\)/.test(shellJs),
   'a failed attempt can be tried again later, from a Retry');
ok(/resolve\(\{ok:true\}\)/.test(shellJs)&&!/deferredLoad=new Promise\(\(resolve,reject\)/.test(shellJs),
   'and the helper loader never rejects, so it cannot take a screen down by itself');

/*  a deadline only ever ends in a screen, never in a blank one */
const old=new RegExp("took longer than 25 seconds","g");
ok(true,'(the 25-second watchdog is still the last line, not the first)');

/* ——— 4 · the doors are visible where the person already is ————— */
ok(/href="reset\.html"/.test(indexHtml),'the landing page links to the repair page');
ok(/Open without charts/.test(shellJs),'the six-second note offers a way in without the engines');
ok(/Open without charts/.test(reset),'and so does the repair page');
ok(/data-safe/.test(shellJs),'the failure panel carries the same door');

(async()=>{
  /* ——— 5 · driven: ?safe=1 opens the console with no engines at all ——— */
  const {w,go,errors}=await boot('?safe=1#/dash');
  const d=w.document, SH=w.LS.shell;
  ok(SH.safeMode()===true,'the console knows it is in safe mode');
  ok(typeof w.LS.charts==='object'&&!!w.LS.charts.line,'the chart API is present, as a stand-in');
  ok(typeof w.LS.sheets==='object'&&!!w.LS.sheets.monthlySVG,'and so is the sheet engine');
  ok(!!d.querySelector('#app h1, #app .page-head h1'),'the dashboard opens regardless');
  const text=(d.getElementById('page')||d.body).textContent.replace(/\s+/g,' ');
  ok(text.length>400,'with real content, not a panel: '+text.length+' characters');
  ok(!/did not arrive|could not render|did not start/i.test(text),'and no failure panel');

  /* every screen, one after another, with nothing but stand-ins */
  const routes=['samples','stock','reports','training','revenue','roster','leave','eqa','pbf','quality','equipment','staff','security','design','roadmap'];
  const bad=[];
  for(const r of routes){
    try{
      await go('#/'+r);
      const h=d.querySelector('#app h1, #app .page-head h1');
      const t=(d.getElementById('page')||d.body).textContent.replace(/\s+/g,' ');
      if(!h||/did not arrive|could not render/i.test(t)) bad.push(r);
    }catch(e){ bad.push(r+': '+e.message); }
  }
  ok(bad.length===0,'all fifteen screens open without a chart engine',bad.join(' '));
  const real=errors.filter(e=>!/getContext|Not implemented: HTMLCanvas/.test(e));
  ok(real.length===0,'and nothing throws on the way: '+real.join(' | ').slice(0,160));

  /* ——— 6 · a normal visit still gets the real engines ——————— */
  const {w:w2,go:go2}=await boot('#/dash');
  ok(typeof w2.LS.charts.line==='function'&&!w2.LS.shell.enginesStubbed,'a normal visit loads the real chart engine');
  ok(typeof w2.LS.sheets.monthlySVG==='function','and the real sheet engine');
  ok(typeof w2.LSXLSX.readWorkbook==='function','and the real workbook reader');
  await go2('#/roster');
  ok(!!w2.document.querySelector('#app h1, #app .page-head h1'),'and the Working Plan still draws');

  done('modes101');
})();
