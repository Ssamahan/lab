'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'email-login.html'),'utf8'),source=fs.readFileSync(path.join(root,'assets/js/core/email-login.js'),'utf8');
const wait=()=>new Promise(r=>setTimeout(r,0));
async function setup(role='Admin'){
 const dom=new JSDOM(html,{url:'https://lab.smhnklvn.workers.dev/email-login#access_token=valid&type=magiclink',runScripts:'outside-only'}),w=dom.window;
 w.LS_SHARED={endpoint:'https://project.supabase.co',key:'public'};w.LSC={hashPassword:async()=> 'pbkdf2$test',isModern:()=>false,isLegacy:()=>false};
 w.LS={auth:{applySavedRoles:()=>{},users:[{id:'u1'},{id:'u2'}]}};
 w.localStorage.setItem('labSystems.roles.v1',JSON.stringify({u1:{role:'Admin',twoFactor:true,totpSecret:'SECRET'},u2:{role:'Viewer'}}));
 w.localStorage.setItem('labSystems.attempts.v1',JSON.stringify({kelvin:{count:5},other:{count:1}}));
 w.localStorage.setItem('labSystems.pending.v1','4');w.fetch=async url=>({ok:true,json:async()=>url.includes('/auth/v1/user')?{email:'smhnklvn@gmail.com',is_anonymous:false}:role});
 w.eval(source);await wait();return {dom,w};
}
(async()=>{
 let {w,dom}=await setup('Viewer');assert.equal(w.document.querySelector('#reset-form').hidden,true);
 w.document.querySelector('#new-password').value='a sufficiently long password';w.document.querySelector('#confirm-password').value='a sufficiently long password';
 w.document.querySelector('#reset-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait();
 assert.equal(JSON.parse(w.localStorage.getItem('labSystems.roles.v1')).u1.passHash,undefined);dom.window.close();
 ({w,dom}=await setup());assert.equal(w.document.querySelector('#reset-form').hidden,false);
 w.document.querySelector('#new-password').value='long enough password';w.document.querySelector('#confirm-password').value='different password';
 w.document.querySelector('#reset-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait();assert.equal(JSON.parse(w.localStorage.getItem('labSystems.roles.v1')).u1.passHash,undefined);
 w.document.querySelector('#confirm-password').value='long enough password';
 w.document.querySelector('#reset-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait();
 const roles=JSON.parse(w.localStorage.getItem('labSystems.roles.v1')),attempts=JSON.parse(w.localStorage.getItem('labSystems.attempts.v1'));
 assert.equal(roles.u1.passHash,'pbkdf2$test');assert.equal(roles.u1.twoFactor,true);assert.equal(roles.u1.totpSecret,'SECRET');assert.equal(roles.u2.role,'Viewer');
 assert.equal(attempts.kelvin,undefined);assert.equal(attempts.other.count,1);assert.equal(w.localStorage.getItem('labSystems.pending.v1'),'4');
 dom.window.close();
 ({w,dom}=await setup());w.fetch=async url=>({ok:true,json:async()=>url.includes('/auth/v1/user')?{email:'smhnklvn@gmail.com',is_anonymous:false}:'Viewer'});
 w.document.querySelector('#new-password').value='long enough password';w.document.querySelector('#confirm-password').value='long enough password';
 w.document.querySelector('#reset-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait();
 assert.equal(JSON.parse(w.localStorage.getItem('labSystems.roles.v1')).u1.passHash,undefined,'revoked Admin must not reset');
 dom.window.close();console.log('admin-password-recovery197: verified Admin only, private local reset, preserved settings and queue');
})().catch(e=>{console.error(e);process.exit(1)});
