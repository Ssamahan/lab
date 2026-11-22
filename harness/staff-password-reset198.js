'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'staff-password-reset.html'),'utf8'),script=fs.readFileSync(path.join(root,'assets/js/core/staff-password-reset.js'),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));
async function setup(url='https://lab.smhnklvn.workers.dev/staff-password-reset',role='Viewer',confirmed=true){
 const dom=new JSDOM(html,{url,runScripts:'outside-only'}),w=dom.window,calls=[];
 w.LS_SHARED={endpoint:'https://project.supabase.co',key:'public'};
 w.localStorage.setItem('labSystems.pending.v1','keep');
 let currentRole=role;
 w.fetch=async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>url.includes('/rpc/')?currentRole:{id:'staff-id',email:'staff@example.org',email_confirmed_at:confirmed?'2026-01-01':null,is_anonymous:false}};};
 w.eval(script);await tick();return {w,dom,calls,setRole:r=>{currentRole=r;}};
}
function submit(w,selector){w.document.querySelector(selector).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}
(async()=>{
 let x=await setup();x.w.document.querySelector('#email').value='staff@example.org';submit(x.w,'#request-form');await tick();
 assert.equal(x.calls.length,1);assert.match(x.calls[0].url,/auth\/v1\/recover/);assert.match(x.calls[0].url,/redirect_to=https%3A%2F%2Flab.smhnklvn.workers.dev%2Fstaff-password-reset/);
 assert.deepEqual(JSON.parse(x.calls[0].opts.body),{email:'staff@example.org'});assert.match(x.w.document.querySelector('#request-status').textContent,/If an account exists/);x.dom.window.close();
 x=await setup('https://lab.smhnklvn.workers.dev/staff-password-reset#access_token=secret&refresh_token=refresh&type=recovery');
 assert.equal(x.w.location.hash,'');assert.equal(x.w.document.querySelector('#recovery-section').hidden,false);assert(!JSON.stringify(x.w.localStorage).includes('secret'));
 x.w.document.querySelector('#password').value='short';x.w.document.querySelector('#confirmation').value='short';submit(x.w,'#password-form');await tick();assert.match(x.w.document.querySelector('#password-status').textContent,/12 characters/);assert.equal(x.calls.length,2);
 x.w.document.querySelector('#password').value='a-long-test-password';x.w.document.querySelector('#confirmation').value='different-password';submit(x.w,'#password-form');await tick();assert.match(x.w.document.querySelector('#password-status').textContent,/do not match/);assert.equal(x.calls.length,2);
 x.w.document.querySelector('#confirmation').value='a-long-test-password';submit(x.w,'#password-form');await tick();
 assert.equal(x.calls.length,5);assert.equal(x.calls[4].opts.method,'PUT');assert.equal(x.calls[4].opts.headers.Authorization,'Bearer secret');assert.deepEqual(JSON.parse(x.calls[4].opts.body),{password:'a-long-test-password'});
 assert.equal(x.w.document.querySelector('#success').hidden,false);assert.equal(x.w.document.querySelector('#password').value,'');assert.equal(x.w.localStorage.getItem('labSystems.pending.v1'),'keep');x.dom.window.close();
 x=await setup('https://lab.smhnklvn.workers.dev/staff-password-reset#access_token=secret&type=recovery',null);assert(x.w.document.querySelector('#recovery-section').hidden);assert.equal(x.calls.length,2);x.dom.window.close();
 x=await setup('https://lab.smhnklvn.workers.dev/staff-password-reset#access_token=secret&type=recovery','Viewer',false);assert(x.w.document.querySelector('#recovery-section').hidden);assert.equal(x.calls.length,1);x.dom.window.close();
 x=await setup('https://lab.smhnklvn.workers.dev/staff-password-reset#access_token=secret&type=invite');assert.equal(x.calls.length,0);assert(x.w.document.querySelector('#recovery-section').hidden);x.dom.window.close();
 x=await setup('https://lab.smhnklvn.workers.dev/staff-password-reset#access_token=secret&type=recovery');x.setRole(null);
 x.w.document.querySelector('#password').value='a-long-test-password';x.w.document.querySelector('#confirmation').value='a-long-test-password';submit(x.w,'#password-form');await tick();
 assert.equal(x.calls.length,4);assert(x.calls.every(c=>c.opts.method!=='PUT'));assert.match(x.w.document.querySelector('#password-status').textContent,/inactive/);x.dom.window.close();
 x=await setup('https://ssamahan.github.io/lab/staff-password-reset.html');x.w.document.querySelector('#email').value='staff@example.org';submit(x.w,'#request-form');await tick();assert.match(x.calls[0].url,/ssamahan.github.io%2Flab%2Fstaff-password-reset.html/);x.dom.window.close();
 x=await setup('https://evil.example/staff-password-reset#access_token=secret&type=recovery');assert.equal(x.calls.length,0);assert.equal(x.w.location.hash,'');x.dom.window.close();
 console.log('staff-password-reset198: recovery, roles, verification, failure, redirect and offline preservation passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
