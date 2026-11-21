'use strict';
const assert=require('node:assert/strict');
const {createGateway}=require('../scripts/staff-invite-gateway.cjs');
const {invite}=require('../scripts/staff-invitations.cjs');
const actor='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222';
(async()=>{
 let calls=[];
 async function transport(url,opts){calls.push({url,opts});
  if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:actor,is_anonymous:false}),{status:200});
  if(url.includes('/rest/v1/lab_access_members?'))return new Response(JSON.stringify([{role:'Admin'}]),{status:200});
  if(url.includes('/auth/v1/invite?'))return new Response(JSON.stringify({id:target}),{status:200});
  if(url.endsWith('/rest/v1/lab_access_members'))return new Response(JSON.stringify([{user_id:target}]),{status:201});
  throw Error('unexpected request');
 }
 const g=createGateway({url:'https://example.supabase.co',publicKey:'public',serviceKey:'secret',redirect:'https://site.example/invite.html',fetch:transport});
 const result=await invite({token:'usertoken',email:'test@example.org',role:'Viewer'},g);
 assert.equal(result.code,'sent');assert.equal(calls.length,4);
 assert.equal(calls[0].opts.headers.Authorization,'Bearer usertoken');
 assert.equal(calls[1].opts.headers.Authorization,'Bearer secret');
 assert.equal(JSON.parse(calls[2].opts.body).email,'test@example.org');
 assert.equal(JSON.parse(calls[3].opts.body).role,'Viewer');
 assert(!JSON.stringify(result).includes('secret'));
 assert.throws(()=>createGateway({url:'http://example.com',publicKey:'x',serviceKey:'x',redirect:'https://site.example/invite.html',fetch:transport}));
 calls=[];const unpriv=createGateway({url:'https://example.supabase.co',publicKey:'public',serviceKey:'secret',redirect:'https://site.example/invite.html',fetch:async(url,opts)=>{calls.push(url);return new Response('[]',{status:200});}});
 assert.equal((await invite({token:'bad',email:'test@example.org',role:'Viewer'},unpriv)).code,'unauthorized');assert.equal(calls.length,1);
 console.log('staff-gateway182: authenticated request and service-only provisioning verified');
})().catch(e=>{console.error(e);process.exit(1)});
