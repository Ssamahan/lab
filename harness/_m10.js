const {boot}=require('./env');
(async()=>{const {w}=await boot('#/roster');
const db=w.LS.store.db(), U=w.LSU;
const p=db.workingPlans['2026-11'].primary;
p.staff.forEach(r=>{
  const marks=r.codes.map((c,i)=>c==='N'||c==='DN'?p.dates[i]:null).filter(Boolean);
  console.log(r.name.padEnd(24), marks.join(' '));
});
process.exit(0);})();
