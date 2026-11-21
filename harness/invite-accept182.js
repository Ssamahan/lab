'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'invite.html'),'utf8');
const source=fs.readFileSync(path.join(root,'assets/js/core/invite-accept.js'),'utf8');
async function setup(hash,verifyOK=true){
  const dom=new JSDOM(html,{url:'https://site.example/invite.html'+hash,runScripts:'outside-only'});
  const w=dom.window,calls=[]; w.LS_SHARED={endpoint:'https://example.supabase.co',key:'publishable'};
  w.fetch=async(url,options)=>{calls.push({url,options});return {ok:options.method==='GET'?verifyOK:true,json:async()=>({email:'invitee@example.org'})};};
  w.eval(source);await new Promise(r=>setTimeout(r,0));return {w,calls};
}
(async()=>{
  let {w,calls}=await setup('#access_token=token123&refresh_token=refreshsecret&type=invite');
  assert.equal(w.location.hash,'');assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');
  assert.equal(calls[0].options.headers.Authorization,'Bearer token123');assert(!w.document.body.textContent.includes('token123'));
  assert.equal(w.document.querySelector('form').hidden,false);
  assert.equal(w.document.querySelector('#staff-link').hidden,true);
  w.document.querySelector('#password').value='long-enough-password';w.document.querySelector('#confirmation').value='different-password';
  w.document.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(calls.length,1);
  w.document.querySelector('#confirmation').value='long-enough-password';w.document.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,0));
  assert.equal(calls.length,2);assert.equal(calls[1].options.method,'PUT');assert.equal(JSON.parse(calls[1].options.body).password,'long-enough-password');
  assert.equal(w.document.querySelector('form').hidden,true);assert(!w.document.documentElement.outerHTML.includes('token123'));
  assert.equal(w.document.querySelector('#staff-link').hidden,false);assert.equal(w.document.querySelector('#staff-link a').getAttribute('href'),'staff-catalog.html');
  ({w,calls}=await setup('#access_token=x&type=recovery'));assert.equal(calls.length,0);assert.equal(w.document.querySelector('form').hidden,true);assert.equal(w.location.hash,'');
  ({w,calls}=await setup('#access_token=x&type=invite',false));assert.equal(calls.length,1);assert.equal(w.document.querySelector('form').hidden,true);
  console.log('invite-accept182: token removal, validation and password setup passed');
})().catch(e=>{console.error(e);process.exit(1)});
