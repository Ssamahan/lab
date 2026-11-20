'use strict';
const fs=require('node:fs'),path=require('node:path');
const {buildSnapshot}=require('./report-source-build.cjs');
const ROOT=path.resolve(__dirname,'..');
const SOURCE='https://drive.usercontent.google.com/download?id=1KHAK1Wsd-xAuIgP3mNcd9100qaf0h15u&export=download';
const LIMIT=15*1024*1024;
async function downloadWorkbook(fetch){
  const r=await fetch(SOURCE,{signal:AbortSignal.timeout(90000),redirect:'follow'});
  if(!r.ok) throw Error('Workbook download returned HTTP '+r.status);
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
