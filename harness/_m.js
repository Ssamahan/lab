const {boot}=require('./env');
(async()=>{const {w}=await boot('#/roster');
const S=w.LS.store;
const keys=Object.keys(S.db().workingPlans).filter(k=>S.db().workingPlans[k].primary.meta.transcribed).sort();
console.log('transcribed months:',keys.length, keys.join(' '));
const feb=S.db().workingPlans['2025-02'].primary;
feb.staff.forEach(r=>console.log(r.name.padEnd(24), r.codes.map(c=>c||'.').join(' ')));
process.exit(0);})();
