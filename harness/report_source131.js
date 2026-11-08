/* Private workbook overlay, synthetic source and simulated network. */
const {boot,ok,done}=require('./env');
(async()=>{
 const {w,go}=await boot('#/dash'),S=w.LS.store,SY=w.LS.sync;
 SY.stopLive();S.clearPending();
 const before=JSON.stringify(S.db()); const beforeMonth=JSON.stringify(S.reportMonth('2026-10'));
 const base={month:'2025-01',meta:{source:'Synthetic'},values:{x64:{total:10},oNa:{pos:1,neg:9}},blood:{'O+':{recv:12,used:7}},sourceReview:[{kind:'total-mismatch',label:'Na+',lineId:'oNa',pos:1,neg:9,sourceTotal:11,calculated:10}],unmatched:[]};
 const conflict={month:'2026-10',meta:{},values:{x64:{total:999}},blood:{},sourceReview:[],unmatched:[]};
 ok(S.setReportSource({'2025-01':base,'2026-10':conflict}),'private source loads into memory');
 ok(JSON.stringify(S.db())===before&&S.pendingChanges()===0,'loading source does not modify shared register or queue');
 ok(S.reportMonths().includes('2025-01')&&S.reportSummary('2025-01').bloodTotals.used===7,'source months and blood supply are available in analysis');
 w.LS.privateNames.connected=()=>true; await go('#/reports');const sel=w.document.querySelector('#repMonth');sel.value='2025-01';sel.dispatchEvent(new w.Event('change'));
 ok(w.document.querySelector('input[data-line="oNa"][data-field="neg"]').readOnly&&w.document.body.textContent.includes('Needs your review'),'source figures are red-flagged and read-only while secure editing is unfinished');
 const m=S.reportMonth('2026-10');ok(m.values.x64.total!==999&&m.sourceReview.some(x=>x.kind==='device-conflict'&&x.lineId==='x64'),'existing device value wins and the difference is flagged');
 ok(S.reportSet('2025-01','x64','total',11)===false&&S.reportBlood('2025-01','O+','used',3)===false,'source edits are refused until private conflict-safe syncing exists');
 ok(!S.db().reporting.months['2025-01'],'refused edits cannot enter the shared register');
 const r=await SY.vaultPushAll();ok(!r.ok&&/Private/.test(r.reason),'source months cannot leak to the shared vault');
 ok(S.reportMarkReviewed('2025-01',0)===false,'source review remains flagged until secure edits are available');
 S.clearReportSource();ok(!S.reportMonths().includes('2025-01')||!!S.db().reporting.months['2025-01'],'clearing session removes protected source');
 ok(JSON.stringify(S.db().reporting.months['2026-10'])===beforeMonth,'source never overwrites the existing month');
 done('report_source131');
})().catch(e=>{console.error(e);process.exit(1)});
