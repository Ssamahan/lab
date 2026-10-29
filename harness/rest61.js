/* v6.9.61 — the plan pays the bench back for every night, stops a week past its
   month, and reads the annual-leave register by itself:
     · three nights worked are three days at home, counted from the morning after
       the last night;
     · a day owed that lands on a Saturday, a Sunday or a public holiday is NOT
       written on the plan — the sheet stays clean — but it is recorded;
     · no plan runs more than seven days past the month it belongs to;
     · a month created today carries the leave already on the books, including the
       manager's FY 2025/26 carry-over, and the leave book shows that block in the
       year he is away in as well as the year it was earned in. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const {w,errors,go}=await boot('#/roster');
  const S=w.LS.store, U=w.LSU, doc=w.document;

  /* ── 1 · the plan stops seven days past its month ──────────────────── */
  const months=['2026-08','2026-09','2026-10','2026-11','2026-12','2027-01','2027-02'];
  const spans=months.map(mk=>{
    const p=S.buildPlan(mk);
    const first=p.dates[0], last=p.dates[p.dates.length-1];
    const endOfMonth=new Date(mk+'-01T12:00:00');
    endOfMonth.setMonth(endOfMonth.getMonth()+1); endOfMonth.setDate(0);
    const monthEnd=endOfMonth.toISOString().slice(0,10);
    return {mk,first,last,monthEnd,days:p.dates.length,
      overrun:U.daysBetween(monthEnd,last)};
  });
  ok(spans.every(s=>s.overrun===7),
     'every plan runs exactly seven days past its own month ('+
       spans.map(s=>s.mk+' +'+s.overrun).join(', ')+')');
  ok(spans.every(s=>s.overrun<=7),'and never more than a week into the next month');
  const novSpan=spans.find(s=>s.mk==='2026-11');
  ok(novSpan.last==='2026-12-07','November 2026 ends on 7 December ('+novSpan.last+')');
  ok(!novSpan.last.startsWith('2026-12-13'),'not the thirteen days the old build ran on to');

  /* ── 2 · every night is paid back with a day at home ───────────────── */
  const nov=S.buildPlan('2026-11');
  const codesOf=name=>(nov.staff.find(r=>r.name===name)||{codes:[]}).codes;
  const runsOf=codes=>{ const out=[]; let run=0;
    codes.forEach((c,i)=>{ if(c==='N'||c==='DN'){ run++; } else { if(run) out.push({len:run,from:i-run}); run=0; } });
    if(run) out.push({len:run,from:codes.length-run}); return out; };
  const isRest=iso=>U.dow(iso)>=5||!!S.holiday(iso);
  const weekdayBlocks=[];
  nov.staff.forEach(r=>runsOf(r.codes).forEach(b=>{
    if(!isRest(nov.dates[b.from])) weekdayBlocks.push({name:r.name,codes:r.codes,block:b});
  }));
  ok(weekdayBlocks.length>0,'the month writes night blocks inside the working week');
  const unpaid=weekdayBlocks.filter(({codes,block})=>{
    const last=block.from+block.len-1;
    for(let k=1;k<=block.len;k++){
      const di=last+k; if(di>=codes.length) return false;   /* the block ends at the edge of the run */
      const iso=nov.dates[di];
      if(isRest(iso)) continue;                              /* weekend: recorded, not written */
      if(codes[di]!=='OFF') return true;
    }
    return false;
  });
  ok(unpaid.length===0,'each of those blocks is followed by as many days at home ('+
     unpaid.map(u=>u.name.split(' ')[0]+' '+U.fmtDateShort(nov.dates[u.block.from])).join(', ')+')');
  ok(weekdayBlocks.every(({codes,block})=>block.len<=3),'and no block of them runs past three nights');

  /* ── 3 · a day owed on a weekend is recorded, not written ──────────── */
  const comps=nov.meta.compOffs||[];
  ok(comps.length>0,'the plan carries a statement of the days owed');
  ok(comps.every(c=>c.owed===c.written+c.withheld),
     'what is owed is exactly what was written plus what was withheld from the grid ('+
       comps.map(c=>c.name.split(' ')[0]+' '+c.written+'/'+c.withheld).join(', ')+')');
  const withheld=comps.filter(c=>c.withheld>0);
  ok(withheld.length>0,'some of those days land on a weekend or a holiday');
  const painted=comps.filter(c=>(c.weekendDays||[]).some(iso=>{
    const di=nov.dates.indexOf(iso); const r=nov.staff.find(x=>x.name===c.name);
    return r&&r.codes[di]==='OFF';
  }));
  ok(painted.length===0,'not one of them is painted on the plan — the weekend stays clean');
  ok(comps.every(c=>(c.weekendDays||[]).every(isRest)),'and every withheld day really is a rest day');
  const dieu=comps.find(c=>/Dieudonne/.test(c.name));
  ok(!!dieu&&dieu.owed>0,'the busiest night name has a statement of his own ('+
     (dieu?dieu.owed+' owed':'-')+')');

  /* ── 4 · the rest-owed card shows it on the roster ─────────────────── */
  doc.querySelector('[data-view="grid"]').click(); await tick(350);
  const card=[...doc.querySelectorAll('#app .card')].find(c=>/Rest owed after nights/.test(c.textContent));
  ok(!!card,'the working plan shows a rest-owed card');
  ok(/One night worked is one day at home/.test(card.textContent),'with the rule written on it');
  ok(/Not written/.test(card.textContent),'and a column for the days that are not written');
  ok(/weekend/.test(card.textContent),'naming the rest days that were recorded only');
  ok([...card.querySelectorAll('tbody tr')].length>=4,'one row per person who carried a night ('+
     [...card.querySelectorAll('tbody tr')].length+')');

  /* ── 5 · a month created today reads the leave register ────────────── */
  const dec=S.createPlan('2026-12');
  const kelDec=dec.primary.staff.find(r=>/Kelvin/.test(r.name));
  const i1=dec.primary.dates.indexOf('2026-12-01');
  ok(kelDec.codes[i1]==='AL','a month created now carries the manager’s carried-over leave (1 December)');
  ok(kelDec.codes[dec.primary.dates.indexOf('2026-12-07')]==='AL','right to the end of the run');

  /* a blank month is still written from the register */
  w.eval("LS.store.commit(d=>{ d.workingPlans['2027-03']={primary:{label:'March 2027',dates:[],staff:[],meta:{}},versions:[]}; },{action:'test.blank'});");
  const blank={label:'March 2027',dates:['2027-03-01','2027-03-02'],staff:[],meta:{}};
  ok(S.applyLeaveToPlan(blank)===0,'a plan with no rows is left alone by the leave overlay');
  const row={name:'Kelvin SAMAHANI',codes:['D','D']};
  const mini={dates:['2026-11-16','2026-11-17'],staff:[row],meta:{}};
  const wrote=S.applyLeaveToPlan(mini);
  ok(wrote===2&&row.codes.join(',')==='AL,AL','the overlay writes the block over the cells it covers');

  /* ── 6 · the leave book shows the block in both years ─────────────── */
  const kel=S.staffById('s1');
  const prev=S.leaveBook(kel,'2025/2026');
  ok(prev.charged===30,'the year it was earned in is charged thirty days');
  ok(prev.balance===0,'and has nothing left');
  const now=S.leaveBook(kel,'2026/2027');
  ok((now.rows||[]).some(l=>l.id==='l18'),'the year he is away in lists the block on his row');
  ok(now.charged===0,'without charging this year for it');
  ok(now.balance===30,'so this year’s own thirty are untouched');
  ok((now.chargedElsewhere||[]).some(c=>c.id==='l18'&&c.fy==='2025/2026'),
     'and says which year the days come out of');
  ok(now.annual.some(l=>l.id==='l18'),'the taken/booked figures count it in the year it falls');
  const chargedFy=S.leaveChargedFy?S.leaveChargedFy(S.leaves().find(l=>l.id==='l18')):null;
  ok(chargedFy==='2025/2026','the record answers which year it is charged to ('+chargedFy+')');

  await go('#/leave'); await tick(400);
  const book=[...doc.querySelectorAll('#app table tbody tr')].find(tr=>/Kelvin SAMAHANI/.test(tr.textContent));
  ok(!!book,'his row is on the leave book');
  ok(/16 Nov/.test(book.textContent),'the block is written on it ('+
     book.textContent.replace(/\s+/g,' ').trim().slice(0,120)+')');
  ok(/FY 2025\/2026/.test(book.textContent),'with the year it is charged to named beside it');

  ok(errors.length===0,'no console errors during the run');
  done('rest61');
})();
