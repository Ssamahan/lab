/* Regression sweep: routes, deleting orders, module cache-busting, and who may see a name. */
const {boot,ok,done}=require('./env');
const click=(el)=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||180));

(async()=>{
  const {w,go,errors}=await boot('#/samples');
  const doc=w.document, db=()=>w.LS.store.db();

  /* ── deleting duplicated orders ─────────────────────────────────────── */
  click(doc.querySelectorAll('[data-check]')[0]); await tick(60);
  click(doc.querySelectorAll('[data-check]')[1]); await tick(60);
  ok(!!doc.querySelector('[data-bulk-delete]'),'Delete selected is offered to the Admin');
  const n=db().samples.length;
  click(doc.querySelector('[data-bulk-delete]')); await tick(220);
  click(doc.querySelector('.modal [data-yes]')); await tick(240);
  ok(db().samples.length===n-2,'two orders are removed');
  click(doc.querySelector('.toast [data-ta="0"]')); await tick(220);
  ok(db().samples.length===n,'Undo restores them');

  /* ── the manifest tab ───────────────────────────────────────────────── */
  await go('#/samples?tab=manifests');
  ok(doc.querySelectorAll('[data-man-card]').length===db().manifests.length,'every manifest has a card');

  /* ── modules are requested with the app version ─────────────────────── */
  await go('#/equipment');
  const srcs=[...doc.querySelectorAll('script[src*="modules/"]')].map(s=>s.getAttribute('src'));
  ok(srcs.length>0,'modules are loaded on demand');
  ok(srcs.every(s=>/\?v=/.test(s)),'each module URL carries the version, so a stale copy cannot be served',srcs.join(' | '));
  ok(srcs.every(s=>/\?v=6\.\d+\.\d+$/.test(s)),'and the version is a real one',srcs.join(' | '));

  /* ── a Manager may not delete ───────────────────────────────────────── */
  w.eval("LS.auth.user={id:'u2',username:'aurelie',name:'Aurelie',role:'Manager'};");
  await go('#/samples');
  click(doc.querySelectorAll('[data-check]')[0]); await tick(60);
  ok(!doc.querySelector('[data-bulk-delete]'),'a Manager sees no Delete button');
  await go('#/samples?tab=manifests');
  ok(!doc.querySelector('[data-man-del]'),'and no manifest Delete');

  /* ── the visitor ────────────────────────────────────────────────────── */
  w.eval("LS.auth.user=Object.assign({},LS.auth.VISITOR,{visitor:true});");
  await go('#/samples');
  click(doc.querySelector('[data-new]')); await tick(400);
  ok(!doc.querySelector('.modal'),'a visitor cannot open the register wizard');
  ok([...doc.querySelectorAll('.toast')].some(t=>/read-only/i.test(t.textContent)),'and is told why');
  ok(/Confidential/.test(doc.querySelector('#smpView').textContent),'the register reads Confidential');

  /* ── routes ─────────────────────────────────────────────────────────── */
  w.eval("LS.auth.user={id:'u1',username:'kelvin',name:'Kelvin SAMAHANI',role:'Admin'};");
  const R=['dash','samples','stock','training','revenue','roster','leave','eqa','pbf','quality','equipment','staff','security','design','roadmap'];
  for(const r of R){ await go('#/'+r); ok(!!doc.querySelector('#app h1, #app .page-head h1'),r+' renders'); }
  ok(errors.filter(e=>!/Not implemented/.test(e)).length===0,'no console errors',errors.join(' | '));

  done('smoke');
})().catch(e=>{console.error(e);process.exit(1);});
