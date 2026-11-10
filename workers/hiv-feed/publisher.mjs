/* Staged-only runner. Receives an encrypted-at-rest config from the private store,
   reads one workbook, saves a rotated config and publishes only the reduced summary. */
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createSummary,ReaderFailure} from './reader.mjs';
class PublisherFailure extends Error {constructor(stage,detail=''){super('Timeliness update failed');this.stage=stage;this.detail=detail;}}
const ORIGIN='https://lab-hiv-timeliness.smhnklvn.workers.dev';
const safeStages=new Set(['publisher-key','temporary-directory','get-config','prepare-config','save-config','read-workbook','publish-summary']);
const safeDetails=new Set(['workbook-path-missing','workbook-path-control-character','workbook-path-wrong-prefix','invalid-config-path','rclone-unavailable','timeout','size-limit','authorization','file-not-found','access-denied','rclone-options','invalid-workbook','other']);
export function safeDiagnostic(error){
 if(!(error instanceof PublisherFailure))return 'unexpected';
 const stage=safeStages.has(error.stage)?error.stage:'unexpected';
 const detail=safeDetails.has(error.detail)||/^http-[1-5][0-9]{2}$/.test(error.detail)?error.detail:'';
 return stage+(detail?' / '+detail:'');
}
export async function publish({key,sourcePath,fetchImpl=fetch,summaryFn=createSummary,tempRoot=tmpdir()}){
 if(typeof key!=='string'||!/^[0-9a-f]{64}$/.test(key))throw new PublisherFailure('publisher-key');
 const headers={'authorization':'Bearer '+key,'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'};
 const call=async(path,opts={})=>{
  const response=await fetchImpl(ORIGIN+path,{...opts,headers:{...headers,...opts.headers},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok){const error=Error('HTTP response');error.status=response.status;throw error;}return response;
 };
 let stage='temporary-directory';const dir=await mkdtemp(join(tempRoot,'hiv-reader-'));const configPath=join(dir,'rclone.conf');
 try{
  stage='get-config';const get=await call('/private/config');
  stage='prepare-config';if(Number(get.headers.get('content-length'))>65536)throw Error('Configuration too large');
  const config=Buffer.from(await get.arrayBuffer());if(!config.length||config.length>65536)throw Error('Invalid configuration');
  await writeFile(configPath,config,{mode:0o600,flag:'wx'});
  let summary,readError;
  try{summary=summaryFn({configPath,sourcePath});}catch(e){readError=e instanceof ReaderFailure?e.category:'other';}
  // Save refreshed credentials even if reading/parsing failed; never publish on failure.
  stage='save-config';const refreshed=await readFile(configPath);if(!refreshed.length||refreshed.length>65536)throw Error('Invalid refreshed configuration');
  await call('/private/config',{method:'PUT',headers:{'content-type':'application/octet-stream'},body:refreshed});
  if(readError)throw new PublisherFailure('read-workbook',readError);
  stage='publish-summary';await call('/private/summary',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(summary)});
 }catch(e){if(e instanceof PublisherFailure)throw e;throw new PublisherFailure(stage,Number.isInteger(e?.status)?'http-'+e.status:'');}
 finally{await rm(dir,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await publish({key:process.env.HIV_PUBLISHER_KEY,sourcePath:process.env.HIV_WORKBOOK_PATH});console.log('Timeliness summary updated.');}
 catch(e){const diagnostic=safeDiagnostic(e);console.error('Timeliness update failed at:',diagnostic);if(process.env.GITHUB_ACTIONS==='true')console.log('::error title=Timeliness update::'+diagnostic);process.exitCode=1;}
}
