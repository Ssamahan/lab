const {boot,ok,done}=require('./env');
const wait=()=>new Promise(r=>setTimeout(r,150));
const click=e=>e.dispatchEvent(new e.ownerDocument.defaultView.MouseEvent('click',{bubbles:true}));
(async()=>{const {w,go}=await boot('#/quality?tab=incidents');w.LS.sync.stopLive();await go('#/quality?tab=incidents');const d=w.document,S=w.LS.store;click(d.querySelector('[data-add-inc]'));await wait();
 const evidence=d.querySelector('#inEvidence');ok(!!evidence,'incident form asks for evidence');if(!evidence){done('incident-evidence169');return;}
 d.querySelector('#inTitle').value='Observed issue';const count=S.db().incidents.length;click(d.querySelector('[data-save]'));await wait();ok(S.db().incidents.length===count,'incident cannot be saved without evidence');
 evidence.value='Equipment maintenance log, 12 October';click(d.querySelector('[data-save]'));await wait();ok(S.db().incidents[0].evidence==='Equipment maintenance log, 12 October','evidence reference is saved');done('incident-evidence169');})().catch(e=>{console.error(e);process.exit(1)});
