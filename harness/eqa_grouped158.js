const {boot,ok,done}=require('./env');
(async()=>{
 const {w,go}=await boot('#/dash');w.LS.sync.stopLive();const S=w.LS.store,d=w.document;
 S.commit(db=>{db.eqa=[{id:'a',program:'Hematology',code:'Q1 2024/25',scoring:'SD',reported:'2026-01-01',analytes:{WBC:1,HCT:0}},{id:'b',program:'Hematology',code:'Q2 2024/25',scoring:'SD',reported:'2026-02-01',analytes:{WBC:-0.5}},{id:'c',program:'Hematology',code:'Q3 2024/25',scoring:'SD',reported:'2026-03-01',analytes:{HCT:-1,WBC:0}},{id:'d',program:'Biochemistry',code:'Q1 2024/25',scoring:'SD',reported:'2026-01-01',analytes:{Glucose:2}},{id:'e',program:'Hematology',code:'Q4 2024/25',scoring:'%',reported:'2026-04-01',analytes:{WBC:100}}];},{action:'test'});
 const saved=JSON.stringify(S.db().eqa),calls=[];const line=w.LS.charts.line;w.LS.charts.line=(el,cfg)=>{if(cfg.id.startsWith('sdTrend'))calls.push(cfg);return line(el,cfg);};
 await go('#/eqa?tab=sd');
 ok(d.querySelectorAll('[data-sd-chart]').length===2,'one chart per programme');
 const h=calls.find(x=>x.series.some(s=>s.name==='WBC')),wbc=h.series.find(x=>x.name==='WBC'),hct=h.series.find(x=>x.name==='HCT');
 ok(h.series.length===2&&wbc.color!==hct.color,'tests have distinct colours on the same chart');
 ok(JSON.stringify(wbc.values.slice(0,3))==='[1,-0.5,0]'&&JSON.stringify(hct.values.slice(0,3))==='[0,null,-1]'&&wbc.values.slice(3).every(v=>v===null),'round alignment preserves zeros and gaps, excluding percentages');
 ok(h.target.value===0&&h.min<=-2&&h.max>=2,'signed graph includes zero reference and both sides');
 ok(d.querySelector('#eqaBody').textContent.includes('WBC')&&d.querySelector('#eqaBody').textContent.includes('HCT'),'legend and results identify tests');
 ok(JSON.stringify(S.db().eqa)===saved,'no saved EQA records changed');done('eqa_grouped158');
})().catch(e=>{console.error(e);process.exit(1)});
