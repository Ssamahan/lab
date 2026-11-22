const assert=require('node:assert/strict');
const {makeTransport}=require('../scripts/report-transport.cjs');
(async()=>{
 const calls=[],secret='synthetic-only',key='public-key';
 const fetch=async(url,opts)=>{calls.push({url,opts});return {ok:true,status:200,json:async()=>url.endsWith('read')?{sha256:'a'.repeat(64),gzip_base64:'AA=='}:{status:'saved'}};};
 const t=makeTransport({fetch,endpoint:'https://private.example/rest/v1/rpc',apiKey:key,secret});
 const s=await t.read();assert.equal(s.sha256,'a'.repeat(64));
 await t.write({expected:s.sha256,sha256:'b'.repeat(64),gzip_base64:'eA=='});
 assert.equal(calls.length,2);assert.equal(JSON.parse(calls[1].opts.body).p_expected,s.sha256);assert.equal(JSON.parse(calls[1].opts.body).p_secret,secret);assert.equal(calls[1].opts.headers.apikey,key);
 assert.throws(()=>makeTransport({fetch,endpoint:'http://private.example/rest/v1/rpc',apiKey:key,secret}),/https/i);
 const fail=makeTransport({fetch:async()=>({ok:false,status:403,text:async()=>secret}),endpoint:'https://private.example/rest/v1/rpc',apiKey:key,secret});
 await assert.rejects(fail.read(),e=>!e.message.includes(secret));
 console.log('report-transport180: HTTPS, scoped secret, CAS payload and redacted failures verified');
})().catch(e=>{console.error(e);process.exit(1)});
