const {boot,ok,done}=require('./env');
const wait=()=>new Promise(r=>setTimeout(r,180));
const click=e=>e.dispatchEvent(new e.ownerDocument.defaultView.MouseEvent('click',{bubbles:true}));
(async()=>{
 const {w,go}=await boot('#/dash');w.LS.sync.stopLive();const d=w.document,S=w.LS.store;const check=JSON.stringify(S.db().checklist);
 ok(!d.body.textContent.includes('ISO readiness'),'dashboard no longer shows invented ISO readiness');
 await go('#/quality?tab=iso');ok(!d.body.textContent.includes('ISO 15189 readiness'),'old ISO link does not show readiness');
 await go('#/quality?tab=sops');click(d.querySelector('[data-add-sop]'));await wait();
 const set=(key,val)=>{d.querySelector('[data-sop-field="'+key+'"]').value=val;};
 set('code','TEST-001');set('title','Specimen handling');set('review','2027-05-01');set('content','Verified local procedure');click(d.querySelector('[data-save-sop]'));await wait();
 let sop=S.db().sops.find(x=>x.code==='TEST-001');ok(!!sop&&sop.content==='Verified local procedure','SOP registration saves text and review date');
 click(d.querySelector('[data-sop="'+sop.id+'"]'));await wait();click(d.querySelector('[data-edit-sop]'));await wait();set('content','Updated procedure');click(d.querySelector('[data-save-sop]'));await wait();
 sop=S.db().sops.find(x=>x.code==='TEST-001');ok(sop.content==='Updated procedure'&&sop.history[0].content==='Verified local procedure','SOP edits preserve prior text');
 ok(JSON.stringify(S.db().checklist)===check,'existing checklist data is not deleted');done('quality153');
})().catch(e=>{console.error(e);process.exit(1)});
