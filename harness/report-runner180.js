const assert=require('node:assert/strict');const {run}=require('../scripts/report-runner.cjs');
(async()=>{
 const events=[];const fetch=async(url)=>{events.push(url);throw Error('synthetic HTTP failure');};
 await assert.rejects(()=>run({fetch,env:{REPORT_PUBLISHER_SECRET:'test'},log:()=>{}}),/Drive credentials/);assert.equal(events.length,0);
 await assert.rejects(()=>run({fetch,env:{REPORT_PUBLISHER_SECRET:'test',REPORT_DRIVE_SERVICE_ACCOUNT:'bad'},log:()=>{}}),/credentials/);assert.equal(events.length,0);
 console.log('report-runner180: missing or malformed private Drive credentials abort before any network or write');
})().catch(e=>{console.error(e);process.exit(1)});
