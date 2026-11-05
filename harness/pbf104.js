/* v6.9.105 — "no scores still": the marks are in the shared copy, not on the device.
   The recovery lifts the PBF visits out of the shared copy on their own, without
   replacing the rest of the register, and the sync loop can now see that a device has
   fewer records than the copy it was given. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms||200));
const click=el=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));

(async()=>{
  const {w,go,errors}=await boot('#/pbf');
  const S=w.LS.store, SY=w.LS.sync, P=w.LS.modules.pbf, doc=w.document, U=w.LSU;
  ok(!errors.length,'the console boots clean',errors.join(' | '));

  /* ── what a device that lost its marks looks like ──────────────────── */
  const questions=(S.db().pbfQuestions||[]).slice();
  const fullVisits=(S.db().pbfVisits||[]).map(v=>JSON.parse(JSON.stringify(v)));
  const markedAnswers={};
  (questions.filter(q=>!q.deleted)).forEach(q=>{ markedAnswers[q.id]=+q.max||0; });
  const visitId='shared-visit-coko';
  const sharedDoc={
    pbfQuestions:JSON.parse(JSON.stringify(questions)),
    pbfDomains:JSON.parse(JSON.stringify(S.db().pbfDomains||[])),
    pbfSchedule:[],
    pbfVisits:[
      {id:visitId,hcName:'Coko HC',quarter:'Q1',fy:U.fyLabel(),date:'2026-10-21',assessor:'Kelvin SAMAHANI',
       answers:Object.assign({},markedAnswers),note:'',recommendations:'Bring the TAT down',pending:false},
      {id:'shared-visit-empty',hcName:'Minazi HC',quarter:'Q1',fy:U.fyLabel(),date:'2026-10-22',assessor:'Kelvin SAMAHANI',
       answers:{},note:'Supervision visit recorded — question marks still to be entered',pending:true}
    ],
    samples:[],staff:[]
  };

  /* the device now holds visits with no marks, exactly as reported */
  S.commit(d=>{
    d.pbfVisits=(d.pbfVisits||[]).map(v=>Object.assign({},v,{answers:{},qids:undefined,qmax:undefined,pending:true}));
    d.pbfSchedule=(d.pbfSchedule||[]).filter(x=>x.quarter!=='Q1');
  },{action:'test.wipe',entity:'pbf',detail:'simulate a device without marks'});
  ok(SY.pbfMarks()===0,'the device holds no PBF marks',String(SY.pbfMarks()));

  await go('#/pbf'); await tick(500);
  const card=doc.querySelector('#pbfRecover');
  ok(!!card,'the screen says why there are no scores instead of showing empty rows');
  ok(/No PBF marks on this device/.test(card.textContent),'with a plain title');
  ok(!!doc.querySelector('[data-pbf-recover]'),'and one press to bring them back');
  const rows=doc.querySelectorAll('[data-pbf-row]').length;
  ok(rows>0,'the health centres are still listed');
  ok(!/\d+%/.test(doc.querySelector('#pbfBody').textContent.replace(/\s/g,'')),'with no invented index — every centre reads a dash');

  /* ── the recovery itself ──────────────────────────────────────────── */
  const before=SY.pbfMarks();
  const res=await SY.recoverPbf({data:sharedDoc,revision:7,updated_at:'2026-10-30T16:30:01Z',updated_by:'Kelvin SAMAHANI'});
  ok(res.ok===true,'the marks come back from the shared copy',res.reason);
  ok(res.added+res.filled===1,'one supervision is brought back, not a duplicate of the one already listed');
  ok(res.filled===1,'by filling the visit this device already had listed without marks');
  ok(res.marksAdded>=Object.keys(markedAnswers).length,'every mark in the shared copy is carried over ('+res.marksAdded+')');
  ok(SY.pbfMarks()>before,'the device now holds marks',before+' → '+SY.pbfMarks());
  ok(SY.pbfMarks()===res.after,'and the answer it reports is what is stored');

  const cokos=(S.db().pbfVisits||[]).filter(v=>v.hcName==='Coko HC'&&String(v.quarter)==='Q1');
  ok(cokos.length===1,'the centre holds one Q1 supervision, not a placeholder beside a real one',String(cokos.length));
  const coko=cokos[0];
  ok(!!coko,'the recovered visit is in the register');
  ok(coko.date==='2026-10-21','dated as the shared copy recorded it',coko.date);
  ok(P.marks(coko).complete===true,'it is complete, so it scores');
  ok(P.marks(coko).pct===100,'at the index its marks give: '+P.marks(coko).pct+'%');
  ok(P.marks(coko).total===questions.filter(q=>!q.deleted).length,'scored on the questions the shared copy marked it on');

  /* the empty visit in the shared copy is not a score, and is not pretended to be one */
  ok(!(S.db().pbfVisits||[]).some(v=>v.id==='shared-visit-empty'),'a visit with no marks is not carried over as a score');

  const audit=(S.db().audit||[]).find(a=>a.action==='pbf.recover');
  ok(!!audit,'the recovery is written to the audit trail',audit&&audit.detail);
  ok(/marks/.test(audit.detail),'and the detail counts the marks',audit.detail);

  /* a plan slot now records that the visit happened */
  const slot=(S.db().pbfSchedule||[]).find(x=>x.hcName==='Coko HC');
  ok(!!slot&&slot.status==='visited','the plan shows the visit as made');

  /* ── running it again changes nothing ─────────────────────────────── */
  const again=await SY.recoverPbf({data:sharedDoc,revision:7});
  ok(again.ok===true,'pressing it a second time is harmless');
  ok(again.added===0&&again.filled===0,'because there is nothing left to bring back');

  /* ── a device visit that already has marks is never overwritten ───── */
  const own={id:'own-visit',hcName:'Rushashi HC',quarter:'Q1',fy:U.fyLabel(),date:'2026-10-29',
    assessor:'Kelvin SAMAHANI',answers:Object.assign({},markedAnswers),pending:false};
  S.commit(d=>{ d.pbfVisits.unshift(own); },{action:'test.add',entity:'pbf',detail:'own visit'});
  const other={data:{pbfVisits:[Object.assign({},own,{answers:{},recommendations:'from the cloud'})],pbfQuestions:questions},revision:8};
  const keep=await SY.recoverPbf(other);
  ok(keep.ok===true,'a shared copy with an emptier version of a marked visit is read');
  ok(P.marks((S.db().pbfVisits||[]).find(v=>v.id==='own-visit')).complete===true,'and the marks on this device are untouched');

  /* ── a question the device no longer has keeps the mark’s maximum ─── */
  const missingId='q-from-shared-copy';
  S.commit(d=>{ d.pbfQuestions=d.pbfQuestions.filter(q=>q.id!==missingId); });
  const legacy={data:{pbfVisits:[{id:'legacy-visit',hcName:'Nyange HC',quarter:'Q1',date:'2026-10-21',
      assessor:'Kelvin SAMAHANI',answers:Object.assign({},markedAnswers,{[missingId]:2}),pending:false}],
    pbfQuestions:[{id:missingId,max:2,text:'A question only the shared copy still has',domain:'quality',active:true}]},revision:9};
  const rec=await SY.recoverPbf(legacy);
  ok(rec.ok===true,'a visit whose question bank moved on is still recoverable');
  ok(rec.questionsAdded===1,'the missing question is restored to the bank');
  const restored=(S.db().pbfQuestions||[]).find(q=>q.id===missingId);
  ok(!!restored&&restored.deleted===true,'as retired, so it is not put back on the printed form');
  const legacyVisit=(S.db().pbfVisits||[]).find(v=>v.id==='legacy-visit');
  ok(P.marks(legacyVisit).complete===true,'and the marks it carried still count');
  ok(P.questions().every(q=>q.id!==missingId),'the form the assessor sees is unchanged');

  /* ── the screen now shows the scores ──────────────────────────────── */
  await go('#/pbf'); await tick(600);
  ok(!doc.querySelector('#pbfRecover'),'the "no marks" card is gone once the marks are back');
  const body=doc.querySelector('#pbfBody').textContent;
  ok(/100%/.test(body),'and the table carries the recovered index');

  /* ── the sync loop can see that a device lost records ─────────────── */
  const counts=SY.tally(S.db());
  w.localStorage.setItem('labSystems.syncState.v1',JSON.stringify({lastRevision:1,appliedCounts:counts}));
  ok(SY.losses().total===0,'a device that still holds what it was given reports no loss');
  S.commit(d=>{ d.pbfVisits=(d.pbfVisits||[]).slice(0,1); },{action:'test.trim',entity:'pbf',detail:'simulate loss'});
  const lost=SY.losses();
  ok(lost.total>0,'a device that has lost records reports the loss',JSON.stringify(lost.parts));
  ok(lost.parts.pbfVisits>0,'naming the register that lost them');
  ok(lost.parts.pbfMarks>0,'and the marks inside it');
  ok(SY.applyRemote&&typeof SY.applyRemote==='function','the pull that repairs it is the one the sync loop uses');

  ok(!errors.length,'no error was raised anywhere',errors.slice(0,2).join(' | '));
  done('pbf104');
})();
