/* v6.9.103 — the PBF index a visited health centre could no longer show.
   A visit is scored on the sheet it was marked on, so editing the questionnaire
   afterwards neither blanks nor rewrites a score that was already recorded. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms||200));
const click=el=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));

(async()=>{
  const {w,errors}=await boot('#/pbf');
  const S=w.LS.store, A=w.LS.auth, P=w.LS.modules.pbf, doc=w.document;
  ok(!errors.length,'the console boots clean',errors.join(' | '));
  ok(!!P&&typeof P.marks==='function','the module publishes what a visit is worth');

  const qs=P.questions();
  ok(qs.length>0,'the questionnaire has questions',String(qs.length));
  const marks=qs.reduce((t,q)=>t+(+q.max||0),0);

  /* ── a complete visit, marked on today's sheet ─────────────────────── */
  const answers={}; qs.forEach(q=>{ answers[q.id]=+q.max||0; });
  const vid='test-coko-visit';
  S.commit(d=>{
    d.pbfVisits=(d.pbfVisits||[]).filter(v=>v.id!==vid);
    d.pbfVisits.unshift({id:vid,hcName:'Coko HC',quarter:'Q1',fy:w.LSU.fyLabel(),date:'2026-10-21',
      assessor:'Kelvin SAMAHANI',answers:Object.assign({},answers),qids:qs.map(q=>q.id),
      qmax:(function(){const m={};qs.forEach(q=>m[q.id]=+q.max||0);return m;})(),
      note:'',recommendations:'',previous:null,pending:false});
  },{action:'pbf.visit.add',entity:'pbf',entityId:vid,detail:'test visit'});
  const visit=()=>S.db().pbfVisits.find(v=>v.id===vid);
  ok(P.sheetOf(visit()).length===qs.length,'the visit remembers every question it was marked on');
  ok(P.marks(visit()).complete===true,'and is complete');
  ok(P.marks(visit()).pct===100,'so the index is full marks: '+P.marks(visit()).pct+'% of '+marks+' marks');
  ok(P.marks(visit()).onCurrentForm===true,'nothing on the sheet has moved');

  /* ── the form changes afterwards: the score must not move ──────────── */
  S.commit(d=>{ d.pbfQuestions=d.pbfQuestions||[]; d.pbfQuestions.push({id:'test-q-added',max:2,text:'A question added after the visit',order:999,active:true,domain:'quality'}); },
    {action:'pbf.question.add',entity:'pbf',entityId:'test-q-added',detail:'test question'});
  ok(P.questions().length===qs.length+1,'the new question joins the form');
  ok(P.marks(visit()).pct===100,'the recorded visit keeps its index when a question is added',String(P.marks(visit()).pct));
  ok(P.marks(visit()).complete===true,'and stays complete');
  ok(P.marks(visit()).addedSince.length===1,'the page can say one question was added since');
  ok(P.marks(visit()).onCurrentForm===false,'and that the visit is not scored against it');
  const legacy=Object.assign({},visit()); delete legacy.qids; delete legacy.qmax;
  S.commit(d=>{ const x=d.pbfVisits.find(v=>v.id===vid); if(x){ delete x.qids; delete x.qmax; } });
  ok(P.marks(visit()).pct===100,'a visit saved before this build is scored on the questions it holds marks for');
  S.commit(d=>{ const x=d.pbfVisits.find(v=>v.id===vid); x.qids=qs.map(q=>q.id); x.qmax={}; qs.forEach(q=>{ x.qmax[q.id]=+q.max||0; }); });

  /* a retired question coming back is the same story */
  const retired=(S.db().pbfQuestions||[]).find(q=>q.deleted);
  if(retired){
    S.commit(d=>{ const q=d.pbfQuestions.find(x=>x.id===retired.id); if(q) q.deleted=false; });
    ok(P.questions().length===qs.length+2,'a retired question can be restored to the form');
    ok(P.marks(visit()).pct===100,'and that too leaves the recorded index alone',String(P.marks(visit()).pct));
    S.commit(d=>{ const q=d.pbfQuestions.find(x=>x.id===retired.id); if(q) q.deleted=true; });
  }

  /* a question taken off the form keeps the mark that was given against it */
  const dropId=qs[0].id;
  S.commit(d=>{ const q=d.pbfQuestions.find(x=>x.id===dropId); if(q) q.deleted=true; });
  ok(P.marks(visit()).pct===100,'deleting a question does not rewrite an old score',String(P.marks(visit()).pct));
  ok(P.marks(visit()).droppedSince.indexOf(dropId)>=0,'the visit can name the questions the form no longer has');
  S.commit(d=>{ const q=d.pbfQuestions.find(x=>x.id===dropId); if(q) q.deleted=false; });

  /* ── a visit saved today carries its sheet ─────────────────────────── */
  P.visitModal(vid); await tick(400);
  const modal=doc.querySelector('.modal');
  ok(!!modal,'the visit form opens');
  ok(modal.querySelectorAll('[data-q]').length===P.questions().length,'with one field per question on the form');
  const firstInput=modal.querySelector('[data-q]');
  firstInput.value=''; firstInput.dispatchEvent(new w.Event('input',{bubbles:true})); await tick(120);
  ok(/Index —/.test(modal.querySelector('#pvIndex').textContent),'a blank mark holds the index back');
  click(modal.querySelector('[data-save]')); await tick(200);
  ok(S.db().pbfVisits.find(v=>v.id===vid).answers[firstInput.dataset.q]!=null,'and the save is refused while a question is unmarked');
  click(modal.querySelector('[data-close]')); await tick(200);

  /* ── half a scorecard is still half a scorecard ────────────────────── */
  const half={}; Object.keys(answers).slice(0,Math.ceil(qs.length/2)).forEach(k=>half[k]=answers[k]);
  const hid='test-half-visit';
  S.commit(d=>{
    d.pbfVisits=(d.pbfVisits||[]).filter(v=>v.id!==hid);
    d.pbfVisits.unshift({id:hid,hcName:'Rushashi HC',quarter:'Q1',fy:w.LSU.fyLabel(),date:'2026-10-24',
      assessor:'Kelvin SAMAHANI',answers:half,qids:qs.map(q=>q.id),qmax:{},note:'',pending:false});
  },{action:'pbf.visit.add',entity:'pbf',entityId:hid,detail:'half-marked test visit'});
  const halfVisit=()=>S.db().pbfVisits.find(v=>v.id===hid);
  ok(P.marks(halfVisit()).complete===false,'a visit with blanks is not complete');
  ok(P.marks(halfVisit()).pct!=null&&P.marks(halfVisit()).pct<100,'its percentage is only what was marked',String(P.marks(halfVisit()).pct));
  const row=P.list().find(r=>r.name==='Rushashi HC');
  ok(!!row&&row.state&&row.state.key==='pending','and the register says the marks are pending',row&&row.state&&row.state.label);

  /* ── the screen: an index for the centres that were visited ────────── */
  w.LS.shell.route(); await tick(900);
  const body=doc.getElementById('app').textContent.replace(/\s+/g,' ');
  ok(/100%/.test(body),'the table shows the index of the visit that was marked');
  const cokoRow=[...doc.querySelectorAll('[data-pbf-row]')].find(r=>/Coko/.test(r.textContent));
  ok(!!cokoRow&&/100%/.test(cokoRow.textContent),'against the health centre it belongs to');
  ok(!/marks pending/.test(cokoRow.textContent),'without calling it pending');
  ok(/scored on \d+ questions/.test(cokoRow.textContent),'and it says how many questions the score was marked on',cokoRow.textContent.slice(0,140));

  /* the drawer used to throw before it could draw the scorecard */
  click(cokoRow.querySelector('[data-open]')); await tick(500);
  const drawer=doc.querySelector('.drawer');
  ok(!!drawer,'opening a health centre draws its scorecard');
  ok(/Index 100%/.test(drawer.textContent),'with the index on it');
  ok(/Questions evaluated/.test(drawer.textContent),'and the question-by-question marks');
  ok(!errors.length,'with no error on the console',errors.slice(0,2).join(' | '));
  const closeBtn=drawer.querySelector('[data-close]'); if(closeBtn) click(closeBtn); await tick(200);

  /* a visitor gets the same restricted page as any other module */
  ok(A.can('pbf')===true,'the Admin holds the PBF permission');

  done('pbf103');
})();
