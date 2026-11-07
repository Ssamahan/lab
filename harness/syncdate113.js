/* v6.9.113 — "the computer shows 30 Oct 2026 and today is 7 Nov".

   That was a true fact printed under a false label. The date was the last time this
   device had exchanged anything with the cloud, and it stayed there because the cloud
   itself had not changed since — the computer was checking every two seconds the whole
   time. Three facts were collapsed into one sentence:

     · when this device last checked      (seconds ago — is the poll alive?)
     · when the shared copy last changed  (a week ago — is anything reaching it?)
     · when this device last sent         (its own last write)

   This suite holds them apart, and holds the write test to account. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms||120));
const DAY=86400000;
const isoAgo=ms=>new Date(Date.now()-ms).toISOString();

(async()=>{
  const {w,go}=await boot('#/dash');
  const S=w.LS.store, SY=w.LS.sync, SH=w.LS.shell, U=w.LSU, doc=w.document, UI=w.LS.ui;

  const setState=o=>{ w.localStorage.setItem('labSystems.syncState.v1',JSON.stringify(o)); };
  const chip=()=>doc.getElementById('syncChip');
  const paint=()=>{ SH.updateNet(); return chip(); };
  const say=()=>chip().textContent.replace(/\s+/g,' ').trim();

  /* ── the reported scene: checked just now, cloud unchanged for 8 days ── */
  setState({lastRevision:1, lastPushAt:isoAgo(8*DAY), lastPullAt:isoAgo(8*DAY),
    lastCheckAt:isoAgo(2000), lastRemoteAt:isoAgo(8*DAY), lastRemoteBy:'Lab desk',
    remoteIsMine:true});
  S.clearPending();
  const c1=paint();
  ok(!c1.hidden,'the chip is shown on a configured, signed-in device');
  ok(!/^Synced/.test(say()),'it no longer calls a week-old date “Synced”',say());
  ok(!/30 Oct|Oct 2026/.test(say()),'and the old date is not the headline',say());
  ok(/No change in cloud · 8 d/.test(say()),'it says the cloud itself has not changed for eight days',say());
  ok(c1.classList.contains('warn'),'in the warning colour, not the reassuring one');
  ok(/checking normally/i.test(c1.title),'the tooltip says this device is checking normally',c1.title.slice(0,80));
  ok(/this device/.test(c1.title),'and that the last thing in the cloud came from this device');
  ok(/has not reached the cloud/i.test(c1.title),'pointing at the other device as the suspect');

  /* ── the three facts are separately available ────────────────────────── */
  const info=SY.pendingInfo();
  ok(info.checkedAgo!=null&&info.checkedAgo<60000,'pendingInfo knows when it last checked',String(info.checkedAgo));
  ok(info.remoteAge>7*DAY,'and when the shared copy last changed',String(Math.round(info.remoteAge/DAY))+'d');
  ok(info.lastPushAt&&info.lastPushAt.slice(0,10)!==U.todayISO(),'and when this device last sent');
  const age=SY.sharedAge();
  ok(age.known===true&&age.days>7,'sharedAge reports the cloud’s own age',String(Math.round(age.days))+' days');
  ok(age.mine===true,'including whether this device wrote it');
  ok(/Checked|Sent|Received/.test(SY.statusText()),'the one-line status says “checked”, not “synced”',SY.statusText());
  ok(!/^Synced/.test(SY.statusText()),'so the Cloud sync card cannot repeat the old wording');

  /* ── a healthy device reads as healthy, with its check time ─────────── */
  setState({lastRevision:4, lastPushAt:isoAgo(9000), lastCheckAt:isoAgo(1500),
    lastRemoteAt:isoAgo(9000), lastRemoteBy:'Phone', remoteIsMine:false});
  const c2=paint();
  ok(/Up to date · checked/.test(say()),'a device level with a fresh cloud says “Up to date · checked”',say());
  ok(c2.classList.contains('ok'),'in the calm colour');
  ok(/Phone/.test(c2.title),'naming the device that wrote the shared copy',c2.title.slice(0,120));

  /* ── the poll is not running: say so instead of implying freshness ──── */
  setState({lastRevision:4, lastCheckAt:isoAgo(3*3600000), lastRemoteAt:isoAgo(3*3600000)});
  const c3=paint();
  ok(/Not checking/.test(say()),'a stale check is named as such',say());
  ok(c3.classList.contains('warn'),'and coloured for attention');

  setState({lastRevision:4});
  const c4=paint();
  ok(/Not checked yet/.test(say()),'a device that has never checked says that',say());

  /* ── a device that cannot reach the cloud is not silent any more ────── */
  setState({lastRevision:4, lastCheckAt:isoAgo(4000), lastRemoteAt:isoAgo(4*DAY),
    failCount:4, lastError:'Invalid API key', nextTryAt:Date.now()+6000});
  let toasts=0; const realToast=UI.toast;
  UI.toast=function(){ toasts++; return realToast.apply(this,arguments); };
  S.commit(d=>{ d.trainings.unshift({id:'sd-a',title:'A',start:U.todayISO(),end:U.todayISO()}); },{action:'t'});
  S.commit(d=>{ d.trainings.unshift({id:'sd-b',title:'B',start:U.todayISO(),end:U.todayISO()}); },{action:'t'});
  ok(S.pendingChanges()===2,'two changes are queued on this device',String(S.pendingChanges()));
  const c5=paint();
  ok(c5.classList.contains('bad'),'a refused queue turns the dot red');
  ok(/2 waiting · retrying in \d+ s/.test(say()),'and counts down to the next attempt',say());
  ok(/Invalid API key/.test(c5.title),'with the reason in the tooltip',c5.title.slice(0,80));
  ok(toasts>=1,'and it says it out loud, once, instead of failing silently',String(toasts));
  paint(); paint();
  ok(toasts===1,'without repeating the same warning on every repaint',String(toasts));
  UI.toast=realToast;
  S.clearPending();

  /* ── a check that finds nothing new must still prove the link works ── */
  const REMOTE_AT='2026-10-30T08:00:00.000Z';
  let calls=0;
  w.fetch=async(url,opts)=>{ opts=opts||{}; calls++;
    const sel=/select=([^&]+)/.exec(String(url)); const cols=sel?decodeURIComponent(sel[1]):'';
    if(cols.indexOf('data')<0) return {ok:true,status:200,json:async()=>[{id:'ruli-dh',revision:6,updated_at:REMOTE_AT,client_id:'other',updated_by:'Phone'}],text:async()=>''};
    return {ok:true,status:200,json:async()=>[{id:'ruli-dh',revision:6,updated_at:REMOTE_AT,data:S.db()}],text:async()=>''};
  };
  setState({lastRevision:6, lastCheckAt:isoAgo(3600000), lastRemoteAt:REMOTE_AT});
  const r=await SY.sync({auto:true,quiet:true});
  ok(r.ok&&r.action==='noop','a background check with nothing new is a no-op',JSON.stringify(r.action));
  const after=SY.pendingInfo();
  ok(after.checkedAgo!=null&&after.checkedAgo<3000,'but it still records that it checked just now',String(after.checkedAgo));
  ok(after.remoteAge!=null&&after.remoteAge>0,'and what the cloud last held',String(after.remoteAge));
  const c6=paint();
  ok(!/Oct 2026|30 Oct/.test(c6.textContent),'so the chip no longer headlines a week-old date',say());
  ok(/checked .* ago/.test(c6.title),'and says in words when it last checked',c6.title.slice(0,60));

  /* ── the write test: the one thing the poll never does ─────────────── */
  ok(typeof SY.writeTest==='function','there is a test that actually writes');
  let posts=0, mode='ok';
  w.fetch=async(url,opts)=>{ opts=opts||{};
    const sel=/select=([^&]+)/.exec(String(url)); const cols=sel?decodeURIComponent(sel[1]):'';
    if(opts.method==='POST'){
      posts++;
      if(mode==='refuse') return {ok:false,status:403,json:async()=>({code:'42501',message:'new row violates row-level security policy'}),text:async()=>'{"code":"42501","message":"new row violates row-level security policy"}',clone(){return {text:async()=>'{"code":"42501"}',json:async()=>({code:'42501'})};}};
      return {ok:true,status:201,json:async()=>[{id:'ruli-dh',revision:9,updated_at:U.nowISO(),client_id:'me',updated_by:'Lab desk'}],text:async()=>''};
    }
    if(cols.indexOf('data')<0) return {ok:true,status:200,json:async()=>[{id:'ruli-dh',revision:6,updated_at:REMOTE_AT,client_id:'other',updated_by:'Phone'}],text:async()=>''};
    return {ok:true,status:200,json:async()=>[{id:'ruli-dh',revision:6,updated_at:REMOTE_AT,data:S.db()}],text:async()=>''};
  };
  setState({lastRevision:6, lastCheckAt:isoAgo(60000), lastRemoteAt:REMOTE_AT});
  w.localStorage.setItem('labSystems.pending.v1','0');
  const wt=await SY.writeTest();
  ok(wt.ok===true,'a project that accepts the write passes the test',JSON.stringify(wt.reason));
  ok(posts>=1,'because it really wrote something',String(posts));
  ok((wt.steps||[]).length>=3,'and reports every step',String((wt.steps||[]).length));
  ok(wt.steps.every(x=>x.ok),'all of them green');
  ok(/revision/.test(wt.steps[wt.steps.length-1].detail),'naming the revision the cloud stored',wt.steps[wt.steps.length-1].detail);
  ok(SY.pendingInfo().checkedAgo<3000,'a successful write also counts as a check');

  /* a project that reads but refuses to write — the fault this test exists for */
  mode='refuse'; posts=0;
  setState({lastRevision:6, lastCheckAt:isoAgo(60000), lastRemoteAt:REMOTE_AT});
  const bad=await SY.writeTest();
  ok(bad.ok===false,'a read-only project fails the write test',String(bad.ok));
  ok(bad.step==='write','and names writing as the failing step',bad.step);
  ok(/row-level security|42501/i.test(bad.reason||''),'with the database’s own words',String(bad.reason).slice(0,60));
  ok(bad.steps.some(x=>x.ok&&/Read the shared copy/.test(x.name)),'while showing that reading worked — which is exactly how this looks healthy');

  /* it will not write over a newer shared copy */
  mode='ok'; posts=0;
  w.fetch=async(url,opts)=>{ opts=opts||{};
    const sel=/select=([^&]+)/.exec(String(url)); const cols=sel?decodeURIComponent(sel[1]):'';
    if(opts.method==='POST'){ posts++; return {ok:true,status:201,json:async()=>[{revision:99}],text:async()=>''}; }
    if(cols.indexOf('data')<0) return {ok:true,status:200,json:async()=>[{id:'ruli-dh',revision:77,updated_at:U.nowISO(),client_id:'other',updated_by:'Phone'}],text:async()=>''};
    return {ok:true,status:200,json:async()=>[{id:'ruli-dh',revision:77,updated_at:U.nowISO(),data:S.db()}],text:async()=>''};
  };
  setState({lastRevision:6, lastCheckAt:isoAgo(60000), lastRemoteAt:REMOTE_AT});
  const guard=await SY.writeTest();
  ok(guard.ok===false&&guard.step==='newer','it refuses to write when the shared copy has moved',String(guard.step));
  ok(posts===0,'so nothing was sent',String(posts));

  /* ── the Data & sync card shows the same three facts ────────────────── */
  setState({lastRevision:6, lastPushAt:isoAgo(8*DAY), lastCheckAt:isoAgo(3000),
    lastRemoteAt:isoAgo(8*DAY), remoteIsMine:true});
  await go('#/staff?tab=data');
  const body=doc.body.textContent.replace(/\s+/g,' ');
  ok(/Last check/.test(body),'the card has a “Last check” row');
  ok(/Shared copy last changed/.test(body),'and a row for the shared copy’s own date');
  ok(/has not changed for \d+ days/.test(body),'with a plain warning when that date is old',(body.match(/has not changed for \d+ days/)||[])[0]);
  ok(/has not reached the cloud/.test(body),'and what that means for the other device');
  ok(/Test a write/.test(body),'and a button that proves writing works');
  const wbtn=doc.querySelector('[data-cloud-write]');
  ok(!!wbtn,'which is wired');
  if(wbtn){ wbtn.click(); await tick(400);
    const t=doc.body.textContent.replace(/\s+/g,' ');
    ok(/Writing to the shared copy/.test(t),'and opens a report when pressed',t.slice(0,60));
  }

  /* ── nothing above broke a screen ──────────────────────────────────── */
  for(const r of ['#/dash','#/samples','#/staff','#/settings','#/training','#/roadmap']){
    await go(r);
    ok(!/Something went wrong/i.test(doc.body.textContent),'a screen still renders: '+r);
  }

  done('syncdate113');
})().catch(e=>{ console.log('  ✗ suite threw: '+(e&&e.stack||e)); done('syncdate113'); });
