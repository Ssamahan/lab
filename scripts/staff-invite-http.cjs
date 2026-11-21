'use strict';
const {invite}=require('./staff-invitations.cjs');
const LIMIT=2048;
async function readBody(request){
  if(!request.body) return '';
  const reader=request.body.getReader(), chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done) break;size+=value.byteLength;if(size>LIMIT){await reader.cancel();throw new RangeError('too large');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder().decode(bytes);
}
async function handleInvitation(request,config){
  const origin=request.headers.get('origin');
  const allowed=config.allowedOrigin;
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  const answer=(status,code)=>new Response(JSON.stringify({code}),{status,headers:Object.assign({'Content-Type':'application/json'},headers)});
  if(!allowed||origin!==allowed) return answer(403,'forbidden');
  headers['Access-Control-Allow-Origin']=allowed;
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:Object.assign({'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Max-Age':'600'},headers)});
  if(request.method!=='POST') return answer(405,'method_not_allowed');
  const auth=request.headers.get('authorization')||'';
  const match=/^Bearer ([^\s]+)$/.exec(auth);
  if(!match) return answer(401,'unauthorized');
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||'')) return answer(415,'unsupported_media_type');
  let body;
  try{body=JSON.parse(await readBody(request));}catch(e){return answer(e instanceof RangeError?413:400,e instanceof RangeError?'too_large':'invalid');}
  if(!body||typeof body!=='object'||Array.isArray(body)) return answer(400,'invalid');
  const result=await invite({token:match[1],email:body.email,role:body.role},config.gateway);
  const status={sent:200,unauthorized:401,forbidden:403,invalid:400,send_failed:502,assignment_failed:502}[result.code]||500;
  return answer(status,result.code);
}
module.exports={handleInvitation};
