'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core'),binary=require('@sparticuz/chromium');
const {createGateway}=require('../scripts/staff-invite-gateway.cjs');
const {handleInvitation}=require('../scripts/staff-invite-http.cjs');
const actor='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222';
(async()=>{
 const calls=[];
 const provider=async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith('/auth/v1/user'))return opts.headers.Authorization==='Bearer admin-token'?Response.json({id:actor,is_anonymous:false}):new Response('{}',{status:401});
  if(url.includes('/rest/v1/lab_access_members?'))return Response.json([{role:'Admin'}]);
  if(url.includes('/auth/v1/invite?'))return Response.json({id:target});
  if(url.endsWith('/rest/v1/lab_access_members'))return Response.json([{user_id:target}],{status:201});
  throw Error('Unexpected provider request');
 };
 const gateway=createGateway({url:'https://example.supabase.co',publicKey:'test-public',serviceKey:'test-server-secret',redirect:'https://site.example/invite.html',fetch:provider});
 const localOrigin='http://127.0.0.1:8000';
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('https://lkjwztvhmzhasclmlocx.supabase.co/**',async route=>{
   const request=route.request(),url=request.url(),baseHeaders={'access-control-allow-origin':localOrigin,'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','content-type':'application/json'};
   if(url.includes('/functions/v1/lab-staff-invite')){
    const init={method:request.method(),headers:{...request.headers(),origin:localOrigin}};
    if(!['OPTIONS','GET','HEAD'].includes(init.method))init.body=request.postData();
    const response=await handleInvitation(new Request(url,init),{allowedOrigin:localOrigin,gateway});
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers.entries()),body:await response.text()});
   }
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:baseHeaders});
   if(url.includes('/auth/v1/token'))return route.fulfill({status:200,headers:baseHeaders,body:JSON.stringify({access_token:'admin-token'})});
   if(url.includes('/rest/v1/rpc/lab_my_access_role'))return route.fulfill({status:200,headers:baseHeaders,body:JSON.stringify('Admin')});
   throw Error('Unexpected client request');
  });
  await page.goto(localOrigin+'/staff-access.html');
  await page.locator('#admin-email').fill('admin@example.org');await page.locator('#admin-password').fill('private-test-password');await page.getByRole('button',{name:'Sign in'}).click();
  await page.getByText('Administrator verified.',{exact:false}).waitFor();
  assert.equal(calls.length,0,'page load and admin login must not send an invitation');
  await page.locator('#invite-email').fill('viewer@example.org');await page.locator('#invite-role').selectOption('Viewer');await page.getByRole('button',{name:'Send invitation'}).click();
  await page.getByText('Invitation sent.',{exact:false}).waitFor();
  assert.equal(calls.length,4);assert.equal(JSON.parse(calls[2].opts.body).email,'viewer@example.org');assert.equal(JSON.parse(calls[3].opts.body).role,'Viewer');
  const failure=await handleInvitation(new Request('https://service.example/invite',{method:'POST',headers:{origin:localOrigin,authorization:'Bearer invalid','content-type':'application/json'},body:JSON.stringify({email:'person@example.org',role:'Viewer'})}),{allowedOrigin:localOrigin,gateway});
  assert.equal(failure.status,401);assert.equal(calls.length,5);assert(!JSON.stringify(await failure.json()).includes('test-server-secret'));
  console.log('Chromium: invitation screen, handler and gateway connected end-to-end against simulated provider; unauthorized call denied.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
