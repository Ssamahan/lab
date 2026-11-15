const {boot,ok,done}=require('./env');
(async()=>{
 const {w,go}=await boot('#/quality?tab=incidents');w.LS.sync.stopLive();const S=w.LS.store,d=w.document;
 const sample={id:'nc2',ref:'NC-2026-039',title:'GeneXpert module 2 invalid result on repeat',severity:'Minor',type:'Analytical',owner:'Jean Paul NSENGIYUMVA',opened:'2026-10-03',due:'2026-10-19',status:'CAPA in progress',root:'Probe check failure after power dip',capa:'UPS installed; module recalibrated'};
 S.db().incidents=[sample];await go('#/quality?tab=incidents');
 ok(!d.querySelector('#qBody').textContent.includes(sample.title),'untouched fictional incident hidden');
 ok(S.db().incidents.length===1,'existing stored data is preserved');
 ok(!S.notifications().some(n=>n.title.includes(sample.ref)),'fictional incident does not create a notification');
 sample.evidence='Reviewed by user';await go('#/quality?tab=incidents');
 ok(d.querySelector('#qBody').textContent.includes(sample.title),'edited incident is preserved and visible');
 done('quality-evidence169');
})().catch(e=>{console.error(e);process.exit(1)});
