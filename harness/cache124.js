/* Service-worker cache selection with a synthetic stalled network; no real register. */
const fs=require('fs'), vm=require('vm'), assert=require('assert');
const src=fs.readFileSync('sw.js','utf8');
const version=src.match(/const VERSION = 'v([^']+)'/)[1];
let calls=0;
const maps={};
const caches={open:async name=>maps[name]||(maps[name]={entries:new Map(),async match(req){return this.entries.get(req.url||req)},async put(req,res){this.entries.set(req.url||req,res)}}),match:async()=>null};
const context={URL,Response,Request,Promise,caches,fetch:()=>{calls++;return new Promise(()=>{});},self:{addEventListener(){},location:{origin:'https://example.test'},registration:{},clients:{}}};
vm.createContext(context);vm.runInContext(src,context);
(async()=>{
 const request={url:'https://example.test/assets/js/modules/dash.js?v='+version};
 const shell=await caches.open('lab-shell-v'+version), runtime=await caches.open('lab-runtime-v'+version);
 const warmed={source:'warmed'};shell.entries.set(request.url,warmed);
 const timeout=()=>new Promise((_,reject)=>setTimeout(()=>reject(Error('waited for stalled network')),150));
 assert.strictEqual(await Promise.race([context.cacheFirst(request,'lab-runtime-v'+version),timeout()]),warmed);
 console.log('✓ warmed exact-version module returned despite stalled network');
 const visited={source:'runtime'};runtime.entries.set(request.url,visited);
 assert.strictEqual(await Promise.race([context.cacheFirst(request,'lab-runtime-v'+version),timeout()]),visited);
 console.log('✓ runtime cache takes precedence and still returns immediately');
 const other={url:'https://example.test/assets/js/modules/dash.js?v=older-version'};
 const absent=await Promise.race([context.cacheFirst(other,'lab-runtime-v'+version).then(()=>false),new Promise(r=>setTimeout(()=>r(true),30))]);
 assert(absent);assert(calls===3);console.log('✓ differently versioned code is not served as an exact cache hit');
})().catch(e=>{console.error(e);process.exitCode=1});
