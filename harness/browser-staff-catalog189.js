'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core'),binary=require('@sparticuz/chromium');
(async()=>{
 let browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});let catalogCalls=0;
  await page.route('https://lkjwztvhmzhasclmlocx.supabase.co/**',async route=>{
   const req=route.request(),url=req.url(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','content-type':'application/json'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   let body;
   if(url.includes('/auth/v1/token'))body={access_token:'test-token'};
   else if(url.includes('/rpc/lab_my_access_role'))body='Viewer';
   else if(url.includes('/rpc/lab_staff_read_catalog')){assert.equal(req.headers().authorization,'Bearer test-token');catalogCalls++;body={revision:85,data:{staff:[{name:'Example',phone:'123'}],trainings:[{title:'<img src=x>'}],equipment:[{name:'Microscope'}]}};}
   else throw Error('Unexpected endpoint');
   return route.fulfill({status:200,headers,body:JSON.stringify(body)});
  });
  await page.goto('http://127.0.0.1:8000/staff-catalog.html');
  assert(!(await page.locator('#catalog').isVisible()));
  await page.locator('#email').fill('viewer@example.org');await page.locator('#password').fill('test-password');await page.getByRole('button',{name:'Sign in'}).click();
  await page.getByText('Viewer · read-only catalog · revision 85').waitFor();assert.equal(catalogCalls,1);
  assert.equal(await page.locator('#trainings tbody td').first().textContent(),'<img src=x>');assert.equal(await page.locator('img').count(),0);
  assert.equal(await page.locator('#password').inputValue(),'');
  await page.getByRole('button',{name:'Sign out'}).click();assert(!(await page.locator('#catalog').isVisible()));assert.equal(await page.locator('#catalog tbody tr').count(),0);
  await browser.close();browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
  const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const offline=await context.newPage();await offline.goto('http://127.0.0.1:8000/');await offline.waitForFunction(()=>window.__lsBooted===true);
  await offline.evaluate(()=>navigator.serviceWorker.ready);await offline.waitForFunction(()=>navigator.serviceWorker.controller);await context.setOffline(true);
  let failed=false;try{await offline.goto('http://127.0.0.1:8000/staff-catalog.html');}catch(_){failed=true;}
  assert(failed,'uncached staff-only page must not fall back to the private app offline');
  await context.close();console.log('Chromium: staff login, scoped catalog, sign-out and offline fallback checked against simulated provider.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
