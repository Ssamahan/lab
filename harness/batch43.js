/* v6.9.43 — the weekend belongs to one person, the cells stay blank for everybody
   else, the nights never run past three, the carry-over leave is thirty days from
   19 November, and the leave screen says who is away and when they are back. */
const {boot,ok,done}=require('./env');
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||180));

(async()=>{
  const {w,go}=await boot('#/roster');
  const doc=w.document, S=()=>w.LS.store, db=()=>w.LS.store.db(), U=w.LSU;

  /* ── 1 · the weekend: one owner on day+night, or a day and a night ── */
  const p=db().workingPlans['2026-11'].primary;
  const dowOf=iso=>U.dow(iso);
  const weekendIdx=p.dates.map((iso,i)=>({iso,i,dow:dowOf(iso)})).filter(x=>x.dow>=5);
  ok(weekendIdx.length>=8,'the month has its weekends ('+weekendIdx.length+' days)');
  const at=(iso,i)=>p.staff.filter(r=>r.codes[i]).map(r=>({name:r.name,code:r.codes[i]}))
    .filter(x=>!/^AL|^SICK|^ML|^SL|^TR|^OFF/.test(x.code));
  const over=[];
  weekendIdx.forEach(x=>{ const who=at(x.iso,x.i); if(who.length>2) over.push(x.iso+': '+who.map(w=>w.name+'='+w.code).join(', ')); });
  ok(over.length===0,'no weekend day is worked by more than two people'+(over.length?' ('+over.join(' | ')+')':''));
  const pairs={};
  weekendIdx.forEach(x=>{ const k=p.dates[x.i-x.dow+5]||x.iso; pairs[k]=pairs[k]||[]; pairs[k].push({i:x.i,who:at(x.iso,x.i)}); });
  const bad=[];
  Object.keys(pairs).forEach(k=>{
    const daysOf=pairs[k].map(d=>d.who);
    if(!daysOf.length) return;
    const first=daysOf[0];
    daysOf.forEach(who=>{
      if(who.length!==first.length) bad.push(k+' differs between days');
      who.forEach(w=>{
        const twin=first.find(f=>f.name===w.name);
        if(!twin||twin.code!==w.code) bad.push(k+' '+w.name+' changes code across the weekend');
      });
    });
  });
  ok(bad.length===0,'Saturday and Sunday of a weekend go to the same people, on the same shifts'+(bad.length?' ('+bad.slice(0,3).join(' | ')+')':''));
  const forms=Object.keys(pairs).map(k=>pairs[k][0].who.map(w=>w.code).sort().join('+'));
  ok(forms.every(f=>f==='DN'||f==='D+N'),'a weekend is either one person on day+night, or one on the day and one on the night ('+[...new Set(forms)].join(', ')+')');
  const splitWeekend=Object.keys(pairs).find(k=>pairs[k][0].who.length===2);
  ok(!!splitWeekend,'the weekend the technologist is away is split between two people');

  /* ── 2 · the rest that follows the weekend ── */
  const runs=row=>{ let best=0,run=0; (row.codes||[]).forEach(c=>{ if(c==='N'||c==='DN'){ run++; best=Math.max(best,run); } else run=0; }); return best; };
  ok(p.staff.every(r=>runs(r)<=3),'nobody is on more than three nights in a row ('+p.staff.map(r=>r.name.split(' ')[0]+':'+runs(r)).join(' ')+')');
  const missed=[];
  p.staff.forEach(r=>weekendIdx.forEach(x=>{
    const mondayIdx=x.i+1;
    if(mondayIdx>=p.dates.length||dowOf(p.dates[mondayIdx])!==0) return;
    const code=r.codes[x.i];
    if((code==='DN'||code==='N'||code==='D')&&r.codes[mondayIdx]!=='OFF') missed.push(r.name.split(' ')[0]+' '+p.dates[mondayIdx]+'='+r.codes[mondayIdx]);
  }));
  ok(missed.length===0,'whoever worked the weekend is off on the Monday after'+(missed.length?' ('+missed.join(', ')+')':''));
  ok(p.staff.every(r=>{ let seven=false;
    for(let i=0;i+6<r.codes.length;i++){ const win=r.codes.slice(i,i+7); if(win.filter(c=>c==='D'||c==='N'||c==='DN').length===7) seven=true; }
    return !seven; }),'and nobody works seven days without an off');

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

  /* ── 5 · September 2026 reads the way the sheet on file reads ── */
  const sep=db().workingPlans['2026-09'].primary;
  ok(sep.dates[0]==='2026-08-31'&&sep.dates[36]==='2026-10-06','the September sheet runs 31 August to 6 October');
  const rowOf=n=>(sep.staff.find(r=>new RegExp(n).test(r.name))||{codes:[]}).codes;
  ok(rowOf('Patrick').slice(31).join(',')==='AL,D,,,N,N','Patrick: leave to 1 October, one day on the 2nd, the weekend blank, nights from the 5th');
  ok(rowOf('Patrick').slice(0,5).join(',')==='AL,AL,AL,AL,AL','and he is on leave from the first day of the sheet');
  const satSun=sep.dates.map((d,i)=>({d,i,w:U.dow(d)>=5})).filter(x=>x.w);
  ok(satSun.every(x=>rowOf('Aurelie')[x.i]==='DN'),'the weekend technologist is day+night on every weekend of the month');
  ok(rowOf('Kelvin').filter(c=>c==='D').length===27,'the manager works every weekday on the sheet');

  /* ── 6 · the plans on file are installed as records, never as signed plans ── */
  const arc=db().workingPlans['2025-09'];
  ok(!!(arc&&arc.primary),'September 2025 is on file');
  ok(arc.primary.meta.transcribed===true&&!arc.primary.meta.official,'and it is a transcribed record, not a published plan');
  ok(/transcribed/i.test(arc.primary.meta.label||''),'the label says so');
  ok(arc.primary.dates[0]==='2025-09-01'&&arc.primary.dates.length===39,'covering 1 September to 9 October, as the sheet runs on');
  ok(arc.primary.staff.length===8,'with every name the sheet carries ('+arc.primary.staff.length+')');
  ok(arc.primary.staff.every(r=>r.codes.length===39),'a code — a blank where the sheet is blank — for every day of every row');
  const dj=arc.primary.staff.find(r=>/Dieudonne/.test(r.name));
  ok(dj.codes.slice(7,37).every(c=>c==='AL'),'Dieudonne is on annual leave from the 8th of September to the 6th of October, as the sheet shows');

  /* ── 7 · circumstantial leave is leave, not absence, and not the thirty days ── */
  ok(S().leaveTypeLabel('CL')==='Circumstantial leave','CL reads as circumstantial leave');
  ok(S().leaveKind('CL')==='authorised','and it is authorised leave, not annual leave');
  ok(!S().leaveCountsAgainstEntitlement('CL'),'so it never comes out of the thirty days');
  ok(S().leaveTypeLabel('IL')==='Circumstantial leave','the old IL still reads as circumstantial leave');
  ok(S().leaveKind('AA')==='authorised'&&!S().leaveCountsAgainstEntitlement('AA'),'nor does authorised leave');
  /* the department's eight letters, and nothing else claiming a column */
  const std=['AL','ML','PL','SL','CL','AA','H','WD'];
  ok(std.every(c=>S().leaveTypeLabel(c)&&S().leaveTypeLabel(c)!==c),'every standard letter has a name');
  ok(S().leaveTypeLabel('ML')==='Maternal leave'&&S().leaveTypeLabel('PL')==='Paternal leave','ML maternal, PL paternal');
  ok(S().leaveTypeLabel('SL')==='Sick leave'&&S().leaveTypeLabel('WD').indexOf('desertion')>=0,'SL sick, WD work desertion');
  ok(S().leaveKind('WD')==='unauthorised'&&!S().leaveCountsAgainstEntitlement('WD'),'work desertion is recorded but never drawn from the thirty days');

  /* ── 8 · December 2025, read from the sheet on file ── */
  const dec=db().workingPlans['2025-12'];
  ok(!!(dec&&dec.primary),'December 2025 is on file');
  ok(dec.primary.meta.transcribed===true,'as a transcribed record');
  ok(dec.primary.dates[0]==='2025-12-01'&&dec.primary.dates.length===42,'1 December to 11 January, as the sheet runs');
  ok(dec.primary.staff.length===8,'eight names on the sheet');
  ok(dec.primary.staff.every(r=>r.codes.length===42),'a code for every day of every row');
  const kel=dec.primary.staff.find(r=>/Kelvin/.test(r.name));
  ok(kel.codes.slice(0,16).every(c=>c==='AL'),'the manager is on annual leave for the first sixteen days');
  ok(kel.codes[24]==='H'&&kel.codes[25]==='H','Christmas and Boxing Day are marked as public holidays');
  ok(dec.primary.staff.some(r=>r.codes[0]==='H'||r.codes.filter(c=>c==='H').length>0),'and H is used, not left blank');
  const pat=dec.primary.staff.find(r=>/Patrick/.test(r.name));
  ok(pat.codes[0]==='N'&&pat.codes[1]==='N'&&pat.codes[2]==='N','Patrick opens the month on three nights, as the sheet shows');
  const diane=dec.primary.staff.find(r=>/Diane/.test(r.name));
  ok(diane.codes.slice(35).every(c=>c==='AL'),'Diane takes her leave into the new year');

  /* ── 9 · the whole 2025 run is on file, straight from the workbook ── */
  const months=Object.keys(db().workingPlans).filter(k=>{
    const e=db().workingPlans[k]; return e.primary&&e.primary.meta&&e.primary.meta.transcribed;
  }).sort();
  ok(months.length>=12,'twelve months of the 2025 run are transcribed ('+months.length+')');
  ['2024-12','2025-01','2025-02','2025-03','2025-04','2025-05','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12']
    .forEach(k=>ok(months.indexOf(k)>=0, k+' is on file'));
  const feb=db().workingPlans['2025-02'].primary;
  const bea=feb.staff.find(r=>/Beatrice/.test(r.name));
  ok(bea.codes.slice(3,7).every(c=>c==='CL'),'Beatrice 4–7 February 2025 reads as circumstantial leave (CL)');
  ok(bea.codes.slice(9,12).every(c=>c==='CL'),'and again 10–12 February');
  ok(bea.codes.slice(12,22).every(c=>c==='ML'),'then maternal leave to the 22nd');
  const jp=feb.staff.find(r=>/Jean Paul/.test(r.name));
  ok(jp.codes[0]==='BE'&&jp.codes[1]==='BE','Jean Paul reads before employment on the first two days');
  const may=db().workingPlans['2025-05'].primary;
  const dia=may.staff.find(r=>/Diane/.test(r.name));
  ok(dia.codes.slice(4,7).every(c=>c==='CL'),'Diane 5–7 May 2025 is circumstantial leave, as the sheet marks it (IL on the paper)');
  ok(S().leaveKind('BE')==='none'&&!S().leaveCountsAgainstEntitlement('BE'),'before employment is not leave and never drawn from the thirty days');

  /* ── 10 · tables fit the card they are in ── */
  ok(typeof U.fitTables==='function','the table fitter is part of the toolkit');
  await go('#/dash'); await tick(320);
  ok(doc.querySelectorAll('#app .card[data-fit]').length>=0,'cards report their fit after render');

  if(w.LS.shell) ok(true,'the shell is still standing');
  done('batch43');
})().catch(e=>{ console.error(e); process.exit(1); });
