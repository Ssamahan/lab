const {boot,ok,done}=require('./env');
(async()=>{
 const {w,go,errors}=await boot('#/reports');const S=w.LS.store;w.LS.sync.stopLive();S.clearPending();
 const old=JSON.stringify(S.reportMonth('2026-10'));let calls=0;
 const data={version:1,checkedAt:'2026-11-09T13:00:00Z',records:[{facility:'Ruli HC',period:'2026-10',completed:'2026-11-09T12:38:37',responses:1},{facility:'Coko HC',period:'2026-10',completed:'2026-11-05T07:25:40',responses:1}]};
 w.fetch=async()=>{calls++;return {ok:true,json:async()=>data};};
 w.document.querySelector('[data-tab="hiv"]').click();await new Promise(r=>setTimeout(r,200));
 const select=w.document.querySelector('#hivPeriod');select.value='2026-10';select.dispatchEvent(new w.Event('change'));
 const root=w.document.querySelector('#pageInner');
 ok(calls===1,'opening tab checks live source once');
 ok(root.textContent.includes('Ruli HC')&&root.textContent.includes('Submitted late'),'late completed report appears');
 ok(root.textContent.includes('Coko HC')&&root.textContent.includes('On time'),'fifth is on time');
 ok(root.textContent.includes('not found'),'missing rows are not claimed to be verified non-submissions');
 ok(JSON.stringify(S.reportMonth('2026-10'))===old&&S.pendingChanges()===0,'feed never writes to saved month or queue');
 w.fetch=async()=>{throw Error('offline')};root.querySelector('[data-hiv-refresh]').click();await new Promise(r=>setTimeout(r,100));
 ok(root.textContent.includes('may be stale')&&root.textContent.includes('Ruli HC'),'failed refresh retains and labels previous snapshot');
 w.document.querySelector('[data-tab="return"]').click();ok(!!w.document.querySelector('[data-row="m1"]'),'return remains usable');
 ok(!errors.length,'no page errors',errors.join(' | '));done('hiv_report134');
})().catch(e=>{console.error(e);process.exit(1)});
