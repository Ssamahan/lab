/* v6.9.40 — the eleven-item batch: leave days, no Briefing, cards that fit their
   data, five tests that are never referred, TAT from reception, a bottle per blood
   culture and no invented consumption, honest monthly ceilings, and a roster that
   reads the working plan for its nights. */
const {boot,ok,done}=require('./env');
const click=(el)=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||180));

(async()=>{
  const {w,go}=await boot('#/dash');
  const doc=w.document, S=()=>w.LS.store, db=()=>w.LS.store.db();

  /* ── 2 · Briefing is gone from the dashboard ───────────────────────── */
  ok(!doc.querySelector('[data-hero-export]'),'no Briefing button on the dashboard');
  ok(!/Briefing/.test(doc.querySelector('#app').textContent),'and the word is not on the screen');
  ok(!w.LS.modules.dash.exportBriefing,'the briefing exporter is gone');

  /* ── 3 · the worklist and the feed take half a row, not the whole ─── */
  const flow=doc.querySelector('#dashFlow');
  const cards=[...flow.children];
  const spanOf=(el)=>(el.style.gridColumn||'').replace('span ','');
  const work=cards.find(c=>/Priority worklist/.test(c.textContent));
  const feed=cards.find(c=>/Live activity/.test(c.textContent));
  ok(!!work&&!!feed,'both cards are on the dashboard');
  const cols=+flow.dataset.cols;
  ok(Math.round(cols/2)===+spanOf(work),'the worklist takes half the row ('+spanOf(work)+' of '+cols+')');
  ok(Math.round(cols/2)===+spanOf(feed),'and so does the live activity ('+spanOf(feed)+' of '+cols+')');
  ok(!cards.some(c=>c.getAttribute('data-span')==='full'),'nothing is pinned to the full width any more');

  /* ── 4 · five tests are never referred ─────────────────────────────── */
  const gone=['CBC (Full Blood Count)','Malaria RDT','Blood Slide for Malaria','Fasting Blood Glucose','Sputum AFB (Ziehl-Neelsen)'];
  const names=db().catalog.tests.map(t=>t.name);
  ok(gone.every(n=>names.indexOf(n)<0),'the five are off the referral menu');
  ok(db().samples.every(s=>gone.indexOf(s.test)<0 && !(s.tests||[]).some(t=>gone.indexOf(t)>=0)),'and no stored order still carries one');
  ok(names.filter(n=>/Blood Culture|TB Culture|Viral Load|Hepatitis/.test(n)).length>=3,'the real menu is still there');

  /* ── 5 · TAT starts at reception, and reception has a time ─────────── */
  await go('#/samples');
  /* the reception stamp is taken from the clock, not from a fixed hour, so the
     test says the same thing at 09:00 and at 17:00 */
  const ago=new Date(Date.now()-30*60000), pz=n=>String(n).padStart(2,'0');
  const stamp=ago.getFullYear()+'-'+pz(ago.getMonth()+1)+'-'+pz(ago.getDate())+'T'+pz(ago.getHours())+':'+pz(ago.getMinutes());
  w.eval(`LS.store.commit(d=>{
    d.samples.push({id:'rx1',sampleId:'BC261001A101',patientName:'Mukamana Alice',patientId:'4301',sex:'Female',age:'9',
      dob:'',test:'Blood Culture',testCode:'BC',cat:'General',hospital:'CHUK',healthFacility:'Coko HC',
      collectionDate:LSU.addDays(LSU.todayISO(),-3), collectionAt:LSU.addDays(LSU.todayISO(),-3)+'T08:00',
      receivedAt:'${stamp}', sentDate:LSU.todayISO(), resultedAt:null, status:'Received',
      priority:'Routine', tatTargetDays:4, collector:'Coko HC', source:'register', manifestId:null,
      tests:['Cytology','Gram Stain','Blood Culture']});
    d.samples.push({id:'rx2',sampleId:'BC261001A102',patientName:'Habimana Jean',patientId:'4302',sex:'Male',age:'40',
      dob:'',test:'Blood Culture',testCode:'BC',cat:'General',hospital:'CHUK',healthFacility:'Coko HC',
      collectionDate:LSU.addDays(LSU.todayISO(),-9), collectionAt:LSU.addDays(LSU.todayISO(),-9)+'T08:00',
      receivedAt:null, sentDate:null, resultedAt:null, status:'Registered',
      priority:'Routine', tatTargetDays:4, collector:'Coko HC', source:'register', manifestId:null,
      tests:['Cytology','Gram Stain','Blood Culture']});
  },{action:'test.reception'})`);
  await go('#/samples'); await tick(300);
  const rx1=db().samples.find(s=>s.id==='rx1'), rx2=db().samples.find(s=>s.id==='rx2');
  const t1=S().tatFor(rx1), t2=S().tatFor(rx2);
  ok(t1.started&&t1.startFrom==='reception','a received sample counts from its reception stamp');
  ok(t1.elapsedH<2,'three days of collection time no longer count against the lab ('+t1.elapsedH.toFixed(1)+'h)');
  ok(!t1.breached,'and it is not shown as a breach');
  ok(t2.awaitingReception&&!t2.breached,'a sample that has not arrived is not late, it is awaiting reception');
  ok(!t2.started,'its clock has not started');
  const row2=[...doc.querySelectorAll('#smpBody tr[data-row]')].find(tr=>tr.dataset.row==='rx2');
  ok(/awaiting reception/.test(row2.textContent),'the list says so instead of a countdown');
  /* an older record with no stamp but a dispatch date keeps its clock running */
  w.eval(`LS.store.commit(d=>{ d.samples.push({id:'old1',sampleId:'TB250101A001',patientName:'Legacy Row',patientId:'9001',
    sex:'Male',age:'34',test:'TB Culture',testCode:'TB',cat:'General',hospital:'NRL',healthFacility:'Ruli HC',
    collectionDate:LSU.addDays(LSU.todayISO(),-20),collectionAt:LSU.addDays(LSU.todayISO(),-20)+'T09:00',
    receivedAt:null,sentDate:LSU.addDays(LSU.todayISO(),-19),resultedAt:null,status:'Pending',
    priority:'Routine',tatTargetDays:21,collector:'Reception',source:'register',manifestId:null,tests:['TB Culture']}); },{action:'test.legacy'});`);
  const old1=S().tatFor(db().samples.find(s=>s.id==='old1'));
  ok(old1.started&&old1.startFrom==='collection'&&!old1.awaitingReception,'a legacy record with a dispatch date still runs its clock');
  /* the wizard carries both fields */
  click([...doc.querySelectorAll('[data-new]')][0]); await tick(250);
  doc.querySelector('#wPid').value='4309';
  click(doc.querySelector('[data-wnext]')); await tick(200);
  click(doc.querySelector('[data-test]')); await tick(120);
  click(doc.querySelector('[data-wnext]')); await tick(260);
  ok(!!doc.querySelector('#wRecv'),'the register wizard asks for the reception date');
  ok(!!doc.querySelector('#wRecvT'),'and the reception time');
  ok(doc.querySelector('#wRecvT').value.match(/^\d\d:\d\d$/),'with the clock already in it',doc.querySelector('#wRecvT').value);
  const recv=doc.querySelector('#wRecv'); recv.value=w.LSU.addDays(w.LSU.todayISO(),-1);
  doc.querySelector('#wRecvT').value='07:45';
  click(doc.querySelector('[data-wnext]')); await tick(400);
  const made=db().samples.filter(s=>String(s.receivedAt||'').indexOf('T07:45')>=0);
  ok(made.length===1,'a registered sample stores the reception date and time it was given');
  ok(/^Received$/.test(made[0].status),'and is marked received');

  /* the drawer can correct both */
  const drawerTarget=db().samples.find(s=>s.id==='rx2');
  w.eval(`LS.modules.samples._openForTest && LS.modules.samples._openForTest('rx2')`);
  await go('#/samples'); await tick(200);
  const tr=[...doc.querySelectorAll('#smpBody tr[data-row]')].find(r=>r.dataset.row==='rx2');
  click(tr.querySelector('[data-edit]')); await tick(240);
  ok(!!doc.querySelector('#edRecv')&&!!doc.querySelector('#edRecvT'),'the record editor has reception date and time');
  doc.querySelector('#edRecv').value=w.LSU.todayISO();
  doc.querySelector('#edRecvT').value='11:15';
  click(doc.querySelector('[data-save]')); await tick(400);
  ok(String(db().samples.find(s=>s.id==='rx2').receivedAt).indexOf('T11:15')>0,'correcting reception re-stamps the clock');

  /* ── 7 · one bottle per blood culture, and deleting gives it back ──── */
  const cid=db().catalog.consumables.find(c=>/blood culture/i.test(c.name)).id;
  const onHand=()=>Math.round(w.LS.store.onHand(cid)*100)/100;
  const before=onHand();
  w.eval(`LS.store.commit(d=>{
    d.samples.push({id:'bcn1',sampleId:'BC261001A201',patientName:'Bebe Neonate',patientId:'4401',sex:'Female',age:'0',
      test:'Blood Culture',testCode:'BC',cat:'General',hospital:'CHUK',healthFacility:'Ruli DH',
      collectionDate:LSU.todayISO(),receivedAt:LSU.nowISO(),status:'Received',priority:'STAT',tatTargetDays:4,
      collector:'Reception',source:'register',manifestId:null,tests:['Cytology','Gram Stain','Blood Culture']});
  },{action:'test.bottle'});`);
  w.eval(`LS.store.commit(d=>{ const s=d.samples.find(x=>x.id==='bcn1'); LS.store.drawBottle(d,s); },{action:'test.draw'});`);
  ok(onHand()===before-1,'a blood culture takes exactly one bottle ('+before+' → '+onHand()+')');
  const last=db().stock.entries[db().stock.entries.length-1];
  ok(last.type==='used'&&last.qty===1,'the movement is one used bottle');
  ok(/Pediatric/i.test(last.ageGroup||''),'a nine-year-old (or a neonate) gets the paediatric bottle',last.ageGroup);
  const adultBefore=onHand();
  w.eval(`LS.store.commit(d=>{
    d.samples.push({id:'bcn2',sampleId:'BC261001A202',patientName:'Grown Up',patientId:'4402',sex:'Male',age:'41',
      test:'Blood Culture',testCode:'BC',cat:'General',hospital:'CHUK',healthFacility:'Ruli DH',
      collectionDate:LSU.todayISO(),receivedAt:LSU.nowISO(),status:'Received',priority:'Routine',tatTargetDays:4,
      collector:'Reception',source:'register',manifestId:null,tests:['Cytology','Gram Stain','Blood Culture']});
    const s=d.samples.find(x=>x.id==='bcn2'); LS.store.drawBottle(d,s);
  },{action:'test.draw2'});`);
  const adultEntry=db().stock.entries[db().stock.entries.length-1];
  ok(/Adult/.test(adultEntry.ageGroup||''),'an adult patient gets the adult bottle',adultEntry.ageGroup);
  ok(onHand()===adultBefore-1,'and only one bottle again');
  /* an ordinary order draws nothing */
  const beforePlain=onHand();
  w.eval(`LS.store.commit(d=>{
    d.samples.push({id:'tb1',sampleId:'TB261001A301',patientName:'TB Case',patientId:'4501',sex:'Male',age:'30',
      test:'TB Culture',testCode:'TB',cat:'General',hospital:'NRL',healthFacility:'Ruli DH',
      collectionDate:LSU.todayISO(),receivedAt:LSU.nowISO(),status:'Received',priority:'Routine',tatTargetDays:21,
      collector:'Reception',source:'register',manifestId:null,tests:['TB Culture']});
    LS.store.drawBottle(d,d.samples.find(x=>x.id==='tb1'));
  },{action:'test.nobottle'});`);
  ok(onHand()===beforePlain,'a TB culture draws no blood-culture bottle');
  /* deleting the order puts the bottle back */
  w.eval(`LS.store.commit(d=>{ d.samples=d.samples.filter(x=>x.id!=='bcn2'); LS.store.restoreBottle(d,'bcn2'); },{action:'test.delete'});`);
  ok(onHand()===beforePlain+1,'deleting the order returns its bottle');
  ok(!db().stock.entries.some(e=>e.sampleId==='bcn2'),'and leaves no ghost movement behind');

  /* ── 8 · the ceilings are the department's own ─────────────────────── */
  const capOf=(re)=>db().catalog.consumables.find(c=>re.test(c.name));
  const eid=capOf(/hiv[- ]?eid/i), vtm=capOf(/vtm|viral transport/i), bc=capOf(/blood culture/i);
  ok(eid&&eid.monthlyCap===3,'HIV-EID is capped at three cartridges a month');
  ok(vtm&&vtm.monthlyCap===5,'VTM is capped at five vials a month');
  ok(vtm.transfersExempt,'and transfers to health centres are counted apart');
  ok(bc.monthlyCap===3&&bc.capSplit&&bc.capSplit['Pediatric/Neonatal']===2&&bc.capSplit.Adult===1,
     'blood culture is two paediatric bottles and one adult');
  const ov=S().stockOverview();
  const bcRow=ov.find(x=>x.id===bc.id);
  ok(bcRow.byAge&&bcRow.byAge.length===2,'the stock screen knows the split');
  ok(typeof bcRow.usedMonth==='number','and counts the month it is standing in');

  /* ── 1 · leave: days field drives the end date ────────────────────── */
  await go('#/leave'); await tick(250);
  const newPlan=[...doc.querySelectorAll('[data-newplan]')][0];
  ok(!!newPlan,'the leave book can add a plan');
  click(newPlan); await tick(220);
  const days=doc.querySelector('#plDays'), from=doc.querySelector('#plFrom'), to=doc.querySelector('#plTo');
  ok(!!days,'the plan form has a Number of days field');
  from.value='2026-11-10'; from.dispatchEvent(new w.Event('change',{bubbles:true}));
  days.value='5'; days.dispatchEvent(new w.Event('input',{bubbles:true}));
  await tick(120);
  ok(to.value==='2026-11-14','five days starting on the 10th ends on the 14th',to.value);
  to.value='2026-11-20'; to.dispatchEvent(new w.Event('change',{bubbles:true}));
  await tick(80);
  ok(days.value==='11','moving the end date recalculates the days',days.value);
  click(doc.querySelector('[data-close]')); await tick(150);
  await go('#/leave?tab=requests'); await tick(300);
  click([...doc.querySelectorAll('[data-new]')][0]); await tick(240);
  ok(!!doc.querySelector('#lvDays'),'the leave request form has the same field');
  const lvFrom=doc.querySelector('#lvFrom'), lvTo=doc.querySelector('#lvTo'), lvDays=doc.querySelector('#lvDays');
  lvFrom.value='2026-11-02'; lvFrom.dispatchEvent(new w.Event('change',{bubbles:true}));
  lvDays.value='3'; lvDays.dispatchEvent(new w.Event('input',{bubbles:true}));
  await tick(120);
  ok(lvTo.value==='2026-11-04','three days from the 2nd ends on the 4th',lvTo.value);
  click(doc.querySelector('[data-close]')); await tick(150);

  /* ── 10 · the roster reads the working plan for its nights ────────── */
  await go('#/roster'); await tick(300);
  click([...doc.querySelectorAll('[data-view]')].find(b=>b.dataset.view==='week')); await tick(400);
  const cells=[...doc.querySelectorAll('[data-night]')];
  ok(cells.length===7,'the weekly roster has a night for every day');
  const cellA=cells.find(td=>/plan/.test(td.textContent));
  ok(!!cellA,'at least one night is named straight from the working plan');
  const planName=(iso)=>{
    const p=db().workingPlans[iso.slice(0,7)];
    if(!p||!p.primary) return '';
    const i=p.primary.dates.indexOf(iso);
    const row=p.primary.staff.find(s=>['N','DN'].indexOf((s.codes||[])[i])>=0);
    return row?row.name:'';
  };
  let matched=0, planned=0;
  cells.forEach(td=>{ const n=planName(td.dataset.night); if(n){ planned++; if(td.textContent.indexOf(n.split(' ')[0])>=0) matched++; } });
  ok(planned>0,'the displayed week is covered by a plan ('+planned+' nights)');
  ok(matched===planned,'every planned night shows the planned person ('+matched+'/'+planned+')');
  /* a day+night code counts as a night too */
  w.eval(`LS.store.commit(d=>{
    const k='2027-02';
    d.workingPlans[k]={versions:[],primary:{label:'February 2027',dates:LSU.monthRange(k),
      staff:[{name:'Aurelie YANSONEYE',codes:LSU.monthRange(k).map(iso=>LSU.dow(iso)>=5?'DN':'OFF')},
             {name:'Jean Paul NSENGIYUMVA',codes:LSU.monthRange(k).map(iso=>LSU.dow(iso)===0?'N':'D')}],
      meta:{period:'February 2027',official:false}}};
  },{action:'test.plan'});`);
  const dn=S().nightCover('2027-02-06');
  ok(dn.name==='Aurelie YANSONEYE'&&dn.code==='DN','a day+night code names the person on nights',dn.name);
  ok(dn.source==='plan','and the roster labels where the name came from');
  const manual=S().nightCover('2027-02-06');
  const wkStart=S().weekStart('2027-02-06');
  w.eval(`LS.store.commit(d=>{ d.unitRosters=d.unitRosters||{}; d.unitRosters['${wkStart}']=d.unitRosters['${wkStart}']||{weekStart:'${wkStart}',assignments:{}}; d.unitRosters['${wkStart}'].night={'2027-02-06':'Patrick ISHIMWE'}; },{action:'test.override'});`);
  const over=S().nightCover('2027-02-06');
  ok(over.name==='Patrick ISHIMWE'&&over.source==='manual','a night entered by hand still overrides the plan');

  /* ── 9 · only the two named people hold three-night blocks ────────── */
  const staff=db().staff.filter(s=>s.threeNight).map(s=>s.name).sort();
  ok(staff.length===2,'exactly two people can hold a three-night block ('+staff.join(', ')+')');
  ok(staff.some(n=>/Patrick/.test(n))&&staff.some(n=>/Jean Paul/.test(n)),'they are Patrick and Jean Paul');
  ok((db().staff.find(s=>/Patrick/.test(s.name)).nightRank||9)<(db().staff.find(s=>/Jean Paul/.test(s.name)).nightRank||9),
     'Patrick is first in line for the block');
  ok(db().staff.filter(s=>!s.threeNight).every(s=>!s.threeNight||(s.maxConsecN||0)>=3),
     'and nobody else is flagged for three');
  /* a generated month obeys it */
  w.eval(`LS.store.commit(d=>{ d.workingPlans['2027-03']={versions:[],primary:LS.store.buildPlan('2027-03')}; },{action:'test.gen'});`);
  const p3=db().workingPlans['2027-03'].primary;
  const runs={};
  p3.staff.forEach(row=>{
    let run=0;
    (row.codes||[]).forEach(c=>{ if(c==='N'||c==='DN'){ run++; runs[row.name]=Math.max(runs[row.name]||0,run); } else run=0; });
  });
  const threeNames=Object.keys(runs).filter(n=>runs[n]>=3);
  ok(threeNames.every(n=>/Patrick|Jean Paul/.test(n)),'a generated month gives three-in-a-row only to those two ('+threeNames.join(', ')+')');
  ok(!Object.keys(runs).some(n=>runs[n]>3),'and never four in a row');

  /* ── 6 · the referred-samples screen fills the page ────────────────── */
  await go('#/samples'); await tick(250);
  const wrap=doc.querySelector('#smpTableWrap');
  ok(!!wrap,'the register takes the full width of the screen');
  ok(!doc.querySelector('#smpView .c8'),'no longer squeezed into eight of twelve columns');
  const side=doc.querySelectorAll('#smpView .grid-12 > .c4');
  ok(side.length===3,'the three small cards sit in one row under it ('+side.length+')');
  const tat=Array.from(doc.querySelectorAll('#smpView .card')).find(c=>/TAT compliance by receiving laboratory/.test(c.textContent));
  ok(!!tat,'the TAT-by-laboratory table is on the screen');
  ok(!!tat && !tat.closest('.fit-card'),'and no longer sits alone in a narrow fit-to-content box');
  const css=require('fs').readFileSync(require('path').resolve(__dirname,'..','assets/css/modules.css'),'utf8');
  const appcss=require('fs').readFileSync(require('path').resolve(__dirname,'..','assets/css/app.css'),'utf8');
  ok(/\.card\{display:flex;flex-direction:column\}/.test(appcss),'a card fills the row it sits in');
  ok(/\.card-foot\{margin-top:auto\}/.test(appcss),'so a short card has no blank block under its foot');
  ok(/\.duty-fill\{[^}]*height:auto/.test(css)&&/\.feed-fill\{[^}]*height:auto/.test(css),
     'and the list cards no longer stretch to fill a tall neighbour');

  done('batch40');
})().catch(e=>{ console.error(e); process.exit(1); });
