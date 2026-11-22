'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'staff-catalog.html'),'utf8');
const script=fs.readFileSync(path.join(root,'assets/js/core/staff-catalog.js'),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function setup(role){
 const dom=new JSDOM(html,{url:'https://site.example/staff-catalog.html',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.LS_SHARED={endpoint:'https://example.supabase.co',key:'public'};
 w.fetch=async(url,opts)=>{calls.push({url,opts});let data;
  if(url.includes('/auth/v1/token'))data={access_token:'test-secret-token'};
  else if(url.includes('/rpc/lab_my_access_role'))data=role;
  else if(url.includes('/rpc/lab_staff_read_catalog'))data={revision:85,data:{staff:[{name:'Staff',phone:'123'}],trainings:[{title:'<img src=x>'}],equipment:[{name:'Centrifuge'}]}};
  else throw Error('unexpected');
  return {ok:true,json:async()=>data};
 };
 w.eval(script);return {w,dom,calls};
}
async function signIn(w){w.document.querySelector('#email').value='staff@example.org';w.document.querySelector('#password').value='private-password';w.document.querySelector('#login-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();}
(async()=>{
 const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert(index.includes('href="staff-catalog.html"'),'staff catalog must be reachable from sign-in');
 let x=await setup('Reviewer');assert(x.w.document.querySelector('#catalog').hidden);await signIn(x.w);
 assert.equal(x.calls.length,3);assert.equal(x.w.document.querySelector('#password').value,'');
 assert.equal(x.w.document.querySelector('#catalog').hidden,false);assert.match(x.w.document.querySelector('#status').textContent,/Reviewer/);
 assert.equal(x.w.document.querySelector('#trainings tbody td').textContent,'<img src=x>');assert.equal(x.w.document.querySelectorAll('img').length,0);
 assert.equal(x.w.localStorage.length,0);assert.equal(x.w.sessionStorage.length,0);
 assert.equal(x.calls[2].opts.headers.Authorization,'Bearer test-secret-token');
 x.w.document.querySelector('#sign-out').click();assert(x.w.document.querySelector('#catalog').hidden);assert.equal(x.w.document.querySelectorAll('tbody tr').length,0);x.dom.window.close();
 x=await setup(null);await signIn(x.w);assert(x.w.document.querySelector('#catalog').hidden);assert.equal(x.calls.length,2);assert.equal(x.w.document.querySelector('#password').value,'');x.dom.window.close();
 console.log('staff-catalog189: verified staff login, restricted catalog, safe rendering and sign-out passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
