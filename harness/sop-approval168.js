const {boot,ok,done}=require('./env');
const wait=()=>new Promise(r=>setTimeout(r,200));
const click=e=>e.dispatchEvent(new e.ownerDocument.defaultView.MouseEvent('click',{bubbles:true}));
(async()=>{
 const {w,go}=await boot('#/quality?tab=sops');w.LS.sync.stopLive();await go('#/quality?tab=sops');
 const d=w.document,S=w.LS.store,code='RliDHL-HEM-SOP-005-VERS-001';
 const row=()=>d.querySelector('[data-source-code="'+code+'"]');
 ok(!!row()&&row().textContent.includes('Waiting for approval'),'source SOP starts waiting for approval');
 ok(d.querySelectorAll('[data-source-code]').length===22 && !!d.querySelector('[data-source-code="RliDHL-ADM-SOP-063-VERS-001"] a[href*="drive.google.com"]'),'seven Drive equipment SOPs are linked alongside five repository documents');
 const checkbox=row()&&row().querySelector('[data-approve-source]');
 ok(!!checkbox&&!checkbox.checked,'approval tick starts unchecked');
 if(!checkbox){done('sop-approval168');return;}
 click(checkbox);await wait();
 ok(!!d.querySelector('[data-confirm-approval]'),'ticking asks for confirmation of DG signature');
 click(d.querySelector('[data-confirm-approval]'));await wait();
 ok(row().querySelector('[data-approve-source]').checked&&row().textContent.includes('Approved'),'confirmed approval is shown');
 ok(S.db().sopApprovalEvents.length===1&&S.db().sopApprovalEvents[0].code===code,'approval event is stored for the specific version');
 S.save(true);S.reloadFromStorage();await go('#/quality?tab=sops');
 ok(row().querySelector('[data-approve-source]').checked,'approval survives reload');
 ok(!d.querySelector('[data-source-code="RliDHL-HEM-SOP-006-VERS-001"] [data-approve-source]').checked,'another SOP remains waiting');
 const event=S.db().sopApprovalEvents[0];
 const merged=w.LS.sync.mergeDoc({sopApprovalEvents:[]},{sopApprovalEvents:[event]});
 ok(merged.sopApprovalEvents.length===1,'approval event survives merging with a device without it');
 click(row().querySelector('[data-approve-source]'));await wait();click(d.querySelector('[data-confirm-approval]'));await wait();
 ok(!row().querySelector('[data-approve-source]').checked&&S.db().sopApprovalEvents.length===2,'correction preserves approval history');
 w.LS.auth.user={id:'v',name:'Visitor',role:'Viewer'};await go('#/quality?tab=sops');
 ok(row().querySelector('[data-approve-source]').disabled,'read-only users cannot change approval');
 done('sop-approval168');
})().catch(e=>{console.error(e);process.exit(1)});
