/* Synthetic service-worker upgrade, stalled requests, old tabs, and diagnostics. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('sw.js','utf8'),version=src.match(/const VERSION = 'v([^']+)'/)[1];
function setup(fail){
 const handlers={},state={deleted:[],claimed:0,skipped:0,fetches:[],stored:[]};
 const old={old:true};
 const cache={match:async r=>null,put:async(r)=>state.stored.push(r.url)};
 class Req {constructor(url,opts){this.url=String(url);this.signal=opts&&opts.signal;}}
 const ctx={URL,Request:Req,Response,Promise,AbortController,
 setTimeout:(f,ms)=>setTimeout(f,ms===8000?10:ms),clearTimeout,
 fetch:async r=>{let url=typeof r==='string'?r:r.url;state.fetches.push(url);if(fail&&url.includes(fail))return new Promise(()=>{});return {ok:true,status:200,clone(){return this;}}},
 caches:{open:async()=>cache,keys:async()=>['old','other-app'],delete:async k=>state.deleted.push(k),match:async req=>String(req.url).includes('v=old')?old:null},
 self:{location:{origin:'https://example.test'},registration:{},clients:{claim:async()=>state.claimed++},skipWaiting:async()=>state.skipped++,addEventListener:(name,fn)=>handlers[name]=fn}};
 vm.createContext(ctx);vm.runInContext(src,ctx);return {handlers,state,old};
}
(async()=>{
 let x=setup();let promise;x.handlers.activate({waitUntil:p=>promise=p});await promise;assert.equal(x.state.claimed,1);assert.deepEqual(x.state.deleted,[]);console.log('✓ activation preserves old and unrelated caches');
 let response;x.handlers.fetch({request:{method:'GET',url:'https://example.test/lab/assets/js/modules/roster.js?v=old',mode:'no-cors'},respondWith:p=>response=p});assert.strictEqual(await response,x.old);assert.equal(x.state.fetches.length,0);console.log('✓ older tab receives its exact cached version without waiting for network');
 response=undefined;x.handlers.fetch({request:{method:'GET',url:'https://example.test/lab/assets/js/modules/roster.js?v=old',cache:'no-store'},respondWith:p=>response=p});assert.equal(response,undefined);console.log('✓ no-store diagnostic bypasses the worker');
 x=setup('assets/js/core/store.js');x.handlers.install({waitUntil:p=>promise=p});await assert.rejects(promise,/incomplete/);assert.equal(x.state.skipped,0);console.log('✓ stalled required file rejects upgrade and leaves prior worker active');
 x=setup();x.handlers.install({waitUntil:p=>promise=p});await promise;assert.equal(x.state.skipped,1);console.log('✓ complete core installs normally');
 x=setup('favicon-192');x.handlers.install({waitUntil:p=>promise=p});await promise;assert.equal(x.state.skipped,1);console.log('✓ missing optional icon does not block upgrade');
})().catch(e=>{console.error(e);process.exitCode=1});
