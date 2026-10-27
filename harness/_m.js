const {boot}=require('./env');
(async()=>{const {w}=await boot('#/roster');
const S=w.LS.store, U=w.LSU;
const db=S.db();
const keys=Object.keys(db.workingPlans).sort();
console.log('months:',keys.join(' '));
const p=db.workingPlans['2026-11']&&db.workingPlans['2026-11'].primary;
if(!p){console.log('no Nov plan');process.exit(0);}
console.log('label',p.meta&&p.meta.label);
console.log('dates',p.dates.length,p.dates[0],p.dates[p.dates.length-1]);
const names=p.staff.map(r=>r.name); console.log('rows',names.length, JSON.stringify(names));
p.staff.forEach(r=>console.log(r.name.padEnd(24), r.codes.map(c=>c||'.').join(' ')));
process.exit(0);})();
