const {boot,ok,done}=require('./env');
const wait=n=>new Promise(r=>setTimeout(r,n||200));
const click=e=>e.dispatchEvent(new e.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));
(async()=>{
 const {w,go,errors}=await boot('#/dash'); const S=w.LS.store,SY=w.LS.sync,d=w.document,U=w.LSU;
 SY.stopLive();
 let legacy=JSON.parse(JSON.stringify(S.db())); legacy.meta.patientNamesMasked=false;
 legacy.samples.unshift({id:'legacy118',sampleId:'TEST-118',patientId:'PID-118',patientName:'Test Patient',test:'TB Culture',collectionDate:'2026-10-01',status:'Registered'});
 S.importJSON(legacy);
 ok(S.patientName({id:'legacy118'})==='Test Patient','legacy name saved in device name store before mask');
 ok(S.db().samples.find(x=>x.id==='legacy118').patientName===U.CONFIDENTIAL,'register masks name after durable save');
 const orig=w.Storage.prototype.setItem;
 w.Storage.prototype.setItem=function(k,v){if(k===S.NAMES_KEY)throw Error('storage full');return orig.call(this,k,v);};
 const old=JSON.parse(JSON.stringify(S.db()));old.meta.patientNamesMasked=false;
 old.samples.unshift({id:'legacyfail118',sampleId:'TEST-F-118',patientId:'PID-F-118',patientName:'Another Patient',test:'TB Culture',collectionDate:'2026-10-01',status:'Registered'});
 S.importJSON(old);
 ok(S.db().samples.find(x=>x.id==='legacyfail118').patientName==='Another Patient','storage failure does not erase legacy name');
 ok(!S.db().meta.patientNamesMasked,'migration remains eligible to retry');
 let posts=0;w.fetch=async()=>{posts++;throw Error('unexpected network');};
 let err='';try{await SY.push({allowPristine:true});}catch(e){err=e.message;}
 ok(/protect them/i.test(err)&&posts===0,'unmasked name blocks network publication before any POST',err);
 ok(!S.setPatientName('test-fail','Typed Patient'),'failed local storage reports failure');
 w.Storage.prototype.setItem=orig;S.harvestNames(S.db());
 ok(S.patientName({id:'legacyfail118'})==='Another Patient','name can be recovered after storage works again');
 S.clearPending(); await go('#/samples');await wait();click(d.querySelector('[data-names-bulk]'));await wait();
 ok(d.body.textContent.includes('Patient ID:'),'bulk name form includes patient IDs');
 ok(!errors.length,'boot has no errors',errors.join(' | ')); done('patient118');
})().catch(e=>{console.error(e);process.exit(1)});
