/* v6.9.41 — the November 2026 plan, built from the department's rules and the
   record of the previous months; the sheet names the post under every name, carries
   the codes the paper plans have always used, and says out loud when it is a draft. */
const {boot,ok,done}=require('./env');
const click=(el)=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||180));

(async()=>{
  const {w,go}=await boot('#/roster');
  const doc=w.document, S=()=>w.LS.store, db=()=>w.LS.store.db();
  const SH=w.LS.sheets, U=w.LSU;

  /* ── the November plan exists, and is a draft ──────────────────────── */
  const entry=db().workingPlans['2026-11'];
  ok(!!(entry&&entry.primary),'November 2026 has a working plan');
  const p=entry.primary;
  ok(p.dates[0]==='2026-11-01','it opens on the 1st of the month');
  ok(p.dates.length>=37,'and runs a full month and at least a week beyond it ('+p.dates.length+' days)');
  ok(p.dates[p.dates.length-1]>='2026-12-07','so the first week of the next month is already planned');
  ok(!!p.meta.draft&&!p.meta.official,'marked as a draft, not an official plan');
  ok(/review before publishing/i.test(p.meta.label||''),'and the label says so in words');
  ok(p.staff.length===db().staff.filter(s=>s.status==='active').length,'a row for every active member of staff ('+p.staff.length+')');
  ok(p.staff.every(r=>(r.codes||[]).length===p.dates.length),'every row has a code for every day');
  ok(new Set(p.staff.map(r=>r.name)).size===p.staff.length,'no member of staff appears twice');

  /* ── it takes over the week the October plan already wrote ─────────── */
  const oct=db().workingPlans['2026-10'].primary;
  const overlapping=oct.dates.filter(iso=>p.dates.indexOf(iso)>=0);
  ok(overlapping.length>=6,'the October plan runs into November ('+overlapping.length+' days)');
  ok(p.meta.carriedFrom===overlapping[0],'the November plan takes that week over from '+p.meta.carriedFrom);
  const drift=[];
  overlapping.forEach(iso=>{
    const oi=oct.dates.indexOf(iso), ni=p.dates.indexOf(iso);
    oct.staff.forEach(r=>{ const row=p.staff.find(x=>x.name===r.name);
      if(!row||!r.codes[oi]) return;
      if(row.codes[ni]===r.codes[oi]) return;
      /* the leave register is the authority: leave that has ended is not carried,
         and leave the register records is written over whatever the old plan said */
      const st=S().staffByName(r.name)||{};
      const lv=S().leaveCodeFor(r.name,iso);
      if(lv && row.codes[ni]===lv) return;
      if(S().isLeaveCode(r.codes[oi]) && !lv) return;
      drift.push(iso+' '+r.name+' '+r.codes[oi]+'→'+row.codes[ni]);
    });
  });
  ok(drift.length===0,'and carries it across cell for cell, except where the leave register says otherwise'+(drift.length?' ('+drift.slice(0,4).join(', ')+')':''));

  /* ── the manager's carried-over leave is where the register puts it ── */
  const kelvin=p.staff.find(r=>/Kelvin/.test(r.name));
  const i19=p.dates.indexOf('2026-11-16');
  ok(i19>=0,'the carry-over leave begins on 16 November');
  ok(kelvin.codes.slice(i19).every(c=>c==='AL'),'the manager is on carried-over annual leave from the 16th to the end of the plan');
  ok(kelvin.codes.slice(0,i19).every(c=>c!=='AL'),'and not a day before it');
  ok(kelvin.codes.slice(0,i19).filter(c=>c==='D').length>=10,'the manager works the bench in the weeks before his leave — never a month of his own off');

  /* ── the nights: one name a night, in blocks of two or three ───────── */
  const carried=p.dates.filter(iso=>p.meta.carriedThrough&&iso<=p.meta.carriedThrough).length;
  const runs=(row)=>{ const out=[]; let run=0;
    (row.codes||[]).forEach((c,i)=>{ if(c==='N'||c==='DN'){ run++; } else { if(run) out.push({len:run,from:i-run}); run=0; } });
    if(run) out.push({len:run,from:row.codes.length-run}); return out; };
  const nights=(row)=>(row.codes||[]).filter(c=>c==='N'||c==='DN').length;

  /* exactly one person on every night */
  const onNight={};
  p.staff.forEach(r=>r.codes.forEach((c,i)=>{ if(c==='N'||c==='DN'){ (onNight[p.dates[i]]=onNight[p.dates[i]]||[]).push(r.name); } }));
  const doubled=Object.keys(onNight).filter(iso=>onNight[iso].length>1);
  ok(doubled.length===0,'only one name is ever on a night'+(doubled.length?' ('+doubled.slice(0,3).join(', ')+')':''));
  const uncovered=p.dates.filter(iso=>!onNight[iso]);
  ok(uncovered.length===0,'and every night has somebody on it'+(uncovered.length?' ('+uncovered.slice(0,3).join(', ')+')':''));

  /* no single night, nothing longer than three, in the part the console writes */
  const written=[];
  p.staff.forEach(r=>runs(r).forEach(b=>{ if(b.from>=carried) written.push({name:r.name,len:b.len,from:p.dates[b.from]}); }));
  ok(written.length>0,'the plan writes night blocks of its own');
  ok(written.every(b=>b.len>=2),'never a single night on its own'+(written.filter(b=>b.len<2).map(b=>b.name+' '+b.from).join(', ')));
  ok(written.every(b=>b.len<=3),'and never more than three in a row');
  const three=written.filter(b=>b.len===3).map(b=>b.name);
  /* a three-night block goes to whoever's own ceiling allows it, and the rotation
     shares it out — it is not reserved for one name */
  ok(three.every(n=>((S().staffByName(n)||{}).maxConsecN||0)>=3),'a three-night block only goes to a ceiling that allows three ('+[...new Set(three)].join(', ')+')');
  ok(written.filter(b=>((S().staffByName(b.name)||{}).maxConsecN||3)<3).every(b=>b.len<=2),'and a two-night ceiling is never stretched past two');
  /* the weekday nights, which is the share that is being evened out — the weekend
     technologist's two weekend nights are hers alone and are counted apart */
  const crewCount={};
  p.staff.filter(r=>!(S().staffByName(r.name)||{}).weekendOnly).forEach(r=>{
    r.codes.forEach((c,i)=>{ if(c==='N' && U.dow(p.dates[i])<5) crewCount[r.name]=(crewCount[r.name]||0)+1; });
  });
  const shares=Object.values(crewCount).filter(n=>n>0);
  ok(shares.length>=3,'the weekday nights are shared by three or more of the bench ('+Object.keys(crewCount).map(n=>n.split(' ')[0]+' '+crewCount[n]).join(', ')+')');
  ok(Math.max.apply(null,shares)-Math.min.apply(null,shares)<=4,'and no one carries a wildly heavier share (spread '+(Math.max.apply(null,shares)-Math.min.apply(null,shares))+' nights)');
  ok(!/Jean Paul/.test(Object.keys(crewCount).filter(n=>crewCount[n]>0).join(' ')),'the person acting for the manager takes no nights');
  const pat=p.staff.find(r=>/Patrick/.test(r.name)), jp=p.staff.find(r=>/Jean Paul/.test(r.name));
  ok(nights(pat)>=nights(jp),'Patrick carries at least as many nights as Jean Paul ('+nights(pat)+' vs '+nights(jp)+')');
  ok(p.staff.every(r=>nights(r)<=(S().staffByName(r.name)||{}).maxNights*2),'nobody is pushed past their own ceiling');

  /* ── the weekend: one on the day, one on the night, everyone else blank ── */
  const weekends=p.dates.filter(iso=>U.dow(iso)>=5);
  const offenders=[], dnBy=[];
  p.staff.forEach(r=>weekends.forEach(iso=>{
    const c=r.codes[p.dates.indexOf(iso)];
    if(!c) return;
    if(S().isLeaveCode(c)) return;                       // leave is not a shift
    if(c==='DN'&&!/Aurelie/.test(r.name)) dnBy.push(r.name+' '+iso);
    if(['D','N','DN'].indexOf(c)<0) offenders.push(r.name+' '+iso+' '+c);
    const dayOn=(onNight[iso]||[]).length;
    if(c==='D'&&dayOn>2) offenders.push(r.name+' '+iso+' third person');
  }));
  ok(dnBy.length===0,'only the weekend technologist ever works day + night at the weekend'+(dnBy.length?' ('+dnBy.slice(0,3).join(', ')+')':''));
  const workingWeekend=[];
  weekends.forEach(iso=>{
    const who=p.staff.filter(r=>{ const c=r.codes[p.dates.indexOf(iso)]; return c==='D'||c==='N'||c==='DN'; }).map(r=>r.name);
    if(who.length>2) workingWeekend.push(iso+': '+who.join(', '));
  });
  ok(workingWeekend.length===0,'no weekend puts more than two people on duty'+(workingWeekend.length?' ('+workingWeekend.slice(0,3).join(' | ')+')':''));
  const aur=p.staff.find(r=>/Aurelie/.test(r.name));
  const aurWeekend=weekends.filter(iso=>aur.codes[p.dates.indexOf(iso)]==='DN');
  ok(aurWeekend.length>=6,'the weekend technologist covers the weekends on DN ('+aurWeekend.length+' of '+weekends.length+')');
  ok(!p.staff.some(r=>/Kelvin|Beatrice/.test(r.name)&&(r.codes||[]).some(c=>c==='N'||c==='DN')),
     'the manager and Reception take no nights');

  /* ── the sheet reads like the department's own record ──────────────── */
  const svg=SH.monthlySVG(p);
  ok(/Laboratory Manager/.test(svg),'the post is printed under the manager’s name');
  ok(/Laboratory Technologist/.test(svg)||/Lab Technician/.test(svg),'and under the technologists’ names');
  ok(/DRAFT/.test(svg),'a draft sheet says DRAFT on its face');
  ok(/RBW/.test(svg)&&/AA/.test(svg),'the key carries the codes the paper plans use (RBW, AA)');
  ok(/Off duty \(rest before work\)/.test(svg),'with RBW spelled out');
  ok(/Working Plan — November 2026/.test(svg),'titled like every previous month');
  ok(/Prepared by/.test(svg)&&/Verified by/.test(svg)&&/Approved by/.test(svg),
     'and it keeps the three signature blocks the record has');

  /* ── the new codes are real choices, not decoration ────────────────── */
  ok(SH.codes.indexOf('RBW')>=0&&SH.codes.indexOf('AA')>=0,'the sheet knows both codes');
  const au=db().staff.find(s=>/Aurelie/.test(s.name));
  ok(S().shiftState(au,'2026-11-03').kind!=='night','a weekday off is still off');
  /* a plan cell holding RBW reads as rest before work */
  w.eval(`LS.store.commit(d=>{ const pl=d.workingPlans['2026-11'].primary; const row=pl.staff.find(r=>/Beatrice/.test(r.name)); row.codes[10]='RBW'; row.codes[11]='AA'; },{action:'test.codes'});`);
  const bea=S().staffByName('Beatrice NGEZEKURE');
  ok(S().shiftState(bea,'2026-11-11').label==='Rest before work','RBW reads as rest before work');
  ok(S().shiftState(bea,'2026-11-12').label==='Authorised leave','AA reads as authorised leave');

  /* ── the month is reachable on the roster screen ───────────────────── */
  await go('#/roster'); await tick(300);
  const next=[...doc.querySelectorAll('[data-nav]')].find(b=>b.dataset.nav==='1');
  click(next); await tick(400);
  const head=doc.querySelector('#roHead')?doc.querySelector('#roHead').textContent:doc.body.textContent;
  ok(/November 2026/.test(head),'one press of Next shows November',head.slice(0,90).replace(/\s+/g,' '));
  ok(/Draft/i.test(head),'and the header says the plan is a draft');

  /* ── a draft becomes the plan in force only when published ─────────── */
  ok(!!doc.querySelector('[data-publish]'),'a draft offers Publish plan');
  click(doc.querySelector('[data-publish]')); await tick(300);
  const go2=doc.querySelector('[data-ok],[data-confirm],.modal [data-confirm]')||null;
  const btns=[...doc.querySelectorAll('.modal button, .confirm button')];
  const yes=btns.find(b=>/Publish plan/i.test(b.textContent));
  ok(!!yes,'it asks before publishing');
  click(yes); await tick(500);
  const pub=db().workingPlans['2026-11'].primary;
  ok(!!pub.meta.official&&!pub.meta.draft,'the month becomes the official plan');
  ok(pub.meta.publishedBy==='Kelvin SAMAHANI','with the name of who published it');
  ok(/^Official/.test(pub.meta.label||''),'and the label says so');
  ok((db().workingPlans['2026-11'].versions||[]).length>=1,'the version it replaced is kept');
  ok(!/DRAFT/.test(SH.monthlySVG(pub)),'and the sheet stops printing DRAFT');
  ok(/Prepared by/.test(SH.monthlySVG(pub)),'the signature blocks remain');

  /* ── she is away: the weekend splits into a day and a night ────────── */
  w.eval(`LS.store.commit(d=>{ d.leaves=d.leaves||[];
    d.leaves.push({id:'t-aur',staffId:'s4',type:'AL',from:'2027-05-08',to:'2027-05-09',status:'Approved',note:'test'}); },{action:'test.leave'});`);
  const may=S().buildPlan('2027-05');
  const codeAt=(name,iso)=>{ const row=may.staff.find(r=>r.name===name); return row?row.codes[may.dates.indexOf(iso)]:''; };
  ['2027-05-08','2027-05-09'].forEach(iso=>{
    const on=may.staff.filter(r=>{ const c=codeAt(r.name,iso); return c==='D'||c==='N'||c==='DN'; }).map(r=>({name:r.name,code:codeAt(r.name,iso)}));
    ok(on.length===2&&on.some(x=>x.code==='D')&&on.some(x=>x.code==='N'),
      iso+' is split between one day and one night ('+on.map(x=>x.name.split(' ')[0]+'='+x.code).join(', ')+')');
    ok(!on.some(x=>x.code==='DN'),'and nobody is handed day + night in her absence');
    const blanks=may.staff.filter(r=>!codeAt(r.name,iso)||S().isLeaveCode(codeAt(r.name,iso)));
    ok(blanks.length===may.staff.length-on.length,'every other weekend cell is left blank');
  });
  const dayName=(may.staff.find(r=>codeAt(r.name,'2027-05-08')==='D')||{}).name;
  const nightName=(may.staff.find(r=>codeAt(r.name,'2027-05-08')==='N')||{}).name;
  ok(codeAt(dayName,'2027-05-09')==='D','the day worker takes both days');
  ok(codeAt(nightName,'2027-05-09')==='N','the night worker takes both nights');
  ok(codeAt(dayName,'2027-05-07')==='OFF','the day worker is off the Friday before');
  ok(codeAt(dayName,'2027-05-10')==='OFF','and off the Monday after');
  ok(codeAt(nightName,'2027-05-10')==='OFF','the night worker is off the Monday after');
  ok(codeAt(nightName,'2027-05-07')==='RBW','the night worker rests before work — on the Friday, before the weekend duty');
  ok(codeAt(nightName,'2027-05-11')!=='RBW' && codeAt(nightName,'2027-05-11')!=='OFF','and is on duty on the Tuesday, when the clinic is heaviest');

  /* ── the grid fits the page, coverage and balance below it ─────────── */
  await go('#/roster'); await tick(320);
  /* the roster opens on the current month — step forward to November */
  const toNov=[...doc.querySelectorAll('[data-nav]')].filter(b=>b.dataset.nav==='1')[0];
  click(toNov); await tick(360);
  const fit=doc.querySelector('.plan-fit');
  ok(!!fit,'the working-plan table sits in a fit-the-page card');
  const nov=db().workingPlans['2026-11'].primary;
  ok(doc.querySelectorAll('.plan-fit td.staff-cell .nm').length===nov.staff.length,
     'one column of names, one row each ('+doc.querySelectorAll('.plan-fit td.staff-cell .nm').length+')');
  ok(!doc.querySelector('.grid-12 .c9 table.cal'),'the table is no longer squeezed into nine of twelve columns');
  const pair2=doc.querySelector('.plan-pair');
  ok(!!pair2&&pair2.children.length===2,'coverage and balance sit below the grid, in two cards');
  ok(/Coverage/.test(pair2.children[0].textContent)&&/Balance/.test(pair2.children[1].textContent),'coverage first, balance second');
  ok(doc.querySelectorAll('.cov-cell').length===nov.dates.length,'coverage shows every day of the run ('+doc.querySelectorAll('.cov-cell').length+')');
  const css2=require('fs').readFileSync(require('path').resolve(__dirname,'..','assets/css/modules.css'),'utf8');
  ok(/\.plan-fit table\.cal\{table-layout:fixed;width:100%/.test(css2),'the table is laid out to the width of the page');
  ok(/\.plan-pair\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(css2),'and the two cards sit side by side where the screen allows');

  done('plan41');
})().catch(e=>{ console.error(e); process.exit(1); });
