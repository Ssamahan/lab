/* Synthetic v6.9.123+ equipment data reopened by the restored v6.9.121 app. */
const {boot,ok,done}=require('./env');
const click=el=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));
const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const a=await boot('#/equipment'),S=a.w.LS.store;
 S.commit(d=>{d.equipment=[{id:'primary-a',name:'Synthetic A',serial:'A',role:'primary',status:'offsite',services:[{id:'case-a',kind:'curative',shippedOn:'2026-10-20',backupId:'primary-b',backupPreviousStatus:'operational'}],downtime:[]},{id:'primary-b',name:'Synthetic B',serial:'B',role:'primary',status:'deployed',deployedFor:'primary-a',services:[],downtime:[]},{id:'spare-c',name:'Synthetic C',serial:'C',role:'backup',status:'standby',services:[],downtime:[]}];},{action:'test',entity:'equipment',entityId:'synthetic'});
 S._persist();const stored=a.w.localStorage.getItem('labSystems.v1'),pending=a.w.localStorage.getItem('labSystems.pending.v1');
 a.w.close();
 const b=await boot('#/equipment',{seed(w){w.localStorage.setItem('labSystems.v1',stored);w.localStorage.setItem('labSystems.pending.v1',pending);}});
 const db=b.w.LS.store.db(),d=b.w.document;
 ok(db.equipment.find(x=>x.id==='primary-a').services[0].backupPreviousStatus==='operational','newer backup status metadata survives opening the older register');
 ok(b.w.LS.store.pendingChanges()===Number(pending),'existing pending count survives opening the older register');
 ok(db.equipment.find(x=>x.id==='primary-b').status==='deployed','opening the app does not release an active backup');
 await b.go('#/equipment');click([...d.querySelectorAll('[data-e-tab]')].find(x=>x.dataset.eTab==='pm'));await wait();
 click([...d.querySelectorAll('[data-editeq]')].find(x=>x.dataset.editeq==='primary-a'));await wait();
 const selector=d.querySelector('#eqBackup');selector.value='spare-c';selector.dispatchEvent(new b.w.Event('change',{bubbles:true}));click(d.querySelector('.modal [data-save]'));await wait();
 ok(!!d.querySelector('.modal')&&b.w.LS.store.db().equipment.find(x=>x.id==='primary-a').services[0].backupId==='primary-b','older form refuses to replace a newer active backup');
 ok(b.w.LS.store.db().equipment.find(x=>x.id==='primary-b').status==='deployed','refused replacement does not release original backup');
 click(d.querySelector('.modal [data-close]'));await wait();
 await b.go('#/equipment');click([...d.querySelectorAll('[data-e-tab]')].find(x=>x.dataset.eTab==='curative'));await wait();click([...d.querySelectorAll('[data-return]')].find(x=>x.dataset.return==='primary-a'));await wait();click(d.querySelector('.modal [data-save]'));await wait(450);
 ok(b.w.LS.store.db().equipment.find(x=>x.id==='primary-b').status==='operational','return restores operational status from later-build metadata');
 ok(b.w.LS.store.db().equipment.find(x=>x.id==='primary-a').services[0].returnedOn,'return closes the original case');
 ok(b.w.LS.store.pendingChanges()===Number(pending)+1,'return creates one additional pending change without clearing the existing queue');
 ok(!b.errors.length,'no browser errors',b.errors.join(' | '));done('rollback129');
})().catch(e=>{console.error(e);process.exit(1)});
