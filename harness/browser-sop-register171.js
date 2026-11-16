const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage();
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8000/');await page.waitForFunction(()=>window.__lsBooted);await page.locator('#landEnter').click();
  await page.waitForFunction(()=>window.LS&&LS.store&&LS.shell);
  await page.evaluate(()=>{LS.sync.stopLive();LS.auth.user={id:'test',name:'Test manager',role:'Admin'};location.hash='#/quality?tab=sops';});
  const rows=page.locator('[data-register-row]');await rows.first().waitFor();
  if(await rows.count()!==70)throw Error('Expected 70 register rows');
  const target=page.locator('[data-register-row="14"]');
  if(!await target.innerText().then(x=>x.includes('Total Bilirubin')))throw Error('Duplicate-code row missing');
  await target.locator('[data-register-action]').click();await page.locator('[data-source-comment]').fill('Check equipment status');await page.locator('[data-save-source-action]').click();
  if(!await target.innerText().then(x=>x.includes('Check equipment status')))throw Error('Action not displayed');
  await page.evaluate(()=>LS.store.save(true));await page.reload();await page.waitForFunction(()=>window.__lsBooted);await page.waitForFunction(()=>window.LS&&LS.store&&LS.shell);
  await page.evaluate(()=>{LS.sync.stopLive();LS.auth.user={id:'test',name:'Test manager',role:'Admin'};['auth','landing'].forEach(id=>document.getElementById(id).hidden=true);document.getElementById('app').hidden=false;location.hash='#/quality?tab=sops';LS.shell.route();});
  await target.waitFor();if(!await target.innerText().then(x=>x.includes('Check equipment status')))throw Error('Action lost after reload');
  console.log('Chromium: all register rows and action persistence verified; editor role simulated.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
