const {boot,ok,done}=require('./env');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const {w}=await boot('#/dash'); const S=w.LS.store,SY=w.LS.sync,SH=w.LS.shell,U=w.LSU,d=w.document;
 SY.stopLive(); S.clearPending();
 S.commit(db=>{db.trainings.unshift({id:'sync117a',title:'waiting test',start:U.todayISO(),attendees:[]});},{action:'test'});
 const timer=w.setTimeout; w.setTimeout=function(fn,ms){return timer(fn,ms===25000?40:ms);};
 w.fetch=(url,opts)=>new Promise((resolve,reject)=>{if(opts.signal) opts.signal.addEventListener('abort',()=>reject(new Error('aborted')));});
 let result=await SY.sync({auto:true,quiet:true});
 ok(!result.ok&&/25 seconds/.test(result.reason),'hung connection returns a timed error',result.reason);
 ok(S.pendingChanges()>0,'timeout retains the local queue');
 ok(!SY.liveState().busy,'timeout releases the sync lock');
 w.localStorage.setItem('labSystems.syncState.v1',JSON.stringify({lastError:'Network failed',failCount:2,nextTryAt:Date.now()-1000}));
 SH.updateNet(); ok(!/retrying in 1 s/.test(d.querySelector('#syncChip').textContent),'expired countdown never falsely stays at one second',d.querySelector('#syncChip').textContent);
 ok(/auto-retry off/.test(d.querySelector('#syncChip').textContent),'stopped retry loop is identified');
 // A failed merge publish must be reported as failure, not as a successful combine.
 const remote=JSON.parse(JSON.stringify(S.db()));
 w.fetch=async(url,opts)=>{if(opts&&opts.method==='POST')return {ok:false,status:403,text:async()=>'write denied',clone(){return {text:async()=>'write denied'}}};
 return {ok:true,status:200,json:async()=>[{id:'ruli-dh',revision:50,updated_at:'2026-11-01T00:00:00Z',data:remote}],text:async()=>''};};
 w.localStorage.setItem('labSystems.syncState.v1',JSON.stringify({lastRevision:1,lastPullAt:U.nowISO()}));
 result=await SY.sync({auto:true,quiet:true});
 ok(!result.ok&&/Push failed/.test(result.reason),'failed combined write is surfaced',result.reason);
 ok(S.pendingChanges()>0,'failed combined write leaves edits pending');
 // A later edit during a successful POST must not be acknowledged by the earlier snapshot.
 w.localStorage.setItem('labSystems.syncState.v1',JSON.stringify({lastRevision:50,lastPullAt:U.nowISO()}));
 let release,started;const startedPromise=new Promise(r=>started=r);
 w.fetch=async(url,opts)=>{if(opts&&opts.method==='POST'){started();await new Promise(r=>release=r);return {ok:true,status:201,json:async()=>[{revision:51,updated_at:U.nowISO()}]};}
 return {ok:true,status:200,json:async()=>[{revision:50,updated_at:'2026-11-01T00:00:00Z',data:remote}],text:async()=>''};};
 const push=SY.push();await startedPromise;
 S.commit(db=>{db.trainings.unshift({id:'sync117b',title:'edited during send',start:U.todayISO(),attendees:[]});},{action:'test'});
 release();await push;
 ok(S.pendingChanges()>0,'new edit during in-flight send remains queued');
 ok(S.db().trainings.some(t=>t.id==='sync117b'),'new edit remains in device register');
 done('sync117');
})().catch(e=>{console.error(e);process.exit(1)});
