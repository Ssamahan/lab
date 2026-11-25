'use strict';
const assert=require('node:assert/strict'),{boot}=require('./env');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const {w,dom}=await boot('#/roster');
 try{
  w.LS.sync.stopLive();const S=w.LS.store,U=w.LSU,doc=w.document,db=S.db();
  const month='2026-12',dates=U.monthRange(month),codes=dates.map(()=>''),staff='Patrick Test';codes[dates.indexOf('2026-12-25')]='D';codes[dates.indexOf('2026-12-31')]='N';
  db.workingPlans[month]={primary:{dates,staff:[{name:staff,codes}],meta:{draft:true}},versions:[]};
  db.holidays.push({date:'2026-12-25',name:'Christmas local'});const before=JSON.stringify(db.workingPlans[month]),beforeHolidays=JSON.stringify(db.holidays),pending=S.pendingChanges();
  let guard=0;while(!doc.querySelector('[data-nav="0"]').textContent.includes('Dec')&&guard++<15){doc.querySelector('[data-nav="1"]').click();await wait(10);}
  let area=doc.querySelector('[data-holiday-review]');assert(area);assert.match(area.textContent,/Christmas Day/);assert.match(area.textContent,/Boxing Day observed/);assert.match(area.textContent,/Patrick Test \(D\)/);assert.doesNotMatch(area.textContent,/Patrick Test \(N\)/);assert.match(area.textContent,/Christmas local/);assert.equal(JSON.stringify(db.workingPlans[month]),before);assert.equal(JSON.stringify(db.holidays),beforeHolidays);assert.equal(S.pendingChanges(),pending);
  doc.querySelector('[data-nav="1"]').click();await wait(20);area=doc.querySelector('[data-holiday-review]');assert.match(area.textContent,/Day after New Year observed/);assert.match(area.textContent,/No working plan on this browser/);assert.match(area.textContent,/verify official notice/);
  console.log('roster-holidays201: 2026/27 reference, planned shifts, local entries and no-write behavior passed');
 }finally{dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
