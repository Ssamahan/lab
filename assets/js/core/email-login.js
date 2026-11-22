/* Email-verified bridge to the legacy, browser-local administrator console.
   This is not server-enforced access to the shared register or cloud sync. */
(function(){
'use strict';
const address='smhnklvn@gmail.com',status=document.getElementById('status'),button=document.getElementById('send');
const config=window.LS_SHARED||{},allowed=new Map([
 ['https://lab.smhnklvn.workers.dev','/email-login.html'],
 ['https://ssamahan.github.io','/lab/email-login.html']
]);
const fragment=new URLSearchParams(window.location.hash.slice(1));
const token=fragment.get('access_token'),type=fragment.get('type');
// Strip bearer and refresh tokens before any network calls, navigation or error.
if(window.location.hash) history.replaceState(null,'',window.location.pathname+window.location.search);
let endpoint;
try{
 const u=new URL(config.endpoint);
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!config.key)throw Error('configuration');
 if(allowed.get(location.origin)!==location.pathname)throw Error('origin');
 endpoint=u.origin;
}catch(_){button.disabled=true;status.textContent='Email sign-in is not configured for this site.';return;}
const headers={apikey:config.key,'Content-Type':'application/json'};
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='Sending a sign-in link…';
 try{
  const redirect=location.origin+location.pathname;
  const r=await fetch(endpoint+'/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{method:'POST',headers,cache:'no-store',credentials:'omit',redirect:'error',body:JSON.stringify({email:address,create_user:false})});
  if(!r.ok)throw Error('send');
  status.textContent='If the administrator account is available, a sign-in link has been sent. Open it in this same browser.';
 }catch(_){status.textContent='The email could not be requested. Please try again later.';}
 finally{button.disabled=false;}
});
async function complete(){
 if(!token||type!=='magiclink'){if(token||type)status.textContent='This link is not an administrator sign-in link.';return;}
 button.disabled=true;status.textContent='Verifying administrator account…';
 try{
  const h=Object.assign({},headers,{Authorization:'Bearer '+token});
  const userResponse=await fetch(endpoint+'/auth/v1/user',{headers:h,cache:'no-store',credentials:'omit',redirect:'error'});
  if(!userResponse.ok)throw Error('user');
  const user=await userResponse.json();
  if(!user||user.is_anonymous!==false||String(user.email||'').toLowerCase()!==address)throw Error('user');
  const roleResponse=await fetch(endpoint+'/rest/v1/rpc/lab_my_access_role',{method:'POST',headers:h,body:'{}',cache:'no-store',credentials:'omit',redirect:'error'});
  if(!roleResponse.ok||await roleResponse.json()!=='Admin')throw Error('role');
  const now=Date.now();
  // The existing console trusts a browser-local session. Never store the email
  // session tokens, change the register, clear a queue, or claim server security.
  localStorage.setItem('labSystems.session.v2',JSON.stringify({userId:'u1',started:now,last:now,expires:now+86400000,persist:true,method:'verified_email'}));
  status.textContent='Administrator verified. Return to the laboratory site in this browser.';
 }catch(_){status.textContent='This link could not verify the administrator account. Request a new link.';}
 finally{button.disabled=false;}
}
complete();
})();
