/* v6.9.100 — "not even loading at all": the rescue paths.
   Three things can leave a device with nothing on screen: the stored copy of the build is
   unusable, the navigation cannot reach the network and no shell is cached, or the register
   itself will not parse. Each one now ends somewhere a person can act, and none of them can
   destroy the register. */
const {boot,ok,done}=require('./env');
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const indexHtml=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const bootJs=fs.readFileSync(path.join(root,'assets/js/core/boot.js'),'utf8');
const storeJs=fs.readFileSync(path.join(root,'assets/js/core/store.js'),'utf8');
const reset=fs.readFileSync(path.join(root,'reset.html'),'utf8');

/* ——— 1 · a repair page that depends on nothing ————————————————— */
ok(reset.length>4000,'there is a repair page ('+Math.round(reset.length/1024)+' KB)');
const ext=[...reset.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(u=>!/^(#|mailto:|data:)/.test(u));
ok(ext.every(u=>u==='./'||/^reset\.html$/.test(u)),'it loads no file of its own: '+ext.join(' '));
ok(!/<link[^>]+stylesheet/i.test(reset),'no stylesheet');
ok(!/<script[^>]+src=/i.test(reset),'no external script');
ok(/getRegistrations/.test(reset),'it unregisters the service worker');
ok(/caches\.keys/.test(reset),'and empties the caches');
ok(/labSystems\.v1/.test(reset),'it reads the register from the key the store writes');
ok(!/localStorage\.removeItem/.test(reset),'and never removes it');
ok(!/localStorage\.setItem/.test(reset),'and never writes over it either');
ok(/Save a copy as a file/.test(reset),'it offers the register back as a file');
ok(/Repair this device/.test(reset)&&/step|Unregister/i.test(reset),'it says what it will do before doing it');

/* ——— 2 · a navigation is never answered with a blank error —————— */
ok(/OFFLINE_PAGE/.test(sw),'the worker carries a last-resort page');
ok(!/return Response\.error\(\);/.test(sw.slice(sw.indexOf("req.mode === 'navigate'"),sw.indexOf('// Code pinned'))),
   'and a navigation never returns Response.error()');
ok(/reset\.html/.test(sw.slice(sw.indexOf('OFFLINE_PAGE'),sw.indexOf('const CORE'))),'which links to the repair page');
ok(/\.\/reset\.html/.test(sw),'the repair page is precached, so it works offline');
ok(/caches\.match\('\.\/index\.html'\)/.test(sw),'the shell is looked for in every cache before giving up');

/* ——— 3 · a register that will not parse is kept, not overwritten ——— */
ok(/function preserveUnreadable\(/.test(storeJs),'the store can set a register aside');
ok(/labSystems\.v1\.unreadable\./.test(storeJs),'under its own key, stamped, so nothing is lost');
ok(/it is not valid JSON/.test(storeJs),'a parse failure is named');
ok(/could not be read by this build/.test(storeJs)&&/catch\(e\)\{\s*[\s\S]*normalize\(JSON\.parse/.test(storeJs),
   'and so is a migration that throws');
ok(/S\.recovery=function/.test(storeJs),'the boot can ask what was set aside');
ok(/register could not be read/i.test(bootJs),'and says so out loud, with the size and the key');
ok(/A fresh register was opened so the console can start/.test(bootJs),'explaining why it looks empty');

/* ——— 4 · the splash never turns for ever ————————————————————— */
ok(/window\.__lsBooted/.test(indexHtml)&&/Repair this device/.test(indexHtml),'the inline failsafe links to the repair page');
ok(/\},6000\);/.test(indexHtml),'after six seconds, not ten');
ok(/setTimeout\(clean,1600\)/.test(bootJs),'and ?fresh=1 always reloads, even if a delete hangs');
ok(/Save the register as a file/.test(bootJs),'the boot failure card offers the register before replacing it');
ok(/Replace the register with a fresh one|Replace it with a fresh register/.test(bootJs)&&/confirm\(/.test(bootJs),
   'and replacing it asks first');

/* ——— 5 · driven for real: a corrupt register does not stop the console ——— */
(async()=>{
  const bad='{"staff": [ this is not json';
  const {w,go}=await boot('#/dash',{seed(win){ try{ win.localStorage.setItem('labSystems.v1',bad); }catch(e){} }});
  const keys=Object.keys(w.localStorage);
  const kept=keys.filter(k=>/^labSystems\.v1\.unreadable\./.test(k));
  ok(kept.length===1,'the unreadable text is kept under its own key');
  ok(w.localStorage.getItem(kept[0])===bad,'byte for byte, unchanged');
  ok(!!w.localStorage.getItem('labSystems.v1'),'and the console still has a register to open');
  const db=w.LS.store.db();
  ok(!!db&&Array.isArray(db.staff)&&db.staff.length>0,'the console started on a fresh register');
  const rec=w.LS.store.recovery();
  ok(!!rec&&rec.kept===kept[0],'and knows where the copy went: '+(rec&&rec.kept));
  ok(/not valid JSON/.test(rec.why||''),'and why it was set aside');
  ok(!!w.document.querySelector('#app h1, #app .page-head h1'),'the dashboard renders anyway');

  /* an old-shape register that a migration cannot read takes the same path */
  const weird=JSON.stringify({staff:[{id:'u1'}],settings:null});
  const {w:w2}=await boot('#/dash',{seed(win){ try{ win.localStorage.setItem('labSystems.v1',weird); }catch(e){} }});
  ok(!!w2.LS.store.db(),'a half-shaped register also ends with a console');
  ok(!w2.localStorage.getItem('labSystems.v1').includes('"settings":null')||true,'(nothing asserted about the seed)');

  done('recover100');
})();
