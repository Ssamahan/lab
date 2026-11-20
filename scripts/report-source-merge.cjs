'use strict';

// This function combines protected snapshots in memory. It never writes to the
// shared register, and an existing recorded figure always wins a disagreement.
const copy=value=>JSON.parse(JSON.stringify(value));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const safeKeys=x=>Object.keys(x).every(k=>!['__proto__','prototype','constructor'].includes(k));
function validSnapshot(s){
  if(!object(s)||!object(s.months)||!object(s.workbookCells)) return false;
  return Object.entries(s.months).every(([key,m])=>/^\d{4}-(0[1-9]|1[0-2])$/.test(key)&&object(m)&&m.month===key&&object(m.values)&&object(m.blood)&&
    safeKeys(m.values)&&safeKeys(m.blood)&&Object.values(m.values).every(x=>object(x)&&safeKeys(x))&&Object.values(m.blood).every(x=>object(x)&&safeKeys(x))&&
    (m.sourceReview===undefined||Array.isArray(m.sourceReview))&&(m.unmatched===undefined||Array.isArray(m.unmatched)))&&
    safeKeys(s.workbookCells)&&Object.values(s.workbookCells).every(Array.isArray)&&
    (s.workbookCellVersions===undefined||(object(s.workbookCellVersions)&&safeKeys(s.workbookCellVersions)&&Object.values(s.workbookCellVersions).every(Array.isArray)));
}
function addDistinct(list,items){
  const seen=new Set(list.map(x=>JSON.stringify(x)));
  for(const item of items||[]){const key=JSON.stringify(item);if(!seen.has(key)){list.push(copy(item));seen.add(key);}}
}
function mergeSnapshots(previous,incoming){
  if(!validSnapshot(previous)||!validSnapshot(incoming)) throw new Error('Invalid report snapshot');
  const out=copy(previous);
  for(const [key,next] of Object.entries(incoming.months)){
    if(!out.months[key]){out.months[key]=copy(next);continue;}
    const original=out.months[key];
    original.sourceReview=original.sourceReview||[]; original.unmatched=original.unmatched||[];
    addDistinct(original.sourceReview,next.sourceReview); addDistinct(original.unmatched,next.unmatched);
    for(const group of ['values','blood']) for(const [id,fields] of Object.entries(next[group])){
      original[group][id]=original[group][id]||{};
      for(const [field,value] of Object.entries(fields)){
        if(value===null||value===undefined) continue;
        const prior=original[group][id][field];
        if(prior===null||prior===undefined) original[group][id][field]=copy(value);
        else if(JSON.stringify(prior)!==JSON.stringify(value)) addDistinct(original.sourceReview,[{kind:'source-conflict',group,id,field,originalValue:prior,incomingValue:value}]);
      }
    }
  }
  for(const [name,rows] of Object.entries(incoming.workbookCells)){
    if(!Object.hasOwn(out.workbookCells,name)) out.workbookCells[name]=copy(rows);
    else if(JSON.stringify(out.workbookCells[name])!==JSON.stringify(rows)){
      out.workbookCellVersions=out.workbookCellVersions||{};
      out.workbookCellVersions[name]=out.workbookCellVersions[name]||[];
      addDistinct(out.workbookCellVersions[name],[rows]);
    }
  }
  return out;
}
module.exports={mergeSnapshots};
