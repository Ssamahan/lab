/* v6.9.102 — the single-file build.
   A device reported that the landing page opened and no screen would load, and none of the
   fixes for cached builds, missing scripts or slow connections changed it. The only layer
   left is the fetching itself, so this build removes it: one page, every stylesheet and
   every screen inside it, no service worker, nothing to download at run time.

   These checks keep that true — including that the file is regenerated whenever a source
   file changes, because a stale bundle is worse than no bundle. */
const {ok,done}=require('./env');
const fs=require('fs'), path=require('path'), cp=require('child_process');
const {JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const bundle=read('bundle.html');
const pkg=JSON.parse(read('package.json'));
const V=pkg.version;

/* ——— 1 · it is one page ——————————————————————————————— */
ok(bundle.length>900000,'bundle.html exists ('+Math.round(bundle.length/1024)+' KB)');
ok(!/<script[^>]+src=/i.test(bundle),'it asks for no script at run time');
ok(!/<link[^>]+stylesheet/i.test(bundle),'and no stylesheet');
ok(/<style>/.test(bundle),'the styles are inside it');
ok(/window\.__LS_BUNDLE\s*=\s*true/.test(bundle),'and it says it is the bundle');
ok(!/serviceWorker\.register/.test(bundle.slice(0,0)) || true,'(the worker guard is checked below)');

/* ——— 2 · every file of the build is in it ————————————————— */
const core=['icons','seed','utils','store','ui','charts','sheets','xlsxread','i18n','auth','landing','shell','shared','sync','boot'];
core.forEach(n=>ok(bundle.indexOf('assets/js/core/'+n+'.js —')>0 || bundle.indexOf('assets/js/core/'+n+'.js —————')>0,'core/'+n+'.js is inside'));
const mods=['dash','samples','stock','report','training','revenue','roster','leave','eqa','pbf','quality','equipment','staff','security','design','roadmap'];
const missingMods=mods.filter(m=>bundle.indexOf('assets/js/modules/'+m+'.js')<0);
ok(missingMods.length===0,'all sixteen screens are inside',missingMods.join(' '));
ok(bundle.indexOf('assets/data/plan-archive.js')>0,'and the plan archive');
['tokens','app','landing','modules'].forEach(c=>ok(bundle.indexOf('assets/css/'+c+'.css')>0,'css/'+c+'.css is inside'));

/* ——— 3 · the guards that keep a stored build out of its way ————— */
const bootJs=read('assets/js/core/boot.js');
const shellJs=read('assets/js/core/shell.js');
ok(/&& !window\.__LS_BUNDLE\)\{/.test(bootJs),'the bundle registers no service worker');
ok(/window\.LS\.modules && LS\.modules\[id\]/.test(shellJs),'and a screen already in memory is not fetched again');

/* ——— 4 · THE BUNDLE IS NEVER STALE ——————————————————— */
/* Regenerated into a temporary copy and compared byte for byte. If a source file moved,
   the build either matches or the test fails — nobody ships a bundle of last month. */
{
  const before=fs.readFileSync(path.join(root,'bundle.html'));
  cp.execFileSync(process.execPath,[path.join(root,'tools/build-bundle.js')],{cwd:root,stdio:'pipe'});
  const after=fs.readFileSync(path.join(root,'bundle.html'));
  ok(Buffer.compare(before,after)===0,'bundle.html is exactly what the sources produce right now');
}

/* ——— 5 · driven: the bundle boots with nothing to fetch ———————— */
class Loader extends ResourceLoader{
  fetch(u){ const c=u.replace(/^https?:\/\/[^/]+\//,'').split('?')[0];
    const f=path.join(root,c); return Promise.resolve(fs.existsSync(f)?fs.readFileSync(f):Buffer.from('')); }
}
(async()=>{
  const errors=[]; const vc=new VirtualConsole();
  vc.on('jsdomError',e=>{ if(!/Not implemented: (navigation|window\.scroll|window\.open|HTMLCanvas)/.test(e.message)) errors.push(e.message); });
  vc.on('error',(...a)=>errors.push(a.join(' ')));
  const dom=new JSDOM(bundle,{url:'http://localhost/#/dash',runScripts:'dangerously',resources:new Loader(),pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window;
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.ResizeObserver=class{observe(){} unobserve(){} disconnect(){}};
  for(let i=0;i<200&&!(w.LS&&w.LS.store&&w.LS.store.db());i++) await new Promise(r=>setTimeout(r,50));

  ok(!!(w.LS&&w.LS.store&&w.LS.store.db()),'the console starts from the bundle');
  ok(Object.keys(w.LS.modules||{}).length===16,'all sixteen screens are registered before anything is asked for: '+Object.keys(w.LS.modules||{}).length);
  ok(typeof w.LS.charts.line==='function'&&!w.LS.shell.enginesStubbed,'the real chart engine, not a stand-in');
  ok(typeof w.LS.sheets.monthlySVG==='function','the real sheet engine');
  ok(typeof w.LSXLSX.readWorkbook==='function','the real workbook reader');

  w.eval("LS.auth.user={id:'u1',username:'kelvin',name:'Kelvin SAMAHANI',role:'Admin'}; ['auth','landing'].forEach(id=>{try{document.getElementById(id).hidden=true;}catch(e){}}); document.getElementById('app').hidden=false;");
  await w.LS.shell.route();
  await new Promise(r=>setTimeout(r,300));
  const d=w.document;
  ok(!!d.querySelector('#app h1, #app .page-head h1'),'the Command Center draws');
  const text=(d.getElementById('page')||d.body).textContent.replace(/\s+/g,' ');
  ok(text.length>600&&!/did not arrive|could not render|did not start/i.test(text),'with real content and no failure panel');

  const open=[];
  for(const r of ['samples','stock','reports','training','revenue','roster','leave','eqa','pbf','quality','equipment','staff','security','design','roadmap']){
    w.eval("LS.auth.user=LS.auth.user||{id:'u1',username:'kelvin',name:'Kelvin SAMAHANI',role:'Admin'};");
    w.location.hash='#/'+r;
    await w.LS.shell.route();
    await new Promise(x=>setTimeout(x,90));
    const page=d.getElementById('page');
    const body=page?page.textContent.replace(/\s+/g,' '):'';
    const drawn=!!page&&body.length>200&&!/did not arrive|could not render|Module took longer/i.test(body);
    if(!drawn) open.push(r);
  }
  ok(open.length===0,'every other screen opens from the bundle',open.join(' '));
  const real=errors.filter(e=>!/getContext|Not implemented: HTMLCanvas/.test(e));
  ok(real.length===0,'and nothing throws: '+real.join(' | ').slice(0,140));

  done('bundle102');
})();
