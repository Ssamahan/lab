const {boot}=require('./env');
(async()=>{const {w}=await boot('#/roster');
const S=w.LS.store,U=w.LSU,db=S.db();
const p=db.workingPlans['2026-11'].primary;
const dates=p.dates;
const night={}, day={};
p.staff.forEach(r=>r.codes.forEach((c,i)=>{
  if(c==='N'||c==='DN') (night[dates[i]]=night[dates[i]]||[]).push(r.name);
  if(c==='D'||c==='DN') (day[dates[i]]=day[dates[i]]||[]).push(r.name);
}));
const multi=Object.keys(night).filter(k=>night[k].length>1);
console.log('dates with >1 on night:',multi.length, multi.slice(0,5).map(k=>k+' '+night[k].join('+')));
const wknd=dates.filter(d=>U.dow(d)>=5);
const bad=[];
p.staff.forEach(r=>wknd.forEach((d,i)=>{ const di=dates.indexOf(d), c=r.codes[di];
  if(c && c!=='DN' && c!=='D' && c!=='N') bad.push(d+' '+r.name+' '+c);
  if(c==='DN' && !/Aurelie/.test(r.name)) bad.push('DN by '+r.name+' on '+d);
}));
console.log('weekend offenders:',bad.length, bad.slice(0,8));
// block lengths
p.staff.forEach(r=>{
  let run=0, starts=[];
  r.codes.forEach((c,i)=>{ if(c==='N'||c==='DN'){ run++; } else { if(run) starts.push(run); run=0; } });
  if(run) starts.push(run);
  console.log(r.name.padEnd(24), 'blocks:', starts.join(','), ' total', r.codes.filter(c=>c==='N'||c==='DN').length);
});
// duplicates
const names=p.staff.map(r=>r.name);
console.log('rows',names.length,'unique',new Set(names).size);
// carry-over check
const oct=db.workingPlans['2026-10'].primary;
const same=[];
oct.dates.forEach((iso,i)=>{ if(!dates.includes(iso)) return;
  const di=dates.indexOf(iso);
  oct.staff.forEach(r=>{const row=p.staff.find(x=>x.name===r.name); if(!row) return;
    if(r.codes[i] && row.codes[di]!==r.codes[i]) same.push(iso+' '+r.name+' oct='+r.codes[i]+' nov='+row.codes[di]);});
});
console.log('carry-over mismatches:',same.length, same.slice(0,5));
console.log('plan range',dates[0],'→',dates[dates.length-1], 'days',dates.length);
process.exit(0);})();
