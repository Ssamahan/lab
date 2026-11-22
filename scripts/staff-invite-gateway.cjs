'use strict';

// Server-only adapter. It is not deployed or connected to the legacy local login.
// The backing membership table must default-deny and reject updates by clients.
function createGateway(config){
  const base=new URL(config.url), redirect=new URL(config.redirect);
  if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash||
     redirect.protocol!=='https:'||redirect.username||redirect.password||redirect.search||redirect.hash||
     !config.publicKey||!config.serviceKey||typeof config.fetch!=='function') throw new Error('Invalid server configuration');
  const endpoint=base.origin, send=config.fetch;
  const serviceHeaders={apikey:config.serviceKey,Authorization:'Bearer '+config.serviceKey,'Content-Type':'application/json'};
  async function json(response){if(!response.ok) throw new Error('Provider request failed');return response.json();}
  return {
    async verify(token){
      const r=await send(endpoint+'/auth/v1/user',{method:'GET',headers:{apikey:config.publicKey,Authorization:'Bearer '+token},cache:'no-store'});
      if(!r.ok) return null;const u=await r.json();
      return u&&typeof u.id==='string'?{id:u.id,email:typeof u.email==='string'?u.email:'',anonymous:u.is_anonymous!==false}:null;
    },
    async role(userId){
      const url=endpoint+'/rest/v1/lab_access_members?select=role&user_id=eq.'+encodeURIComponent(userId)+'&active=eq.true&limit=1';
      const result=await json(await send(url,{method:'GET',headers:serviceHeaders,cache:'no-store'}));
      return Array.isArray(result)&&result.length===1?result[0].role:null;
    },
    async send(email){
      const url=endpoint+'/auth/v1/invite?redirect_to='+encodeURIComponent(redirect.href);
      return json(await send(url,{method:'POST',headers:serviceHeaders,body:JSON.stringify({email}),cache:'no-store'}));
    },
    async assign(userId,role,actor){
      const headers=Object.assign({},serviceHeaders,{Prefer:'return=representation'});
      const body=JSON.stringify({user_id:userId,role,active:true,invited_by:actor});
      const result=await json(await send(endpoint+'/rest/v1/lab_access_members',{method:'POST',headers,body,cache:'no-store'}));
      return Array.isArray(result)&&result.length===1&&result[0].user_id===userId;
    }
  };
}
module.exports={createGateway};
