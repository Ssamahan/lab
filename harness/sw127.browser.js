/* Real service-worker smoke test with isolated local browser data. Optional npm deps:
   npm i --no-save --no-package-lock playwright-core @sparticuz/chromium */
const {chromium:pw}=require('playwright-core'), chromium=require('@sparticuz/chromium').default;
const {spawn}=require('child_process'), assert=require('assert');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{let browser;const server=spawn('python3',['-m','http.server','18767','--bind','127.0.0.1'],{cwd:require('path').resolve(__dirname,'..'),stdio:'ignore'});
try{
 await wait(300);browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 const ctx=await browser.newContext({viewport:{width:360,height:800},hasTouch:true,isMobile:true});
 await ctx.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const page=await ctx.newPage();await page.goto('http://127.0.0.1:18767/',{waitUntil:'load'});
 await page.waitForFunction(()=>window.__lsBooted===true);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);
 const details=await page.evaluate(async()=>({version:await (await fetch('sw.js',{cache:'no-store'})).text(),keys:await caches.keys()}));
 assert(details.version.includes("const VERSION = 'v6.9.127'"));assert(details.keys.includes('lab-shell-v6.9.127'));
 console.log('✓ actual browser installs and activates the complete current worker');
 await page.evaluate(()=>localStorage.setItem('test-preserve','keep'));
 await ctx.setOffline(true);await page.reload({waitUntil:'domcontentloaded',timeout:15000});await page.waitForFunction(()=>window.__lsBooted===true,{timeout:12000});
 assert.equal(await page.evaluate(()=>localStorage.getItem('test-preserve')),'keep');assert(await page.locator('#landing').isVisible());
 console.log('✓ installed cached shell opens offline without clearing local storage');
}finally{if(browser)await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1});
