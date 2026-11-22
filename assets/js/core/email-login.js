/* Email-verified bridge to the legacy, browser-local administrator console.
   This is not server-enforced access to the shared register or cloud sync. */
(function(){
'use strict';
const address='smhnklvn@gmail.com',status=document.getElementById('status'),button=document.getElementById('send');
const reset=document.getElementById('reset-form'),password=document.getElementById('new-password'),confirmation=document.getElementById('confirm-password');
const resetStatus=document.getElementById('reset-status'),email=document.getElementById('admin-email');
const requestSection=document.getElementById('request-section'),verifiedSection=document.getElementById('verified-section');
document.getElementById('show-password').addEventListener('change',event=>{
 password.type=confirmation.type=event.target.checked?'text':'password';
});
let verified=false,resetBusy=false;
const config=window.LS_SHARED||{},allowed=new Map([
 ['https://lab.smhnklvn.workers.dev',new Set(['/email-login','/email-login.html'])],
 ['https://ssamahan.github.io',new Set(['/lab/email-login.html'])]
]);
const fragment=new URLSearchParams(window.location.hash.slice(1));
const token=fragment.get('access_token'),type=fragment.get('type');
// Strip bearer and refresh tokens before any network calls, navigation or error.
if(window.location.hash) history.replaceState(null,'',window.location.pathname+window.location.search);
let endpoint;
try{
 const u=new URL(config.endpoint);
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!config.key)throw Error('configuration');
 if(!allowed.get(location.origin)?.has(location.pathname))throw Error('origin');
 endpoint=u.origin;
}catch(_){button.disabled=true;status.textContent='Email sign-in is not configured for this site.';return;}
const headers={apikey:config.key,'Content-Type':'application/json'};
requestSection.addEventListener('submit',async event=>{
 event.preventDefault();if(button.disabled)return;
 button.disabled=true;status.textContent='Sending a sign-in link…';
 try{
  // This legacy recovery is intentionally limited to the registered Admin.
  // Never create an account, and give the same response for other addresses.
  if(email.value.trim().toLowerCase()!==address){
   status.textContent='If this is the registered administrator email, a sign-in link has been sent. Open it in this same browser.';return;
  }
  const redirect=location.origin+location.pathname;
  const r=await fetch(endpoint+'/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{method:'POST',headers,cache:'no-store',credentials:'omit',redirect:'error',body:JSON.stringify({email:address,create_user:false})});
  if(!r.ok)throw Error('send');
  status.textContent='If the administrator account is available, a sign-in link has been sent. Open it in this same browser.';
 }catch(_){status.textContent='The email could not be requested. Please try again later.';}
 finally{button.disabled=false;}
});
async function verifyAccount(){
 const h=Object.assign({},headers,{Authorization:'Bearer '+token});
 const userResponse=await fetch(endpoint+'/auth/v1/user',{headers:h,cache:'no-store',credentials:'omit',redirect:'error'});
 if(!userResponse.ok)throw Error('user');
 const user=await userResponse.json();
 if(!user||user.is_anonymous!==false||String(user.email||'').toLowerCase()!==address)throw Error('user');
 const roleResponse=await fetch(endpoint+'/rest/v1/rpc/lab_my_access_role',{method:'POST',headers:h,body:'{}',cache:'no-store',credentials:'omit',redirect:'error'});
 if(!roleResponse.ok||await roleResponse.json()!=='Admin')throw Error('role');
}
async function complete(){
 if(!token||type!=='magiclink'){if(token||type)status.textContent='This link is not an administrator sign-in link.';return;}
 button.disabled=true;status.textContent='Verifying administrator account…';
 try{
  await verifyAccount();
  const now=Date.now();
  // The existing console trusts a browser-local session. Never store the email
  // session tokens, change the register, clear a queue, or claim server security.
  localStorage.setItem('labSystems.session.v2',JSON.stringify({userId:'u1',started:now,last:now,expires:now+86400000,persist:true,method:'verified_email'}));
  verified=true;requestSection.hidden=true;verifiedSection.hidden=false;reset.hidden=false;
  status.textContent='Administrator verified. Return to the laboratory site in this browser or reset the local password below.';
  password.focus();
 }catch(_){status.textContent='This link could not verify the administrator account. Request a new link.';}
 finally{button.disabled=false;}
}
reset.addEventListener('submit',async event=>{
 event.preventDefault();if(!verified||resetBusy)return;
 const value=password.value;
 if(value.length<12){resetStatus.textContent='Enter a password of at least 12 characters.';resetStatus.focus();return;}
 if(value!==confirmation.value){resetStatus.textContent='The passwords do not match. Please enter the same password twice.';resetStatus.focus();return;}
 resetBusy=true;resetStatus.textContent='Checking and saving your password…';const submit=reset.querySelector('button[type=submit]');submit.disabled=true;
 try{
  const auth=window.LS&&window.LS.auth,crypto=window.LSC;
  if(!auth||!crypto)throw Error('authentication not loaded');
  auth.applySavedRoles();
  for(const other of auth.users){
   if(other.id==='u1'||!other.passHash)continue;
   if((crypto.isModern(other.passHash)&&await crypto.verifyPassword(value,other.passHash))||
      (crypto.isLegacy(other.passHash)&&auth.hash(value)===other.passHash))throw Error('password in use');
  }
  const encoded=await crypto.hashPassword(value);
  // Verify again immediately before changing the device: membership may have
  // been revoked or the one-hour email session may have expired in an open tab.
  try{await verifyAccount();}catch(_){throw Error('verification expired');}
  const roles=JSON.parse(localStorage.getItem('labSystems.roles.v1')||'{}');
  const attempts=JSON.parse(localStorage.getItem('labSystems.attempts.v1')||'{}');
  if(!roles||typeof roles!=='object'||Array.isArray(roles)||!attempts||typeof attempts!=='object'||Array.isArray(attempts))throw Error('invalid local settings');
  if(roles.u1&&(typeof roles.u1!=='object'||Array.isArray(roles.u1)))throw Error('invalid local settings');
  roles.u1=Object.assign({},roles.u1||{},{role:'Admin',passHash:encoded});
  localStorage.setItem('labSystems.roles.v1',JSON.stringify(roles));
  // Reset only Kelvin's throttle. Never delete the register or queued work.
  delete attempts.kelvin;try{localStorage.setItem('labSystems.attempts.v1',JSON.stringify(attempts));}catch(_){}
  password.value='';confirmation.value='';reset.hidden=true;
  const success=document.getElementById('reset-success');success.hidden=false;success.focus();
 }catch(error){
  password.value='';confirmation.value='';
  resetStatus.textContent=error.message==='verification expired'?'Your email verification expired or could not be checked. Request a new link and try again.':error.message==='password in use'?'Choose a different password; that password is already in use on this browser.':'Password could not be saved. Check your connection and browser storage, then try again.';
  resetStatus.focus();
 }
 finally{resetBusy=false;submit.disabled=false;}
});
complete();
})();
