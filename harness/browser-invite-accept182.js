'use strict';
const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage();let updates=0;
  await page.route('https://lkjwztvhmzhasclmlocx.supabase.co/auth/v1/user',async route=>{
   const req=route.request(), headers={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'GET,PUT,OPTIONS','content-type':'application/json'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(req.headers().authorization!=='Bearer test-token')throw Error('Invitation token not used for verification');
   if(req.method()==='PUT'){
    if(JSON.parse(req.postData()).password!=='correct-password-123')throw Error('Wrong password payload');
    updates++;
   }
   return route.fulfill({status:200,headers,body:JSON.stringify({id:'test-id',email:'example@example.org'})});
  });
  await page.goto('http://127.0.0.1:8000/invite.html#access_token=test-token&refresh_token=test-refresh&type=invite');
  await page.getByText('Choose a password to finish setting up your account.').waitFor();
  if(new URL(page.url()).hash)throw Error('Token remains in address bar');
  await page.locator('#password').fill('correct-password-123');await page.locator('#confirmation').fill('different-password-123');await page.getByRole('button',{name:'Set password'}).click();
  if(updates)throw Error('Password mismatch submitted');
  await page.locator('#confirmation').fill('correct-password-123');await page.getByRole('button',{name:'Set password'}).click();
  await page.getByText('Password set.',{exact:false}).waitFor();
  if(updates!==1)throw Error('Expected one password update');
  if(await page.locator('form').isVisible())throw Error('Password form remains visible');
  if(!await page.getByRole('link',{name:'Sign in to the read-only staff catalog'}).isVisible())throw Error('Staff catalog link not shown');
  if(await page.getByRole('link',{name:'Sign in to the read-only staff catalog'}).getAttribute('href')!=='staff-catalog.html')throw Error('Wrong staff catalog destination');
  console.log('Chromium: invitation fragment removed, mismatches blocked, password setup sent and staff link shown.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
