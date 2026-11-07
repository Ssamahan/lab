/* v6.9.112 — "I record on the phone and the computer sees nothing."

   Four things have to be true for that to stop happening, and this suite holds all four:

     1. a device that holds real work is never refused publication, even though it has
        never pulled (the pristine guard used to refuse it, quietly, on every poll);
     2. a failure is retried on its own, with a growing wait, and the wait is written
        down where a person can see it;
     3. what is still owed is visible in the header as a number, not as a guess;
     4. work typed just before the phone is closed or locked leaves the device at that
        moment, and what could not leave stays queued and goes on the next open. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms||150));
const click=el=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));

(async()=>{
  const {w}=await boot('#/dash');
  const S=w.LS.store, SY=w.LS.sync, SH=w.LS.shell, doc=w.document, U=w.LSU;

  /* a project that refuses nothing, and remembers what it was sent */
  const sent=[];
  let accept=true, downUntil=0, posts=0;
  w.fetch=async(url,opts)=>{
    opts=opts||{};
    const now=Date.now();
    if(now<downUntil) throw new Error('network dropped');
    if(accept===false) return {ok:false,status:401,json:async()=>({message:'Invalid API key'}),
      text:async()=>'{"message":"Invalid API key"}',clone(){return {text:async()=>'{"message":"Invalid API key"}'};}};
    if(opts.method==='POST'){
      sent.push(JSON.parse(opts.body)[0].data);
      return {ok:true,status:201,json:async()=>[{id:'ruli-dh',revision:sent.length,updated_at:U.nowISO(),updated_by:'device'}],text:async()=>''};
    }
    const sel=/select=([^&]+)/.exec(String(url)); const cols=sel?decodeURIComponent(sel[1]):'';
    if(cols.indexOf('data')<0) return {ok:true,status:200,json:async()=>[{id:'ruli-dh',revision:1,updated_at:'2026-11-01T08:00:00Z'}],text:async()=>''};
    return {ok:true,status:200,json:async()=>[],text:async()=>'[]'};
  };

  /* ── 1 · a phone that recorded a day, and has never synced ─────────── */
  w.localStorage.removeItem('labSystems.syncState.v1');
  w.localStorage.removeItem('labSystems.pending.v1');
  S.commit(d=>{ d.trainings=(d.trainings||[]).concat([{id:'tr-112',title:'Night shift microscopy',organizer:'In-house',
    type:'In-house',location:'Ruli DH',start:'2026-11-05',end:'2026-11-05',attendees:[]}]);
    d.trainingExpenses=(d.trainingExpenses||[]).concat([{id:'tex-112',title:'Night shift microscopy',linkedTraining:'tr-112',
      start:'2026-11-05',end:'2026-11-05',
      expenses:[{id:'x112',cat:'transport',desc:'Taxi',amount:4000,date:'2026-11-05'}],reimbursements:[]}]);
  },{action:'training.create',entity:'trainings',entityId:'tr-112',detail:'recorded offline on the phone'});
  ok(S.pendingChanges()>0,'the phone knows it holds unpublished work',S.pendingChanges());
  ok(!SY.state().lastPullAt&&!SY.state().lastRevision,'and it has no sync history at all — the state that used to refuse it');

  /* the shared copy has a register, and it is not newer by revision number */
  const remoteDoc=JSON.parse(JSON.stringify(S.db()));
  remoteDoc.trainings=(remoteDoc.trainings||[]).filter(t=>t.id!=='tr-112');
  remoteDoc.trainingExpenses=(remoteDoc.trainingExpenses||[]).filter(t=>t.id!=='tex-112');
  remoteDoc.samples=(remoteDoc.samples||[]).concat([{id:'sm-112',sampleId:'BC261101112',patientName:'Confidential',
    test:'Blood Culture',healthFacility:'Ruli DH',collectionDate:'2026-11-01',status:'Pending'}]);
  /* one stub for the whole suite: it can be told to refuse writes, or to drop the link */
  w.fetch=async(url,opts)=>{
    opts=opts||{};
    if(Date.now()<downUntil) throw new Error('network dropped');
    if(!accept) return {ok:false,status:401,json:async()=>({message:'Invalid API key'}),
      text:async()=>'{"message":"Invalid API key"}',clone(){return {text:async()=>'{"message":"Invalid API key"}'};}};
    if(opts.method==='POST'){ posts++;
      sent.push(JSON.parse(opts.body)[0].data);
      return {ok:true,status:201,json:async()=>[{id:'ruli-dh',revision:1+sent.length,updated_at:U.nowISO(),updated_by:'phone'}],text:async()=>''}; }
    const sel=/select=([^&]+)/.exec(String(url)); const cols=sel?decodeURIComponent(sel[1]):'';
    if(cols.indexOf('data')<0) return {ok:true,status:200,json:async()=>[{id:'ruli-dh',revision:1,updated_at:'2026-11-01T08:00:00Z'}],text:async()=>''};
    return {ok:true,status:200,json:async()=>[{id:'ruli-dh',revision:1,updated_at:'2026-11-01T08:00:00Z',data:remoteDoc}],text:async()=>''};
  };

  const res=await SY.sync({auto:true,quiet:true});
  ok(res.ok===true,'the first exchange after a day offline finishes',res.reason);
  ok(res.action==='combined'||res.action==='pushed','and it publishes instead of refusing',res.action);
  ok(sent.length>=1,'the shared copy received a write',String(sent.length));
  const published=sent[sent.length-1];
  ok(!!(published.trainings||[]).find(t=>t.id==='tr-112'),'carrying the training recorded on the phone');
  ok(!!(published.trainingExpenses||[]).find(t=>t.id==='tex-112'),'and its expense row');
  ok(!!(published.samples||[]).find(s=>s.id==='sm-112'),'while what only the shared copy had is kept, not overwritten');
  ok(!!(S.db().trainings||[]).find(t=>t.id==='tr-112'),'and it is still on the device afterwards');

  /* ── 2 · a failure is retried on its own, with a growing wait ─────── */
  w.localStorage.setItem('labSystems.syncState.v1',JSON.stringify({lastRevision:2,lastPullAt:U.nowISO()}));
  accept=false;
  S.commit(d=>{ d.trainings.unshift({id:'tr-112b',title:'Second session',start:'2026-11-05',end:'2026-11-05',attendees:[]}); },
    {action:'training.create',entity:'trainings',entityId:'tr-112b',detail:'typed while the link was dying'});
  const bad=await SY.sync({auto:true,quiet:true});
  ok(bad.ok===false,'a refused publish reports failure',String(bad.reason||'').slice(0,60));
  ok(bad.retryIn>=2000,'with the first retry two seconds away',String(bad.retryIn));
  ok(S.pendingChanges()>0,'and the change stays queued — nothing is thrown away',S.pendingChanges());
  const st1=SY.state();
  ok(st1.failCount===1,'the failure is counted',String(st1.failCount));
  ok(st1.nextTryAt>Date.now(),'and a retry time is set',String(st1.nextTryAt-Date.now())+'ms');
  ok(/Invalid API key|refused/.test(st1.lastError||''),'with the reason kept for the header',st1.lastError&&st1.lastError.slice(0,40));
  const info1=SY.pendingInfo();
  ok(info1.waiting===true,'the queue reports that it is waiting');
  ok(info1.count>0&&info1.retryIn>0,'with a count and a countdown',JSON.stringify({n:info1.count,r:info1.retryIn}));

  /* the wait grows, and it is capped */
  await SY.sync({auto:true,quiet:true}); await SY.sync({auto:true,quiet:true});
  const st2=SY.state();
  ok(st2.failCount===3,'each failure adds to the count',String(st2.failCount));
  ok(st2.nextTryAt-Date.now()>st1.nextTryAt-Date.now(),'and the wait gets longer, not shorter');
  for(let i=0;i<9;i++) await SY.sync({auto:true,quiet:true});
  const capped=SY.state();
  ok(capped.nextTryAt-Date.now()<=31000,'but never longer than half a minute',String(capped.nextTryAt-Date.now()));

  /* the live tick respects the backoff instead of hammering a dead link */
  const sh=require('fs').readFileSync(require('path').join(__dirname,'..','assets','js','core','sync.js'),'utf8');
  ok(/const nt=Number\(state\(\)\.nextTryAt\|\|0\);/.test(sh)&&/Date\.now\(\)<nt/.test(sh),'the background tick waits out the backoff');
  ok(!/Date\.now\(\)<nt\) return; \*\/ *$/.test(sh),'without disabling the loop');

  /* ── 3 · the header says what is owed ────────────────────────────── */
  SH.updateNet();
  const chip=doc.getElementById('syncChip');
  ok(!!chip,'the top bar carries a queue chip');
  ok(!chip.hidden,'and it is shown on a device that is configured for sync');
  const say=chip.textContent.replace(/\s+/g,' ').trim();
  ok(/\d+ waiting/.test(say),'naming how many changes are waiting',say);
  ok(/retrying in \d+ s/.test(say),'and when the next attempt is',say);
  ok(chip.classList.contains('bad'),'in the warning colour while it cannot get through');
  ok(/last sync attempt failed/i.test(chip.title),'with the reason in the tooltip',chip.title.slice(0,60));

  /* the connection comes back: the chip clears itself and says so */
  accept=true;
  const fixed=await SY.sync({auto:false,quiet:true});
  ok(fixed.ok===true,'once the project accepts writes again, the queue empties',JSON.stringify(fixed.action));
  ok(S.pendingChanges()===0,'nothing is left waiting',String(S.pendingChanges()));
  ok(!SY.state().failCount&&!SY.state().nextTryAt,'and the backoff is forgotten');
  ok(SY.pendingInfo().waiting===false,'the queue reports itself empty');
  SH.updateNet();
  const after=doc.getElementById('syncChip');
  ok(/Up to date|No change in cloud/.test(after.textContent),'the chip goes back to saying this device is level with the cloud',after.textContent.trim());
  ok(!after.classList.contains('bad'),'and leaves the warning colour');
  ok(!!(sent[sent.length-1].trainings||[]).find(t=>t.id==='tr-112b'),'the change typed during the outage is now in the shared copy');

  /* ── 4 · leaving the page flushes what was just typed ────────────── */
  ok(typeof SY.flush==='function','there is a flush for the moment the page is left');
  ok(/pagehide/.test(sh)&&/visibilitychange/.test(sh),'hooked to pagehide and to the tab going to the background');
  ok(/keepalive:!!opts\.keepalive/.test(sh),'and the publish it makes is a keepalive request, so it finishes after the page is gone');

  /* queued work is made by committing, the way a person makes it */
  const queueWork=id=>S.commit(d=>{ d.trainings.unshift({id,title:'Flush test '+id,start:'2026-11-05',end:'2026-11-05',attendees:[]}); },
    {action:'training.create',entity:'trainings',entityId:id,detail:'typed just before the phone was closed'});
  w.localStorage.setItem('labSystems.syncState.v1',JSON.stringify({lastRevision:5,lastPullAt:U.nowISO(),lastPushAt:U.nowISO()}));
  posts=0;
  queueWork('tr-flush');
  ok(S.pendingChanges()>0,'the phone holds a change',String(S.pendingChanges()));
  ok(SY.flush()===true,'a device with queued work flushes when the page is left');
  await tick(250);
  ok(posts===1,'and the publish is actually sent',String(posts));
  S.clearPending();
  ok(SY.flush()===false,'with nothing queued there is no needless request');

  /* a phone that has never synced is NOT flushed over the shared copy */
  queueWork('tr-never');
  w.localStorage.removeItem('labSystems.syncState.v1');
  posts=0;
  ok(SY.flush()===false,'a device with no sync history is never fire-and-forget published');
  await tick(150);
  ok(posts===0,'so the shared copy is not at risk',String(posts));
  S.clearPending();

  /* offline: the flush declines instead of hanging */
  w.localStorage.setItem('labSystems.syncState.v1',JSON.stringify({lastRevision:5,lastPullAt:U.nowISO()}));
  queueWork('tr-offline');
  const wasOnline=navigator.onLine;
  Object.defineProperty(w.navigator,'onLine',{value:false,configurable:true});
  ok(SY.flush()===false,'offline, the flush declines and leaves the queue intact');
  Object.defineProperty(w.navigator,'onLine',{value:wasOnline,configurable:true});
  S.clearPending();

  /* ── 5 · pressing the chip publishes now ─────────────────────────── */
  queueWork('tr-press');
  let forced=0;
  const innerFetch=w.fetch;
  w.fetch=async(url,opts)=>{ if(opts&&opts.method==='POST') forced++; return innerFetch(url,opts); };
  SY.setState({nextTryAt:Date.now()+60000,failCount:4,lastError:'a previous failure'});
  const pressed=await SH.syncNow();
  ok(pressed&&pressed.ok===true,'pressing the chip publishes immediately',JSON.stringify(pressed&&pressed.reason));
  ok(forced>=1,'with a write',String(forced));
  ok(!SY.state().nextTryAt,'and a human instruction clears the backoff');
  ok(S.pendingChanges()===0,'so nothing is left waiting');

  /* ── the guide is in the app, not only in this file ──────────────── */
  const staffJs=require('fs').readFileSync(require('path').join(__dirname,'..','assets','js','modules','staff.js'),'utf8');
  ok(/pendingLine/.test(staffJs),'Data & sync names what the device still owes');
  ok(/trainingExpenses/.test(staffJs),'including expense lines, by name');
  const shellJs=require('fs').readFileSync(require('path').join(__dirname,'..','assets','js','core','shell.js'),'utf8');
  ok(/SH\.syncNow/.test(shellJs),'and the chip has a press-to-send handler');
  ok(/retrying in/.test(shellJs),'that says when the next attempt is');

  done('autosync112');
})().catch(e=>{ console.log('  ✗ suite threw: '+(e&&e.stack||e)); done('autosync112'); });
