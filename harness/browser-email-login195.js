'use strict';
const {chromium}=require('playwright-core'),binary=require('@sparticuz/chromium'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage();let emails=0;
  await page.route('https://lab.smhnklvn.workers.dev/**',async route=>{
   let file=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'')||'index.html';
   if(file==='email-login')file='email-login.html';
   const resolved=path.join(root,file);if(!resolved.startsWith(root+'/')||!fs.existsSync(resolved))return route.abort();
   const type=file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css';
   return route.fulfill({status:200,contentType:type,body:fs.readFileSync(resolved)});
  });
  await page.route('https://lkjwztvhmzhasclmlocx.supabase.co/**',async route=>{
   const req=route.request(),url=req.url(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'GET,POST,OPTIONS'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   let body;
   if(url.includes('/auth/v1/otp')){emails++;body={};}
   else if(url.includes('/auth/v1/user')){if(req.headers().authorization!=='Bearer test-token')throw Error('token missing');body={email:'smhnklvn@gmail.com',is_anonymous:false};}
   else if(url.includes('/rest/v1/rpc/lab_my_access_role'))body='Admin';else return route.abort();
   return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('https://lab.smhnklvn.workers.dev/email-login');
  await page.evaluate(()=>{localStorage.setItem('labSystems.pending.v1','3');localStorage.setItem('test-register','preserve');});
  await page.getByRole('button',{name:'Send sign-in and reset link'}).click();await page.getByText('a sign-in link has been sent',{exact:false}).waitFor();
  if(emails!==1)throw Error('email request not made once');
  // The email is opened from outside the app, not a same-document hash change.
  await page.goto('about:blank');
  await page.goto('https://lab.smhnklvn.workers.dev/email-login#access_token=test-token&refresh_token=private&type=magiclink');
  await page.getByRole('heading',{name:'Set a new Kelvin password'}).waitFor();
  if(new URL(page.url()).pathname!=='/email-login')throw Error('Cloudflare canonical path not exercised');
  await page.locator('#new-password').fill('short');await page.locator('#confirm-password').fill('short');
  await page.getByRole('button',{name:'Reset local password'}).click();await page.getByText('at least 12 characters.',{exact:false}).waitFor();
  await page.locator('#new-password').fill('test-only-long-passphrase');await page.locator('#confirm-password').fill('different-passphrase');
  await page.getByRole('button',{name:'Reset local password'}).click();await page.getByText('The passwords do not match.',{exact:false}).waitFor();
  await page.locator('#confirm-password').fill('test-only-long-passphrase');
  await page.getByRole('button',{name:'Reset local password'}).click();await page.getByRole('heading',{name:'Password reset successfully'}).waitFor();
  const state=await page.evaluate(()=>({hash:location.hash,session:JSON.parse(localStorage.getItem('labSystems.session.v2')),pending:localStorage.getItem('labSystems.pending.v1'),register:localStorage.getItem('test-register'),all:JSON.stringify(localStorage)}));
  if(state.hash||state.session.userId!=='u1'||state.pending!=='3'||state.register!=='preserve'||state.all.includes('test-token'))throw Error('unsafe session or data mutation');
  await page.goto('https://lab.smhnklvn.workers.dev/');
  await page.locator('#app').waitFor({state:'visible'});
  const current=await page.evaluate(()=>({name:window.LS&&LS.auth&&LS.auth.user&&LS.auth.user.username,pending:localStorage.getItem('labSystems.pending.v1')}));
  if(current.name!=='kelvin')throw Error('verified email did not open the Kelvin console');
  if(current.pending!=='3')throw Error('offline queue lost on console entry');
  const credentials=await page.evaluate(()=>LS.auth.verifyCredentials('kelvin','test-only-long-passphrase'));
  if(!credentials.ok)throw Error('reset password does not work in the console');
  console.log('Chromium: verified email opens Kelvin console and resets password without losing offline work against simulated provider.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
