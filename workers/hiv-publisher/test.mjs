import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from './src.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const db=new Map();
const STATE={prepare(sql){return {bind(...args){return {async first(){const value=db.get(args[0]);return value===undefined?null:{value};},async run(){db.set(args[0],args[1]);return {success:true};}};}};}};
const env={STATE,PUBLISHER_KEY:'a'.repeat(64),CONFIG_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
const req=(path,opts={})=>new Request('https://example.test'+path,opts);
const auth={'authorization':'Bearer '+env.PUBLISHER_KEY};
let res=await worker.fetch(req('/'),env);assert.equal(res.status,503);
res=await worker.fetch(req('/private/config'),env);assert.equal(res.status,401);
res=await worker.fetch(req('/private/config',{method:'PUT',headers:auth,body:'private-token-example'}),env);assert.equal(res.status,200);assert(!db.get('config').includes('private-token-example'));
res=await worker.fetch(req('/private/config',{headers:auth}),env);assert.equal(await res.text(),'private-token-example');assert(!res.headers.has('access-control-allow-origin'));
res=await worker.fetch(req('/private/config',{headers:auth}),{...env,CONFIG_ENCRYPTION_KEY:Buffer.alloc(32,8).toString('base64')});assert.equal(res.status,503);
const summary={version:1,checkedAt:new Date().toISOString(),records:[{facility:'Coko HC',period:'2026-10',completed:'2026-11-05T07:25:40',responses:1,staffName:'DO NOT EXPOSE'}],other:'DO NOT EXPOSE'};
res=await worker.fetch(req('/private/summary',{method:'PUT',headers:auth,body:JSON.stringify(summary)}),env);assert.equal(res.status,200);
res=await worker.fetch(req('/'),env);assert.equal(res.status,200);let body=await res.text();assert(!body.includes('DO NOT EXPOSE'));assert(!body.includes('private-token-example'));assert.equal(res.headers.get('access-control-allow-origin'),'*');
const prior=db.get('summary');
for(const bad of [{...summary,records:[]},{...summary,records:[summary.records[0],summary.records[0]]},{...summary,checkedAt:'2000-01-01T00:00:00Z'}, {...summary,records:[{...summary.records[0],facility:'unexpected'}]}]){
 res=await worker.fetch(req('/private/summary',{method:'PUT',headers:auth,body:JSON.stringify(bad)}),env);assert.equal(res.status,400);assert.equal(db.get('summary'),prior);
}
db.set('summary',JSON.stringify({...summary,checkedAt:'2000-01-01T00:00:00Z'}));res=await worker.fetch(req('/'),env);assert.equal(res.status,503);assert(!(await res.text()).includes('DO NOT EXPOSE'));
res=await worker.fetch(req('/private/config',{method:'PUT',headers:auth,body:'x'.repeat(140000)}),env);assert.equal(res.status,503);
const priorLog=console.error, logs=[];console.error=(...args)=>logs.push(args.join(' '));
try {
 res=await worker.fetch(req('/private/config',{method:'PUT',headers:auth,body:'private-token-example'}),{...env,CONFIG_ENCRYPTION_KEY:'bad'});
 assert.equal(res.status,503);assert(logs.includes('Timeliness publisher failure: config-encrypt'));
 assert(!logs.join(' ').includes('private-token-example'));assert(!logs.join(' ').includes(env.PUBLISHER_KEY));
} finally {console.error=priorLog;}
console.log('publisher: auth, encrypted storage, filtering, validation and stale failure passed');
const keys=['determineNonReactive','determineReactive','determineInvalid','statpakNonReactive','statpakReactive','statpakInvalid','determineUsed','statpakUsed'];
const metrics=Object.fromEntries(keys.map((k,i)=>[k,i===0?null:i]));metrics.privateComment='DO NOT EXPOSE';
const withMetrics={...summary,checkedAt:new Date().toISOString(),records:[{...summary.records[0],metrics}]};
res=await worker.fetch(req('/private/summary',{method:'PUT',headers:auth,body:JSON.stringify(withMetrics)}),env);assert.equal(res.status,200);
res=await worker.fetch(req('/'),env);body=await res.text();assert(!body.includes('DO NOT EXPOSE'));assert.equal(JSON.parse(body).records[0].metrics.determineNonReactive,null);
res=await worker.fetch(req('/private/summary',{method:'PUT',headers:auth,body:JSON.stringify({...withMetrics,records:[{...withMetrics.records[0],metrics:{...metrics,determineUsed:-1}}]})}),env);assert.equal(res.status,400);
res=await worker.fetch(req('/private/summary',{method:'PUT',headers:auth,body:JSON.stringify({...withMetrics,records:[{...withMetrics.records[0],responses:2}]})}),env);assert.equal(res.status,200);res=await worker.fetch(req('/'),env);assert.equal((await res.json()).records[0].metrics,null);
console.log('publisher metrics: allowlist, null, invalid values and duplicates passed');
const stock={flag:'yes',status:'stockout',test:'determine',remaining:149,determineExpiry:'2026-12-02',statpakExpiry:'2026-10-24',comment:'DO NOT EXPOSE'};
const withStock={...summary,checkedAt:new Date().toISOString(),records:[{...summary.records[0],stock}]};
res=await worker.fetch(req('/private/summary',{method:'PUT',headers:auth,body:JSON.stringify(withStock)}),env);assert.equal(res.status,200);
res=await worker.fetch(req('/'),env);body=await res.text();assert(!body.includes('DO NOT EXPOSE'));assert.equal(JSON.parse(body).records[0].stock.remaining,149);
for(const badStock of [{...stock,flag:'private text'}, {...stock,statpakExpiry:'2026-02-30'}, {...stock,test:null,remaining:3}]){
 res=await worker.fetch(req('/private/summary',{method:'PUT',headers:auth,body:JSON.stringify({...withStock,records:[{...withStock.records[0],stock:badStock}]})}),env);assert.equal(res.status,400);
}
res=await worker.fetch(req('/private/summary',{method:'PUT',headers:auth,body:JSON.stringify({...withStock,records:[{...withStock.records[0],responses:2}]})}),env);assert.equal(res.status,200);res=await worker.fetch(req('/'),env);assert.equal((await res.json()).records[0].stock,null);
console.log('publisher stock: allowlist, dates, ambiguity and duplicates passed');
