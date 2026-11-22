/* Individual staff recovery uses Supabase Auth; no tokens or passwords are stored. */
(function(){
'use strict';
const requestForm=document.getElementById('request-form'),requestStatus=document.getElementById('request-status');
const form=document.getElementById('password-form'),section=document.getElementById('recovery-section'),status=document.getElementById('password-status');
const email=document.getElementById('email'),password=document.getElementById('password'),confirmation=document.getElementById('confirmation');
const hadFragment=!!location.hash;
const fragment=new URLSearchParams(location.hash.slice(1));
let token=fragment.get('access_token');const kind=fragment.get('type');
// Remove every fragment (including refresh tokens and provider errors) immediately.
if(location.hash)history.replaceState(null,'',location.pathname+location.search);
const cfg=window.LS_SHARED||{},paths=new Map([
 ['https://lab.smhnklvn.workers.dev',{accepted:new Set(['/staff-password-reset','/staff-password-reset.html']),redirect:'/staff-password-reset'}],
 ['https://ssamahan.github.io',{accepted:new Set(['/lab/staff-password-reset.html']),redirect:'/lab/staff-password-reset.html'}]
]);
let base,redirect;
try{
 const u=new URL(cfg.endpoint),site=paths.get(location.origin);
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!cfg.key||!site||!site.accepted.has(location.pathname))throw Error('configuration');
 base=u.origin;redirect=location.origin+site.redirect;
}catch(_){requestForm.hidden=true;requestStatus.textContent='Password recovery is not configured on this site.';requestForm.hidden=false;requestForm.querySelector('button').disabled=true;return;}
const headers={apikey:cfg.key,'Content-Type':'application/json'};
const roles=new Set(['Admin','Manager','Technologist','Reviewer','Viewer']);
let busy=false,ready=false;
const options={cache:'no-store',credentials:'omit',redirect:'error'};
async function verify(){
 const h=Object.assign({},headers,{Authorization:'Bearer '+token});
 const userRes=await fetch(base+'/auth/v1/user',Object.assign({},options,{headers:h}));
 if(!userRes.ok)throw Error('verification');
 const user=await userRes.json();
 if(!user||user.is_anonymous!==false||!user.email||!user.email_confirmed_at)throw Error('verification');
 const roleRes=await fetch(base+'/rest/v1/rpc/lab_my_access_role',Object.assign({},options,{method:'POST',headers:h,body:'{}'}));
 if(!roleRes.ok||!roles.has(await roleRes.json()))throw Error('verification');
 return h;
}
requestForm.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 if(!email.value.trim()||!email.checkValidity()){requestStatus.textContent='Enter a valid email address.';requestStatus.focus();return;}
 busy=true;const button=requestForm.querySelector('button');button.disabled=true;requestStatus.textContent='Requesting reset link…';
 try{
  const response=await fetch(base+'/auth/v1/recover?redirect_to='+encodeURIComponent(redirect),Object.assign({},options,{method:'POST',headers,body:JSON.stringify({email:email.value.trim()})}));
  if(!response.ok)throw Error('request');
  requestStatus.textContent='If an account exists for that email, a reset link will be sent. Check your inbox and spam folder.';
 }catch(_){requestStatus.textContent='Could not request a reset link. Check your connection and try again later.';}
 finally{busy=false;button.disabled=false;requestStatus.focus();}
});
document.getElementById('show-password').addEventListener('change',event=>{password.type=confirmation.type=event.target.checked?'text':'password';});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!ready||busy)return;
 if(password.value.length<12){status.textContent='Enter a password of at least 12 characters.';status.focus();return;}
 if(password.value!==confirmation.value){status.textContent='The passwords do not match.';status.focus();return;}
 busy=true;const button=form.querySelector('button');button.disabled=true;status.textContent='Saving password…';
 try{
  const authHeaders=await verify();
  const response=await fetch(base+'/auth/v1/user',Object.assign({},options,{method:'PUT',headers:authHeaders,body:JSON.stringify({password:password.value})}));
  if(!response.ok)throw Error('update');
  password.value='';confirmation.value='';token=null;ready=false;section.hidden=true;
  const success=document.getElementById('success');success.hidden=false;success.focus();
 }catch(_){password.value='';confirmation.value='';status.textContent='Could not reset the password. Your link may have expired, access may be inactive, or the connection failed. Request a new link or contact your administrator.';status.focus();}
 finally{busy=false;button.disabled=false;}
});
if(hadFragment){
 requestForm.hidden=true;
 if(!token||kind!=='recovery'){token=null;requestForm.hidden=false;requestStatus.textContent='This reset link is invalid. Request a new link.';}
 else verify().then(()=>{ready=true;section.hidden=false;password.focus();}).catch(()=>{token=null;requestForm.hidden=false;requestStatus.textContent='This reset link is invalid, expired, or your staff access is inactive. Request a new link or contact your administrator.';});
}
})();
