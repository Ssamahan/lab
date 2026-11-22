/* Isolated authenticated transport for a future guarded sync cutover. It never
   modifies local data or clears a queue: a lost write response is ambiguous. */
(function(root){
'use strict';
function failure(code){const error=new Error(code);error.code=code;return error;}
function createAdminTransport(config){
 let url;
 try{url=new URL(config.endpoint);}catch(_){throw new Error('Invalid transport configuration');}
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||
    !config.key||typeof config.fetch!=='function')throw new Error('Invalid transport configuration');
 async function call(name,token,body,write){
  if(typeof token!=='string'||!token.trim())throw failure('invalid_request');
  let response;
  try{response=await config.fetch(url.origin+'/rest/v1/rpc/'+name,{
   method:'POST',headers:{apikey:config.key,Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify(body),cache:'no-store',credentials:'omit',redirect:'error'
  });}catch(_){throw failure(write?'unknown_write':'network');}
  if(!response.ok){
   let detail={};try{detail=await response.json();}catch(_){}
   if(detail.code==='40001')throw failure('conflict');
   if(response.status===401||response.status===403||detail.code==='42501')throw failure('denied');
   // An intermediary error may occur after the database committed. Preserve
   // the pending work until a fresh read can establish what happened.
   throw failure(write?'unknown_write':'request_failed');
  }
  try{return await response.json();}catch(_){throw failure(write?'unknown_write':'invalid_response');}
 }
 return {
  async read(token){
   const result=await call('lab_admin_read_register',token,{},false);
   if(!result||!result.data||typeof result.data!=='object'||Array.isArray(result.data)||
      !Number.isSafeInteger(result.revision)||result.revision<1)throw failure('invalid_response');
   return result;
  },
  async write(token,revision,data,clientId){
   if(!Number.isSafeInteger(revision)||revision<1||!data||typeof data!=='object'||Array.isArray(data)||
      typeof clientId!=='string'||clientId.length<1||clientId.length>128)throw failure('invalid_request');
   const result=await call('lab_admin_write_register',token,{p_expected_revision:revision,p_data:data,p_client_id:clientId},true);
   if(!Number.isSafeInteger(result)||result<=revision)throw failure('unknown_write');
   return result;
  }
 };
}
if(typeof module==='object'&&module.exports)module.exports={createAdminTransport};
else root.LSAdminTransport={createAdminTransport};
})(typeof window!=='undefined'?window:globalThis);
