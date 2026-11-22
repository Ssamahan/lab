'use strict';
const {chromium}=require('playwright-core'),binary=require('@sparticuz/chromium'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:800}});let changed=0,emails=0;
  await page.route('https://lab.smhnklvn.workers.dev/**',async route=>{
   let file=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'');if(file==='staff-password-reset')file='staff-password-reset.html';
   const resolved=path.join(root,file);if(!resolved.startsWith(root+'/')||!fs.existsSync(resolved))return route.abort();
   return route.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:fs.readFileSync(resolved)});
  });
  await page.route('https://lkjwztvhmzhasclmlocx.supabase.co/**',async route=>{
   const req=route.request(),url=req.url(),h={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'GET,POST,PUT,OPTIONS'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:h});
   let data={};if(url.includes('/recover'))emails++;
   else if(url.includes('/rpc/lab_my_access_role'))data='Reviewer';
   else if(url.includes('/auth/v1/user')&&req.method()==='GET')data={id:'staff-id',email:'staff@example.org',is_anonymous:false,email_confirmed_at:'2026-01-01'};
   else if(url.includes('/auth/v1/user')&&req.method()==='PUT'){changed++;if(JSON.parse(req.postData()).password!=='test-passphrase-long')throw Error('Wrong password sent');}
   else return route.abort();
   return route.fulfill({status:200,headers:h,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('https://lab.smhnklvn.workers.dev/staff-password-reset');
  await page.evaluate(()=>localStorage.setItem('offline-work','preserve'));
  await page.getByLabel('Registered staff email').fill('staff@example.org');await page.getByRole('button',{name:'Send reset link'}).click();await page.getByText('If an account exists',{exact:false}).waitFor();
  if(emails!==1)throw Error('Email request failed');
  await page.goto('about:blank');await page.goto('https://lab.smhnklvn.workers.dev/staff-password-reset#access_token=token&refresh_token=private&type=recovery');
  await page.getByRole('heading',{name:'Choose a new password'}).waitFor();
  if(await page.evaluate(()=>location.hash))throw Error('Token left in address');
  await page.getByLabel('New password (at least 12 characters)').fill('test-passphrase-long');await page.getByLabel('Repeat new password').fill('wrong-password');
  await page.getByRole('button',{name:'Reset password',exact:true}).click();await page.getByText('The passwords do not match.').waitFor();
  await page.getByLabel('Repeat new password').fill('test-passphrase-long');await page.getByRole('button',{name:'Reset password',exact:true}).click();await page.getByRole('heading',{name:'Password reset successfully'}).waitFor();
  if(changed!==1||await page.evaluate(()=>localStorage.getItem('offline-work'))!=='preserve')throw Error('Reset or offline preservation failed');
  console.log('Chromium: staff recovery request, validation, reset and preserved offline work against simulated provider.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
