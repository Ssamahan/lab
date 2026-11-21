'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'staff-access.html'),'utf8');
const source=fs.readFileSync(path.join(root,'assets/js/core/staff-access.js'),'utf8');
const wait=()=>new Promise(r=>setTimeout(r,0));
async function setup(role){
 const dom=new JSDOM(html,{url:'https://lab.example/staff-access.html',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.LS_SHARED={endpoint:'https://example.supabase.co',key:'public'};
 w.fetch=async(url,opts)=>{calls.push({url,opts});let body;
  if(url.includes('/auth/v1/token'))body={access_token:'jwt-test'};
  else if(url.includes('/rest/v1/rpc/'))body=role;
  else if(url.includes('/functions/v1/'))body={code:'sent'};
  else throw Error('unexpected request');
  return {ok:true,json:async()=>body};
 };
 w.eval(source);return {w,calls};
}
(async()=>{
 let {w,calls}=await setup('Admin');assert.equal(w.document.querySelector('#invite-form').hidden,true);
 w.document.querySelector('#admin-email').value='admin@example.org';w.document.querySelector('#admin-password').value='admin-password';
 w.document.querySelector('#login-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait();
 assert.equal(calls.length,2);assert.equal(w.document.querySelector('#admin-password').value,'');assert.equal(w.document.querySelector('#invite-form').hidden,false);
 assert(!JSON.stringify(w.localStorage).includes('jwt-test'));assert.equal(calls.filter(x=>x.url.includes('/functions/v1/')).length,0);
 w.document.querySelector('#invite-email').value='person@example.org';w.document.querySelector('#invite-role').value='Viewer';
 w.document.querySelector('#invite-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait();
 assert.equal(calls.length,3);assert.equal(calls[2].opts.headers.Authorization,'Bearer jwt-test');assert.equal(JSON.parse(calls[2].opts.body).role,'Viewer');assert(w.document.querySelector('#status').textContent.includes('sent'));
 ({w,calls}=await setup('Viewer'));w.document.querySelector('#admin-email').value='admin@example.org';w.document.querySelector('#admin-password').value='admin-password';w.document.querySelector('#login-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait();
 assert.equal(w.document.querySelector('#invite-form').hidden,true);assert.equal(calls.length,2);assert(w.document.querySelector('#status').textContent.toLowerCase().includes('administrator'));
 console.log('staff-access183: separate server-verified admin login and explicit invitation submission passed');
})().catch(e=>{console.error(e);process.exit(1)});
