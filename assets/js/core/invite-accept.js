/* Staff invitation acceptance. The access token stays in this page's memory only. */
(function(){
'use strict';
const status=document.getElementById('status'), form=document.querySelector('form');
const password=document.getElementById('password'), confirmation=document.getElementById('confirmation');
const fragment=new URLSearchParams(location.hash.slice(1));
const token=fragment.get('access_token'), kind=fragment.get('type');
// Remove both access and refresh tokens before any network request or navigation.
history.replaceState(null,'',location.pathname+location.search);
const cfg=window.LS_SHARED||{};
let base;
try{const url=new URL(cfg.endpoint);if(url.protocol!=='https:') throw new Error('Invalid endpoint');base=url.origin;}
catch(_){status.textContent='Invitation service is not configured. Contact the administrator.';return;}
if(kind!=='invite'||!token||!cfg.key){
  status.textContent='This invitation link is missing or invalid. Ask the administrator for a new invitation.';return;
}
const headers={apikey:cfg.key,Authorization:'Bearer '+token};
let ready=false, busy=false;
async function verify(){
  try{
    const res=await fetch(base+'/auth/v1/user',{method:'GET',headers,cache:'no-store'});
    if(!res.ok) throw new Error('Invalid invitation');
    const user=await res.json();
    if(!user||!user.id&&!user.email) throw new Error('Invalid invitation');
    ready=true; form.hidden=false; status.textContent='Choose a password to finish setting up your account.';
  }catch(_){status.textContent='This invitation is invalid or expired. Ask the administrator for a new invitation.';}
}
form.addEventListener('submit',async function(event){
  event.preventDefault();
  if(!ready||busy) return;
  if(password.value.length<12){status.textContent='Choose a password with at least 12 characters.';return;}
  if(password.value!==confirmation.value){status.textContent='The passwords do not match.';return;}
  busy=true;form.querySelector('button').disabled=true;
  try{
    const res=await fetch(base+'/auth/v1/user',{method:'PUT',headers:Object.assign({'Content-Type':'application/json'},headers),body:JSON.stringify({password:password.value}),cache:'no-store'});
    if(!res.ok) throw new Error('Password update failed');
    password.value='';confirmation.value='';form.hidden=true;ready=false;
    status.textContent='Password set. You can try signing in to the read-only staff catalog; contact the administrator if access is not yet enabled.';
    document.getElementById('staff-link').hidden=false;
  }catch(_){status.textContent='Could not set the password. Check the connection or ask the administrator for a new invitation.';}
  finally{busy=false;form.querySelector('button').disabled=false;}
});
verify();
})();
