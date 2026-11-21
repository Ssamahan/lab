'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'visitor-view.html'),'utf8');
const source=fs.readFileSync(path.join(root,'assets/js/core/visitor-view.js'),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function setup(data,ok=true){
 const dom=new JSDOM(html,{url:'https://site.example/visitor-view.html',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.LS_SHARED={endpoint:'https://example.supabase.co',key:'public-key'};
 w.fetch=async(url,options)=>{calls.push({url,options});return {ok,json:async()=>data};};
 w.eval(source);await tick();return {w,calls,dom};
}
(async()=>{
 let x=await setup(null);assert.match(x.w.document.querySelector('#status').textContent,/not yet published/i);assert.equal(x.calls.length,1);x.dom.window.close();
 const data={revision:2,data:{trainings:[{title:'<img src=x onerror=alert(1)>',location:'Ruli',attendees:['private']}],equipment:[{name:'Microscope',status:'active',serial:'private'}]},reviewed_at:'2026-01-01T00:00:00Z'};
 x=await setup(data);assert.match(x.calls[0].url,/\/rpc\/lab_read_public_snapshot$/);
 assert.equal(x.calls[0].options.cache,'no-store');assert(!x.calls[0].options.headers.Authorization);
 assert.equal(x.w.document.querySelectorAll('#trainings tbody tr').length,1);
 assert.equal(x.w.document.querySelector('#trainings tbody td').textContent,'<img src=x onerror=alert(1)>');
 assert.equal(x.w.document.querySelectorAll('img').length,0);
 assert(!x.w.document.body.textContent.includes('private'));
 assert.equal(x.w.localStorage.length,0);assert.equal(x.w.sessionStorage.length,0);
 x.w.document.querySelector('[href="#equipment"]').click();await tick();assert.equal(x.w.location.hash,'#equipment');x.dom.window.close();
 x=await setup({},false);assert.match(x.w.document.querySelector('#status').textContent,/unavailable/i);assert.equal(x.w.document.querySelectorAll('tbody tr').length,0);x.dom.window.close();
 console.log('visitor-snapshot188: read-only snapshot, empty/error states and safe rendering passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
