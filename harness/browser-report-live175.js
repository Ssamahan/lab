const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8000/');await page.waitForFunction(()=>window.__lsBooted);await page.locator('#landEnter').click();await page.waitForFunction(()=>window.LS&&LS.store&&LS.shell);
  await page.evaluate(()=>{
   LS.sync.stopLive();LS.auth.user={id:'u1',name:'Test manager',role:'Admin'};
   LS.privateNames.connected=()=>true;
   LS.privateNames.loadReportSource=async()=>{LS.store.setReportSource({'2023-06':{month:'2023-06',meta:{source:'Test snapshot'},values:{x64:{total:23}},blood:{},sourceReview:[]}},{});return 1;};
   location.hash='#/reports';
  });
  await page.locator('[data-tab="analysis"]').click();await page.locator('[data-tl="2023-06"]').waitFor();
  if(await page.evaluate(()=>!!LS.store.db().reporting.months['2023-06']))throw Error('Protected snapshot entered shared register');
  await page.evaluate(()=>LS.store.reportSet('2030-02','x64','total',71));
  if(!(await page.locator('[data-tl="2030-02"]').innerText()).includes('71'))throw Error('New month did not update the timeline');
  await page.locator('[data-tl="2030-02"]').click();await page.evaluate(()=>LS.store.reportSet('2030-02','x64','total',95));
  if(!(await page.locator('[data-tl="2030-02"]').innerText()).includes('95')||!await page.locator('[data-tl="2030-02"]').evaluate(e=>e.classList.contains('on')))throw Error('Edited month or selected marker was lost');
  await page.evaluate(()=>{LS.privateNames.connected=()=>false;LS.store.clearReportSource();});
  if(await page.locator('[data-tl="2023-06"]').count())throw Error('Protected month remained visible after sign-out');
  if(!(await page.locator('[data-history-status]').innerText()).includes('requires a private session'))throw Error('Private history availability not explained');
  console.log('Chromium: protected snapshot, live history updates and sign-out verified.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
