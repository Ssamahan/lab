const {boot}=require('./env');
(async()=>{const {w}=await boot('#/roster');
const S=w.LS.store, db=S.db();
S.commit(d=>{ d.leaves=d.leaves||[]; d.leaves.push({id:'t-aur',staffId:'s4',type:'AL',from:'2027-05-08',to:'2027-05-09',status:'Approved'}); },{action:'t'});
const may=S.buildPlan('2027-05');
const from=may.dates.indexOf('2027-05-03');
may.staff.forEach(r=>console.log(r.name.padEnd(24), r.codes.slice(from, from+14).map((c,i)=>may.dates[from+i].slice(5)+':'+(c||'.')).join(' ')));
process.exit(0);})();
