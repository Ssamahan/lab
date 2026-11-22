'use strict';
const {createGateway}=require('./staff-invite-gateway.cjs');
const {handleInvitation}=require('./staff-invite-http.cjs');
// Runtime variables are supplied by Supabase; the service key never reaches a browser.
const redirects=new Map([
  ['https://lab.smhnklvn.workers.dev','https://lab.smhnklvn.workers.dev/invite.html'],
  ['https://ssamahan.github.io','https://ssamahan.github.io/lab/invite.html']
]);
Deno.serve(async request=>{
  const origin=request.headers.get('origin'),redirect=redirects.get(origin);
  if(!redirect)return new Response(JSON.stringify({code:'forbidden'}),{status:403,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  try{
    const gateway=createGateway({url:Deno.env.get('SUPABASE_URL'),publicKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),redirect,fetch});
    return await handleInvitation(request,{gateway,allowedOrigin:origin});
  }catch(_){return new Response(JSON.stringify({code:'service_unavailable'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
});
