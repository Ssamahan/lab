const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8000/');await page.waitForFunction(()=>window.__lsBooted);await page.locator('#landEnter').click();await page.waitForFunction(()=>window.LS&&LS.store&&LS.shell);
  await page.evaluate(()=>{LS.sync.stopLive();LS.auth.user={id:'test',name:'Test manager',role:'Admin'};location.hash='#/quality?tab=sops';});
  await page.locator('#registerSearch').fill('bilirubin');
  if(!await page.locator('[data-register-row="14"]').isVisible())throw Error('matching row not visible');
  if(await page.locator('[data-register-row="13"]').isVisible())throw Error('nonmatching row visible');
  await page.locator('#registerSearch').fill('not-a-real-sop-xyz');
  if(!(await page.locator('#registerResults').innerText()).includes('0 of 70'))throw Error('empty result not displayed');
  await page.locator('#registerSearch').fill('');
  await page.locator('a[href="#sopSources"]').click();
  if(!await page.locator('[data-source-code="RliDHL-ADM-SOP-063-VERS-001"] a[href*="drive.google.com"]').isVisible())throw Error('source link not visible');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('mobile page overflows');
  console.log('Chromium: mobile register filters and source navigation work.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
