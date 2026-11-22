/* Invitation administration requires a separate, server-verified staff session. */
(function(){
'use strict';
const status=document.getElementById('status'), login=document.getElementById('login-form'), form=document.getElementById('invite-form');
const adminEmail=document.getElementById('admin-email'), adminPassword=document.getElementById('admin-password');
const inviteEmail=document.getElementById('invite-email'), inviteRole=document.getElementById('invite-role');
const cfg=window.LS_SHARED||{};let base='',token='',busy=false;
try{const url=new URL(cfg.endpoint);if(url.protocol!=='https:') throw new Error('invalid');base=url.origin;}catch(_){status.textContent='Staff access service is not configured.';return;}
if(!cfg.key){status.textContent='Staff access service is not configured.';return;}
const publicHeaders={apikey:cfg.key,'Content-Type':'application/json'};
function logout(){token='';form.hidden=true;login.hidden=false;adminPassword.value='';inviteEmail.value='';}
login.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;busy=true;login.querySelector('button').disabled=true;status.textContent='Checking administrator account…';
 try{
  const res=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:publicHeaders,body:JSON.stringify({email:adminEmail.value.trim(),password:adminPassword.value}),cache:'no-store'});
  adminPassword.value='';if(!res.ok)throw new Error('sign in failed');const session=await res.json();
  if(!session.access_token)throw new Error('missing token');
  const check=await fetch(base+'/rest/v1/rpc/lab_my_access_role',{method:'POST',headers:Object.assign({},publicHeaders,{Authorization:'Bearer '+session.access_token}),body:'{}',cache:'no-store'});
  if(!check.ok||await check.json()!=='Admin')throw new Error('not administrator');
  token=session.access_token;login.hidden=true;form.hidden=false;status.textContent='Administrator verified. Enter an email and choose a role.';
 }catch(_){logout();status.textContent='Administrator sign-in or verification failed. Check your account and try again.';}
 finally{adminPassword.value='';busy=false;login.querySelector('button').disabled=false;}
});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!token||busy)return;busy=true;form.querySelector('button[type=submit]').disabled=true;status.textContent='Sending invitation…';
 try{
  const res=await fetch(base+'/functions/v1/lab-staff-invite',{method:'POST',headers:Object.assign({},publicHeaders,{Authorization:'Bearer '+token}),body:JSON.stringify({email:inviteEmail.value.trim(),role:inviteRole.value}),cache:'no-store'});
  const result=await res.json();
  if(result.code==='self_invite'){status.textContent='This administrator already has an account and cannot be invited to a different role. Test with a separate email address.';return;}
  if(result.code==='assignment_failed'){status.textContent='The email may have been sent, but the role was not assigned. Contact the administrator before retrying.';return;}
  if(!res.ok||result.code!=='sent')throw new Error('send failed');
  inviteEmail.value='';status.textContent='Invitation sent. The recipient must accept it and set a password.';
 }catch(_){status.textContent='The invitation could not be sent. Check the account and service configuration.';}
 finally{busy=false;form.querySelector('button[type=submit]').disabled=false;}
});
document.getElementById('sign-out').addEventListener('click',()=>{logout();status.textContent='Signed out of invitation management.';});
})();
