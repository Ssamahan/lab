const assert=require('node:assert/strict'),{gzipSync,gunzipSync}=require('node:zlib'),{createHash}=require('node:crypto');
const {publishOnce}=require('../scripts/report-publisher.cjs');
const snap=(pos)=>({months:{'2025-01':{month:'2025-01',meta:{},values:{m1:{pos}},blood:{},sourceReview:[],unmatched:[]}},workbookCells:{}});
const pack=o=>{const b=gzipSync(Buffer.from(JSON.stringify(o)));return {gzip_base64:b.toString('base64'),sha256:createHash('sha256').update(b).digest('hex')}};
(async()=>{
 const prior=pack(snap(2));let calls=0,saved;
 const result=await publishOnce({read:async()=>prior,parse:async()=>snap(8),write:async v=>{calls++;saved=v;return {status:'saved'};}});
 assert.equal(calls,1);assert.equal(saved.expected,prior.sha256);
 const combined=JSON.parse(gunzipSync(Buffer.from(saved.gzip_base64,'base64')));
 assert.equal(combined.months['2025-01'].values.m1.pos,2);assert.equal(combined.months['2025-01'].sourceReview[0].incomingValue,8);assert.equal(result.status,'saved');
 const same=await publishOnce({read:async()=>saved,parse:async()=>snap(8),write:async()=>{throw Error('unexpected write')}});assert.equal(same.status,'unchanged');
 await assert.rejects(()=>publishOnce({read:async()=>({...prior,sha256:'0'.repeat(64)}),parse:async()=>snap(3),write:async()=>{throw Error('unexpected write')}}),/integrity/i);
 await assert.rejects(()=>publishOnce({read:async()=>prior,parse:async()=>snap(3),write:async()=>({status:'conflict'})}),/changed/i);
 await assert.rejects(()=>publishOnce({read:async()=>prior,parse:async()=>({months:{},workbookCells:{}}),write:async()=>{throw Error('unexpected write')}}),/empty/i);
 console.log('report-publisher179: safe merge, integrity, no-op and concurrent change checks passed');
})().catch(e=>{console.error(e);process.exit(1)});
