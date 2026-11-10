/* Staged-only runner. Receives an encrypted-at-rest config from the private store,
   reads one workbook, saves a rotated config and publishes only the reduced summary. */
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createSummary} from './reader.mjs';
const ORIGIN='https://lab-hiv-timeliness.smhnklvn.workers.dev';
export async function publish({key,sourcePath,fetchImpl=fetch,summaryFn=createSummary,tempRoot=tmpdir()}){
 if(typeof key!=='string'||!/^[0-9a-f]{64}$/.test(key))throw Error('Invalid credentials');
 const headers={'authorization':'Bearer '+key};
 const call=async(path,opts={})=>{
  const response=await fetchImpl(ORIGIN+path,{...opts,headers:{...headers,...opts.headers},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Private store request failed');return response;
 };
 const dir=await mkdtemp(join(tempRoot,'hiv-reader-'));const configPath=join(dir,'rclone.conf');
 try{
  const get=await call('/private/config');
  if(Number(get.headers.get('content-length'))>65536)throw Error('Configuration too large');
  const config=Buffer.from(await get.arrayBuffer());if(!config.length||config.length>65536)throw Error('Invalid configuration');
  await writeFile(configPath,config,{mode:0o600,flag:'wx'});
  let summary,readError;
  try{summary=summaryFn({configPath,sourcePath});}catch{readError=true;}
  // Save refreshed credentials even if reading/parsing failed; never publish on failure.
  const refreshed=await readFile(configPath);if(!refreshed.length||refreshed.length>65536)throw Error('Invalid refreshed configuration');
  await call('/private/config',{method:'PUT',headers:{'content-type':'application/octet-stream'},body:refreshed});
  if(readError)throw Error('Workbook read failed');
  await call('/private/summary',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(summary)});
 }finally{await rm(dir,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await publish({key:process.env.HIV_PUBLISHER_KEY,sourcePath:process.env.HIV_WORKBOOK_PATH});console.log('Timeliness summary updated.');}
 catch{console.error('Timeliness update failed or could not be confirmed.');process.exitCode=1;}
}
