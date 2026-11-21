'use strict';
const {createGateway}=require('./staff-invite-gateway.cjs');
const {handleInvitation}=require('./staff-invite-http.cjs');
// Runtime variables are supplied by Supabase; the service key never reaches a browser.
Deno.serve(async request=>{
  try{
    const gateway=createGateway({url:Deno.env.get('SUPABASE_URL'),publicKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),redirect:'https://lab.smhnklvn.workers.dev/invite.html',fetch});
    return await handleInvitation(request,{gateway,allowedOrigin:'https://lab.smhnklvn.workers.dev'});
  }catch(_){return new Response(JSON.stringify({code:'service_unavailable'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
});
