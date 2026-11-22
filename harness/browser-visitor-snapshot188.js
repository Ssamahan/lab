const {waitFor}=require('./browser-wait');
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core'),binary=require('@sparticuz/chromium');
(async()=>{
 let browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});const calls=[];
  await page.route('https://lkjwztvhmzhasclmlocx.supabase.co/**',async route=>{
   const req=route.request();calls.push(req.url());
   if(!req.url().includes('/rpc/lab_read_public_snapshot'))throw Error('visitor requested private endpoint');
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'apikey,content-type'}});
   return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify({revision:4,data:{trainings:[{title:'<img src=x onerror=alert(1)>',location:'Ruli'}],equipment:[{name:'Microscope',status:'active'}]}})});
  });
  await page.goto('http://127.0.0.1:8000/visitor-view.html');
  await page.getByText('Public snapshot · revision 4').waitFor();
  assert.equal(await page.locator('#trainings tbody td').first().textContent(),'<img src=x onerror=alert(1)>');
  assert.equal(await page.locator('img').count(),0);assert(await page.getByText('Microscope').isVisible());
  await page.getByRole('link',{name:'Equipment'}).click();assert.equal(new URL(page.url()).hash,'#equipment');
  assert(calls.every(url=>url.includes('/rpc/lab_read_public_snapshot')));
  await browser.close();
  browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
  const ctx=await browser.newContext();
  await ctx.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const offlinePage=await ctx.newPage();await offlinePage.goto('http://127.0.0.1:8000/');
  await waitFor(offlinePage,()=>window.__lsBooted===true);
  await offlinePage.evaluate(()=>navigator.serviceWorker.ready);await waitFor(offlinePage,()=>navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  let failed=false;try{await offlinePage.goto('http://127.0.0.1:8000/visitor-view.html');}catch(_){failed=true;}
  assert(failed,'an uncached offline visitor page must not fall back to the full private application');
  await ctx.close();
  console.log('Chromium: visitor snapshot is read-only, safe-rendered and fails closed offline.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
