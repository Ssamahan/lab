/* Synthetic vault conflict checks; no network or production records. */
const {boot,ok,done}=require('./env');
(async()=>{
 const {w}=await boot('#/dash'); const S=w.LS.store,SY=w.LS.sync;
 SY.stopLive(); const existing=JSON.parse(JSON.stringify(S.reportMonth('2026-10')));
 let requests=[];
 w.fetch=async(url,opts={})=>{ requests.push({url,opts}); return {ok:false,status:409,text:async()=>'{"code":"23505"}'}; };
 let refused=false; try{await SY.vaultPushMonth('2026-10',existing);}catch(e){refused=/not overwritten/.test(e.message);}
 ok(refused,'a duplicate online month is refused');
 ok(!requests[0].url.includes('on_conflict')&&!String(requests[0].opts.headers.Prefer).includes('merge-duplicates'),'vault insert never asks for an overwrite');
 const different=JSON.parse(JSON.stringify(existing)); different.values.x64={total:9999};
 const fresh={month:'2030-11',meta:{},values:{x64:{total:4}},blood:{},notes:''};
 w.fetch=async()=>({ok:true,status:200,json:async()=>[{ym:'2026-10',data:different,updated_at:'2099-01-01T00:00:00Z'},{ym:'2030-11',data:fresh,updated_at:'2099-01-01T00:00:00Z'}]});
 const r=await SY.vaultMerge();
 ok(r.conflicts.includes('2026-10')&&r.added===1&&r.updated===0,'different copies are flagged while missing months are added');
 ok(JSON.stringify(S.reportMonth('2026-10'))===JSON.stringify(existing),'fetch cannot overwrite the local existing month');
 ok(S.reportMonth('2030-11').values.x64.total===4,'a genuinely absent month is restored');
 done('report_vault131');
})().catch(e=>{console.error(e);process.exit(1)});
