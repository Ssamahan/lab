const {boot,ok,done}=require('./env');
(async()=>{const {w,errors}=await boot('#/reports');const S=w.LS.store;w.LS.sync.stopLive();S.clearPending();const old=JSON.stringify(S.reportMonth('2026-10'));const m={determineUsed:20,determineNonReactive:10,determineReactive:1,determineInvalid:2,statpakUsed:0,statpakNonReactive:null,statpakReactive:0,statpakInvalid:0};
const data={version:1,checkedAt:'2026-11-10T11:50:00Z',records:[{facility:'Coko HC',period:'2026-10',completed:'2026-11-05T10:00:00',responses:1,metrics:m}]};w.fetch=async()=>({ok:true,json:async()=>data});w.document.querySelector('[data-tab="hiv"]').click();await new Promise(r=>setTimeout(r,150));const root=w.document.querySelector('#pageInner');const panels=root.querySelectorAll('.hiv-table-panel');
ok(panels.length===4&&panels[0].textContent.includes('Determine')&&panels[1].textContent.includes('STAT-PAK'),'two paired test tables plus paired monthly tables');
ok(panels[0].textContent.includes('13')&&panels[0].textContent.includes('20')&&panels[0].textContent.includes('Reported counts differ'),'calculated and reported totals preserved and difference flagged');
ok(root.textContent.includes('not reported tests used') && root.textContent.includes('STAT-PAK results come from O–Q'), 'result totals clearly distinguished from usage and column mapping explained');
ok(panels[1].textContent.includes('—')&&panels[1].textContent.includes('0'),'missing distinct from zero');
ok([...root.querySelectorAll('h3')].some(e=>e.textContent.includes('Centre-by-month detail')),'centre-month detail retained');
ok(JSON.stringify(S.reportMonth('2026-10'))===old&&S.pendingChanges()===0,'register and queue untouched');ok(!errors.length,'no errors',errors.join(' | '));done('hiv_compact140');})().catch(e=>{console.error(e);process.exit(1)});
