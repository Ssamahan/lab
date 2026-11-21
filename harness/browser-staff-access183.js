'use strict';
const {chromium}=require('playwright-core'),binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});let sent=0;
  await page.route('https://lkjwztvhmzhasclmlocx.supabase.co/**',async route=>{
    const req=route.request(),url=req.url(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','content-type':'application/json'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    let body;if(url.includes('/auth/v1/token'))body={access_token:'test-token'};
    else if(url.includes('/rest/v1/rpc/lab_my_access_role'))body='Admin';
    else if(url.includes('/functions/v1/lab-staff-invite')){if(req.headers().authorization!=='Bearer test-token')throw Error('missing authorization');sent++;body={code:'sent'};}
    else throw Error('unexpected endpoint');
    return route.fulfill({status:200,headers,body:JSON.stringify(body)});
  });
  await page.goto('http://127.0.0.1:8000/staff-access.html');
  if(await page.locator('#invite-form').isVisible())throw Error('Invitation form available before verification');
  await page.locator('#admin-email').fill('admin@example.org');await page.locator('#admin-password').fill('private-test-password');await page.getByRole('button',{name:'Sign in'}).click();
  await page.getByText('Administrator verified.',{exact:false}).waitFor();
  if(await page.locator('#admin-password').inputValue())throw Error('Password not cleared');
  if(sent)throw Error('Invitation sent without administrator action');
  await page.locator('#invite-email').fill('staff@example.org');await page.locator('#invite-role').selectOption('Reviewer');await page.getByRole('button',{name:'Send invitation'}).click();
  await page.getByText('Invitation sent.',{exact:false}).waitFor();if(sent!==1)throw Error('Expected one invitation');
  await page.getByRole('button',{name:'Sign out'}).click();if(await page.locator('#invite-form').isVisible())throw Error('Invitation form still available after sign out');
  console.log('Chromium: administrator verification and manual invitation screen tested with simulated provider.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
