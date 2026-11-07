const {boot,ok,done}=require('./env');
(async()=>{
 const {w,errors}=await boot('#/dash'); const S=w.LS.store,Y=w.LS.sync,SH=w.LS.shell;
 Y.stopLive();S.clearPending();
 const when='2026-11-07T10:00:00.000Z';
 const before=JSON.stringify(S.db());let posts=0, readFail=false,writeFail=false;
 const row={id:'ruli-dh',revision:20,updated_at:when,data:JSON.parse(before)};
 w.fetch=async (url,opts)=>{
   if(opts&&opts.method==='POST'){posts++;return {ok:!writeFail,status:writeFail?403:201,json:async()=>[{revision:21,updated_at:when}],text:async()=>writeFail?'write denied':'',clone(){return {text:async()=>writeFail?'write denied':''}}};}
   if(readFail) throw Error('network offline');
   return {ok:true,status:200,json:async()=>[row],text:async()=>''};
 };
 Y.setState({lastRevision:20,lastRemoteAt:when,lastPullAt:when,lastError:'previous timeout',failCount:4,nextTryAt:Date.now()-1000,appliedCounts:null});
 let result=await Y.sync({auto:true,quiet:true});
 ok(result.ok&&result.action==='noop','a successful unchanged revision read completes');
 ok(Y.state().lastError===null&&Y.state().failCount===0&&!Y.state().nextTryAt,'successful read clears stale error and retry backoff');
 ok(posts===0&&S.pendingChanges()===0&&JSON.stringify(S.db())===before,'read-only check does not modify register, queue, or publish');
 SH.updateNet();let chip=w.document.querySelector('#syncChip');
 ok(!chip.classList.contains('bad'),'status no longer remains red after a successful check');
 ok(/does not test write permission or private-name sync/.test(chip.title),'status explains that a read is not a write test');
 readFail=true;result=await Y.sync({auto:true,quiet:true});
 ok(!result.ok&&/network offline/.test(Y.state().lastError),'a current read failure remains visible');
 SH.updateNet();ok(chip.classList.contains('bad')&&/Last sync failed/.test(chip.textContent),'status reports a current failure without diagnosing its cause');
 readFail=false;writeFail=true;
 S.commit(db=>{db.meta.sync122Synthetic=true;},{action:'test'});
 const pending=S.pendingChanges();result=await Y.sync({auto:true,quiet:true});
 ok(!result.ok&&S.pendingChanges()===pending,'failed write after successful read keeps pending edits');
 ok(/Push failed/.test(Y.state().lastError),'failed write remains visible after read succeeded');
 ok(!errors.length,'no browser errors',errors.join(' | '));done('sync122');
})().catch(e=>{console.error(e);process.exit(1)});
