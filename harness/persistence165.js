const {boot,ok,done}=require('./env');
(async()=>{
 const {w}=await boot('#/dash');
 w.LS.sync.stopLive();
 const S=w.LS.store;
 S.commit(db=>{db.reporting.months['2031-01']={month:'2031-01',meta:{catchment:'120000'},values:{},blood:{},notes:''};});
 w.dispatchEvent(new w.Event('pagehide'));
 const stored=JSON.parse(w.localStorage.getItem(S.STORAGE_KEY));
 ok(stored.reporting.months['2031-01']?.meta.catchment==='120000','pending edit is persisted when leaving immediately');
 S.commit(db=>{db.reporting.months['2031-02']={month:'2031-02',meta:{catchment:'130000'},values:{},blood:{},notes:''};});
 Object.defineProperty(w.document,'hidden',{value:true,configurable:true});
 w.document.dispatchEvent(new w.Event('visibilitychange'));
 const background=JSON.parse(w.localStorage.getItem(S.STORAGE_KEY));
 ok(background.reporting.months['2031-02']?.meta.catchment==='130000','pending edit is persisted when a tab is backgrounded');
 done('persistence165');
})().catch(e=>{console.error(e);process.exit(1)});
