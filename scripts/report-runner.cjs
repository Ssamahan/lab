'use strict';
const {downloadWorkbook,parseWorkbook}=require('./report-reader.cjs');
const {makeTransport}=require('./report-transport.cjs');
const {publishOnce}=require('./report-publisher.cjs');
const ENDPOINT='https://xakoyknvkktpcmyecoxx.supabase.co/rest/v1/rpc';
const PUBLISHABLE_KEY='sb_publishable_LP464vGRnwj3g-i6FtgxcA_WOU1R3k7';
async function run({fetch,env,log}){
  if(!env.REPORT_PUBLISHER_SECRET) throw Error('Report publisher credential not configured');
  if(!env.REPORT_DRIVE_SERVICE_ACCOUNT) throw Error('Private Drive credentials not configured');
  const bytes=await downloadWorkbook(fetch,env.REPORT_DRIVE_SERVICE_ACCOUNT);
  const candidate=await parseWorkbook(bytes);
  const transport=makeTransport({fetch,endpoint:ENDPOINT,apiKey:PUBLISHABLE_KEY,secret:env.REPORT_PUBLISHER_SECRET});
  const result=await publishOnce({read:transport.read,write:transport.write,parse:async()=>candidate,dryRun:env.REPORT_DRY_RUN==='true'});
  log('Protected monthly report refresh: '+result.status);
  return result;
}
if(require.main===module) run({fetch:globalThis.fetch,env:process.env,log:console.log}).catch(()=>{console.error('Protected monthly report refresh failed; no workbook contents or credentials are logged.');process.exitCode=1;});
module.exports={run};
