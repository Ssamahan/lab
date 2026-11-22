'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');const root=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'email-login.html'),'utf8'),js=fs.readFileSync(path.join(root,'assets/js/core/email-login.js'),'utf8');
const wait=()=>new Promise(r=>setTimeout(r,0));
async function boot(fragment='',role='Admin',email='smhnklvn@gmail.com',page='/email-login.html'){
 const dom=new JSDOM(html,{url:'https://lab.smhnklvn.workers.dev'+page+fragment,runScripts:'outside-only'}),w=dom.window,calls=[];
 w.LS_SHARED={endpoint:'https://project.supabase.co',key:'public'};
 w.localStorage.setItem('labSystems.pending.v1','7');w.localStorage.setItem('labSystems.db.v1','keep');
 w.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('/auth/v1/user')?{email,is_anonymous:false}:role};};
 w.eval(js);await wait();return {w,calls,dom};
}
(async()=>{
 let {w,calls,dom}=await boot('', 'Admin', 'smhnklvn@gmail.com', '/email-login');
 assert.equal(w.document.querySelector('#send').disabled,false,'Cloudflare canonical URL must be usable');
 w.document.querySelector('#send').click();await wait();
 assert.equal(calls.length,1);assert(calls[0].url.includes('/auth/v1/otp?redirect_to='));
 assert.equal(JSON.parse(calls[0].options.body).email,'smhnklvn@gmail.com');assert.equal(JSON.parse(calls[0].options.body).create_user,false);
 assert.equal(w.localStorage.getItem('labSystems.session.v2'),null);dom.window.close();
 ({w,calls,dom}=await boot('#access_token=SECRET&refresh_token=REFRESH&type=magiclink'));
 assert.equal(w.location.hash,'');assert.equal(calls.length,2);assert.equal(calls[0].options.headers.Authorization,'Bearer SECRET');
 const session=JSON.parse(w.localStorage.getItem('labSystems.session.v2'));assert.equal(session.userId,'u1');assert.equal(session.persist,true);
 assert(!JSON.stringify(w.localStorage).includes('SECRET'));assert.equal(w.localStorage.getItem('labSystems.pending.v1'),'7');assert.equal(w.localStorage.getItem('labSystems.db.v1'),'keep');dom.window.close();
 ({w,calls,dom}=await boot('#access_token=x&type=magiclink','Viewer'));assert.equal(w.localStorage.getItem('labSystems.session.v2'),null);dom.window.close();
 ({w,calls,dom}=await boot('#access_token=x&type=magiclink','Admin','other@example.org'));assert.equal(w.localStorage.getItem('labSystems.session.v2'),null);dom.window.close();
 ({w,calls,dom}=await boot('#access_token=x&type=invite'));assert.equal(w.location.hash,'');assert.equal(calls.length,0);assert.equal(w.localStorage.getItem('labSystems.session.v2'),null);dom.window.close();
 console.log('email-login195: email request, verified Admin, token removal and offline preservation passed');
})().catch(e=>{console.error(e);process.exit(1)});
