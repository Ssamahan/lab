const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const context=await browser.newContext();
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8000/#/dash');
  await page.waitForFunction(()=>window.LS&&LS.auth&&LS.shell&&LS.store);
  await page.evaluate(()=>{LS.sync.stopLive();LS.auth.user={id:'u1',username:'test',name:'Test manager',role:'Admin'};['auth','landing'].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=true;});document.getElementById('app').hidden=false;location.hash='#/reports';LS.shell.route();});
  await page.locator('[data-new-month]').first().click();
  await page.locator('#nmKey').fill('2027-01');
  await page.locator('#nmPopulation').fill('120000');
  await page.locator('[data-save]').last().click();
  await page.waitForFunction(()=>LS.store.reportMonth('2027-01').meta.catchment==='120000');
  await page.locator('[data-new-month]').first().click();
  await page.locator('#nmKey').fill('2027-02');
  await page.locator('[data-save]').last().click();
  await page.waitForFunction(()=>LS.store.reportMonth('2027-02').meta.catchment==='120000');
  await page.reload();
  await page.waitForFunction(()=>window.LS&&LS.store&&LS.store.reportMonth('2027-02').meta.catchment==='120000');
  console.log('Chromium: January population saved, copied to February and persisted after reload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
