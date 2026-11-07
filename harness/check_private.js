const fs=require('fs'); const {JSDOM}=require('jsdom');
async function run(registerOK,privateOK){
 const calls=[]; const dom=new JSDOM(fs.readFileSync('check.html','utf8'),{url:'https://example.test/lab/check.html',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.fetch=async(url,opts)=>{calls.push({url:String(url),opts});const reg=String(url).includes('/lab_registers?'), priv=String(url).includes('/auth/v1/settings');const status=(reg&&!registerOK||priv&&!privateOK)?503:200;return {ok:status===200,status,text:async()=>priv?'PRIVATE_RESPONSE_SHOULD_NOT_APPEAR':'v6.9.120'};};
 }});
 await new Promise(r=>setTimeout(r,100));return {w:dom.window,calls,report:dom.window.__lsReport};
}
(async()=>{
 for(const [reg,priv] of [[true,true],[false,true],[true,false]]){
  const x=await run(reg,priv), {w,calls,report}=x;
  if(!report)throw Error('no report');
  if(!report.includes((reg?'ok  ':'FAIL')+'  The shared register (Supabase)'))throw Error('wrong register result');
  if(!report.includes((priv?'ok  ':'FAIL')+'  Private names authentication (Supabase)'))throw Error('wrong private result');
  if(report.includes('PRIVATE_RESPONSE_SHOULD_NOT_APPEAR'))throw Error('response body leaked');
  if(calls.some(c=>c.opts.method && c.opts.method!=='GET'))throw Error('not read-only');
  if(reg&&priv&&!w.document.querySelector('#verdict').textContent.includes('does not test sign-in'))throw Error('misleading verdict');
  w.close();console.log('passed register='+reg+' private='+priv);
 }
})().catch(e=>{console.error(e);process.exit(1)});
