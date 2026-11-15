const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage();
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8000/');await page.waitForFunction(()=>window.__lsBooted);
  await page.locator('#landEnter').click();await page.waitForFunction(()=>window.LS&&LS.store&&LS.shell);
  await page.evaluate(()=>{LS.sync.stopLive();LS.auth.user={id:'test',name:'Test editor',role:'Admin'};location.hash='#/quality?tab=sops';});
  const row=page.locator('[data-source-code="RliDHL-ADM-SOP-063-VERS-001"]');await row.waitFor();
  const box=row.locator('[data-approve-source]');
  if(await box.isChecked()||!await row.getByText('Waiting for approval').count())throw Error('Expected unapproved source');
  await box.click();await page.locator('[data-confirm-approval]').click();
  if(!await box.isChecked())throw Error('Approval not displayed');
  await page.evaluate(()=>LS.store.save(true));await page.reload();await page.waitForFunction(()=>window.__lsBooted);
  await page.waitForFunction(()=>window.LS&&LS.store&&LS.shell);
  await page.evaluate(()=>{LS.sync.stopLive();LS.auth.user={id:'test',name:'Test editor',role:'Admin'};['auth','landing'].forEach(id=>document.getElementById(id).hidden=true);document.getElementById('app').hidden=false;location.hash='#/quality?tab=sops';LS.shell.route();});
  await row.waitFor();if(!await box.isChecked())throw Error('Approval did not persist after reload');
  console.log('Chromium: Drive SOP approval confirmed and persisted; editor role simulated.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
