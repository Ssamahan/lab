const {boot,ok,done}=require('./env');
(async()=>{
 const {w,go,errors}=await boot('#/dash'), S=w.LS.store,P=w.LS.privateNames,A=w.LS.auth;
 w.LS.sync.stopLive();S.clearPending();
 const sample=S.db().samples[0], id=sample.id, map=new Map();let offline=false, sends=0;
 const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
 w.fetch=async(url,opts={})=>{
   if(offline)throw Error('offline');
   if(!String(url).includes('xakoyknvkktpcmyecoxx')) throw Error('unexpected endpoint');
   if(String(url).includes('/auth/v1/token')) return response(200,{access_token:'FAKE_TOKEN',expires_in:3600,user:{is_anonymous:false}});
   if(String(url).includes('private_name_heads')) return response(200,[...map.values()]);
   if(String(url).includes('private_name_append')){
     const x=JSON.parse(opts.body), head=map.get(x.p_sample);sends++;
     if((head?head.entry_id:null)!==x.p_parent)return response(200,{status:'conflict'});
     map.set(x.p_sample,{sample_id:x.p_sample,entry_id:x.p_entry,patient_name:x.p_name});return response(200,{status:'saved',entry_id:x.p_entry});
   }
   throw Error('unexpected request');
 };
 ok(S.setPatientName(id,'Synthetic Local'),'save name locally');
 ok(S.pendingChanges()===0,'name save does not change the existing register pending queue');
 const n=await P.signIn('test@example.invalid','FAKE_PASSWORD');
 ok(n.pushed===1&&map.get(id).patient_name==='Synthetic Local','signed-in sync sends an existing local name');
 ok(!JSON.stringify(S.db()).includes('Synthetic Local'),'name never enters public register');
 ok(!JSON.stringify(w.localStorage).includes('FAKE_PASSWORD')&&!JSON.stringify(w.localStorage).includes('FAKE_TOKEN'),'password and token not stored in localStorage');
 S.setPatientName(id,'Synthetic Corrected');await P.sync();
 ok(map.get(id).patient_name==='Synthetic Corrected','edit syncs with the known parent');
 ok(S.names()[id].previousNames.includes('Synthetic Local'),'local name history retained on edit');
 const old=map.get(id);map.set(id,{sample_id:id,entry_id:'remote-change',patient_name:'Synthetic Remote'});
 let r=await P.sync();ok(r.conflicts===1&&S.patientName(sample)==='Synthetic Corrected','remote edit causes conflict, not overwrite');
 ok(map.get(id).patient_name==='Synthetic Remote','conflict leaves remote copy untouched');
 await P.resolve(id,'local');ok(map.get(id).patient_name==='Synthetic Corrected','choosing device name appends after the reviewed remote version');
 map.set(id,{sample_id:id,entry_id:'remote-change-2',patient_name:'Synthetic Remote'});await P.sync();
 r=await P.resolve(id,'remote');
 ok(S.patientName(sample)==='Synthetic Remote'&&S.names()[id].previousNames.includes('Synthetic Corrected'),'choosing remote retains old local name in history');
 S.setPatientName(id,'Synthetic Offline');offline=true;
 let failed=false;try{await P.sync()}catch(e){failed=true;}
 ok(failed&&S.patientName(sample)==='Synthetic Offline','offline failure keeps local name');
 offline=false;await P.sync();ok(map.get(id).patient_name==='Synthetic Offline','retry sends local name');
 const second=S.db().samples[1];map.set(second.id,{sample_id:second.id,entry_id:'second-remote',patient_name:'Synthetic Pulled'});
 await P.sync();ok(S.patientName(second)==='Synthetic Pulled','remote name received for matching sample identity');
 A.user={id:'u4',role:'Viewer',name:'Viewer'};let denied=false;try{await P.sync()}catch(e){denied=true;}
 ok(denied,'viewer cannot use Kelvin name session');P.signOut();
 A.user={id:'u1',role:'Admin',name:'Kelvin',username:'kelvin'};
 ok(!P.connected(),'private session is cleared on disconnect');
 await go('#/samples');ok(!!w.document.querySelector('[data-private-names]'),'Kelvin sees the private names connection control');
 ok(!errors.length,'app has no browser errors',errors.join(' | '));done('private120');
})().catch(e=>{console.error(e);process.exit(1)});
