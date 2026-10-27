const {boot}=require('./env');
(async()=>{const {w}=await boot('#/pbf');
const S=w.LS.store, db=S.db();
console.log('healthCenters', db.catalog.healthCenters.map(h=>h.name));
console.log('pbf rows', (db.pbf||[]).map(r=>r.name));
console.log('visits', (db.pbfVisits||[]).map(r=>r.hcName));
console.log('schedule uniq', Array.from(new Set((db.pbfSchedule||[]).map(r=>r.hcName))));
process.exit(0);})();
