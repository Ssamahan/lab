/* v6.9.98 — the page opens first and the heavy work follows.
   Three things were making a phone wait: the printer, the spreadsheet engine and the
   workbook reader were downloaded and parsed before the public overview could be drawn;
   the service worker pulled the whole bundle down a second time on every release; and it
   re-requested all forty assets on every visit for copies that could not have changed.
   These checks pin the cure, and pin that nothing was lost to it. */
const {boot,ok,done}=require('./env');
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const indexHtml=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const shellJs=fs.readFileSync(path.join(root,'assets/js/core/shell.js'),'utf8');
const bootJs=fs.readFileSync(path.join(root,'assets/js/core/boot.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const V=pkg.version;

/* ——— 1 · the overview does not wait for the printer ——————————————— */
const deferred=['charts','sheets','xlsxread'];
ok(deferred.every(n=>indexHtml.indexOf('core/'+n+'.js')<0),
   'the chart helper, the sheet engine and the workbook reader are not in the page');
ok(/const DEFERRED=\[/.test(shellJs),'the shell knows the list of deferred files');
ok(deferred.every(n=>new RegExp("'assets/js/core/"+n+"\\.js'").test(shellJs)),
   'and names each of them');
ok(/async=false/.test(shellJs),'they load in order, so the sheet engine finds the charts');
ok(/function ensureDeps\(/.test(shellJs)&&/deferredLoad\.then\(res=>/.test(shellJs),
   'they are loaded once, and a failure can be retried');
ok(/return ensureDeps\(\)\s*\n?\s*\.then\(/.test(shellJs),'a module is not fetched until its helpers are');
{
  const raw=deferred.reduce((a,n)=>a+fs.statSync(path.join(root,'assets/js/core/'+n+'.js')).size,0);
  ok(raw>90000,'which keeps '+Math.round(raw/1024)+' KB off the first paint');
}

/* ——— 2 · the service worker downloads the bundle once, not twice —— */
ok(/cache: 'default'/.test(sw),'the shell is cached from the copy the page has already fetched');
ok(!/cache: 'reload' \}/.test(sw),'and nothing is re-downloaded behind its back');
ok(/for \(let i = 0; i < CORE\.length; i \+= 6\)/.test(sw),'the install caches the shell only');
ok(!/const list = CORE\.concat\(MODULES\)/.test(sw),'not the sixteen screens, before the page can be drawn');
ok(/async function warmModules/.test(sw)&&/MODULES\.slice\(i, i \+ 4\)/.test(sw),
   'the screens are warmed afterwards, four at a time');
ok(/setTimeout\(\(\) => \{ warmModules\(\)\.catch/.test(sw),'and only once the page is up');
ok(/\?v=' \+ VERSION\.replace\(\/\^v\/, ''\)/.test(sw),
   'the warm copies are stored under the addresses the page actually asks for');

/* ——— 3 · an asset pinned to a build is never re-fetched ——————————— */
ok(/if \(hit\) return hit;/.test(sw),'a cached asset is answered from the cache');
ok(/const cacheFirst = |async function cacheFirst/.test(sw),'cache-first is still the rule for versioned code');
const cf=sw.slice(sw.indexOf('async function cacheFirst'),sw.indexOf('async function staleWhileRevalidate'));
ok(!/fetch\(request\)\.then/.test(cf),'with no background request for a file that cannot have changed');
ok(/catch \(e\) \{[\s\S]*caches\.match\(request\)/.test(cf),'and the old copy still answers when the network is gone');
ok(/isCurrentVersion\(url\)/.test(sw),'the version in the address is still what decides this');

/* ——— 4 · a slow start says so, with numbers ——————————————————— */
ok(/function startCost\(/.test(bootJs),'the boot measures what the start cost');
ok(/transferSize/.test(bootJs),'including how many bytes came down');
ok(/c\.total<2600/.test(bootJs),'a quick start says nothing');
ok(/showStartCost/.test(bootJs)&&/id='lsCost'/.test(bootJs),'a slow one puts a line in the corner');
ok((bootJs.match(/diag=1/g)||[]).length>=2,'and ?diag=1 always shows it');

/* ——— 5 · driven for real: the overview draws, then the screens work ——— */
(async()=>{
  const {w,go}=await boot('#/dash');
  const d=w.document;
  ok(!!d.querySelector('#landing')||!!d.querySelector('#app h1, #app .page-head h1'),
     'the page draws without the deferred helpers');
  ok(typeof w.LS.shell.ensureDeps==='function','the shell exposes the way to fetch them');
  /* a screen needs all three, and gets them */
  await go('#/dash');
  ok(typeof w.LS.charts==='object','the dashboard has its charts');
  ok(typeof w.LS.sheets==='object','and the sheet engine, for the exports');
  ok(typeof w.LSXLSX==='object','and the workbook reader, for a district return');
  ok(!!d.querySelector('#app h1, #app .page-head h1'),'the dashboard renders');
  /* the sheets actually draw — the deferral must not have broken the print path */
  const S=w.LS.store, U=w.LSU;
  let svg='';
  try{ svg=w.LS.sheets.monthlySVG(S.planForMonth(U.monthKey())); }catch(e){ svg='threw: '+e.message; }
  ok(typeof svg==='string'&&svg.indexOf('<svg')===0,'and the monthly sheet still draws: '+String(svg).slice(0,40));
  /* every other screen still reaches its helpers */
  let bad=[];
  for(const r of ['samples','roster','reports','pbf','quality']){
    try{ await go('#/'+r); if(!d.querySelector('#app h1, #app .page-head h1')) bad.push(r); }
    catch(e){ bad.push(r+':'+e.message); }
  }
  ok(bad.length===0,'six screens open on top of the deferred files',bad.join(' '));
  done('load98');
})();
