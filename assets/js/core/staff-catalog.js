/* Read-only, server-authorized staff catalog. Tokens stay in this page's memory. */
(function(){
'use strict';
const config=window.LS_SHARED||{},status=document.getElementById('status');
const login=document.getElementById('login-form'),catalog=document.getElementById('catalog');
const email=document.getElementById('email'),password=document.getElementById('password');
const allowedRoles=new Set(['Admin','Manager','Technologist','Reviewer','Viewer']);
let base='',busy=false,epoch=0;
try{const url=new URL(config.endpoint);if(url.protocol!=='https:'||!config.key)throw Error('configuration');base=url.origin;}
catch(_){status.textContent='Staff catalog is not configured.';login.hidden=true;return;}
const headers={apikey:config.key,'Content-Type':'application/json'};
function clear(){document.querySelectorAll('#catalog tbody').forEach(body=>body.replaceChildren());catalog.hidden=true;login.hidden=false;password.value='';}
function rows(selector,items,fields){
 const body=document.querySelector(selector+' tbody');
 items.forEach(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item))return;
  const tr=document.createElement('tr');
  fields.forEach(field=>{const cell=document.createElement('td');cell.textContent=typeof item[field]==='string'?item[field]:'';tr.appendChild(cell);});
  body.appendChild(tr);
 });
}
async function request(url,options){
 const response=await fetch(base+url,Object.assign({method:'POST',cache:'no-store',credentials:'omit'},options));
 if(!response.ok)throw Error('request failed');return response.json();
}
login.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;busy=true;const attempt=++epoch;
 const button=login.querySelector('button[type=submit]');button.disabled=true;status.textContent='Checking staff account…';
 const body=JSON.stringify({email:email.value.trim(),password:password.value});password.value='';
 try{
  const session=await request('/auth/v1/token?grant_type=password',{headers,body});
  if(attempt!==epoch)return;
  if(!session||typeof session.access_token!=='string'||!session.access_token)throw Error('session');
  const authenticatedHeaders=Object.assign({},headers,{Authorization:'Bearer '+session.access_token});
  const role=await request('/rest/v1/rpc/lab_my_access_role',{headers:authenticatedHeaders,body:'{}'});
  if(attempt!==epoch)return;
  if(!allowedRoles.has(role))throw Error('membership');
  const result=await request('/rest/v1/rpc/lab_staff_read_catalog',{headers:authenticatedHeaders,body:'{}'});
  if(attempt!==epoch)return;
  if(!result||!result.data||!Array.isArray(result.data.staff)||!Array.isArray(result.data.trainings)||!Array.isArray(result.data.equipment))throw Error('catalog');
  clear();rows('#staff',result.data.staff,['name','role','phone','email']);
  rows('#trainings',result.data.trainings,['title','start','end','organizer','location']);
  rows('#equipment',result.data.equipment,['name','model','status','location']);
  login.hidden=true;catalog.hidden=false;status.textContent=role+' · read-only catalog · revision '+String(result.revision||'');
 }catch(_){if(attempt===epoch){clear();status.textContent='Staff sign-in or catalog access failed. Please try again.';}}
 finally{if(attempt===epoch){busy=false;button.disabled=false;password.value='';}}
});
document.getElementById('sign-out').addEventListener('click',()=>{
 epoch++;busy=false;login.querySelector('button[type=submit]').disabled=false;clear();status.textContent='Signed out of the staff catalog.';
});
})();
