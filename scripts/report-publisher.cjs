'use strict';
const {createHash}=require('node:crypto');
const {gunzipSync,gzipSync}=require('node:zlib');
const {mergeSnapshots}=require('./report-source-merge.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
async function publishOnce({read,parse,write}){
  const old=await read();
  if(!old||!/^[a-f0-9]{64}$/.test(old.sha256||'')||typeof old.gzip_base64!=='string') throw Error('Protected snapshot unavailable');
  const bytes=Buffer.from(old.gzip_base64,'base64');
  if(hash(bytes)!==old.sha256) throw Error('Protected snapshot integrity check failed');
  const before=JSON.parse(gunzipSync(bytes,{maxOutputLength:40*1024*1024}).toString('utf8'));
  const candidate=await parse();
  if(!candidate||!candidate.months||!Object.keys(candidate.months).length) throw Error('Empty source is not publishable');
  const merged=mergeSnapshots(before,candidate);
  if(JSON.stringify(merged)===JSON.stringify(before)) return {status:'unchanged'};
  const compressed=gzipSync(Buffer.from(JSON.stringify(merged)),{level:9});
  const result=await write({expected:old.sha256,sha256:hash(compressed),gzip_base64:compressed.toString('base64')});
  if(!result||result.status==='conflict') throw Error('Protected snapshot changed during import; nothing published');
  if(result.status!=='saved') throw Error('Protected snapshot was not saved');
  return {status:'saved',months:Object.keys(merged.months).length};
}
module.exports={publishOnce};
