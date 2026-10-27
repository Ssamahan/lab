const {boot}=require('./env');
(async()=>{const {w}=await boot('#/roster');
const S=w.LS.store, db=S.db();
const p=S.buildPlan('2026-11');
const idx=n=>p.staff.find(x=>x.name===n).codes;
p.dates.forEach((iso,i)=>{
  const hol=S.holiday(iso);
  if(!hol) return;
  console.log('HOLIDAY',iso,hol.name,'dow',w.LSU.dow(iso));
  p.staff.forEach(r=>{ if(r.codes[i]) console.log('   ',r.name,'=',r.codes[i]); });
});
console.log('\nDec 2026 (12-25,26):');
const d=S.buildPlan('2026-12');
d.dates.forEach((iso,i)=>{ if(!S.holiday(iso))return; console.log(iso, S.holiday(iso).name, d.staff.filter(r=>r.codes[i]).map(r=>r.name.split(' ')[0]+':'+r.codes[i]).join(' | ')); });
process.exit(0);})();
