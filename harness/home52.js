/* v6.9.52 — a blank cell in the working plan means the person is at home. It is an
   answer, not a missing one: they must never be drawn as day cover on the strength of
   their contract, and they must not appear in "On duty now". */
const {boot,ok,done}=require('./env');
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||200));

(async()=>{
  const {w,go}=await boot('#/dash');
  const S=w.LS.store, U=w.LSU, doc=w.document;
  const today=U.todayISO();
  const covers=()=>S.planCovers(today);
  ok(covers(),'a working plan covers today (the test needs one)');

  const bern=S.staffByName('Bernadette MUHAWENIMANA');
  const kelvin=S.staffByName('Kelvin SAMAHANI');
  const mk=today.slice(0,7);
  const idx=S.planForMonth(mk).dates.indexOf(today);
  ok(idx>=0,'today sits inside the plan');

  /* ── a blank cell ─────────────────────────────────────────────────── */
  w.eval(`LS.store.commit(d=>{ const p=d.workingPlans['${mk}'].primary;
    p.staff.find(s=>s.name==='Bernadette MUHAWENIMANA').codes[${idx}]='';
  },{action:'test.blank'});`);
  let st=S.shiftState(bern,today);
  ok(st.kind==='off','a blank cell is not a shift',JSON.stringify(st));
  ok(st.label==='At home','it reads “At home”',st.label);
  ok(st.source==='plan','the plan, not the contract pattern, answered',st.source);
  ok(st.blank===false,'she is on the plan with an empty cell',st.blank);
  ok(S.isOnDuty(bern,today)===false,'she is not on duty');
  ok(!S.onDuty(today).some(x=>x.staff.id===bern.id),'she is not in the on-duty list');

  /* the dashboard card agrees, on screen */
  await go('#/dash');
  const card=[...doc.querySelectorAll('.card')].find(c=>/On duty now/.test(c.textContent));
  ok(!!card,'the On duty now card is on the dashboard');
  const dutyRows=[...card.querySelectorAll('[data-duty-kind]')];
  const bernRow=dutyRows.find(r=>/Bernadette/.test(r.textContent));
  ok(!!bernRow,'she is still listed — being at home is shown, not hidden');
  ok(bernRow.dataset.dutyKind==='off','her row is an off row',bernRow.dataset.dutyKind);
  ok(/At home/.test(bernRow.textContent),'her row says At home',bernRow.textContent.replace(/\s+/g,' ').trim());
  ok(!/On day duty/.test(bernRow.textContent),'and never “On day duty”');
  const onDutyRows=dutyRows.filter(r=>/on-duty-now|day|night|daynight/.test(r.dataset.dutyKind));
  ok(!onDutyRows.some(r=>/Bernadette/.test(r.textContent)),'she is not counted among the people on duty');
  const chips=card.querySelector('.row.wrap')?card.querySelector('.row.wrap').textContent:'';
  ok(new RegExp('(\\d+) on duty').test(chips),'the card still prints a count',chips.replace(/\s+/g,' ').trim());

  /* ── a marked cell still works, and OFF still reads at home ────────── */
  w.eval(`LS.store.commit(d=>{ const p=d.workingPlans['${mk}'].primary;
    p.staff.find(s=>s.name==='Bernadette MUHAWENIMANA').codes[${idx}]='D';
  },{action:'test.day'});`);
  st=S.shiftState(bern,today);
  ok(st.kind==='day'&&/On duty/.test(st.label),'a D cell puts her back on day duty',st.label);
  ok(S.isOnDuty(bern,today)===true,'and back in the on-duty list');

  w.eval(`LS.store.commit(d=>{ const p=d.workingPlans['${mk}'].primary;
    p.staff.find(s=>s.name==='Bernadette MUHAWENIMANA').codes[${idx}]='OFF';
  },{action:'test.off'});`);
  ok(S.shiftState(bern,today).label==='At home','an OFF cell also reads At home');

  /* ── someone the plan never listed ──────────────────────────────────────
     Jeanne Claudine is on the October plan since she arrived on the 6th, so the
     case is made here rather than assumed: a row taken off the month must read
     as “at home”, and say that it is a blank, not a decision. */
  const marie=S.staffByName('Jeanne Claudine UWAYISABA');
  if(marie){
    ok(!!S.planRowFor(marie,today),'she is on the October plan she joined');
    const rowBack=JSON.stringify(S.planForMonth(mk).staff.find(r=>r.name===marie.name));
    w.eval(`LS.store.commit(d=>{ const p=d.workingPlans['${mk}'].primary;
      p.staff=p.staff.filter(r=>r.name!=='Jeanne Claudine UWAYISABA'); },{action:'test.unlisted'});`);
    const ms=S.shiftState(marie,today);
    ok(ms.kind==='off','a person the plan never listed is at home too',JSON.stringify(ms));
    ok(ms.blank===true,'and says so, so the omission can be seen',String(ms.blank));
    w.eval(`LS.store.commit(d=>{ d.workingPlans['${mk}'].primary.staff.push(${rowBack});
      d.workingPlans['${mk}'].primary.staff=d.workingPlans['${mk}'].primary.staff; },{action:'test.restore'});`);
  }

  /* ── no plan for the day: the contract may speak again ────────────── */
  const far='2027-06-15';
  ok(!S.planCovers(far),'no plan covers that day');
  const farState=S.shiftState(kelvin,far);
  ok(farState.source==='pattern','without a plan the contract pattern is the source',farState.source);

  /* ── leave still wins over everything ─────────────────────────────── */
  const aurelie=S.staffByName('Aurelie YANSONEYE');
  ok(['leave','off'].indexOf(S.shiftState(aurelie,today).kind)>=0,'leave is unaffected');

  /* ── the leave screen explains the same thing ─────────────────────── */
  await go('#/leave');
  const txt=doc.body.textContent.replace(/\s+/g,' ');
  ok(/At home/.test(txt),'the leave screen names people as At home');

  done('home52');
})();
