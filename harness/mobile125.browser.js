/* Optional real-Chromium layout regression using synthetic seed data only.
   Install: npm i --no-save --no-package-lock playwright-core @sparticuz/chromium
   Requires Chromium system libraries (libnss3 and libnspr4). */
const {chromium:pw}=require('playwright-core');
const chromium=require('@sparticuz/chromium').default;
const {spawn}=require('child_process');
const assert=require('assert');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const server=spawn('python3',['-m','http.server','18765','--bind','127.0.0.1'],{cwd:require('path').resolve(__dirname,'..'),stdio:'ignore'});
 let browser;
 try{
  await wait(300);
  browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
  const page=await browser.newPage({viewport:{width:360,height:800},hasTouch:true,isMobile:true,serviceWorkers:'block'});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:18765/#/roster',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.LS&&LS.shell&&LS.auth);
  await page.evaluate(()=>{LS.auth.user={id:'u1',username:'kelvin',name:'Kelvin SAMAHANI',role:'Admin'};['auth','landing'].forEach(id=>document.getElementById(id).hidden=true);document.getElementById('app').hidden=false;LS.shell.route();});
  await page.waitForSelector('[data-plan-next]');
  const before=await page.evaluate(()=>JSON.stringify(LS.store.db().workingPlans));
  for(const width of [320,360,390,680]){
   await page.setViewportSize({width,height:800});await wait(200);
   const plan=await page.evaluate(()=>{const box=document.querySelector('.plan-fit .dt-scroll');return {scroll:box.scrollWidth,client:box.clientWidth,visible:[...document.querySelectorAll('.cal thead [data-plan-day]')].filter(e=>getComputedStyle(e).display!=='none').length,pager:getComputedStyle(document.querySelector('.plan-pager')).display};});
   assert(plan.scroll<=plan.client+1,`plan overflows at ${width}: ${JSON.stringify(plan)}`);assert.equal(plan.visible,5);assert.notEqual(plan.pager,'none');
   console.log('✓ readable five-day plan fits '+width+'px');
  }
  await page.setViewportSize({width:360,height:800});
  const first=await page.locator('[data-plan-range]').textContent();await page.locator('[data-plan-next]').click();
  const second=await page.locator('[data-plan-range]').textContent();assert.notEqual(first,second);
  const indices=await page.evaluate(()=>[...document.querySelectorAll('.cal thead [data-plan-day]')].filter(e=>getComputedStyle(e).display!=='none').map(e=>+e.dataset.planDay));
  assert.deepEqual(indices,[5,6,7,8,9]);
  while(await page.locator('[data-plan-next]').isEnabled()) await page.locator('[data-plan-next]').click();
  assert(await page.locator('[data-plan-prev]').isEnabled());
  const lastVisible=page.locator('.cal tbody [data-cell]').filter({visible:true}).last();
  await lastVisible.click(); await page.waitForSelector('.modal');
  assert(await page.locator('.modal').isVisible(),'last visible day remains editable');
  await page.locator('.modal [data-close]').first().click(); await wait(200);
  assert.equal(await page.evaluate(()=>JSON.stringify(LS.store.db().workingPlans)),before);
  console.log('✓ date navigation reaches final days without changing plan data');
  await page.setViewportSize({width:980,height:800});await wait(200);
  if(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches)){
   assert.notEqual(await page.locator('.plan-pager').evaluate(e=>getComputedStyle(e).display),'none');
   console.log('✓ wider touch viewport uses plan navigation');
  }
  await page.setViewportSize({width:1280,height:800});await wait(200);
  assert.equal(await page.locator('.plan-pager').evaluate(e=>getComputedStyle(e).display),'none');
  assert((await page.locator('.cal thead [data-plan-day]').count())>5);
  assert((await page.locator('.cal thead [data-plan-day]').evaluateAll(es=>es.filter(e=>getComputedStyle(e).display!=='none').length))>5);
  console.log('✓ desktop keeps the full plan visible');
  for(const width of [320,360,390,980]){
   await page.setViewportSize({width,height:800});
   for(const route of ['dash','samples','stock','training','equipment','staff','reports','roster']){
    await page.evaluate(async route=>{location.hash='#/'+route;await LS.shell.route()},route);await wait(200);
    const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert(dims.scroll<=dims.client+1,`${route} overflows at ${width}: ${JSON.stringify(dims)}`);
   }
   console.log('✓ eight seeded screens do not widen the page at '+width+'px');
  }
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
