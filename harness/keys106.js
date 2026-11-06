/* v6.9.106 — three reports, one build:
     (1) "Pull failed (401) Invalid API key" — the shared copy must be reachable again,
         and when a key is refused the screen must say which key and why, in a sentence;
     (2) an examination's name must be editable from Settings, and the change must follow
         the name into every sample, target and monthly-return figure that carries it;
     (3) a training recorded while the shared copy was unreachable, and its expenses,
         must reach the cloud without the local record being replaced. */
const fs=require('fs'), path=require('path');
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms||250));
const GOOD='sb_publishable_6OQVktnGsJo_RPpZfGtITQ_pt3NCdgJ';
const TYPO='sb_publishable_60QVktnGsJo_RPPzFGtITQ_pt3NC';   /* what the screenshot looked like */

(async()=>{
  const {w,go}=await boot('#/dash');
  const S=w.LS.store, SY=w.LS.sync, U=w.LSU, doc=w.document;
  const state=()=>SY.state();

  /* a stub project: the real key is accepted, anything else is refused exactly the way
     Supabase refuses it — 401 {"message":"Invalid API key"} */
  const calls=[];
  let remoteDoc={};
  let remoteAt='2026-10-30T16:30:01Z';
  w.fetch=async(url,opts)=>{
    opts=opts||{};
    const key=(opts.headers&&(opts.headers.apikey||opts.headers.apikey))||'';
    const headerKey=opts.headers&&(opts.headers.apikey||opts.headers['apikey']);
    calls.push({url:String(url),method:opts.method||'GET',key:headerKey,body:opts.body});
    const body=opts.body?JSON.parse(opts.body):null;
    if(opts.method==='POST'){ remoteDoc=(body&&body[0]&&body[0].data)||remoteDoc;
      remoteAt=U.nowISO();                     /* the server stamps the row it just wrote */
      return {ok:true,status:201,json:async()=>[{id:'ruli-dh',revision:10,updated_at:remoteAt,updated_by:'Kelvin SAMAHANI'}],text:async()=>''}; }
    if(headerKey!==GOOD) return {ok:false,status:401,
      json:async()=>({message:'Invalid API key'}),
      text:async()=>'{"message":"Invalid API key"}', clone(){ return {text:async()=>'{"message":"Invalid API key"}'}; }};
    const sel=/select=([^&]+)/.exec(String(url)); const cols=sel?decodeURIComponent(sel[1]):'';
    const row={id:'ruli-dh',revision:9,updated_at:remoteAt,client_id:'phone',updated_by:'Kelvin SAMAHANI'};
    if(cols.indexOf('data')>=0) row.data=remoteDoc;
    return {ok:true,status:200,json:async()=>[row],text:async()=>JSON.stringify([row])};
  };

  /* ── (3) a training and its expenses, recorded while the cloud was refused ── */
  const db0=S.db();
  const localTraining={id:'tr-test-106',title:'Malaria microscopy refresher',organizer:'RBC',
    type:'In-house',location:'Ruli DH',start:'2026-11-04',end:'2026-11-04',attendees:['Beatrice NGEZEKURE'],
    notes:'recorded while the shared copy was unreachable'};
  S.commit(d=>{ d.trainings=(d.trainings||[]).concat([localTraining]);
    d.trainingExpenses=(d.trainingExpenses||[]).concat([{id:'tex-106',title:'Malaria microscopy refresher',
      linkedTraining:'tr-test-106',start:'2026-11-04',end:'2026-11-04',
      expenses:[{id:'x-106',cat:'refreshment',desc:'Tea and snacks',amount:12000,date:'2026-11-04'}],
      reimbursements:[{id:'r-106',amount:8000,date:'2026-11-05',source:'Hospital',note:'part paid'}]}]);
  },{action:'training.create',entity:'trainings',entityId:'tr-test-106',detail:'Recorded offline'});
  ok(S.pendingChanges()>0,'the device knows it holds work the shared copy has not seen',S.pendingChanges());

  const localTally=SY.localTally();
  ok(localTally.trainingSessions>0,'the tally counts the training-revenue rows',localTally.trainingSessions);
  ok(localTally.trainingExpenses>0,'and the expense lines inside them',localTally.trainingExpenses);

  /* the shared copy holds a register this device never received, with a record of its own */
  remoteDoc=JSON.parse(JSON.stringify(db0));
  remoteDoc.trainings=(remoteDoc.trainings||[]).concat([{id:'tr-cloud-106',title:'GeneXpert mentoring',
    organizer:'CHUK',type:'External',location:'CHUK',start:'2026-10-30',end:'2026-10-30',attendees:[]}]);
  remoteDoc.samples=(remoteDoc.samples||[]).concat([{id:'sm-cloud-106',sampleId:'BC261030777',patientName:'Confidential',
    test:'Blood Culture',hospital:'CHUK',healthFacility:'Ruli DH',collectionDate:'2026-10-30',status:'Pending'}]);

  const before=S.db().trainings.length;
  const res=await SY.sync({auto:true,quiet:true});
  ok(res.ok===true,'the first sync after the repair finishes',res.reason);
  ok(res.action==='combined','it combines both copies instead of replacing this one',res.action);
  const after=S.db();
  ok(!!after.trainings.find(t=>t.id==='tr-test-106'),'the training recorded yesterday is still here');
  ok(!!(after.trainingExpenses||[]).find(t=>t.id==='tex-106'),'with its expense row');
  const exp=(after.trainingExpenses||[]).find(t=>t.id==='tex-106');
  ok(exp&&exp.expenses.length===1&&exp.expenses[0].amount===12000,'the 12,000 RWF expense is intact',exp&&JSON.stringify(exp.expenses));
  ok(exp&&exp.reimbursements.length===1&&exp.reimbursements[0].amount===8000,'and the 8,000 RWF reimbursement');
  ok(!!after.trainings.find(t=>t.id==='tr-cloud-106'),'what only the shared copy had was added, not dropped');
  ok(!!(after.samples||[]).find(s=>s.id==='sm-cloud-106'),'including a sample this device had never seen');
  ok(after.trainings.length>before,'the register grew rather than shrank',before+' → '+after.trainings.length);
  const pushed=calls.filter(c=>c.method==='POST');
  ok(pushed.length===1,'the combined register is published at once',String(pushed.length));
  ok(pushed[0]&&/tr-test-106/.test(pushed[0].body),'the published copy carries the offline training');
  ok(pushed[0]&&/tex-106/.test(pushed[0].body),'and its expenses');
  ok(/combined/i.test((state().conflictNote||'')),'and the device says what it did, in words',state().conflictNote);

  /* ── the quiet poll: a write that did not move the revision number ──
     The live table carries a `revision` column without the trigger that increments it,
     so it can sit at the same number while the document changes. A device that trusted
     the number alone went on saying "up to date" for ever. */
  S.clearPending();
  const quiet1=await SY.sync({auto:true,quiet:true});
  ok(quiet1.ok===true&&quiet1.action==='noop','a quiet tick with nothing new does nothing',quiet1.action);
  remoteDoc.samples=(remoteDoc.samples||[]).concat([{id:'sm-cloud-107',sampleId:'MRB261104001',
    patientName:'Confidential',test:'Marburg',hospital:'NRL',healthFacility:'Ruli DH',
    collectionDate:'2026-11-04',status:'Pending'}]);
  remoteAt='2026-11-05T09:14:02.551Z';           /* the server stamped it; the number stayed 9 */
  const quiet2=await SY.sync({auto:true,quiet:true});
  ok(quiet2.ok===true&&quiet2.action==='pulled','a write that left the revision number alone is still picked up',quiet2.action);
  ok(!!(S.db().samples||[]).find(x=>x.id==='sm-cloud-107'),'and the record it carried is now on this device');

  /* an expense typed into a revenue row that already existed is work of its own, even
     though it changes no top-level record at all */
  ok(SY.hasOwnWork()===true,'a device with a recorded training says it holds work of its own');
  const anyRow=(S.db().trainingExpenses||[]).find(r=>r&&r.id);
  const nestedId='x-nested-106';
  S.commit(d=>{ const r=(d.trainingExpenses||[]).find(x=>x.id===anyRow.id);
    r.expenses=(r.expenses||[]).concat([{id:nestedId,cat:'transport',desc:'Taxi to the venue',amount:5000,date:'2026-11-04'}]); },
    {action:'revenue.expense',entity:'trainingExpenses',entityId:anyRow.id,detail:'Taxi 5,000 RWF'});
  ok(SY.hasOwnWork()===true,'and so does one whose only new record is an expense line inside an older row');

  /* "Push everything now" on a device that has never read the shared copy but does hold
     work of its own: it must combine and publish, not refuse and not overwrite. */
  w.localStorage.removeItem('labSystems.syncState.v1');
  ok(!SY.state().lastPullAt&&!SY.state().lastRevision,'a device with no sync history at all');
  ok(!!(S.db().trainings||[]).find(t=>t.id==='tr-test-106'),'that still holds the training recorded offline');
  const pub=await SY.publishAll();
  ok(!!pub,'the publish button finishes instead of refusing',JSON.stringify(pub));
  ok(pub&&pub.combined===true,'by combining first, so nothing is overwritten');
  ok((S.db().trainings||[]).some(t=>t.id==='tr-test-106'),'and the local training is still here afterwards');
  ok((S.db().trainings||[]).some(t=>t.id==='tr-cloud-106'),'together with the record only the other copy had');

  /* the same code path, compared: two rows with the same id keep the local version */
  const merged=SY.mergeDoc({samples:[{id:'a',note:'typed here'}],settings:{lab:'this device'}},
                           {samples:[{id:'a',note:'from the cloud'},{id:'b',note:'cloud only'}],settings:{lab:'cloud'}});
  ok(merged.samples.length===2,'a merge unions the rows',JSON.stringify(merged.samples));
  ok(merged.samples.find(s=>s.id==='a').note==='typed here','and keeps what this device typed on a shared row');
  ok(!!merged.samples.find(s=>s.id==='b'),'while adding what only the other copy held');
  ok(merged.settings.lab==='this device','local settings are not overwritten by a merge');

  /* ── (1) the key ─────────────────────────────────────────────────── */
  const shipped=fs.readFileSync(path.join(__dirname,'..','assets','js','core','shared.js'),'utf8');
  ok(shipped.indexOf(GOOD)>=0,'shared.js ships the key the project actually issued');
  ok(shipped.indexOf('sb_publishable_60QVktn')<0,'and not the misread one (0 for O, P for p)');
  ok(w.LS_SHARED.key===GOOD,'the running app uses that key',w.LS_SHARED.key);
  ok(w.LS_SHARED.key.length===46,'which is the length the project issued',w.LS_SHARED.key.length);
  ok(SY.keyKind(w.LS_SHARED.key)==='publishable','and is a publishable key, never the secret one');
  const fp=SY.keyFingerprint(w.LS_SHARED.key);
  ok(fp.indexOf(GOOD.slice(0,14))===0&&fp.indexOf('dgJ')>0&&/46 characters/.test(fp),'a fingerprint names the shape without hiding the tail',fp);

  /* a device-saved key that the project refuses is dropped and the request retried */
  S.commit(d=>{ d.settings.cloud=d.settings.cloud||{}; d.settings.cloud.endpoint='https://lkjwztvhmzhasclmlocx.supabase.co';
    d.settings.cloud.anonKey=TYPO; },{action:'test.setkey',entity:'settings',detail:'a mistyped key saved under Settings'});
  ok(SY.config().source==='device','while it is saved, this device uses its own key',SY.config().source);
  calls.length=0;
  const pulled=await SY.pull();
  ok(!!pulled&&pulled.id==='ruli-dh','the pull succeeds once the bad key is dropped',JSON.stringify(pulled&&pulled.id));
  ok(calls.length>=2,'by asking twice — the refusal, then the retry',String(calls.length));
  ok(calls[0].key===TYPO,'the first request carried the saved key');
  ok(calls[calls.length-1].key===GOOD,'the last one carried the built-in key');
  ok(!(S.settings().cloud.anonKey),'and the saved key is cleared from the device',JSON.stringify(S.settings().cloud.anonKey||''));
  ok(SY.config().source==='deployment','so the device runs on the deployment key again',SY.config().source);
  ok((S.db().audit||[]).some(a=>a.action==='sync.key.builtin'),'with an audit line that says it happened');

  /* and if the deployment key itself were refused, the message must be a sentence */
  const refusal=await (async()=>{
    const real=w.fetch;
    w.fetch=async()=>({ok:false,status:401,json:async()=>({message:'Invalid API key'}),
      text:async()=>'{"message":"Invalid API key"}',clone(){return {text:async()=>'{"message":"Invalid API key"}'};}});
    try{ await SY.pull(); return null; }catch(e){ return e.message||''; } finally{ w.fetch=real; }
  })();
  ok(!!refusal,'a refused key stops the pull with a reason',refusal);
  ok(/Invalid API key/.test(refusal),'that names the refusal');
  ok(/built-in shared key/.test(refusal),'and says which key this device was using',refusal);
  ok(/case-sensitive/.test(refusal),'and teaches the O/0, p/P trap that caused it');
  ok(!/^Pull failed \(\d+\)$/.test(refusal),'never a bare status code',refusal);
  const pushRefusal=await (async()=>{
    const real=w.fetch;
    w.fetch=async()=>({ok:false,status:401,json:async()=>({message:'Invalid API key'}),
      text:async()=>'{"message":"Invalid API key"}',clone(){return {text:async()=>'{"message":"Invalid API key"}'};}});
    try{ await SY.push({allowPristine:true}); return null; }catch(e){ return e.message||''; } finally{ w.fetch=real; }
  })();
  ok(pushRefusal&&/Invalid API key/.test(pushRefusal),'a refused publish says the same thing',pushRefusal);

  /* ── (2) renaming an examination ─────────────────────────────────── */
  S.commit(d=>{
    d.catalog.tests=(d.catalog.tests||[]).concat([{id:'t-rename',name:'Sputum AFB',code:'AFB',cat:'TB',tat:2,active:true}]);
    d.samples=(d.samples||[]).concat([
      {id:'sm-ren1',sampleId:'AFB261101001',patientName:'Confidential',test:'Sputum AFB',testCode:'AFB',
       healthFacility:'Ruli DH',collectionDate:'2026-11-01',status:'Pending',tests:['Sputum AFB']},
      {id:'sm-ren2',sampleId:'AFB261101002',patientName:'Confidential',test:'Sputum AFB',testCode:'AFB',
       healthFacility:'Ruli DH',collectionDate:'2026-11-01',status:'Pending',tests:['Sputum AFB','Blood Culture']}
    ]);
    d.settings.tat=d.settings.tat||{}; d.settings.tat['Sputum AFB']=4;
    d.reporting=d.reporting||{lines:[],months:{}};
    d.reporting.months=d.reporting.months||{};
    d.reporting.months['2026-11']={values:{'auto:sputum-afb':{pos:3,neg:7}},blood:{},meta:{}};
  },{action:'test.seed',entity:'catalog',detail:'a test with two samples and a monthly figure'});

  const ids=(S.db().samples||[]).filter(s=>s.test==='Sputum AFB').map(s=>s.sampleId).sort();
  const bad=S.renameTest('t-rename',{name:'Sputum AFB (Ziehl-Neelsen)'});
  ok(bad.ok===true,'the name can be changed',bad.reason);

  const t2=(S.db().catalog.tests||[]).find(t=>t.id==='t-rename');
  ok(t2.name==='Sputum AFB (Ziehl-Neelsen)','the menu carries the new name');
  const renamed=(S.db().samples||[]).filter(s=>s.test==='Sputum AFB (Ziehl-Neelsen)');
  ok(renamed.length===2,'every sample that carried it changed too',String(renamed.length));
  ok((S.db().samples||[]).filter(s=>s.test==='Sputum AFB').length===0,'none was left on the old name');
  const multi=(S.db().samples||[]).find(s=>s.id==='sm-ren2');
  ok(multi.tests.indexOf('Sputum AFB (Ziehl-Neelsen)')>=0&&multi.tests.indexOf('Blood Culture')>=0,
    'a sample with several examinations keeps the others',JSON.stringify(multi.tests));
  ok(multi.tests.indexOf('Sputum AFB')<0,'and drops the old name');
  ok((S.db().samples||[]).filter(s=>s.id==='sm-ren1'||s.id==='sm-ren2').map(s=>s.sampleId).sort().join()===ids.join(),
    'the sample numbers already issued are not rewritten',ids.join()+' → '+renamed.map(s=>s.sampleId).join());
  ok(S.settings().tat['Sputum AFB (Ziehl-Neelsen)']===4,'a target typed for the old name follows it',S.settings().tat['Sputum AFB (Ziehl-Neelsen)']);
  ok(S.settings().tat['Sputum AFB']==null,'and is not left behind under the old one');
  const dec=S.reportMonth('2026-11');
  const movedKey=Object.keys(dec.values).find(k=>k.indexOf('auto:sputum-afb-ziehl')===0);
  ok(!!movedKey&&dec.values[movedKey].pos===3,'the figures on the monthly return follow the name',JSON.stringify(dec.values));
  ok(movedKey&&dec.values[movedKey].neg===7,'both figures, not just the first');
  ok(!dec.values['auto:sputum-afb'],'nothing is copied twice');
  const autoLines=S.reportLines().filter(l=>l.auto&&/Sputum AFB/i.test(l.label));
  ok(autoLines.length===1,'the form shows the examination once, not twice',JSON.stringify(autoLines.map(l=>l.label)));

  const dup=S.renameTest('t-rename',{name:'Blood Culture'});
  ok(dup.ok===false,'a name already on the menu is refused',dup.reason);
  ok(/already called/.test(dup.reason),'with a reason a person can read',dup.reason);
  const blank=S.renameTest('t-rename',{name:'   '});
  ok(blank.ok===false,'an empty name is refused',blank.reason);
  const same=S.renameTest('t-rename',{name:'Sputum AFB (Ziehl-Neelsen)'});
  ok(same.ok===false,'and nothing is written when nothing changed',same.reason);
  const code=S.renameTest('t-rename',{name:'Sputum AFB (ZN)',code:'ZN'});
  ok(code.ok===true,'the code can be corrected in the same place',code.reason);
  ok((S.db().samples||[]).find(s=>s.id==='sm-ren1').testCode==='ZN','and the code beside the sample follows it',
    (S.db().samples||[]).find(s=>s.id==='sm-ren1').testCode);
  ok((S.db().audit||[]).some(a=>a.action==='settings.test.rename'),'every rename is audited');

  /* the button exists where the user asked for it: Settings → Test menu */
  await go('#/staff'); await tick(700);
  const settingsTab=doc.querySelector('[data-st-tab="settings"]');
  ok(!!settingsTab,'the Test menu is where the user said it is: Settings → Test menu');
  if(settingsTab){ settingsTab.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await tick(400); }
  const row=doc.querySelector('[data-rename-test]');
  ok(!!row,'every row on the test menu carries a rename control');
  ok(!!doc.querySelector('[data-rename-test="t-rename"]'),'including the examination just renamed');
  ok(/pencil/i.test(doc.body.innerHTML),'and the menu explains what the pencil does');

  done('keys106');
})().catch(e=>{ console.log('  ✗ suite threw: '+(e&&e.stack||e)); done('keys106'); });
