const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage();
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8000/');
  await page.waitForFunction(()=>window.__lsBooted);
  await page.locator('#landEnter').click();
  await page.waitForFunction(()=>window.LS&&LS.store&&LS.shell);
  await page.evaluate(()=>location.hash='#/quality?tab=sops');
  await page.locator('#sopTable').waitFor();
  const body=page.locator('#qBody');
  if(await body.getByText('SOP-LAB-001').count()) throw Error('Example SOP visible');
  const link=body.getByRole('link',{name:/RliDHL-HEM-SOP-001-VERS-002/});
  if(await link.count()!==1 || !(await link.getAttribute('href')).startsWith('https://github.com/Ssamahan/SOPs/')) throw Error('Source document link missing');
  if(!await body.getByText(/Approval, effective dates/).count()) throw Error('Approval qualification missing');
  if(!await body.getByRole('button',{name:'Register SOP'}).count()) throw Error('Register workflow missing');
  console.log('SOP catalogue, source link and register workflow verified in Chromium');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
