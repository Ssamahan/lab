const {boot}=require('./env');
(async()=>{const {w}=await boot('#/roster');
const S=w.LS.store;
['2027-03','2027-04','2026-12','2027-01'].forEach(mk=>{
  const p=S.buildPlan(mk);
  p.staff.forEach(r=>{ let run=0,best=0,at='';
    r.codes.forEach((c,i)=>{ if(c==='N'||c==='DN'){ run++; if(run>best){best=run;at=p.dates[i];} } else run=0; });
    if(best>=3) console.log(mk, r.name, 'best', best, 'ending', at);
  });
});
process.exit(0);})();
