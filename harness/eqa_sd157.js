const {boot,ok,done}=require('./env');
const pause=()=>new Promise(r=>setTimeout(r,180));
(async()=>{
 const {w,go}=await boot('#/dash');w.LS.sync.stopLive();const S=w.LS.store,d=w.document;
 S.commit(db=>{db.eqa=[{id:'a',program:'Biochemistry',code:'Q1 2024/25',scoring:'SD',scorePublished:'2026-01-01',analytes:{Glucose:1.5,ALT:-1}},{id:'b',program:'Biochemistry',code:'Q2 2024/25',scoring:'SD',scorePublished:'2026-04-01',analytes:{Glucose:-0.5,ALT:0}},{id:'c',program:'TB',code:'Q3 2024/25',scoring:'%',scorePublished:'2026-05-01',analytes:{'TB Smear':100}},{id:'d',program:'Serology',code:'Q4 2024/25',scoring:'SD',analytes:{}}];db.eqaAnalytes={};},{action:'test'});
 const before=JSON.stringify(S.db().eqa);
 await go('#/eqa?tab=sd');
 ok(d.querySelectorAll('[data-sd-chart]').length===2,'programmes include awaiting SD rounds without inventing values');
 ok(d.body.textContent.includes('Closer to zero')&&d.body.textContent.includes('-0.50')&&d.body.textContent.includes('0.00'),'signed results including zero and distance movement are displayed');
 ok(!d.querySelector('#eqaBody').textContent.includes('TB Smear'),'percentage results are not plotted as SD');
 ok(d.querySelector('[data-sd-chart] svg').textContent.includes('0.0 SD'),'chart identifies zero baseline');
 ok(JSON.stringify(S.db().eqa)===before,'viewing trends does not change results');
 await go('#/eqa'); d.querySelector('[data-new-eqa]').click();await pause();
 const select=d.querySelector('#eqProgram');ok(Array.from(select.options).some(x=>x.value==='Serology')&&Array.from(select.options).some(x=>x.value==='__other'),'serology and additional future programmes are available');
 select.value='__other';select.dispatchEvent(new w.Event('change',{bubbles:true}));d.querySelector('#eqOtherProgram').value='New scheme';d.querySelector('#eqCode').value='Future';d.querySelector('[data-save]').click();await pause();
 ok(S.db().eqa.some(x=>x.program==='New scheme'&&x.stage==='awaiting'),'new scheme can be recorded without invented results');done('eqa_sd157');
})().catch(e=>{console.error(e);process.exit(1)});
