'use strict';
const assert=require('node:assert/strict'),{boot}=require('./env');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const {w,dom}=await boot('#/roster');
 try{
  w.LS.sync.stopLive(); const S=w.LS.store,SH=w.LS.sheets,U=w.LSU,doc=w.document,db=S.db();
  const dates=['2026-12-25','2026-12-26','2026-12-27','2026-12-28','2026-12-29'];
  db.workingPlans['2026-12']={primary:{dates,staff:[{name:'Test Staff',codes:['D','','N','D','D']}],meta:{period:'December 2026'}},versions:[]};
  db.holidays.push({date:'2026-12-29',name:'Custom holiday'});
  const before=JSON.stringify(db.workingPlans['2026-12']);
  let guard=0;while(!doc.querySelector('[data-nav="0"]').textContent.includes('Dec')&&guard++<15){doc.querySelector('[data-nav="1"]').click();await wait(10);}
  doc.querySelector('[data-view="sheet"]').click();await wait(80);
  const svg=doc.querySelector('#sheetHost svg');assert(svg);
  for(const date of ['2026-12-25','2026-12-26','2026-12-28','2026-12-29']) assert(svg.querySelector('[data-holiday-date="'+date+'"]'),date);
  assert(!svg.querySelector('[data-holiday-date="2026-12-27"]'));
  assert.equal(svg.querySelector('[data-holiday-date="2026-12-28"] rect').getAttribute('fill'),'#F4CED3');assert(svg.outerHTML.includes('#BB5265'));assert(!svg.textContent.includes('Red columns: public holiday'));
  const seen=[];SH.toPNG=async s=>{seen.push(['png',s]);return new w.Blob();};SH.toPDF=async s=>{seen.push(['pdf',s]);return new w.Blob();};U.download=()=>{};
  doc.querySelector('[data-sheet-png]').click();doc.querySelector('[data-sheet-pdf]').click();await wait(30);
  assert.deepEqual(seen.map(x=>x[0]),['png','pdf']);for(const item of seen) assert(item[1].includes('data-holiday-date="2026-12-28"'));
  assert.equal(JSON.stringify(db.workingPlans['2026-12']),before);
  const data={weekStart:'2026-12-28',dates:['2026-12-28','2026-12-29','2027-01-02'],services:[{name:'Test'}],weekend:{'2026-12-28':'Holiday','2027-01-02':'Saturday'},dayDuty:{},displayHolidays:{'2026-12-28':'Boxing Day observed','2026-12-29':'Custom holiday'}};
  const week=SH.weeklySVG(data);const parsed=new w.DOMParser().parseFromString(week,'image/svg+xml');assert(!parsed.querySelector('parsererror'));assert(parsed.querySelector('[data-holiday-date="2026-12-28"]'));assert(parsed.querySelector('[data-holiday-date="2026-12-29"]'));assert(!parsed.querySelector('[data-holiday-date="2027-01-02"]'));assert(week.includes('#FBE5E8'));
  console.log('roster-holiday-export203: monthly preview, PNG/PDF input, local and reference holidays, weekend distinction and weekly SVG passed');
 }finally{dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
