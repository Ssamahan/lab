const {waitFor}=require('./browser-wait');
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core'),binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  // The test must never reach or write the real project.
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8000/');
  await waitFor(page,()=>window.__lsBooted&&window.LS&&LS.auth&&LS.shell&&LS.store);
  await page.evaluate(()=>{
   LS.sync.stopLive();
   LS.auth.user={id:'test',name:'Reviewer',role:'Reviewer'};
   LS.auth.session={userId:'test',expires:Date.now()+3600000};
   document.getElementById('landing').hidden=true;
   document.getElementById('auth').hidden=true;
   LS.shell.afterAuth();location.hash='#/roster';LS.shell.route();
  });
  await page.locator('[data-generate]').waitFor();
  await page.locator('[data-generate]').click();
  await page.getByRole('button',{name:/^(Generate draft|Archive & regenerate)$/}).last().click();
  await waitFor(page,()=>LS.store.db().audit.some(x=>x.actor==='Reviewer'&&['roster.generate','roster.regenerate.official'].includes(x.action)));
  const outcome=await page.evaluate(()=>{
   const old=JSON.stringify(LS.store.db().equipment),pending=LS.store.pendingChanges();
   const result=LS.store.commit(d=>{d.equipment=[];},{action:'equipment.remove',entity:'equipment'});
   return {unchanged:old===JSON.stringify(LS.store.db().equipment),pendingSame:pending===LS.store.pendingChanges(),result,edit:LS.auth.can('edit'),generate:LS.auth.can('roster_generate')};
  });
  assert.deepEqual(outcome,{unchanged:true,pendingSame:true,result:false,edit:false,generate:true});
  console.log('Chromium: reviewer generates a local draft and is blocked from equipment edits; live API access is not tested.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
