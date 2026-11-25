'use strict';
const assert=require('node:assert/strict'),{boot}=require('./env');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const {w,dom}=await boot('#/roster');
 try{
  const S=w.LS.store,UI=w.LS.ui,doc=w.document,db=S.db();w.LS.sync.stopLive();w.LS.auth.guard=()=>true;
  db.leaves=[];db.trainings=[];db.workingPlans={};
  const people=S.activeStaff().slice(0,6);assert.equal(people.length,6);
  const dates=['2026-12-21','2026-12-22','2026-12-23','2026-12-25','2026-12-26'];
  const rows=people.map((person,i)=>({id:person.id,name:person.name,codes:['D','D',i===5?'':'D','D','D']}));
  db.workingPlans['2026-12']={primary:{dates,staff:rows,meta:{}},versions:[]};
  let guard=0;while(!doc.querySelector('[data-nav="0"]').textContent.includes('Dec')&&guard++<15){doc.querySelector('[data-nav="1"]').click();await wait(15);}
  let card=doc.querySelector('[data-second-call]'),buttons=card.querySelectorAll('[data-second-call-review]');assert.equal(buttons.length,2);assert.equal(buttons[0].dataset.date,'2026-12-21');assert.equal(buttons[1].dataset.date,'2026-12-22');assert.notEqual(buttons[0].dataset.secondCallReview,buttons[1].dataset.secondCallReview);
  const before=JSON.stringify(db.workingPlans['2026-12']);UI.confirm=async()=>false;buttons[0].click();await wait(20);assert.equal(JSON.stringify(db.workingPlans['2026-12']),before);
  UI.confirm=async()=>true;buttons[0].click();await wait(30);const p=S.planForMonth('2026-12');const selected=p.staff.find(st=>st.codes[0]==='2C');assert(selected);assert.equal(p.staff.filter(st=>st.codes[0]==='D').length,5);assert.equal(S.shiftState(selected.id,'2026-12-21').kind,'secondcall');assert(!S.isOnDuty(selected.id,'2026-12-21'));assert(doc.querySelector('[data-second-call]').textContent.includes('2C assigned'));
  card=doc.querySelector('[data-second-call]');const next=card.querySelector('[data-date="2026-12-22"]');assert(next);assert.notEqual(p.staff[+next.dataset.secondCallReview].name,selected.name);
  UI.confirm=async()=>{p.staff[+next.dataset.secondCallReview].codes[1]='N';return true;};next.click();await wait(30);assert(!p.staff.some(st=>st.codes[1]==='2C'));assert(p.staff.some(st=>st.codes[1]==='N'));
  const svg=w.LS.sheets.monthlySVG(p);assert(svg.includes('2C — Second call'));assert(svg.includes('>2C</text>'));
  console.log('second-call204: suggestions, rotation, threshold, holiday and weekend exclusion, review, stale protection, standby coverage and export passed');
 }finally{dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
