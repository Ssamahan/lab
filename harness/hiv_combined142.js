const {boot,ok,done}=require('./env');
(async()=>{const {w,errors}=await boot('#/reports');const S=w.LS.store;w.LS.sync.stopLive();S.clearPending();const before=JSON.stringify(S.reportMonth('2026-10'));
const metrics=(d,s,du,su)=>({determineNonReactive:d,determineReactive:0,determineInvalid:0,statpakNonReactive:s,statpakReactive:0,statpakInvalid:0,determineUsed:du,statpakUsed:su});
const data={version:1,checkedAt:'2026-11-10T11:50:00Z',stale:true,records:[
 {facility:'Coko HC',period:'2026-09',completed:'2026-10-05T10:00:00',responses:1,metrics:metrics(10,2,11,1)},
 {facility:'Coko HC',period:'2026-10',completed:'2026-11-05T10:00:00',responses:1,metrics:metrics(20,0,20,0)},
 {facility:'Ruli HC',period:'2026-10',completed:'2026-11-05T10:00:00',responses:1,metrics:metrics(40,null,40,null)},
 {facility:'Nyange HC',period:'2026-10',completed:'2026-11-05T10:00:00',responses:2,metrics:metrics(100,1,100,1)}]};
w.fetch=async()=>({ok:true,json:async()=>data});w.document.querySelector('[data-tab="hiv"]').click();await new Promise(r=>setTimeout(r,150));const root=w.document.querySelector('#pageInner'),text=root.textContent;
ok(text.includes('Source is not current')&&text.includes('last successful result'),'stale snapshot is explicitly labeled');
ok(text.includes('Combined result sum: 32')&&text.includes('Combined reported tests used: 32'),'combined totals use complete pairs only');
ok(text.includes('2 paired centre-months')&&text.includes('not people'),'coverage and not people clearly stated');
ok(text.includes('Monthly combined trend')&&text.includes('All-time by centre'),'monthly and centre trends shown');
ok(JSON.stringify(S.reportMonth('2026-10'))===before&&S.pendingChanges()===0,'register and queue untouched');ok(!errors.length,'no page errors',errors.join(' | '));done('hiv_combined142');})().catch(e=>{console.error(e);process.exit(1)});
