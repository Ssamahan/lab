'use strict';
const assert=require('node:assert/strict'),{boot}=require('./env');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const {w,dom}=await boot('#/roster');
 try{
  w.LS.sync.stopLive(); const doc=w.document,S=w.LS.store;
  doc.querySelector('[data-view="grid"]').click();await wait(50);
  const first=doc.querySelector('[data-cell]');assert(first,'shift grid exists');
  const si=+first.dataset.si, di=+first.dataset.di;
  // The visible month is the current selected plan; identify it from its first date.
  const current=w.LSU.monthKey();const p=S.planForMonth(current);assert(p&&p.staff[si]);
  S.leaveCodeFor=()=>null;p.staff[si].codes.splice(di,3,'D','N','D');
  const open=async(i)=>{doc.querySelector('[data-cell="'+si+'-'+i+'"]').click();await wait(30);return doc.querySelector('.modal-scrim:last-child');};
  let modal=await open(di);assert(doc.documentElement.classList.contains('scroll-lock'));
  modal.querySelector('[data-code="D"]').click();assert(!doc.documentElement.classList.contains('scroll-lock'));assert(!doc.body.classList.contains('scroll-lock'));assert.notEqual(doc.body.style.overflow,'hidden');await wait(200);
  modal=await open(di);modal.querySelector('[data-off-run="2"]').click();assert(!modal.querySelector('[data-off-review]').hidden);assert.deepEqual(Array.from(p.staff[si].codes.slice(di,di+3)),['D','N','D']);modal.querySelector('[data-off-confirm]').click();assert.deepEqual(Array.from(S.planForMonth(current).staff[si].codes.slice(di,di+3)),['OFF','OFF','D']);assert(!doc.documentElement.classList.contains('scroll-lock'));await wait(200);
  modal=await open(di);modal.querySelector('[data-off-run="3"]').click();modal.querySelector('[data-off-confirm]').click();assert.deepEqual(Array.from(S.planForMonth(current).staff[si].codes.slice(di,di+3)),['OFF','OFF','OFF']);assert(!doc.body.classList.contains('scroll-lock'));await wait(200);
  let row=S.planForMonth(current).staff[si];modal=await open(di);modal.querySelector('[data-off-run="2"]').click();row.codes[di+1]='N';modal.querySelector('[data-off-confirm]').click();assert.match(modal.querySelector('[data-off-error]').textContent,/plan or leave changed/);assert.equal(row.codes[di+1],'N');w.LS.ui.closeTop();await wait(200);
  row=S.planForMonth(current).staff[si];row.codes[di+1]='AL';modal=await open(di);modal.querySelector('[data-off-run="2"]').click();assert.match(modal.querySelector('[data-off-error]').textContent,/leave/);assert.equal(row.codes[di+1],'AL');w.LS.ui.closeTop();await wait(200);
  const plan=S.planForMonth(current),last=plan.dates.length-1;modal=await open(last);modal.querySelector('[data-off-run="2"]').click();assert.match(modal.querySelector('[data-off-error]').textContent,/end of this monthly plan/);w.LS.ui.closeTop();await wait(200);
  console.log('roster-off-runs200: shift unlock, 2/3-day review, leave and boundary checks passed');
 }finally{dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
