/* v6.9.58 — Jeanne Claudine UWAYISABA arrived on 6 October 2026.
   She takes her place on the October plan, the days before her arrival are hatched
   rather than blank, and from the 6th she works the bench on dayshifts as a
   newcomer: no weekend and no night until her thirty days of induction are over. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const {w,errors,go}=await boot('#/roster');
  const S=w.LS.store, U=w.LSU, doc=w.document;
  const marie=S.staffByName('Jeanne Claudine UWAYISABA');

  /* ── 1 · she arrived on 6 October ───────────────────────────────────── */
  ok(!!marie,'her record is on the establishment');
  ok(marie.joinDate==='2026-10-06','she arrived on 6 October 2026 ('+marie.joinDate+')');
  ok(S.newcomerUntil(marie)==='2026-11-04','her thirty days of induction end on 4 November 2026');
  ok(S.isNewcomer(marie,'2026-10-06'),'she is a newcomer on her first day');
  ok(!S.isNewcomer(marie,'2026-11-05'),'and an ordinary member of the roster from the 5th');

  /* ── 2 · she is on the October plan ────────────────────────────────── */
  const oct=S.planForMonth('2026-10');
  const row=(oct.staff||[]).find(r=>r.name===marie.name);
  ok(!!row,'she has a row on the October working plan');
  ok(oct.staff.filter(r=>r.name===marie.name).length===1,'exactly one row — no duplicate');
  ok(row.codes.length===oct.dates.length,'one cell per day of the month ('+row.codes.length+')');
  const i5=oct.dates.indexOf('2026-10-05'), i6=oct.dates.indexOf('2026-10-06');
  ok(i5>=0&&i6>=0,'the plan runs through the 5th and the 6th');

  /* ── 3 · the days before are hatched, not blank ────────────────────── */
  ok(row.codes.slice(0,i6).every(c=>c==='BE'),
     'every day before her arrival reads BE ('+row.codes.slice(0,i6).join(',')+')');
  ok(row.codes.slice(0,i6).every(c=>c!==''),'not one of them is left blank — a blank means at home');
  ok(oct.meta.revised===true,'the month is marked revised');
  ok(/6 October 2026/.test(oct.meta.revisedNote||''),'and says why');

  /* ── 4 · from the 6th she works dayshifts ──────────────────────────── */
  const after=oct.dates.map((iso,i)=>({iso,i})).filter(x=>x.iso>='2026-10-06');
  const workdays=after.filter(x=>U.dow(x.iso)<5&&!S.holiday(x.iso));
  ok(workdays.length>0,'there are working days after her arrival');
  ok(workdays.every(x=>row.codes[x.i]==='D'),
     'she works every one of them as a day shift ('+workdays.filter(x=>row.codes[x.i]!=='D').map(x=>x.iso+':'+row.codes[x.i]).join(', ')+')');
  ok(after.every(x=>row.codes[x.i]!=='N'&&row.codes[x.i]!=='DN'),'and never a night while she is a newcomer');

  /* ── 5 · the weekend is exempt for her thirty days ─────────────────── */
  const weekends=after.filter(x=>U.dow(x.iso)>=5);
  ok(weekends.length>0,'the month has weekend days after her arrival');
  ok(weekends.every(x=>row.codes[x.i]===''),'her weekend cells are blank — nobody else is rostered there');
  /* and the generator does not put her on a weekend either */
  const nov=S.planForMonth('2026-11');
  const nrow=nov.staff.find(r=>r.name===marie.name);
  ok(!!nrow,'she is on the November plan too');
  const novInduction=nov.dates.map((iso,i)=>({iso,i})).filter(x=>x.iso<='2026-11-04');
  ok(novInduction.every(x=>nrow.codes[x.i]!=='N'&&nrow.codes[x.i]!=='DN'),
     'no night inside her induction month ('+novInduction.map(x=>x.iso+':'+(nrow.codes[x.i]||'-')).join(' ')+')');
  ok(novInduction.filter(x=>U.dow(x.iso)>=5).every(x=>nrow.codes[x.i]===''||S.isLeaveCode(nrow.codes[x.i])||nrow.codes[x.i]==='OFF'),
     'and no weekend duty before the induction ends');
  ok(nov.dates.some((iso,i)=>iso>'2026-11-05'&&(nrow.codes[i]==='N'||nrow.codes[i]==='DN')),
     'after it she takes her share of the nights — she is on the rota');

  /* ── 6 · the screen shows the hatch ────────────────────────────────── */
  await go('#/roster'); await tick(320);
  doc.querySelector('[data-view="grid"]').click(); await tick(360);
  const beCells=[...doc.querySelectorAll('#roBody td.be')];
  ok(beCells.length===i6,'the grid hatches exactly the days before she arrived ('+beCells.length+')');
  ok(beCells.every(td=>td.dataset.tip&&/before employment/i.test(td.dataset.tip)),'and every one says why');
  ok(beCells.every(td=>/BE/.test(td.textContent)),'each carries the BE mark as well as the hatch');
  const herRow=[...doc.querySelectorAll('#roBody tbody tr')].find(tr=>/UWAYISABA/.test(tr.textContent));
  ok(!!herRow,'her row is drawn on the working plan');
  const cells=[...herRow.querySelectorAll('td.day')];
  ok(cells[i6-1].classList.contains('be'),'the day before her arrival is hatched on the screen');
  ok(!cells[i6].classList.contains('be'),'and her first day is not');
  ok(/D/.test(cells[i6].textContent),'it reads D');

  /* ── 7 · the sheet is hatched too, and keeps the roster order ──────── */
  const svg=w.LS.sheets.monthlySVG(oct);
  const dashed=(svg.match(/stroke-dasharray="7 5"/g)||[]).length;
  ok(dashed===i6,'the printed sheet hatches the same days ('+dashed+')');
  ok(/Hatched — before employment/.test(svg),'and the key explains the hatch');
  ok(!/>BE</.test(svg),'the hatch carries no letter — a letter would read as a shift');
  const names=S.activeStaff().map(st=>st.name);
  const order=[...svg.matchAll(/<text x="120" y="([\d.]+)"[^>]*>([^<]+)</g)]
    .filter(m=>+m[1]>520&&+m[1]<1080).map(m=>m[2].trim()).filter(t=>names.indexOf(t)>=0);
  ok(order[0]==='Kelvin SAMAHANI','the sheet runs in roster order, manager first ('+order.slice(0,3).join(' · ')+')');
  ok(order[order.length-1]==='Aurelie YANSONEYE','and the weekend technologist last');
  ok(order.indexOf('Jeanne Claudine UWAYISABA')===order.indexOf('Bernadette MUHAWENIMANA')+1,
     'with Jeanne Claudine on the bench between Bernadette and Aurelie ('+order.join(' · ')+')');

  /* ── 8 · nothing else on the October plan moved ────────────────────── */
  const others=['Kelvin SAMAHANI','Beatrice NGEZEKURE','Aurelie YANSONEYE','Patrick ISHIMWE',
    'Jean Paul NSENGIYUMVA','Dieudonne NIYIDUHABYOSE','Bernadette MUHAWENIMANA'];
  ok(others.every(n=>oct.staff.some(r=>r.name===n)),'every other member of staff keeps their row');
  ok(oct.staff.find(r=>r.name==='Kelvin SAMAHANI').codes.filter(c=>c==='D').length>=10,
     'and the manager still works the bench as the signed plan says');
  ok(S.isNewcomer(S.staffByName('Kelvin SAMAHANI'),'2026-10-06')===false,'nobody else is treated as a newcomer');
  ok(S.isNewcomer(S.staffByName('Bernadette MUHAWENIMANA'),'2026-10-06')===false,'nor is Bernadette');

  /* ── 9 · her contact details are on the record, and on the sheet ───── */
  ok(marie.phone==='0784063985','her phone number is recorded ('+marie.phone+')');
  ok(marie.email==='uwayjeanneclaudine@gmail.com','and her email address ('+marie.email+')');
  const contact=w.LS.sheets.monthlySVG(S.planForMonth('2026-10'));
  ok(contact.indexOf('0784063985')>=0,'the contact list prints her number, not a dash');
  ok(!/UWAYISABA[^<]*<\/text>[\s\S]{0,400}—/.test(contact),'and nothing reads “—” against her name');

  /* ── 10 · she is Jeanne Claudine, everywhere ───────────────────────── */
  ok(marie.name==='Jeanne Claudine UWAYISABA','her name is Jeanne Claudine UWAYISABA ('+marie.name+')');
  ok(U.nameParts(marie.name).given==='Jeanne Claudine','her given name is “Jeanne Claudine”, whole');
  ok(U.surname(marie.name)==='UWAYISABA','and her family name is UWAYISABA');
  ok(U.initials(marie.name)==='JU','her avatar reads JU — first given initial and the family name');
  const dump=JSON.stringify(S.db());
  ok(dump.indexOf('Marie Claudine')<0,'no record in the register still calls her Marie Claudine');
  ok(dump.indexOf('Jeanne Claudine UWAYISABA')>=0,'and the register holds her under the right name');
  ok(S.planMonths().every(k=>!(S.planForMonth(k).staff||[]).some(r=>/^Marie /.test(r.name||''))),
     'no stored month carries the old name on a row');
  ok(Object.keys(S.db().workingPlans).every(k=>(S.db().workingPlans[k].versions||[])
      .every(v=>!(v.staff||[]).some(r=>/^Marie /.test(r.name||'')))),'nor does any archived version');
  const sheetOct=w.LS.sheets.monthlySVG(S.planForMonth('2026-10'));
  ok(sheetOct.indexOf('Jeanne Claudine UWAYISABA')>=0,'the October sheet prints her full name');
  ok(sheetOct.indexOf('Marie Claudine')<0,'and never the old one');
  await go('#/roster'); await tick(320);
  doc.querySelector('[data-view="grid"]').click(); await tick(340);
  const herCells=[...doc.querySelectorAll('#roBody td.staff-cell')].map(td=>td.textContent.replace(/\s+/g,' '));
  ok(herCells.some(t=>/Jeanne Claudine UWAYISABA/.test(t)),'the working plan prints her full name on her row');
  ok(!herCells.some(t=>/^Marie /.test(t)),'with no row left under the old name');

  ok(errors.length===0,'no console errors during the run'+(errors.length?': '+errors.join(' | '):''));
  done('arrival58');
})().catch(e=>{ console.error(e); process.exit(1); });
