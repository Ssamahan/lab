'use strict';
const assert=require('node:assert/strict');
const actor='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222';
let handler,sent=0,lastRedirect='';
const values={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'publishable',SUPABASE_SERVICE_ROLE_KEY:'server-secret'};
global.Deno={serve(fn){handler=fn;},env:{get:k=>values[k]}};
global.fetch=async(url,opts)=>{
 if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:actor,is_anonymous:false}),{status:200});
 if(url.includes('/rest/v1/lab_access_members?'))return new Response(JSON.stringify([{role:'Admin'}]),{status:200});
 if(url.includes('/auth/v1/invite?')){sent++;lastRedirect=new URL(url).searchParams.get('redirect_to');return new Response(JSON.stringify({id:target}),{status:200});}
 if(url.endsWith('/rest/v1/lab_access_members'))return new Response(JSON.stringify([{user_id:target}]),{status:201});
 throw Error('unexpected');
};
require('../scripts/staff-invite-edge.cjs');
(async()=>{
 const headers={origin:'https://lab.smhnklvn.workers.dev',authorization:'Bearer valid',apikey:'publishable','content-type':'application/json'};
 let r=await handler(new Request('https://service.example/invite',{method:'OPTIONS',headers:{origin:headers.origin}}));assert.equal(r.status,204);
 r=await handler(new Request('https://service.example/invite',{method:'POST',headers,body:JSON.stringify({email:'staff@example.org',role:'Reviewer'})}));assert.equal(r.status,200);assert.equal((await r.json()).code,'sent');assert.equal(sent,1);
 const githubHeaders={...headers,origin:'https://ssamahan.github.io'};
 r=await handler(new Request('https://service.example/invite',{method:'POST',headers:githubHeaders,body:JSON.stringify({email:'staff@example.org',role:'Reviewer'})}));assert.equal(r.status,200);assert.equal(sent,2);assert.equal(lastRedirect,'https://ssamahan.github.io/lab/invite.html');
 r=await handler(new Request('https://service.example/invite',{method:'POST',headers:{...headers,origin:'https://attacker.example'},body:JSON.stringify({email:'staff@example.org',role:'Reviewer'})}));assert.equal(r.status,403);assert.equal(sent,2);
 values.SUPABASE_SERVICE_ROLE_KEY='';r=await handler(new Request('https://service.example/invite',{method:'POST',headers,body:'{}'}));assert.equal(r.status,503);assert(!JSON.stringify(await r.json()).includes('server-secret'));
 console.log('staff-edge183: runtime configuration, preflight and invitation request passed with simulated provider');
})().catch(e=>{console.error(e);process.exit(1)});
