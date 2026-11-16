const {boot,ok,done}=require('./env');
const wait=()=>new Promise(r=>setTimeout(r,100));
const click=e=>e.dispatchEvent(new e.ownerDocument.defaultView.MouseEvent('click',{bubbles:true}));
(async()=>{
 const {w,go}=await boot('#/quality?tab=sops');w.LS.sync.stopLive();await go('#/quality?tab=sops');const d=w.document,S=w.LS.store;
 const rows=d.querySelectorAll('[data-register-row]');
 ok(rows.length===70,'all 70 source register rows are displayed');
 ok(d.querySelector('[data-register-row="13"]').textContent.includes('Aspartate Aminotransferase'),'first duplicate code retains its title');
 ok(d.querySelector('[data-register-row="14"]').textContent.includes('Total Bilirubin'),'second duplicate code retains its title');
 ok(d.querySelector('[data-register-row="1"]').textContent.includes('2025-09-22'),'master list date is shown with attribution');
 const btn=d.querySelector('[data-register-row="14"] [data-register-action]');ok(!!btn,'issue row has an action button');
 if(!btn){done('sop-register171');return;} click(btn);await wait();d.querySelector('[data-source-comment]').value='Check equipment status';click(d.querySelector('[data-save-source-action]'));await wait();
 ok(S.db().sopIssueActions.some(x=>x.code==='register:14'&&x.comment==='Check equipment status'),'action stored by row rather than duplicate code');
 S.save(true);S.reloadFromStorage();await go('#/quality?tab=sops');ok(d.querySelector('[data-register-row="14"]').textContent.includes('Check equipment status'),'row action persists');
 done('sop-register171');
})().catch(e=>{console.error(e);process.exit(1)});
