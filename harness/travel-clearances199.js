'use strict';
const assert=require('node:assert/strict'),{boot}=require('./env');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const {w,dom,go}=await boot('#/roster');
 try{
  w.LS.sync.stopLive();await go('#/revenue');
  const root=w.document.querySelector('#app'),key='labSystems.travelClearances.local.v1';
  assert.match(root.textContent,/Combined overview/);root.querySelector('[data-finance-tab=travel]').click();
  assert.match(root.textContent,/Travel clearances/);assert.match(root.textContent,/not backed up or synced/);
  const training=JSON.stringify(w.LS.store.db().trainings),expenses=JSON.stringify(w.LS.store.db().trainingExpenses),queue=w.LS.store.pendingChanges();
  root.querySelector('[data-travel-add]').click();await wait(20);
  const modal=w.document.querySelector('.modal-scrim:last-child');modal.querySelector('[data-travel-save]').click();assert.match(modal.querySelector('[data-travel-error]').textContent,/traveller/);assert.equal(w.localStorage.getItem(key),null);
  const values={tcTraveller:'Staff One',tcPurpose:'Sample transportation',tcOrigin:'Ruli',tcDestination:'Kigali NRL',tcStart:'2026-11-24',tcEnd:'2026-11-23',tcCost:'1000',tcExpected:'1500',tcActual:'1200'};
  for(const [id,value] of Object.entries(values))modal.querySelector('#'+id).value=value;
  modal.querySelector('[data-travel-save]').click();assert.match(modal.querySelector('[data-travel-error]').textContent,/before departure/);assert.equal(w.localStorage.getItem(key),null);
  modal.querySelector('#tcEnd').value='2026-11-25';modal.querySelector('[data-travel-save]').click();await wait(300);
  let saved=JSON.parse(w.localStorage.getItem(key));assert.equal(saved.length,1);assert.equal(saved[0].destination,'Kigali NRL');assert.equal(saved[0].cost,1000);assert.equal(saved[0].expectedReimbursement,1500);assert.equal(saved[0].actualReimbursement,1200);
  root.querySelector('[data-finance-tab=combined]').click();assert.match(root.textContent,/Combined overview/);assert.match(root.textContent,/1,200/);assert.match(root.textContent,/1,500/);root.querySelector('[data-finance-tab=travel]').click();
  assert.equal(JSON.stringify(w.LS.store.db().trainings),training);assert.equal(JSON.stringify(w.LS.store.db().trainingExpenses),expenses);assert.equal(w.LS.store.pendingChanges(),queue);
  saved[0].legacyField='preserved';delete saved[0].expectedReimbursement;w.localStorage.setItem(key,JSON.stringify(saved));
  await go('#/revenue');assert.match(root.textContent,/Kigali NRL/);root.querySelector('[data-travel-edit]').click();await wait(20);
  const edit=w.document.querySelector('.modal-scrim:last-child');assert.equal(edit.querySelector('#tcExpected').value,'');assert.equal(edit.querySelector('#tcActual').value,'1200');edit.querySelector('#tcExpected').value='-1';edit.querySelector('[data-travel-save]').click();assert.match(edit.querySelector('[data-travel-error]').textContent,/expected reimbursement/);edit.querySelector('#tcExpected').value='0';edit.querySelector('#tcActual').value='-2';edit.querySelector('[data-travel-save]').click();assert.match(edit.querySelector('[data-travel-error]').textContent,/reimbursement received/);edit.querySelector('#tcActual').value='';edit.querySelector('#tcDestination').value='<img src=x onerror=alert(1)>';edit.querySelector('[data-travel-save]').click();await wait(300);
  await go('#/revenue');assert.match(root.textContent,/<img src=x/);assert.equal(root.querySelectorAll('img[src=x]').length,0);
  saved=JSON.parse(w.localStorage.getItem(key));assert.equal(saved.length,1);assert.equal(saved[0].expectedReimbursement,0);assert.equal(saved[0].legacyField,'preserved');assert.equal(saved[0].actualReimbursement,null);root.querySelector('[data-finance-tab=combined]').click();assert.match(root.textContent,/0\/1 missions recorded/);root.querySelector('[data-finance-tab=travel]').click();
  w.LS.ui.confirm=async()=>true;root.querySelector('[data-travel-delete]').click();await wait(300);assert.equal(JSON.parse(w.localStorage.getItem(key)).length,0);
  assert.equal(JSON.stringify(w.LS.store.db().trainings),training);assert.equal(JSON.stringify(w.LS.store.db().trainingExpenses),expenses);
  w.LS.shell.ensureCore=async()=>{throw Error('maps unavailable in test');};root.querySelector('[data-finance-tab=training]').click();assert.match(root.textContent,/Training revenue/);assert(!root.querySelector('[data-travel-add]'));root.querySelector('[data-finance-tab=combined]').click();
  w.LS.auth.user={id:'review',name:'Reviewer',role:'Reviewer'};w.LS.modules.revenue.render(root,{});assert(!root.querySelector('[data-travel-add]'));
  await wait(150);console.log('travel-clearances199: create, validate, edit, delete, escape, permission and offline isolation passed');
 }finally{dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
