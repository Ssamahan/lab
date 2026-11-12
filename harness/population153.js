const {boot,ok,done}=require('./env');
const wait=()=>new Promise(r=>setTimeout(r,250));
const click=e=>e.dispatchEvent(new e.ownerDocument.defaultView.MouseEvent('click',{bubbles:true}));
(async()=>{
 const {w,go}=await boot('#/dash'); w.LS.sync.stopLive(); const d=w.document,S=w.LS.store;
 await go('#/reports');
 click(d.querySelector('[data-new-month]')); await wait();
 d.querySelector('#nmKey').value='2027-01'; d.querySelector('#nmKey').dispatchEvent(new w.Event('change',{bubbles:true}));
 const population=d.querySelector('#nmPopulation');
 ok(!!population,'January opening form asks for catchment population');
 if(population){ population.value='120000'; click(d.querySelector('[data-save]')); await wait();
  ok(String(S.reportMonth('2027-01').meta.catchment)==='120000','January stores the entered population');
  click(d.querySelector('[data-new-month]')); await wait(); d.querySelector('#nmKey').value='2027-02'; d.querySelector('#nmKey').dispatchEvent(new w.Event('change',{bubbles:true})); click(d.querySelector('[data-save]')); await wait();
  ok(String(S.reportMonth('2027-02').meta.catchment)==='120000','new month carries population from January of the same calendar year');
  ok(String(S.reportMonth('2026-10').meta.catchment)==='115897','historical October population remains unchanged');
 }
 done('population153');
})().catch(e=>{console.error(e);process.exit(1)});
