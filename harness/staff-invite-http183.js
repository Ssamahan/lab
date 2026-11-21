'use strict';
const assert=require('node:assert/strict');
const {handleInvitation}=require('../scripts/staff-invite-http.cjs');
const admin='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222';
let sent=0,role='Admin';
const gateway={verify:async t=>t==='valid'?{id:admin,anonymous:false}:null,role:async()=>role,send:async()=>{sent++;return {id:target};},assign:async()=>true};
const config={gateway,allowedOrigin:'https://site.example'};
const req=(body,origin='https://site.example',authorization='Bearer valid')=>new Request('https://service.example/invite',{method:'POST',headers:{origin,authorization,'content-type':'application/json'},body:JSON.stringify(body)});
(async()=>{
 let r=await handleInvitation(req({email:'viewer@example.org',role:'Viewer'},'https://attacker.example'),config);assert.equal(r.status,403);assert.equal(sent,0);
 r=await handleInvitation(req({email:'viewer@example.org',role:'Viewer'},undefined,'Bearer invalid'),config);assert.equal(r.status,401);assert.equal(sent,0);
 role='Viewer';r=await handleInvitation(req({email:'viewer@example.org',role:'Viewer'}),config);assert.equal(r.status,403);assert.equal(sent,0);role='Admin';
 r=await handleInvitation(req({email:'viewer@example.org',role:'Admin'}),config);assert.equal(r.status,400);assert.equal(sent,0);
 r=await handleInvitation(req({email:'viewer@example.org',role:'Viewer'}),config);assert.equal(r.status,200);assert.equal(sent,1);assert.equal((await r.json()).code,'sent');assert.equal(r.headers.get('access-control-allow-origin'),'https://site.example');
 r=await handleInvitation(new Request('https://service.example/invite',{method:'OPTIONS',headers:{origin:'https://site.example'}}),config);assert.equal(r.status,204);assert(r.headers.get('access-control-allow-headers').includes('apikey'));assert.equal(sent,1);
 r=await handleInvitation(req({email:'a'.repeat(3000),role:'Viewer'}),config);assert.equal(r.status,413);assert.equal(sent,1);
 console.log('staff-invite-http183: origin, authentication, authorization, validation and body limit passed');
})().catch(e=>{console.error(e);process.exit(1)});
