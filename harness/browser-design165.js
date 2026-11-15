const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const context=await browser.newContext({reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();
  for(const width of [375,1440]){
   await page.setViewportSize({width,height:900});
   await page.goto('http://127.0.0.1:8000/');
   await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
   await page.reload();
   await page.waitForFunction(()=>window.__lsBooted);
   await page.locator('#landing').waitFor({state:'visible'});
   const button=page.locator('#landEnter');
   if(!(await button.isVisible()))throw Error('Visitor entry is hidden at '+width);
   const box=await button.boundingBox();
   if(!box||box.x<0||box.x+box.width>width)throw Error('Visitor entry extends beyond viewport at '+width);
   await button.focus();
   if(await page.evaluate(()=>document.activeElement.id)!=='landEnter')throw Error('Visitor entry is not keyboard focusable');
   await button.press('Enter');
   await page.locator('#app').waitFor({state:'visible'});
   await page.waitForFunction(()=>window.LS&&LS.store&&LS.shell);
   if(!await page.locator('.nav-item').count())throw Error('Navigation did not render');
   console.log('Overview and keyboard visitor entry work at '+width+'px');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
