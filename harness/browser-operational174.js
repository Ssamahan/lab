const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage({reducedMotion:'reduce'});
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8000/');await page.waitForFunction(()=>window.__lsBooted);await page.locator('#landEnter').click();await page.waitForFunction(()=>window.LS&&LS.shell&&LS.store);
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:900});
   await page.evaluate(()=>{LS.sync.stopLive();LS.auth.user={id:'test',name:'Test manager',role:'Admin'};LS.store.settings().theme='porcelain';LS.shell.applyTheme();location.hash='#/dash';});
   await page.locator('.dashboard-heading').waitFor();
   const palette=await page.evaluate(()=>({background:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),font:getComputedStyle(document.querySelector('.hero h1')).fontFamily,sidebar:getComputedStyle(document.documentElement).getPropertyValue('--rail-w').trim()}));
   if(palette.background!=='#FAFAF9'||!palette.font.includes('Inter')||palette.sidebar!=='232px')throw Error('Unexpected design tokens: '+JSON.stringify(palette));
   if(!await page.locator('[data-hero-register]').isVisible())throw Error('Dashboard action missing');
   for(const [hash,selector] of [['stock','#stkTable'],['samples','.page-head'],['eqa','.page-head'],['roster','.page-head'],['quality?tab=sops','#registerSearch']]){
    await page.evaluate(h=>{location.hash='#/'+h;},hash);await page.locator(selector).first().waitFor();
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Page overflow at '+width+' in '+hash);
   }
   console.log('Operational pages and responsive layout checked at '+width+'px');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
