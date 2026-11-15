const {boot,ok,done}=require('./env');
const wait=()=>new Promise(r=>setTimeout(r,150));
const click=e=>e.dispatchEvent(new e.ownerDocument.defaultView.MouseEvent('click',{bubbles:true}));
(async()=>{
 const {w,go}=await boot('#/quality?tab=sops');w.LS.sync.stopLive();await go('#/quality?tab=sops');const d=w.document,S=w.LS.store;
 const row=()=>d.querySelector('[data-source-code="RliDHL-HEM-SOP-007-VERS-004"]');
 ok(!!row(),'revised IAT SOP is listed');
 ok(row()&&row().textContent.includes('Waiting for approval'),'revised unsigned SOP is not treated as approved');
 ok(row()&&row().textContent.includes('code'),'document-code conflict is explained');
 const button=row()&&row().querySelector('[data-source-action]');ok(!!button,'document issue offers an action button');
 if(!button){done('sop-review170');return;}
 click(button);await wait();const comment=d.querySelector('[data-source-comment]');ok(!!comment,'action accepts a comment');
 comment.value='Verify the master-list code';click(d.querySelector('[data-save-source-action]'));await wait();
 ok(S.db().sopIssueActions.some(x=>x.code==='RliDHL-HEM-SOP-007-VERS-004'&&x.comment==='Verify the master-list code'),'action comment is stored');
 S.save(true);S.reloadFromStorage();await go('#/quality?tab=sops');ok(row().textContent.includes('Verify the master-list code'),'action persists after reload');
 done('sop-review170');
})().catch(e=>{console.error(e);process.exit(1)});
