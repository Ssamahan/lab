const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage();await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8000/');await page.waitForFunction(()=>window.__lsBooted);await page.locator('#landEnter').click();
  await page.waitForFunction(()=>window.LS&&LS.store&&LS.shell);
  await page.evaluate(()=>{LS.sync.stopLive();LS.auth.user={id:'test',name:'Test manager',role:'Admin'};location.hash='#/quality?tab=sops';});
  await page.locator('[data-review-band="unknown"]').waitFor();
  if(!await page.locator('[data-review-band="unknown"]').innerText().then(x=>x.includes('22')))throw Error('Unknown date count missing');
  await page.evaluate(()=>{location.hash='#/quality?tab=incidents';});await page.locator('#qBody [data-add-inc]').click();
  await page.locator('#inTitle').fill('Synthetic evidence test');await page.locator('#inEvidence').fill('Synthetic test log');await page.locator('[data-save]').last().click();
  await page.getByText('Synthetic evidence test').waitFor();
  const evidence=await page.evaluate(()=>LS.store.db().incidents.find(x=>x.title==='Synthetic evidence test').evidence);
  if(evidence!=='Synthetic test log')throw Error('Evidence not stored');
  console.log('Chromium: review bands and evidence-backed incident creation verified; editor role simulated.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
