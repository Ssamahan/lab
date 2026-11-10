/* Staged only: encrypted rclone config, authenticated writer, public reduced summary. */
const MAX_AGE_MS=30*60*1000, MAX_BODY=128*1024;
const FACILITIES=new Set(['Coko HC','Minazi HC','Muhondo HC','Muyongwe HC','Nyange HC','Ruli HC','Rushashi HC','Rwankuba HC']);
const encoder=new TextEncoder(), decoder=new TextDecoder();
function json(value,status=200,cors=false){const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};if(cors)headers['access-control-allow-origin']='*';return new Response(JSON.stringify(value),{status,headers});}
async function authorized(req,env){
 if(typeof env.PUBLISHER_KEY!=='string'||env.PUBLISHER_KEY.length<40)return false;
 const value=req.headers.get('authorization')||'';
 const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(value)),crypto.subtle.digest('SHA-256',encoder.encode('Bearer '+env.PUBLISHER_KEY))]);
 const x=new Uint8Array(a),y=new Uint8Array(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
async function bodyBytes(req){
 const len=Number(req.headers.get('content-length'));if(Number.isFinite(len)&&len>MAX_BODY)throw Error('large');
 if(!req.body)throw Error('empty');let size=0;const chunks=[];const reader=req.body.getReader();
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw Error('large');}chunks.push(value);}
 const out=new Uint8Array(size);let p=0;for(const v of chunks){out.set(v,p);p+=v.length;}return out;
}
function toBase64(bytes){let s='';for(const n of bytes)s+=String.fromCharCode(n);return btoa(s);}
function fromBase64(s){const raw=atob(s);return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function key(env){const raw=fromBase64(env.CONFIG_ENCRYPTION_KEY||'');if(raw.length!==32)throw Error('key');return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);}
async function encrypt(bytes,env){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),bytes));return JSON.stringify({v:1,iv:toBase64(iv),ciphertext:toBase64(ct)});}
async function decrypt(value,env){const item=JSON.parse(value);if(item.v!==1)throw Error('version');return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(item.iv)},await key(env),fromBase64(item.ciphertext)));}
async function readState(db,k){return (await db.prepare('SELECT value FROM hiv_state WHERE key = ?').bind(k).first())?.value;}
async function writeState(db,k,v){await db.prepare('INSERT INTO hiv_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k,v).run();}
function validatedSummary(data,now){
 if(!data||data.version!==1||!Array.isArray(data.records)||data.records.length===0||data.records.length>5000)return null;
 const stamp=Date.parse(data.checkedAt);if(!Number.isFinite(stamp)||stamp>now+60000||stamp<now-10*60*1000)return null;
 const seen=new Set(),records=[];
 for(const r of data.records){
  if(!r||!FACILITIES.has(r.facility)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.period)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(r.completed)||!Number.isInteger(r.responses)||r.responses<1||r.responses>5000)return null;
  const id=r.facility+'|'+r.period;if(seen.has(id))return null;seen.add(id);
  records.push({facility:r.facility,period:r.period,completed:r.completed,responses:r.responses});
 }
 return {version:1,checkedAt:new Date(stamp).toISOString(),records};
}
export default {async fetch(req,env){
 try{
  const path=new URL(req.url).pathname;
  if(path==='/'&&req.method==='GET'){
   const value=await readState(env.STATE,'summary');if(!value)return json({error:'No verified summary available'},503,true);
   const data=JSON.parse(value),stamp=Date.parse(data.checkedAt),now=Date.now();
   if(!Number.isFinite(stamp)||stamp>now+60000||now-stamp>MAX_AGE_MS)return json({error:'Summary is stale'},503,true);
   return json(data,200,true);
  }
  if(!['/private/config','/private/summary'].includes(path))return json({error:'Not found'},404);
  if(!await authorized(req,env))return json({error:'Unauthorized'},401);
  if(path==='/private/config'&&req.method==='GET'){
   const value=await readState(env.STATE,'config');if(!value)return json({error:'Not configured'},503);
   return new Response(await decrypt(value,env),{headers:{'content-type':'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
  if(path==='/private/config'&&req.method==='PUT'){
   const bytes=await bodyBytes(req);if(bytes.length===0||bytes.length>64*1024)return json({error:'Invalid input'},400);
   await writeState(env.STATE,'config',await encrypt(bytes,env));return json({ok:true});
  }
  if(path==='/private/summary'&&req.method==='PUT'){
   const data=validatedSummary(JSON.parse(decoder.decode(await bodyBytes(req))),Date.now());if(!data)return json({error:'Invalid summary'},400);
   await writeState(env.STATE,'summary',JSON.stringify(data));return json({ok:true});
  }
  return json({error:'Method not allowed'},405);
 }catch{return json({error:'Request failed'},503);}
}};
