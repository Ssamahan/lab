const assert=require('node:assert/strict');
const {downloadWorkbook}=require('../scripts/report-reader.cjs');
(async()=>{
 const zip=Uint8Array.from([0x50,0x4b,3,4,1,2]);
 const fetch=async()=>new Response(zip,{status:200});
 assert.deepEqual(await downloadWorkbook(fetch),Buffer.from(zip));
 await assert.rejects(()=>downloadWorkbook(async()=>new Response('<html>login</html>',{status:200})),/workbook/i);
 await assert.rejects(()=>downloadWorkbook(async()=>new Response('x',{status:403})),/403/);
 console.log('report-reader180: rejects an HTML login page and HTTP errors without attempting an import');
})().catch(e=>{console.error(e);process.exit(1)});
