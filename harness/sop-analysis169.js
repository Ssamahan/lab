const {boot,ok,done}=require('./env');
(async()=>{
 const {w,go}=await boot('#/quality?tab=sops');w.LS.sync.stopLive();const S=w.LS.store,U=w.LSU,d=w.document;
 const dates=[-1,10,50,120,300,400,null];
 S.db().sops=dates.map((n,i)=>({id:'user'+i,code:'RliDHL-PAR-SOP-'+String(i+1).padStart(3,'0')+'-VERS-001',title:'Recorded SOP '+i,review:n===null?'':U.addDays(U.todayISO(),n),acknowledged:false}));
 await go('#/quality?tab=sops');const text=d.querySelector('#qBody').textContent;
 for(const name of ['Overdue','0–30 days','31–90 days','91–180 days','181–360 days','Beyond 360 days','Unknown review date']) ok(text.includes(name),name+' band is visible');
 ok(text.includes('Parasitology'),'section is named');
 ok(d.querySelector('[data-review-band="0-30"]').textContent.includes('1'),'30-day band counts a recorded review date');
 ok(d.querySelector('[data-review-band="unknown"]').textContent.includes('13'),'unknown dates include unverified source documents');
 done('sop-analysis169');
})().catch(e=>{console.error(e);process.exit(1)});
