/* Optional browser test: npm i --no-save --no-package-lock playwright-core @sparticuz/chromium.
   Uses isolated browser storage, synthetic data, and a local HTTP server. */
const {chromium:pw}=require('playwright-core'), chromium=require('@sparticuz/chromium').default;
const {spawn}=require('child_process'), assert=require('assert');
// The stylesheet gate was withdrawn in v6.9.128 to restore v6.9.121 startup.
if(process.argv[2]==='style'){console.log('Stylesheet paint safeguard is not present in this build.');process.exit(0);}
const asset='/assets/js/core/store.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const server=spawn('python3',['-m','http.server','18766','--bind','127.0.0.1'],{cwd:require('path').resolve(__dirname,'..'),stdio:'ignore'});let browser;
 try{
  await wait(300);browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
  const page=await browser.newPage({viewport:{width:360,height:800},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await page.addInitScript(()=>{localStorage.setItem('test-preserve','keep');localStorage.setItem('labSystems.pending.v1','3')});
  let release;const blocked=new Promise(r=>release=r);let intercepted=false;
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='127.0.0.1')return route.abort();
   if(u.pathname.endsWith(asset)){intercepted=true;await blocked;}
   return route.continue().catch(()=>{});
  });
  await page.goto('http://127.0.0.1:18766/',{waitUntil:'commit'});
  await page.waitForFunction(()=>document.getElementById('boot'));
  await page.waitForTimeout(12500);
  assert(intercepted,'the core script request was stalled');
  assert(await page.locator('#earlyBootWarning').isVisible(),'early watchdog becomes visible while the parser-blocking script is pending');
  assert.equal(await page.evaluate(()=>localStorage.getItem('labSystems.pending.v1')),'3');
  assert.equal(await page.evaluate(()=>localStorage.getItem('test-preserve')),'keep');
  console.log('✓ stalled '+(process.argv[2]==='style'?'stylesheet':'script')+' paints a warning without modifying local data');
  await page.screenshot({timeout:3000}); // A DOM node alone is not enough: it must paint.
  release();await page.waitForFunction(()=>window.__lsBooted===true,{timeout:10000});
  await page.waitForFunction(()=>!document.querySelector('#earlyBootWarning'));
  assert(await page.locator('#landing').isVisible());console.log('✓ a late successful load removes the warning and displays the actual screen');
  await page.waitForTimeout(500);assert.equal(await page.locator('#earlyBootWarning').count(),0);console.log('✓ warning does not cover a rendered screen');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
