const {boot,ok,done}=require('./env');
(async()=>{const {w,go}=await boot('#/dash');w.LS.sync.stopLive();const S=w.LS.store,d=w.document;
 S.commit(db=>{db.cqiRecommendations=[{id:'done',text:'Completed action',status:'Fully implemented',commitDate:'2026-01-01'},{id:'late',text:'Open later',status:'Awaiting review',commitDate:'2026-03-01'},{id:'early',text:'Open earlier',status:'Not implemented',commitDate:'2026-02-01'}];},{action:'test'});
 const before=JSON.stringify(S.db().cqiRecommendations);await go('#/eqa?tab=cqi');
 const text=d.querySelector('#eqaBody').textContent;
 ok(text.indexOf('Open earlier')<text.indexOf('Open later')&&text.indexOf('Open later')<text.indexOf('Completed action'),'outstanding recommendations precede completed ones, ordered by commitment date');
 ok(JSON.stringify(S.db().cqiRecommendations)===before,'display sorting preserves records');done('cqi_sort162');
})().catch(e=>{console.error(e);process.exit(1)});
