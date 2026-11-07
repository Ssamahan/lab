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
 const mk=id=>{const s=Object.assign({},sample,{id,sampleId:id,patientName:'Confidential'});S.db().samples.push(s);return s;};
 const second=mk('synthetic-second');S.setPatientName(second.id,'—');
 map.set(second.id,{sample_id:second.id,entry_id:'second-remote',patient_name:'Synthetic Pulled'});
 r=await P.sync();ok(r.conflicts===0&&S.patientName(second)==='Synthetic Pulled','dash placeholder receives a real remote name automatically');
 ok(S.names()[second.id].previousNames.includes('—'),'placeholder preserved in local history');
 const third=mk('synthetic-third');S.setPatientName(third.id,'-');const beforeSends=sends;
 await P.sync();ok(!map.has(third.id)&&sends===beforeSends,'a dash is never uploaded as a name');
 const fourth=mk('synthetic-fourth');map.set(fourth.id,{sample_id:fourth.id,entry_id:'placeholder-cloud',patient_name:'—'});
 await P.sync();ok(!S.patientName(fourth),'a remote placeholder is never copied as a real name');
 const fifth=mk('synthetic-fifth');map.set(fifth.id,{sample_id:fifth.id,entry_id:'fifth-remote',patient_name:'Synthetic Real'});
 await P.sync();S.setPatientName(fifth.id,'—');r=await P.sync();
 ok(r.conflicts===1&&S.patientName(fifth)==='—','placeholder after a real baseline stays for review');
 let refused=false;try{await P.resolve(fifth.id,'local');}catch(e){refused=true;}
 ok(refused&&map.get(fifth.id).patient_name==='Synthetic Real','placeholder cannot overwrite the private value');
 await P.resolve(fifth.id,'remote');ok(S.patientName(fifth)==='Synthetic Real','review can explicitly choose the real remote name');
 const history=mk('synthetic-history');S.setPatientName(history.id,'Synthetic Older');S.setPatientName(history.id,'—');
 map.set(history.id,{sample_id:history.id,entry_id:'history-remote',patient_name:'Synthetic Different'});
 r=await P.sync();ok(r.conflicts===1&&S.patientName(history)==='—'&&P.conflicts()[0].previous.includes('Synthetic Older'),'different locally preserved historical name is shown for review');
 await P.resolve(history.id,'remote');ok(S.names()[history.id].previousNames.includes('Synthetic Older'),'historical name remains after reviewed choice');
 const sixth=mk('synthetic-sixth');S.setPatientName(sixth.id,'—');map.set(sixth.id,{sample_id:sixth.id,entry_id:'sixth-remote',patient_name:'Synthetic Incoming'});
 const oldSet=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(k,v){if(k===S.NAMES_KEY)throw Error('disk full');return oldSet.call(this,k,v);};
 let storageFailed=false;try{await P.sync();}catch(e){storageFailed=true;}w.Storage.prototype.setItem=oldSet;
 ok(storageFailed&&S.patientName(sixth)==='—'&&map.get(sixth.id).patient_name==='Synthetic Incoming','failed local storage leaves both copies intact');
 await P.sync();ok(S.patientName(sixth)==='Synthetic Incoming','placeholder can retry after storage recovers');
 A.user={id:'u4',role:'Viewer',name:'Viewer'};let denied=false;try{await P.sync()}catch(e){denied=true;}
 ok(denied,'viewer cannot use Kelvin name session');P.signOut();
 A.user={id:'u1',role:'Admin',name:'Kelvin',username:'kelvin'};
 ok(!P.connected(),'private session is cleared on disconnect');
 await go('#/samples');ok(!!w.document.querySelector('[data-private-names]'),'Kelvin sees the private names connection control');
 ok(!errors.length,'app has no browser errors',errors.join(' | '));done('private121');
})().catch(e=>{console.error(e);process.exit(1)});
