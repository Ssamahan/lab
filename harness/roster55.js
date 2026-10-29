/* v6.9.55 — the roster answers to the department, not to the generator:
   the order it is read in, the manager's own thirty days on the plan, the nights
   shared fairly and never handed to somebody acting for the manager, RBW only in
   the one case it exists for, the service requisition against the right name, and
   blocks of days or nights in a single click. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const {w,errors,go}=await boot('#/roster');
  const S=w.LS.store, U=w.LSU, doc=w.document, db=()=>S.db();
  const click=el=>{ if(el) el.click(); };

  /* ── 1 · the order the roster is read in ───────────────────────────── */
  const order=S.activeStaff().map(s=>s.name);
  ok(order[0]==='Kelvin SAMAHANI','the manager is the first name on the roster');
  ok(order[order.length-1]==='Aurelie YANSONEYE','and the weekend technologist is the last');
  ok(order.slice(1,-1).join('|')==='Jean Paul NSENGIYUMVA|Dieudonne NIYIDUHABYOSE|Beatrice NGEZEKURE|Patrick ISHIMWE|Bernadette MUHAWENIMANA|Jeanne Claudine UWAYISABA',
     'between them the bench reads Jean Paul, Dieudonné, Beatrice, Patrick, Bernadette, Jeanne Claudine ('+order.join(', ')+')');
  ok(S.rosterRank(S.staffByName('Aurelie YANSONEYE'))>S.rosterRank(S.staffByName('Jeanne Claudine UWAYISABA')),
     'she sorts after everybody on the bench');
  const nov=S.planForMonth('2026-11');
  ok(!!nov,'there is a November 2026 plan');
  ok(nov.staff.map(r=>r.name)[0]==='Kelvin SAMAHANI','the stored plan runs in the same order');
  ok(nov.staff.map(r=>r.name).indexOf('Aurelie YANSONEYE')===nov.staff.length-1,'with Aurelie on the last row');

  /* ── 2 · the manager's thirty days are the FY 2025/26 carry-over ───── */
  const kel=db().leaves.find(l=>l.id==='l18');
  ok(!!kel,'the manager has a leave record');
  ok(kel.from==='2026-11-16','it starts on 16 November 2026 ('+kel.from+')');
  ok(kel.to==='2026-12-15','and runs the full thirty days to 15 December ('+kel.to+')');
  ok(U.daysBetween(kel.from,kel.to)+1===30,'that is thirty days');
  ok(kel.backOn==='2026-12-16','and he is back on the 16th');
  ok(kel.chargedFy==='2025/2026','charged to the year the days were earned in');
  ok(/2025\/2026/.test(kel.note||''),'and the note says so');
  ok(!db().leaves.some(l=>l.staffId==='s1'&&l.id!=='l18'),'no second block sits on top of it');
  const kbPrev=S.leaveBook(S.staffById('s1'),'2025/2026');
  ok(kbPrev.charged===30&&kbPrev.balance===0,'the FY 2025/26 book is clear — 30 charged, nothing left');
  const kbNow=S.leaveBook(S.staffById('s1'),'2026/2027');
  ok(kbNow.charged===0&&kbNow.balance===30,'and this year’s own thirty are untouched');

  /* ── 3 · the working plan reads the leave plan by itself ───────────── */
  const krow=nov.staff.find(r=>/Kelvin/.test(r.name));
  const i16=nov.dates.indexOf('2026-11-16');
  ok(i16>=0,'the plan runs through 16 November');
  ok(krow.codes[i16]==='AL','and his row is annual leave from that day');
  ok(krow.codes.slice(i16).every(c=>c==='AL'),'every cell from there to the end of the run is AL');
  ok(krow.codes.slice(0,i16).every(c=>c!=='AL'),'not one cell before it');
  ok(krow.codes.slice(0,i16).filter(c=>c==='D').length>=10,'while the first fortnight he is on the bench');
  ok(nov.staff.find(r=>/Beatrice/.test(r.name)).codes.indexOf('AL')<0,'nobody else is painted with his leave');

  /* ── 4 · the November nights ───────────────────────────────────────── */
  const novRows={}; nov.staff.forEach(r=>novRows[r.name]=r.codes);
  const nightRows=nov.staff.filter(r=>r.codes.some(c=>c==='N'||c==='DN')).map(r=>r.name);
  ok(!nightRows.some(n=>/Jean Paul/.test(n)),'Jean Paul takes no nights while he is acting for the manager');
  ok(!nightRows.some(n=>/Beatrice/.test(n)),'Beatrice takes no nights — the conditions set for her are kept');
  ok(!nightRows.some(n=>/Kelvin/.test(n)),'and the manager himself takes none');
  ['Dieudonne NIYIDUHABYOSE','Bernadette MUHAWENIMANA','Jeanne Claudine UWAYISABA'].forEach(n=>{
    ok((novRows[n]||[]).some(c=>c==='N'||c==='DN'),n.split(' ')[0]+' takes a share of the nights');
  });
  const countOf=name=>(novRows[name]||[]).filter(c=>c==='N'||c==='DN').length;
  const shares=['Dieudonne NIYIDUHABYOSE','Bernadette MUHAWENIMANA','Jeanne Claudine UWAYISABA']
    .map(n=>countOf(n));
  ok(Math.max.apply(null,shares)-Math.min.apply(null,shares)<=3,
     'the three shares are level, so nobody is dumped on ('+shares.join(' / ')+')');
  const blocksOf=name=>{ const out=[]; let run=0;
    (novRows[name]||[]).forEach((c,i)=>{ if(c==='N'||c==='DN') run++; else { if(run) out.push({len:run,from:i-run}); run=0; } });
    if(run) out.push({len:run,from:novRows[name].length-run}); return out; };
  const carriedLen=nov.dates.filter(iso=>nov.meta.carriedThrough&&iso<=nov.meta.carriedThrough).length;
  const own=[]; ['Patrick ISHIMWE','Dieudonne NIYIDUHABYOSE','Bernadette MUHAWENIMANA','Jeanne Claudine UWAYISABA']
    .forEach(n=>blocksOf(n).forEach(b=>{ if(b.from>=carriedLen) own.push({name:n,len:b.len,from:b.from}); }));
  ok(own.length>0,'the month writes night blocks of its own');
  /* the last day of the run begins a block that the next month's plan continues */
  const novLast=nov.dates[nov.dates.length-1];
  const lone=own.filter(b=>b.len<2 && nov.dates[b.from]!==novLast);
  ok(lone.length===0,'never a lone night ('+lone.map(b=>b.name.split(' ')[0]+' '+nov.dates[b.from]).join(', ')+')');
  ok(own.every(b=>b.len<=3),'and never more than three in a row');
  ok(own.every(b=>b.len<=(S.staffByName(b.name).maxConsecN||3)),'no block runs past its holder’s own ceiling');
  ok(own.filter(b=>/Jeanne Claudine/.test(b.name)).every(b=>b.len<=2),'Jeanne Claudine works two at a time');

  /* ── 5 · RBW has one meaning and one place ─────────────────────────── */
  ok(!nov.staff.some(r=>r.codes.some(c=>c==='RBW')),
     'November writes no RBW at all — the weekend technologist covers her weekends');
  /* make the weekend uncoverable, and the rule shows itself */
  w.eval("LS.store.commit(d=>{ d.leaves=d.leaves||[]; d.leaves.push({id:'t-away',staffId:'s4',type:'AL',from:'2027-01-01',to:'2027-01-31',status:'Planned',note:'test'}); },{action:'test.leave'});");
  const jan=S.buildPlan('2027-01');
  const codeAt=(name,iso)=>{ const r=jan.staff.find(x=>x.name===name); return r?r.codes[jan.dates.indexOf(iso)]:''; };
  const rbws=[]; jan.staff.forEach(r=>r.codes.forEach((c,i)=>{ if(c==='RBW') rbws.push({name:r.name,iso:jan.dates[i],di:i}); }));
  ok(rbws.length>0,'a weekend nobody can cover produces RBW');
  ok(rbws.every(b=>U.dow(b.iso)===4),'and it is always the Friday before the weekend duty ('+rbws.map(b=>b.iso).join(', ')+')');
  const rbwOne=rbws[0];
  const friNightBefore=(function(){ let iso=U.addDays(rbwOne.iso,-1); return codeAt(rbwOne.name,iso); })();
  ok(friNightBefore!=='N','the person resting before work was not already on the Friday night');
  ok(codeAt(rbwOne.name,U.addDays(rbwOne.iso,1))==='N','he then works the Saturday night');
  ok(codeAt(rbwOne.name,U.addDays(rbwOne.iso,2))==='N','and the Sunday night');
  ok(codeAt(rbwOne.name,U.addDays(rbwOne.iso,3))==='OFF','rests the Monday after');
  ok(codeAt(rbwOne.name,U.addDays(rbwOne.iso,4))==='D','and is on duty on the Tuesday — the heavy clinic day is not lost');
  ok(jan.dates.filter(iso=>U.dow(iso)===2).every(iso=>{
    const on=jan.staff.filter(r=>(r.codes[jan.dates.indexOf(iso)]||'D')==='D').length;
    const off=jan.staff.filter(r=>r.codes[jan.dates.indexOf(iso)]==='OFF').length;
    return on>=3 && off<=2;
  }),'no Tuesday is stripped of the bench');
  ok(!jan.staff.some(r=>r.codes.filter(c=>c==='RBW').length>4),'and RBW never piles up on one name');

  /* ── 6 · the service requisition sits against the right name ──────── */
  const octReq=S.requisitionOfficer('2026-10');
  ok(octReq && octReq.name==='Kelvin SAMAHANI' && !octReq.acting,'in October the manager carries the service requisition himself');
  const novReq=S.requisitionOfficer('2026-11');
  ok(novReq && novReq.name==='Jean Paul NSENGIYUMVA','in November, while he is away, Jean Paul takes it over');
  ok(novReq.acting===true && novReq.forName==='Kelvin SAMAHANI','and is marked as acting for him');
  ok(/every Monday/i.test(S.REQUISITION_NOTE),'the note says when the request goes — every Monday, for the whole week');
  const decReq=S.requisitionOfficer('2027-02');
  ok(decReq && decReq.name==='Kelvin SAMAHANI' && !decReq.acting,'the month after his leave, it is his again');

  await w.LS.shell.route(); await tick(250);
  await new Promise(r=>{ const t=doc.querySelector('[data-view="grid"]'); click(t); setTimeout(r,250); });
  const rowText=name=>{
    const tr=[...doc.querySelectorAll('#roBody tbody tr')].find(x=>x.textContent.indexOf(name)>=0);
    return tr?tr.textContent.replace(/\s+/g,' '):'';
  };
  ok(/Service requisition/.test(rowText('Kelvin SAMAHANI')),'the October grid marks the requisition against the manager’s name');
  ok(!/Service requisition/.test(rowText('Jean Paul NSENGIYUMVA')),'and not against anybody else');
  const novBtn=[...doc.querySelectorAll('[data-nav]')].filter(b=>b.dataset.nav==='1')[0];
  click(novBtn); await tick(320);
  ok(/Service requisition · acting/.test(rowText('Jean Paul NSENGIYUMVA')),'in November the mark moves to Jean Paul and says it is acting');
  ok(!/Service requisition/.test(rowText('Kelvin SAMAHANI')),'and the manager’s row no longer claims it');
  const svg=w.LS.sheets.monthlySVG(S.planForMonth('2026-11'));
  ok(/service requisition/i.test(svg),'the printed sheet carries the same mark');
  ok(/acting/i.test(svg),'and says who is acting');

  /* ── 7 · fill the leaves from the register ─────────────────────────── */
  ok(!!doc.querySelector('[data-leavefill]'),'the working plan offers one action that reads the leave register');
  w.eval("LS.store.commit(d=>{ const pl=d.workingPlans['2026-11'].primary; pl.staff.find(r=>/Kelvin/.test(r.name)).codes[20]='D'; },{action:'test.wipe'});");
  click(doc.querySelector('[data-leavefill]')); await tick(320);
  const after=S.planForMonth('2026-11').staff.find(r=>/Kelvin/.test(r.name));
  ok(after.codes[20]==='AL','a cell wiped off his block is put back from the register');

  /* ── 8 · two or three days, two or three nights, in one click ─────── */
  const p=S.planForMonth('2026-11');
  const si=p.staff.findIndex(r=>/Jeanne Claudine/.test(r.name));
  const di=p.dates.indexOf('2026-11-10');
  ok(di>=0,'a weekday of her row is on the grid');
  click(doc.querySelector('[data-si="'+si+'"][data-di="'+di+'"]')); await tick(200);
  const runs=[...doc.querySelectorAll('[data-run]')].map(b=>b.dataset.run+'×'+b.dataset.n);
  ok(runs.indexOf('D×2')>=0&&runs.indexOf('D×3')>=0,'the picker offers two or three days in one click ('+runs.join(' ')+')');
  ok(runs.indexOf('N×2')>=0&&runs.indexOf('N×3')>=0,'and two or three nights');
  ok(runs.indexOf('AL×15')>=0,'and the annual-leave blocks the book is written in');
  click(doc.querySelector('[data-run="N"][data-n="2"]')); await tick(320);
  const p2=S.planForMonth('2026-11');
  ok(p2.staff[si].codes.slice(di,di+2).join('')==='NN','clicking two nights writes two consecutive nights');
  ok(p2.staff[si].codes.slice(di,di+2).join('')!=='NNN','and stops there');

  /* ── 9 · tapping annual leave fills the next fifteen fields ────────── */
  /* a sick-leave block sits in the middle of where the annual leave would go */
  w.eval("LS.store.commit(d=>{ d.leaves.push({id:'t-sl',staffId:'s3',type:'SL',from:'2026-11-30',to:'2026-12-01',status:'Approved',note:'test'}); },{action:'test.leave'});");
  const sj=p2.staff.findIndex(r=>/Beatrice/.test(r.name));
  const dj=p2.dates.indexOf('2026-11-23');
  click(doc.querySelector('[data-si="'+sj+'"][data-di="'+dj+'"]')); await tick(200);
  click(doc.querySelector('[data-code="AL"]')); await tick(320);
  const p3=S.planForMonth('2026-11');
  /* the run now stops a week past its month, so from 23 November there are fifteen
     cells to the end of the plan: the two sick days are left alone and the other
     thirteen are filed as annual leave, the fill stopping at the end of the run */
  const filled=p3.staff[sj].codes.slice(dj);
  const restCells=p3.dates.length-dj;
  ok(restCells===15,'the run has fifteen cells from 23 November to its last day ('+restCells+')');
  ok(filled.filter(c=>c==='AL').length===13,'tapping AL fills every remaining field as annual leave ('+filled.filter(c=>c==='AL').length+' of '+restCells+')');
  const beatrice=p3.staff[sj];
  const slDay=beatrice.codes[p3.dates.indexOf('2026-11-30')];
  ok(slDay!=='AL','a sick-leave block in the register is left alone by the annual-leave fill ('+(slDay||'blank')+')');
  ok(S.leaveCodeFor('Beatrice NGEZEKURE','2026-11-30')==='SL','so the cell still reads SL from the register');
  ok(beatrice.codes[p3.dates.indexOf('2026-12-02')]==='AL','and the fill carries on past it');

  /* ── 10 · the leave book offers the blocks and the year they come from ── */
  await go('#/leave'); await tick(320);
  const addBtn=doc.querySelector('[data-newplan]');
  ok(!!addBtn,'the leave book can add a plan');
  click(addBtn); await tick(250);
  const quick=[...doc.querySelectorAll('[data-days]')].map(b=>b.dataset.days);
  ok(quick.join('|')==='10|15|20|30','the form offers ten, fifteen, twenty and thirty days ('+quick.join(', ')+')');
  ok(!!doc.querySelector('#plCharge'),'and asks which year the block is charged to');
  ok(!!doc.querySelector('#plDays'),'the number of days is a field of its own');
  click(doc.querySelector('[data-days="15"]')); await tick(120);
  ok(doc.querySelector('#plDays').value==='15','a click sets fifteen days');
  ok(U.daysBetween(doc.querySelector('#plFrom').value,doc.querySelector('#plTo').value)+1===15,'and the end date follows it');

  ok(errors.length===0,'no console errors during the run'+(errors.length?': '+errors.join(' | '):''));
  done('roster55');
})().catch(e=>{ console.error(e); process.exit(1); });
