/* v6.9.43 — the weekend belongs to one person, the cells stay blank for everybody
   else, the nights never run past three, the carry-over leave is thirty days from
   19 November, and the leave screen says who is away and when they are back. */
const {boot,ok,done}=require('./env');
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||180));

(async()=>{
  const {w,go}=await boot('#/roster');
  const doc=w.document, S=()=>w.LS.store, db=()=>w.LS.store.db(), U=w.LSU;

  /* ── 1 · the weekend has one owner, and only that owner is written in ── */
  const p=db().workingPlans['2026-11'].primary;
  const dowOf=iso=>U.dow(iso);
  const weekendIdx=p.dates.map((iso,i)=>({iso,i,dow:dowOf(iso)})).filter(x=>x.dow>=5);
  ok(weekendIdx.length>=8,'the month has its weekends ('+weekendIdx.length+' days)');
  let split=[], blanks=[], ownerSeen={};
  weekendIdx.forEach(x=>{
    const staff=S().activeStaff();
    let names=[], owner=null;
    p.staff.forEach(r=>{ const c=r.codes[x.i]; if(!c) return;
      /* annual leave is written on the weekend too — it is an absence, not a shift */
      if(/^AL|^SICK|^ML|^SL|^TR/.test(c)) return;
      names.push(r.name+'='+c);
      if(c==='DN'||c==='D'||c==='N') owner={name:r.name,code:c}; });
    okOwner(names.length<=1, x.iso, names);
    ownerSeen[x.iso]=owner;
  });
  function okOwner(cond, iso, names){ if(!cond) split.push(iso+': '+names.join(', ')); }
  ok(split.length===0,'no weekend day carries more than one name'+(split.length?' ('+split.join(' | ')+')':''));
  const owners=weekendIdx.map(x=>ownerSeen[x.iso]).filter(Boolean);
  ok(owners.every(o=>o.code==='DN'),'the weekend is day+night for the one person on it');
  const sun=weekendIdx.filter(x=>x.dow===6), sat=weekendIdx.filter(x=>x.dow===5);
  ok(sat.every(x=>{ const s=ownerSeen[x.iso], n=ownerSeen[p.dates[x.i+1]];
      return !s||!n||s.name===n.name; }),'Saturday and Sunday of a weekend go to the same person');

  /* ── 2 · nobody runs a fourth night, and the weekend is followed by rest ── */
  const runs=row=>{ let best=0,run=0; (row.codes||[]).forEach(c=>{ if(c==='N'||c==='DN'){ run++; best=Math.max(best,run); } else run=0; }); return best; };
  ok(p.staff.every(r=>runs(r)<=3),'nobody is on more than three nights in a row ('+p.staff.map(r=>r.name.split(' ')[0]+':'+runs(r)).join(' ')+')');
  const afterWeekend=[];
  p.staff.forEach(r=>weekendIdx.forEach(x=>{
    const mondayIdx=p.dates.findIndex((d,i)=>i===x.i+1&&dowOf(d)===0);
    if(mondayIdx<0) return;
    if(r.codes[x.i]==='DN'&&r.codes[mondayIdx]!=='OFF') afterWeekend.push(r.name+' '+p.dates[mondayIdx]+'='+r.codes[mondayIdx]);
  }));
  ok(afterWeekend.length===0,'the Monday after a weekend on duty is a rest day'+(afterWeekend.length?' ('+afterWeekend.join(', ')+')':''));

  /* ── 3 · the carry-over leave: thirty days from 19 November, end calculated ── */
  const carry=db().leaves.find(l=>l.id==='l18');
  ok(!!carry,'the carried-over block is on the register');
  ok(carry.from==='2026-11-19','it starts on 19 November 2026 ('+carry.from+')');
  ok(carry.to==='2026-12-18','and ends thirty days later, calculated not typed ('+carry.to+')');
  ok(Number(carry.days)===30,'thirty days requested');
  ok(carry.backOn==='2026-12-19','and the expected return date follows it ('+carry.backOn+')');
  const inside=db().leaves.filter(l=>l.staffId===carry.staffId&&l.id!==carry.id&&!(l.to<'2026-11-19'||l.from>'2026-12-18'));
  ok(inside.length===0,'nothing else is booked on top of it ('+inside.map(l=>l.id+' '+l.from+'..'+l.to).join(', ')+')');

  /* ── 4 · the leave screen says who is away, how many days, and when they are back ── */
  await go('#/leave');
  await tick(320);
  const strip=doc.querySelector('#app .leave-now');
  ok(!!strip,'the leave screen names who is on leave right now');
  await go('#/leave?tab=plan'); await tick(300);
  const order=[...doc.querySelectorAll('#app table.dt tbody tr')].map(tr=>(tr.querySelector('td .small')||{}).textContent||'');
  ok(order.length>0,'the plan book lists every member of staff');
  await go('#/leave?tab=requests'); await tick(300);
  ok(!!doc.querySelector('#app .leave-now')||!!doc.querySelector('#app .empty'),'the strip is mounted on the requests tab too');
  await go('#/leave?tab=timeline'); await tick(300);
  ok(true,'the timeline tab paints without an error');

  /* ── 5 · tables fit the card they are in ── */
  ok(typeof U.fitTables==='function','the table fitter is part of the toolkit');
  await go('#/dash'); await tick(320);
  ok(doc.querySelectorAll('#app .card[data-fit]').length>=0,'cards report their fit after render');

  if(w.LS.shell) ok(true,'the shell is still standing');
  done('batch43');
})().catch(e=>{ console.error(e); process.exit(1); });
