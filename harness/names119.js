const {boot,ok,done}=require('./env');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const click=e=>e.dispatchEvent(new e.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));
(async()=>{
 const {w,go,errors}=await boot('#/dash'), S=w.LS.store, A=w.LS.auth, U=w.LSU, d=w.document;
 const sample=S.db().samples[0]; S.setPatientName(sample.id,'Example Test Patient');
 ok(A.namesOpen()&&U.ptName(sample)==='Example Test Patient','Kelvin sees a local name without another reveal');
 A.closeNames(); ok(A.namesOpen(),'Kelvin still sees names after the reveal window is closed');
 S.commit(db=>db.manifests.unshift({id:'test119',manifestId:'TEST119',type:'Referral',title:'Sample Referral Manifest',testingHospital:'Test hospital',createdAt:'2026-11-01',samples:[sample.id],status:'Generated'}));
 await go('#/samples?tab=manifests'); await delay(150);
 const view=d.querySelector('[data-man-view="test119"]'); ok(!!view,'manifest is available'); click(view); await delay(150);
 ok(d.querySelector('#manDoc').textContent.includes('Example Test Patient'),'manifest preview includes recorded patient name');
 let printed='';U.print=html=>{printed=html}; click(d.querySelector('[data-print-man]'));
 ok(printed.includes('Example Test Patient'),'Print / PDF receives manifest with the patient name');
 d.querySelector('.modal [data-close]').click();
 A.user={id:'u4',role:'Viewer',name:'Viewer'};ok(!A.namesOpen()&&U.ptName(sample)==='Confidential','viewer does not inherit Kelvin visibility');
 ok(!errors.length,'no browser errors',errors.join(' | ')); done('names119');
})().catch(e=>{console.error(e);process.exit(1)});
