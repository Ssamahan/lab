const assert=require('node:assert/strict'),{generateKeyPairSync,createVerify}=require('node:crypto');
const {downloadWorkbook}=require('../scripts/report-reader.cjs');
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const credentials=JSON.stringify({type:'service_account',client_email:'report-reader@example.iam.gserviceaccount.com',private_key:privateKey.export({format:'pem',type:'pkcs8'})});
const zip=Uint8Array.from([0x50,0x4b,3,4,1,2]);
function responseFetch(download=new Response(zip)){
 let calls=[];const fetch=async(url,opts)=>{
  calls.push({url,opts});if(calls.length===1){
   assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(opts.redirect,'error');
   const assertion=new URLSearchParams(opts.body).get('assertion'),parts=assertion.split('.');const payload=JSON.parse(Buffer.from(parts[1],'base64url'));
   assert.equal(payload.iss,'report-reader@example.iam.gserviceaccount.com');assert.equal(payload.scope,'https://www.googleapis.com/auth/drive.readonly');assert.equal(payload.aud,url);
   const verify=createVerify('RSA-SHA256');verify.update(parts.slice(0,2).join('.'));verify.end();assert(verify.verify(publicKey,Buffer.from(parts[2],'base64url')));
   return new Response(JSON.stringify({access_token:'test-drive-token'}));
  }
  assert.equal(url,'https://www.googleapis.com/drive/v3/files/1KHAK1Wsd-xAuIgP3mNcd9100qaf0h15u?alt=media');assert.equal(opts.headers.Authorization,'Bearer test-drive-token');assert.equal(opts.redirect,'error');return download;
 };return {fetch,calls};
}
(async()=>{
 let r=responseFetch();assert.deepEqual(await downloadWorkbook(r.fetch,credentials),Buffer.from(zip));assert.equal(r.calls.length,2);
 r=responseFetch(new Response('<html>login</html>',{status:200}));await assert.rejects(()=>downloadWorkbook(r.fetch,credentials),/workbook/i);
 r=responseFetch(new Response('x',{status:403}));await assert.rejects(()=>downloadWorkbook(r.fetch,credentials),/403/);
 let count=0;await assert.rejects(()=>downloadWorkbook(async()=>{count++;},''),/credentials/i);assert.equal(count,0);
 await assert.rejects(()=>downloadWorkbook(async()=>new Response('fail',{status:403}),credentials),/authorization/i);
 console.log('report-reader180: private signed Drive access, read-only scope and fail-closed download verified');
})().catch(e=>{console.error(e);process.exit(1)});
