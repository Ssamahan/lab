'use strict';
const assert=require('node:assert/strict'),{boot}=require('./env');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const {w,dom}=await boot('#/roster');
 try{
  w.LS.sync.stopLive();const S=w.LS.store,doc=w.document,db=S.db();
  const dates=['2026-12-21','2026-12-22','2026-12-26','2026-12-28'];
  db.workingPlans['2026-12']={primary:{dates,staff:[{name:'Kelvin',codes:['D','D','D','D']},{name:'A',codes:['D','D','','']},{name:'B',codes:['D','D','','']},{name:'C',codes:['D','','','']},{name:'C',codes:['D','','','']}],meta:{}},versions:[]};
  db.workingPlans['2026-11']={primary:{dates:['2026-11-02'],staff:[{name:'A',codes:['D']},{name:'B',codes:['D']}],meta:{}},versions:[]};
  const before=JSON.stringify(db.workingPlans),pending=S.pendingChanges();
  let guard=0;while(!doc.querySelector('[data-nav="0"]').textContent.includes('Dec')&&guard++<15){doc.querySelector('[data-nav="1"]').click();await wait(10);}
  const review=doc.querySelector('[data-coverage-review]');assert(review);assert.match(review.textContent,/1 day under-covered/);assert.match(review.textContent,/22 Dec 2026 — 3 of 4/);assert.doesNotMatch(review.textContent,/21 Dec 2026 —/);assert.doesNotMatch(review.textContent,/26 Dec 2026 —/);assert.doesNotMatch(review.textContent,/28 Dec 2026 —/);assert.match(review.textContent,/Night coverage is checked separately: 4 dates/);assert.match(review.textContent,/November 2026: 1 ordinary weekdays · average 2.0 day staff · 1 below 4 · 1 with exactly 2/);assert.equal(JSON.stringify(db.workingPlans),before);assert.equal(S.pendingChanges(),pending);
  console.log('roster-coverage202: day thresholds, dates, holidays, unique staff, separate nights, comparison and no writes passed');
 }finally{dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
