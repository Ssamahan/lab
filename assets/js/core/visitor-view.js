/* Public snapshot only: never read the private register or device storage. */
(function(){
'use strict';
const status=document.getElementById('status'),config=window.LS_SHARED||{};
function addRows(selector,rows,fields){
 const body=document.querySelector(selector+' tbody');
 rows.forEach(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row))return;
  const tr=document.createElement('tr');
  fields.forEach(field=>{const td=document.createElement('td');td.textContent=typeof row[field]==='string'?row[field]:'';tr.appendChild(td);});
  body.appendChild(tr);
 });
}
async function load(){
 try{
  const endpoint=new URL(config.endpoint);
  if(endpoint.protocol!=='https:'||!config.key)throw new Error('configuration');
  const response=await fetch(endpoint.origin+'/rest/v1/rpc/lab_read_public_snapshot',{
   method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:'{}',cache:'no-store',credentials:'omit'
  });
  if(!response.ok)throw new Error('unavailable');
  const snapshot=await response.json();
  if(snapshot===null){status.textContent='A public snapshot is not yet published.';return;}
  if(!snapshot||!snapshot.data||!Array.isArray(snapshot.data.trainings)||!Array.isArray(snapshot.data.equipment))throw new Error('invalid snapshot');
  addRows('#trainings',snapshot.data.trainings,['title','start','end','location']);
  addRows('#equipment',snapshot.data.equipment,['name','status']);
  status.textContent='Public snapshot · revision '+String(snapshot.revision||'');
 }catch(_){status.textContent='Public information is unavailable. Please try again later.';}
}
load();
})();
