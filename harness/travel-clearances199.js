'use strict';
const assert=require('node:assert/strict'),{boot}=require('./env');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const {w,dom,go}=await boot('#/roster');
 try{
  w.LS.sync.stopLive();await go('#/revenue');
  const root=w.document.querySelector('#app'),key='labSystems.travelClearances.local.v1';
  assert.match(root.textContent,/Travel clearances/);assert.match(root.textContent,/not backed up or synced/);
  const training=JSON.stringify(w.LS.store.db().trainings),expenses=JSON.stringify(w.LS.store.db().trainingExpenses),queue=w.LS.store.pendingChanges();
  root.querySelector('[data-travel-add]').click();await wait(20);
  const modal=w.document.querySelector('.modal-scrim:last-child');modal.querySelector('[data-travel-save]').click();assert.match(modal.querySelector('[data-travel-error]').textContent,/traveller/);assert.equal(w.localStorage.getItem(key),null);
  const values={tcTraveller:'Staff One',tcPurpose:'Sample transportation',tcOrigin:'Ruli',tcDestination:'Kigali NRL',tcStart:'2026-11-24',tcEnd:'2026-11-23',tcCost:'1000'};
  for(const [id,value] of Object.entries(values))modal.querySelector('#'+id).value=value;
  modal.querySelector('[data-travel-save]').click();assert.match(modal.querySelector('[data-travel-error]').textContent,/before departure/);assert.equal(w.localStorage.getItem(key),null);
  modal.querySelector('#tcEnd').value='2026-11-25';modal.querySelector('[data-travel-save]').click();await wait(300);
  let saved=JSON.parse(w.localStorage.getItem(key));assert.equal(saved.length,1);assert.equal(saved[0].destination,'Kigali NRL');assert.equal(saved[0].cost,1000);
  assert.equal(JSON.stringify(w.LS.store.db().trainings),training);assert.equal(JSON.stringify(w.LS.store.db().trainingExpenses),expenses);assert.equal(w.LS.store.pendingChanges(),queue);
  await go('#/revenue');assert.match(root.textContent,/Kigali NRL/);root.querySelector('[data-travel-edit]').click();await wait(20);
  const edit=w.document.querySelector('.modal-scrim:last-child');edit.querySelector('#tcDestination').value='<img src=x onerror=alert(1)>';edit.querySelector('[data-travel-save]').click();await wait(300);
  await go('#/revenue');assert.match(root.textContent,/<img src=x/);assert.equal(root.querySelectorAll('img[src=x]').length,0);
  saved=JSON.parse(w.localStorage.getItem(key));assert.equal(saved.length,1);
  w.LS.ui.confirm=async()=>true;root.querySelector('[data-travel-delete]').click();await wait(300);assert.equal(JSON.parse(w.localStorage.getItem(key)).length,0);
  assert.equal(JSON.stringify(w.LS.store.db().trainings),training);assert.equal(JSON.stringify(w.LS.store.db().trainingExpenses),expenses);
  w.LS.auth.user={id:'review',name:'Reviewer',role:'Reviewer'};w.LS.modules.revenue.render(root,{});assert(!root.querySelector('[data-travel-add]'));
  console.log('travel-clearances199: create, validate, edit, delete, escape, permission and offline isolation passed');
 }finally{dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
