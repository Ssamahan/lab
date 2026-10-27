const {boot}=require('./env');
(async()=>{const {w}=await boot('#/roster');
const S=w.LS.store, db=S.db();
// generate a fresh month through the public API
S.commit(d=>{ d.workingPlans['2027-01']={versions:[],primary:S.buildPlan('2027-01')}; },{action:'t'});
S.commit(d=>{ d.workingPlans['2027-02']={versions:[],primary:S.buildPlan('2027-02')}; },{action:'t'});
const f=db.workingPlans['2027-02'].primary;
console.log('Feb 2027', f.dates[0],'→',f.dates[f.dates.length-1], 'rows',f.staff.length, 'carried',f.meta.carriedFrom);
console.log('Jan tail →', db.workingPlans['2027-01'].primary.dates.slice(-1)[0]);
f.staff.forEach(r=>console.log(r.name.padEnd(24), r.codes.map(c=>c||'.').join(' ')));
const svg=w.LS.sheets.monthlySVG(f);
console.log('svg length',svg.length,'NaN?',/NaN/.test(svg));
const nov=db.workingPlans['2026-11'].primary;
const svg2=w.LS.sheets.monthlySVG(nov);
console.log('nov svg',svg2.length,'NaN?',/NaN/.test(svg2));
process.exit(0);})();
