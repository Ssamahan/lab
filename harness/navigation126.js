/* Isolated service worker tests; no browser storage or external requests. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('sw.js','utf8'),version=src.match(/const VERSION = 'v([^']+)'/)[1];
async function scenario(mode,cached){
 const handlers={},shell={match:async key=>key==='./index.html'?cached:null,put:async()=>{}};
 const ctx={URL,Response,Request,Promise,setTimeout:(fn,ms)=>setTimeout(fn,ms===8000?20:ms),clearTimeout,
  caches:{open:async()=>shell,match:async()=>null},fetch:()=>mode==='fetch-stuck'?new Promise(()=>{}):Promise.reject(Error('offline')),
  self:{location:{origin:'https://example.test'},registration:{},clients:{},addEventListener:(name,fn)=>handlers[name]=fn}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 let result;handlers.fetch({request:{method:'GET',url:'https://example.test/',mode:'navigate'},preloadResponse:mode==='preload-stuck'?new Promise(()=>{}):Promise.resolve(undefined),respondWith:p=>result=p});
 return Promise.race([result,new Promise((_,reject)=>setTimeout(()=>reject(Error('navigation did not resolve')),200))]);
}
(async()=>{
 const cached={source:'current-version-shell'};
 assert.strictEqual(await scenario('preload-stuck',cached),cached);console.log('✓ stalled preload falls back to current cached shell');
 assert.strictEqual(await scenario('fetch-stuck',cached),cached);console.log('✓ stalled fetch falls back to current cached shell');
 const missing=await scenario('fetch-stuck',null);assert.equal(missing.type,'error');console.log('✓ without a cached shell the navigation returns an error instead of hanging');
 assert.strictEqual(await scenario('offline',cached),cached);console.log('✓ network rejection still falls back to cached shell');
})().catch(e=>{console.error(e);process.exitCode=1});
