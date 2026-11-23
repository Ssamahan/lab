'use strict';
const fs=require('node:fs'),path=require('node:path'),{createSign}=require('node:crypto');
const {buildSnapshot}=require('./report-source-build.cjs');
const ROOT=path.resolve(__dirname,'..');
const SOURCE='https://www.googleapis.com/drive/v3/files/1KHAK1Wsd-xAuIgP3mNcd9100qaf0h15u?alt=media';
const TOKEN_URL='https://oauth2.googleapis.com/token';
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.readonly';
const LIMIT=15*1024*1024;
async function driveToken(fetch,serviceAccount){
  let account;try{account=JSON.parse(serviceAccount);}catch(_){throw Error('Private Drive credentials are not configured');}
  if(!account||account.type!=='service_account'||typeof account.client_email!=='string'||!account.client_email.endsWith('.iam.gserviceaccount.com')||typeof account.private_key!=='string'||!account.private_key.includes('BEGIN PRIVATE KEY')) throw Error('Private Drive credentials are invalid');
  const now=Math.floor(Date.now()/1000), encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:DRIVE_SCOPE,aud:TOKEN_URL,iat:now,exp:now+3600});
  let assertion;try{const signer=createSign('RSA-SHA256');signer.update(payload);signer.end();assertion=payload+'.'+signer.sign(account.private_key,'base64url');}catch(_){throw Error('Private Drive credentials are invalid');}
  const response=await fetch(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString(),signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok)throw Error('Private Drive authorization failed');
  const json=await response.json();if(!json||typeof json.access_token!=='string'||!json.access_token)throw Error('Private Drive authorization failed');
  return json.access_token;
}
async function downloadWorkbook(fetch,serviceAccount){
  const token=await driveToken(fetch,serviceAccount);
  const r=await fetch(SOURCE,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(90000),redirect:'error'});
  if(!r.ok) throw Error('Private workbook download returned HTTP '+r.status);
  if(!r.body) throw Error('Workbook download has no body');
  const parts=[];let size=0;
  for await(const part of r.body){size+=part.byteLength;if(size>LIMIT) throw Error('Workbook exceeds size limit');parts.push(Buffer.from(part));}
  const data=Buffer.concat(parts);
  if(data.length<4||data[0]!==0x50||data[1]!==0x4b||data[2]!==3||data[3]!==4) throw Error('Response is not a workbook');
  return data;
}
async function parseWorkbook(bytes){
  const {boot}=require('../harness/env.js');
  const {w,dom}=await boot('#/reports');
  try{
    w.LS.sync.stopLive();
    Object.assign(w,{DecompressionStream,Blob,Response,TextDecoder});
    w.eval(fs.readFileSync(path.join(ROOT,'assets/js/core/xlsxread.js'),'utf8'));
    const sheets=await w.LSXLSX.readWorkbook({arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
    return buildSnapshot(sheets,w.LS.modules.reports.__read);
  }finally{dom.window.close();}
}
module.exports={downloadWorkbook,parseWorkbook};
