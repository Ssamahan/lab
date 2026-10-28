/* v6.9.54 — an analyser sent off site cannot be recorded without the day it left.
   The status change asks for the shipment date, the return date closes the same case,
   and the register then answers "how many days did the repair take". */
const {boot,ok,done}=require('./env');
const click=(el)=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||220));
const setVal=(el,v)=>{ el.value=v; el.dispatchEvent(new el.ownerDocument.defaultView.Event('change',{bubbles:true})); el.dispatchEvent(new el.ownerDocument.defaultView.Event('input',{bubbles:true})); };

(async()=>{
  const {w,go}=await boot('#/equipment');
  const doc=w.document, U=w.LSU, S=w.LS.store;
  const mod=()=>doc.querySelector('.modal');

  /* a clean primary analyser with no off-site case */
  const eq=S.db().equipment.find(e=>e.role!=='backup'&&!((e.services||[]).some(s=>s.shippedOn&&!s.returnedOn)));
  ok(!!eq,'there is an analyser in service to work with');

  /* ── the form ─────────────────────────────────────────────────────── */
  await go('#/equipment');
  click([...doc.querySelectorAll('[data-e-tab]')].find(b=>b.dataset.eTab==='pm'));
  await tick(260);
  const editBtn=[...doc.querySelectorAll('[data-editeq]')].find(b=>b.dataset.editeq===eq.id);
  ok(!!editBtn,'the preventive table has an edit button for it');
  click(editBtn); await tick(320);
  ok(!!mod(),'the equipment form opens');

  const wrap=()=>doc.getElementById('eqOffsiteWrap');
  ok(!!wrap(),'the form carries an off-site block');
  ok(wrap().style.display==='none','it stays out of the way until the status says off-site');

  /* ── choosing “Off-site repair” asks for the shipment date ────────── */
  const status=doc.getElementById('eqStatus');
  setVal(status,'offsite'); await tick(180);
  ok(wrap().style.display!=='none','choosing Off-site repair reveals it');
  const ship=doc.getElementById('eqShip');
  ok(!!ship,'a shipment date is asked for');
  ok(ship.type==='date','as a date');
  ok(ship.value===U.todayISO(),'defaulted to today',ship.value);
  ok(!!doc.getElementById('eqBackup'),'and a backup analyser can be named');
  ok(/Out for 0 days/.test(doc.getElementById('eqShipHint').textContent),'the hint starts the clock at zero',
    doc.getElementById('eqShipHint').textContent);

  /* a case cannot be opened without the day it left */
  ship.value='';
  click(doc.querySelector('.modal [data-save]')); await tick(260);
  ok(!!mod(),'the form refuses to close without a shipment date');
  ok(!((S.db().equipment.find(e=>e.id===eq.id).services||[]).some(s=>s.shippedOn)),'and no case was written');

  /* ── nine days ago ───────────────────────────────────────────────── */
  const shipped=U.addDays(U.todayISO(),-9);
  setVal(ship,shipped); await tick(140);
  ok(/Out for 9 days/.test(doc.getElementById('eqShipHint').textContent),'the hint counts the days away',
    doc.getElementById('eqShipHint').textContent);
  click(doc.querySelector('.modal [data-save]')); await tick(420);
  ok(!mod(),'the record is saved');

  let rec=S.db().equipment.find(e=>e.id===eq.id);
  ok(rec.status==='offsite','the analyser is off-site',rec.status);
  const kase=(rec.services||[]).find(s=>s.shippedOn&&!s.returnedOn);
  ok(!!kase,'an off-site case exists');
  ok(kase.shippedOn===shipped,'it carries the shipment date that was asked for',kase.shippedOn);
  ok(kase.kind==='curative','and it is a curative case',kase.kind);

  /* ── the fleet and the curative ledger show the days ──────────────── */
  await go('#/equipment'); await tick(200);
  const fleetTxt=[...doc.querySelectorAll('[data-eq]')].map(c=>c.textContent.replace(/\s+/g,' ')).join(' | ');
  ok(/9 days out/.test(fleetTxt),'the fleet card says how long it has been away');

  click([...doc.querySelectorAll('[data-e-tab]')].find(b=>b.dataset.eTab==='curative'));
  await tick(300);
  const cur=doc.querySelector('#eqBody').textContent.replace(/\s+/g,' ');
  ok(/9 days out so far/.test(cur),'the curative ledger counts the same days',cur.slice(0,160));
  ok(/Off-site repair/.test(cur),'the case is named in the ledger');

  /* ── returning closes the case and records the repair time ────────── */
  click([...doc.querySelectorAll('[data-return]')].find(b=>b.dataset.return===eq.id));
  await tick(320);
  ok(!!mod(),'the return form opens');
  const rt=doc.getElementById('rtDate');
  ok(!!rt&&rt.min===shipped,'the return cannot precede the shipment',rt&&rt.min);
  ok(/9 days out so far/.test(mod().textContent),'it repeats how long it has been away');
  ok(/Out for 9 days/.test(doc.getElementById('rtDays').textContent),'and shows the repair time it will record',
    doc.getElementById('rtDays').textContent);
  click(doc.querySelector('.modal [data-save]')); await tick(420);

  rec=S.db().equipment.find(e=>e.id===eq.id);
  ok(rec.status!=='offsite','it is no longer off site',rec.status);
  const closed=(rec.services||[]).find(s=>s.shippedOn&&s.returnedOn);
  ok(!!closed,'the case is closed');
  ok(!((rec.services||[]).some(s=>s.shippedOn&&!s.returnedOn)),'nothing is left dangling open');
  ok(closed.returnedOn===U.todayISO(),'with today as the return date',closed.returnedOn);
  ok(closed.awayDays===9||closed.repairDays===9,'the repair time is stored on the case',closed.awayDays);

  await go('#/equipment');
  click([...doc.querySelectorAll('[data-e-tab]')].find(b=>b.dataset.eTab==='curative'));
  await tick(300);
  const cur2=doc.querySelector('#eqBody').textContent.replace(/\s+/g,' ');
  ok(/9 days to repair/.test(cur2),'the ledger says how long the repair took');
  ok(/Repaired in 9 days on average across 1 returned case/.test(cur2),'and the turnaround average is drawn from it',
    (cur2.match(/Repaired in[^.]*\./)||[''])[0]);

  /* ── the drawer carries the same number ──────────────────────────── */
  click([...doc.querySelectorAll('[data-e-tab]')].find(b=>b.dataset.eTab==='fleet'));
  await tick(300);
  const card=doc.querySelector('[data-eq="'+eq.id+'"]');
  ok(!!card,'the fleet card is back');
  click(card);
  await tick(320);
  const draw=(doc.querySelector('.drawer')||{}).textContent||'';
  ok(/repair took 9 days/.test(draw),'the asset history says the repair took 9 days',
    (draw.match(/repair took[^·]*/)||[''])[0]);
  w.LS.ui.closeAll&&w.LS.ui.closeAll(); await tick(200);

  /* ── leaving off-site from the edit form must give a return date ─── */
  const eq2=S.db().equipment.find(e=>e.role!=='backup'&&e.id!==eq.id);
  w.LS.store.commit(d=>{ const x=d.equipment.find(y=>y.id===eq2.id);
    x.services=x.services||[]; x.status='offsite';
    x.services.push({id:'svcX',date:U.addDays(U.todayISO(),-20),kind:'curative',type:'Off-site repair',
      shippedOn:U.addDays(U.todayISO(),-20),hours:0,note:'test',source:'status'}); },{action:'test.open'});
  await go('#/equipment');
  click([...doc.querySelectorAll('[data-e-tab]')].find(b=>b.dataset.eTab==='pm'));
  await tick(260);
  click([...doc.querySelectorAll('[data-editeq]')].find(b=>b.dataset.editeq===eq2.id));
  await tick(320);
  ok(doc.getElementById('eqShip').value===U.addDays(U.todayISO(),-20),'the form remembers the shipment date');
  setVal(doc.getElementById('eqStatus'),'operational'); await tick(180);
  ok(doc.getElementById('eqReturnWrap').style.display!=='none','leaving off-site asks for the return date');
  const ret=doc.getElementById('eqReturn');
  ok(ret.value===U.todayISO(),'defaulted to today — the day it is back in service');
  ret.value='';
  click(doc.querySelector('.modal [data-save]')); await tick(260);
  ok(!!mod(),'with the date cleared the form refuses to close — a case is never abandoned');
  setVal(ret,U.addDays(U.todayISO(),-4)); await tick(140);
  ok(/after 16 days/.test(doc.getElementById('eqReturnHint').textContent),'the days are counted as the date is chosen',
    doc.getElementById('eqReturnHint').textContent);
  click(doc.querySelector('.modal [data-save]')); await tick(420);
  const r2=S.db().equipment.find(e=>e.id===eq2.id);
  ok(r2.status==='operational','the status changed');
  ok(((r2.services||[]).some(s=>s.shippedOn&&s.returnedOn===U.addDays(U.todayISO(),-4))),'and the case closed on that day');

  done('equipment54');
})();
