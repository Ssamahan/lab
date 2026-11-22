'use strict';
function makeTransport({fetch,endpoint,apiKey,secret}){
  const url=new URL(endpoint);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash) throw Error('HTTPS endpoint required');
  if(typeof apiKey!=='string'||!apiKey||typeof secret!=='string'||!secret||typeof fetch!=='function') throw Error('Publisher configuration missing');
  const call=async(name,body)=>{
    const response=await fetch(url.href.replace(/\/$/,'')+'/'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:apiKey},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    // Do not log response bodies: an upstream error can echo credentials.
    if(!response.ok) throw Error('Protected report service returned HTTP '+response.status);
    return response.json();
  };
  return {read:()=>call('report_publisher_read',{p_secret:secret}),
    write:payload=>call('report_publisher_write',{p_secret:secret,p_expected:payload.expected,p_sha256:payload.sha256,p_gzip_base64:payload.gzip_base64})};
}
module.exports={makeTransport};
