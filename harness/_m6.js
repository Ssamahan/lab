const {boot}=require('./env');
(async()=>{const {w}=await boot('#/roster');
const S=w.LS.store, db=S.db();
for(const k of ['2026-09','2026-10','2026-11']){
  const p=db.workingPlans[k]&&db.workingPlans[k].primary; if(!p){console.log(k,'none');continue;}
  console.log('\n===',k,p.dates[0],'→',p.dates[p.dates.length-1],'| meta',JSON.stringify(p.meta&&{o:p.meta.official,g:p.meta.generated,t:p.meta.transcribed,label:p.meta.label}));
  p.staff.forEach(r=>console.log('  '+r.name.padEnd(24), r.codes.map(c=>c||'.').join(' ')));
}
console.log('\nleaves Nov 2026:');
(db.leaves||[]).filter(l=>l.from<='2026-12-10'&&l.to>='2026-10-25').forEach(l=>console.log(' ',l.staffId,l.type,l.from,l.to,l.status));
console.log('\nstaff:');
db.staff.forEach(s=>console.log(' ',s.id,s.name,s.status,s.pattern,'wkOnly='+!!s.weekendOnly,'maxN='+s.maxNights,'maxConsec='+s.maxConsecN,'pref='+s.nightPref));
process.exit(0);})();
