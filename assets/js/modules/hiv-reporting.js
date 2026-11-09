/* ============================================================================
   MODULE · HIV REPORTING — health-centre monthly submission timeliness
   ----------------------------------------------------------------------------
   The import is deliberately separate from the shared laboratory register. It
   stores only health-centre name, reporting month and completion date/time in
   this browser's localStorage; form answers, staff names, email addresses and
   testing/stock data are never retained or sent to Supabase.
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, S=LS.store, M={};
LS.modules['hiv-reporting']=M;
const STORE_KEY='labSystems.hivReporting.v1';
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_ALIASES={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
const DAY_MS=86400000;
let rootEl=null;
let view={asOf:null,from:null,to:null};

function pad(n){ return String(n).padStart(2,'0'); }
function clean(s){ return String(s==null?'':s).replace(/^\uFEFF/,'').trim(); }
function dateOrdinal(iso){
  const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m?Math.floor(Date.UTC(+m[1],+m[2]-1,+m[3])/DAY_MS):NaN;
}
function todayISO(){ return U.todayISO?U.todayISO():new Date().toISOString().slice(0,10); }
function dateFromOrdinal(n){
  const d=new Date(n*DAY_MS);
  return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());
}
function monthKey(y,m){ return String(y)+'-'+pad(m+1); }
function monthOrdinal(key){ const m=String(key).match(/^(\d{4})-(\d{2})$/); return m?(+m[1])*12+(+m[2])-1:NaN; }
function monthFromOrdinal(n){ return monthKey(Math.floor(n/12),n%12); }
function addMonth(key,n){ return monthFromOrdinal(monthOrdinal(key)+n); }
function monthLabel(key){
  const m=String(key).match(/^(\d{4})-(\d{2})$/); if(!m) return key;
  return MONTHS[+m[2]-1]+' '+m[1];
}
function formatDate(iso){
  if(!iso) return '—';
  const n=dateOrdinal(iso); if(!Number.isFinite(n)) return String(iso);
  const d=new Date(n*DAY_MS);
  return d.getUTCDate()+' '+MONTHS[d.getUTCMonth()].slice(0,3)+' '+d.getUTCFullYear();
}
function formatDateLong(iso){
  if(!iso) return '—';
  const n=dateOrdinal(iso); if(!Number.isFinite(n)) return String(iso);
  const d=new Date(n*DAY_MS);
  return d.getUTCDate()+' '+MONTHS[d.getUTCMonth()]+' '+d.getUTCFullYear();
}
function escape(s){ return U.esc(String(s==null?'':s)); }
function normHeader(s){
  return clean(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function normFacility(s){
  return normHeader(s).replace(/\bhealth centre\b/g,'hc').replace(/\bhealth center\b/g,'hc').replace(/\s+/g,' ').trim();
}
function expectedFacilities(){
  const rows=((S.db().catalog||{}).healthCenters||[]).map(x=>typeof x==='string'?x:x&&x.name).filter(Boolean);
  return rows.length?Array.from(new Set(rows.map(clean))).sort((a,b)=>a.localeCompare(b)):[];
}
function canonicalFacility(raw,facilities){
  const n=normFacility(raw);
  return facilities.find(x=>normFacility(x)===n)||clean(raw);
}
function reportMonthInfo(raw,completedAt){
  const s=clean(raw).toLowerCase();
  const dateMatch=s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/);
  if(dateMatch){
    let y=+dateMatch[1], m=+dateMatch[2]-1;
    if(m>=0&&m<12) return {year:y,month:m};
  }
  const explicitYear=s.match(/\b(19\d{2}|20\d{2})\b/);
  const token=s.replace(/\b(19\d{2}|20\d{2})\b/g,' ').match(/[a-z]+/);
  let m=token?MONTH_ALIASES[token[0]]:undefined;
  if(m==null){
    const number=s.match(/^\s*(\d{1,2})\s*$/);
    if(number&&+number[1]>=1&&+number[1]<=12) m=+number[1]-1;
  }
  if(m==null) return null;
  const actual=String(completedAt||'').slice(0,10).match(/^(\d{4})-(\d{2})-/);
  if(!explicitYear&&!actual) return null;
  const actualYear=actual?+actual[1]:+explicitYear[1];
  const actualMonth=actual?+actual[2]-1:m;
  /* Reporting Month has no year in the Microsoft Form. A report completed in
     June for May therefore resolves to May of that same year; December submitted
     the following January resolves to the previous year. */
  const year=explicitYear?+explicitYear[1]:(m>actualMonth?actualYear-1:actualYear);
  return {year,month:m};
}
function parseTimestamp(value){
  if(value instanceof Date&&!isNaN(value)){
    const y=value.getFullYear(),m=value.getMonth()+1,d=value.getDate();
    return {date:y+'-'+pad(m)+'-'+pad(d),time:pad(value.getHours())+':'+pad(value.getMinutes())+':'+pad(value.getSeconds())};
  }
  if(typeof value==='number'&&Number.isFinite(value)){
    /* Excel's 1900 date system; subtracting 25569 maps the serial to Unix UTC. */
    if(value>1000000000000){
      const d=new Date(value); if(isNaN(d)) return null;
      return {date:d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate()),time:pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds())};
    }
    if(value>20000&&value<100000){
      const ms=Math.round((value-25569)*DAY_MS),d=new Date(ms);
      if(isNaN(d)) return null;
      return {date:d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate()),time:pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds())};
    }
  }
  const s=clean(value);
  if(!s) return null;
  let m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/);
  if(m){
    const y=+m[1],mo=+m[2],d=+m[3],h=+(m[4]||0),mi=+(m[5]||0),se=+(m[6]||0);
    if(mo<1||mo>12||d<1||d>31||h>23||mi>59||se>59) return null;
    return {date:y+'-'+pad(mo)+'-'+pad(d),time:pad(h)+':'+pad(mi)+':'+pad(se)};
  }
  /* CSV exports sometimes use M/D/YYYY. If one component is >12 it is treated
     as the day; otherwise use the common Excel export order, M/D/YYYY. */
  m=s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(m){
    let a=+m[1],b=+m[2],mo,day;
    if(a>12){ day=a; mo=b; } else if(b>12){ mo=a; day=b; } else { mo=a; day=b; }
    if(mo<1||mo>12||day<1||day>31) return null;
    return {date:+m[3]+'-'+pad(mo)+'-'+pad(day),time:pad(+(m[4]||0))+':'+pad(+(m[5]||0))+':'+pad(+(m[6]||0))};
  }
  const parsed=new Date(s);
  if(!isNaN(parsed)) return {date:parsed.getFullYear()+'-'+pad(parsed.getMonth()+1)+'-'+pad(parsed.getDate()),time:pad(parsed.getHours())+':'+pad(parsed.getMinutes())+':'+pad(parsed.getSeconds())};
  return null;
}
function headerIndexes(headers){
  const hs=headers.map(normHeader);
  const find=aliases=>hs.findIndex(h=>aliases.includes(h));
  return {
    facility:find(['health facility name','health facility','facility name','health centre name','health center name','centre name','center name']),
    reportMonth:find(['reporting month','report month','month reported','report period','reporting period','period']),
    completed:find(['completion time','completion date','completed at','date completed','submission date','submitted at','submitted on','date submitted'])
  };
}
function findHeaderRow(grid){
  for(let i=0;i<Math.min(grid.length,40);i++){
    const ix=headerIndexes(grid[i]||[]);
    if(ix.facility>=0&&ix.reportMonth>=0&&ix.completed>=0) return i;
  }
  return -1;
}
function recordsFromGrid(grid,facilities){
  if(!Array.isArray(grid)||!grid.length) throw new Error('The selected sheet is empty.');
  const headerRow=findHeaderRow(grid);
  if(headerRow<0){
    const show=(grid[0]||[]).map(clean).filter(Boolean).slice(0,12).join(' · ');
    throw new Error('Could not find the required columns: Health Facility Name, Reporting Month and Completion time. First row found: '+(show||'blank'));
  }
  const indexes=headerIndexes(grid[headerRow]);
  const records=[],invalid=[],outside=[];
  for(let i=headerRow+1;i<grid.length;i++){
    const row=grid[i]||[];
    if(row.every(v=>clean(v)==='')) continue;
    const rawFacility=clean(row[indexes.facility]);
    const rawMonth=row[indexes.reportMonth];
    const rawCompleted=row[indexes.completed];
    if(!rawFacility&&!clean(rawMonth)&&!clean(rawCompleted)) continue;
    if(!rawFacility||!clean(rawMonth)||!clean(rawCompleted)){ invalid.push({row:i+1,reason:'missing facility, reporting month or completion time'}); continue; }
    const stamp=parseTimestamp(rawCompleted);
    if(!stamp){ invalid.push({row:i+1,reason:'unreadable completion time'}); continue; }
    const period=reportMonthInfo(rawMonth,stamp.date);
    if(!period){ invalid.push({row:i+1,reason:'unreadable reporting month'}); continue; }
    const facility=canonicalFacility(rawFacility,facilities);
    if(facilities.length&&!facilities.some(f=>normFacility(f)===normFacility(facility))){
      outside.push({row:i+1,facility}); continue;
    }
    records.push({facility,period:monthKey(period.year,period.month),completedAt:stamp.date+'T'+stamp.time,submittedOn:stamp.date});
  }
  if(!records.length) throw new Error('No usable health-centre rows were found. Check that the workbook has the expected headers and completion dates.');
  return {records,invalid,outside,headerRow:headerRow+1,validRows:records.length};
}
function parseDelimited(text){
  const s=String(text||'').replace(/^\uFEFF/,'');
  const sample=s.split(/\r?\n/).find(x=>x.trim())||'';
  let quote=false,commas=0,tabs=0;
  for(let i=0;i<sample.length;i++){
    if(sample[i]==='"'){ if(quote&&sample[i+1]==='"'){ i++; continue; } quote=!quote; }
    else if(!quote&&sample[i]===',') commas++;
    else if(!quote&&sample[i]==='\t') tabs++;
  }
  const delimiter=tabs>commas?'\t':',';
  const rows=[]; let row=[],field='',inQuotes=false;
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(c==='"'){
      if(inQuotes&&s[i+1]==='"'){ field+='"'; i++; }
      else inQuotes=!inQuotes;
    }else if(c===delimiter&&!inQuotes){ row.push(field); field=''; }
    else if((c==='\n'||c==='\r')&&!inQuotes){
      if(c==='\r'&&s[i+1]==='\n') i++;
      row.push(field); field='';
      if(row.some(v=>clean(v)!=='')) rows.push(row);
      row=[];
    }else field+=c;
  }
  if(field!==''||row.length){ row.push(field); if(row.some(v=>clean(v)!=='')) rows.push(row); }
  return rows;
}
function normalPath(path){
  const out=[];
  String(path||'').split('/').forEach(p=>{ if(!p||p==='.') return; if(p==='..') out.pop(); else out.push(p); });
  return out.join('/');
}
async function unzipEntries(buffer){
  const bytes=new Uint8Array(buffer),dv=new DataView(buffer),start=Math.max(0,bytes.length-65557);
  let eocd=-1;
  for(let i=bytes.length-22;i>=start;i--){ if(dv.getUint32(i,true)===0x06054b50){ eocd=i; break; } }
  if(eocd<0) throw new Error('This is not a supported .xlsx file. Try saving the sheet as CSV.');
  const count=dv.getUint16(eocd+10,true),centralOffset=dv.getUint32(eocd+16,true),decoder=new TextDecoder();
  const entries={}; let p=centralOffset;
  for(let i=0;i<count;i++){
    if(dv.getUint32(p,true)!==0x02014b50) throw new Error('The workbook ZIP directory is damaged.');
    const method=dv.getUint16(p+10,true),compressedSize=dv.getUint32(p+20,true),nameLen=dv.getUint16(p+28,true),extraLen=dv.getUint16(p+30,true),commentLen=dv.getUint16(p+32,true),localOffset=dv.getUint32(p+42,true);
    const name=decoder.decode(bytes.slice(p+46,p+46+nameLen));
    entries[name]={method,compressedSize,localOffset};
    p+=46+nameLen+extraLen+commentLen;
  }
  async function read(name){
    const e=entries[name]; if(!e) return null;
    const o=e.localOffset;
    if(dv.getUint32(o,true)!==0x04034b50) throw new Error('The workbook entry '+name+' is damaged.');
    const localNameLen=dv.getUint16(o+26,true),localExtraLen=dv.getUint16(o+28,true),from=o+30+localNameLen+localExtraLen;
    const raw=bytes.slice(from,from+e.compressedSize);
    if(e.method===0) return raw;
    if(e.method!==8) throw new Error('This workbook uses an unsupported compression method. Save it as CSV and import that instead.');
    if(typeof DecompressionStream==='undefined') throw new Error('This browser cannot unpack Excel workbooks offline. Save the worksheet as CSV, then import the CSV.');
    try{
      const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }catch(err){ throw new Error('Could not unpack the Excel sheet in this browser. Save it as CSV and import the CSV.'); }
  }
  return {read,decoder};
}
function xmlDoc(bytes,decoder){
  if(!bytes) return null;
  const doc=new DOMParser().parseFromString(decoder.decode(bytes),'application/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error('The workbook contains invalid XML.');
  return doc;
}
function descendantsByLocalName(node,name){
  return Array.from(node.getElementsByTagName('*')).filter(x=>x.localName===name);
}
function colIndex(ref){
  const letters=String(ref||'').match(/^[A-Z]+/i); if(!letters) return 0;
  let n=0; for(const c of letters[0].toUpperCase()) n=n*26+c.charCodeAt(0)-64;
  return n-1;
}
async function parseXlsx(file){
  const zip=await unzipEntries(await file.arrayBuffer()),decoder=zip.decoder;
  const workbook=xmlDoc(await zip.read('xl/workbook.xml'),decoder);
  const rels=xmlDoc(await zip.read('xl/_rels/workbook.xml.rels'),decoder);
  if(!workbook||!rels) throw new Error('Could not locate the workbook sheets.');
  const sheet=descendantsByLocalName(workbook,'sheet')[0];
  if(!sheet) throw new Error('The workbook has no worksheet.');
  const rid=Array.from(sheet.attributes).find(a=>a.localName==='id')?.value||'';
  const relation=descendantsByLocalName(rels,'Relationship').find(x=>x.getAttribute('Id')===rid);
  if(!relation) throw new Error('Could not resolve the first worksheet.');
  let target=relation.getAttribute('Target')||'';
  const sheetPath=target.startsWith('/')?normalPath(target.slice(1)):normalPath('xl/'+target);
  const sharedBytes=await zip.read('xl/sharedStrings.xml');
  const sharedDoc=sharedBytes?xmlDoc(sharedBytes,decoder):null;
  const strings=sharedDoc?descendantsByLocalName(sharedDoc,'si').map(si=>descendantsByLocalName(si,'t').map(t=>t.textContent||'').join('')):[];
  const sheetDoc=xmlDoc(await zip.read(sheetPath),decoder);
  if(!sheetDoc) throw new Error('Could not read the first worksheet.');
  const grid=[];
  descendantsByLocalName(sheetDoc,'row').forEach(rowEl=>{
    const row=[];
    descendantsByLocalName(rowEl,'c').forEach(cell=>{
      const idx=colIndex(cell.getAttribute('r'));
      const type=cell.getAttribute('t')||'';
      let value='';
      if(type==='inlineStr') value=descendantsByLocalName(cell,'t').map(t=>t.textContent||'').join('');
      else {
        const v=descendantsByLocalName(cell,'v')[0];
        const raw=v?(v.textContent||''):'';
        if(type==='s') value=strings[+raw]||'';
        else if(type==='b') value=raw==='1';
        else if(type==='str') value=raw;
        else if(raw!==''&&Number.isFinite(Number(raw))) value=Number(raw);
        else value=raw;
      }
      row[idx]=value;
    });
    grid.push(row);
  });
  return grid;
}
async function parseFile(file,facilities){
  const name=String(file&&file.name||'').toLowerCase();
  const grid=name.endsWith('.xlsx')?await parseXlsx(file):parseDelimited(await file.text());
  return recordsFromGrid(grid,facilities);
}
function rowIdentity(r){
  return normFacility(r&&r.facility)+'|'+String(r&&r.period||'')+'|'+clean(r&&(r.completedAt||r.submittedOn));
}
function mergeRows(existing,incoming){
  const rows=(existing||[]).slice();
  const existingKeys=new Set(rows.map(rowIdentity));
  let added=0,alreadyPresent=0;
  (incoming||[]).forEach(r=>{
    if(existingKeys.has(rowIdentity(r))) alreadyPresent++;
    else { rows.push(r); added++; }
  });
  return {rows,added,alreadyPresent};
}
function loadData(){
  try{
    const data=JSON.parse(localStorage.getItem(STORE_KEY)||'null');
    if(data&&Array.isArray(data.rows)) return data;
  }catch(e){}
  return {version:1,rows:[],importedAt:null,fileName:''};
}
function saveData(data){
  try{ localStorage.setItem(STORE_KEY,JSON.stringify(data)); return true; }
  catch(e){ return false; }
}
function deadlineFor(period){
  const m=String(period||'').match(/^(\d{4})-(\d{2})$/); if(!m) return '';
  const reportMonth=+m[2]-1;
  const due=new Date(Date.UTC(+m[1],reportMonth+1,4));
  return due.getUTCFullYear()+'-'+pad(due.getUTCMonth()+1)+'-'+pad(due.getUTCDate());
}
function groupRows(rows){
  const groups={};
  (rows||[]).forEach(r=>{
    if(!r||!r.facility||!r.period||!r.submittedOn) return;
    const key=normFacility(r.facility)+'|'+r.period;
    (groups[key]=groups[key]||[]).push(r);
  });
  Object.keys(groups).forEach(k=>groups[k].sort((a,b)=>String(a.completedAt||a.submittedOn).localeCompare(String(b.completedAt||b.submittedOn))));
  return groups;
}
function allPeriods(rows,asOf){
  const keys=(rows||[]).map(r=>r.period).filter(k=>/^\d{4}-\d{2}$/.test(k)).sort();
  if(!keys.length) return [];
  let end=keys[keys.length-1];
  const nowMonth=String(asOf||todayISO()).slice(0,7);
  /* Show the current reporting month, even with no submission yet, when this is
     a current-year working dataset. Its next-month deadline may still be open. */
  if(/^\d{4}-\d{2}$/.test(nowMonth)&&nowMonth>=end){
    const yearGap=+nowMonth.slice(0,4)- +end.slice(0,4);
    const gap=monthOrdinal(nowMonth)-monthOrdinal(end);
    if(yearGap===0 || (yearGap===1&&gap<=2)) end=nowMonth;
  }
  const out=[]; let k=keys[0],guard=0;
  while(k<=end&&guard++<48){ out.push(k); k=addMonth(k,1); }
  return out;
}
function buildModel(data,asOf,facilities,from,to){
  const allRows=data&&Array.isArray(data.rows)?data.rows:[];
  facilities=(facilities&&facilities.length?facilities:expectedFacilities()).slice();
  asOf=asOf||todayISO();
  const asMonth=String(asOf).slice(0,7),asOrdinal=dateOrdinal(asOf);
  /* A user may set a retrospective cut-off. Ignore later periods and entries
     received after that date so the snapshot cannot see into the future. */
  const rows=allRows.filter(r=>r&&r.period&&r.period<=asMonth&&(!r.submittedOn||dateOrdinal(r.submittedOn)<=asOrdinal));
  const all=allPeriods(rows,asOf);
  let selected=all.slice();
  if(from) selected=selected.filter(k=>k>=from);
  if(to) selected=selected.filter(k=>k<=to);
  const groups=groupRows(rows);
  const matrix=[];
  selected.forEach(period=>{
    const dueDate=deadlineFor(period),dueOrdinal=dateOrdinal(dueDate);
    facilities.forEach(facility=>{
      const key=normFacility(facility)+'|'+period;
      const candidates=groups[key]||[];
      const chosen=candidates[0]||null;
      let state='notDue',lateDays=0,overdueDays=0,lateBand='';
      /* Keep an open reporting window out of the score until the 4th has passed,
         even when a centre has already submitted early. */
      if(asOrdinal>dueOrdinal){
        if(chosen){
          if(dateOrdinal(chosen.submittedOn)<=dueOrdinal) state='onTime';
          else {
            state='late';
            lateDays=Math.max(1,dateOrdinal(chosen.submittedOn)-dueOrdinal);
            lateBand=lateDays<=2?'withinTolerance':'beyondTolerance';
          }
        }else { state='missing'; overdueDays=asOrdinal-dueOrdinal; }
      }
      matrix.push({facility,period,dueDate,chosen,state,lateDays,lateBand,overdueDays,submissions:candidates.length});
    });
  });
  const centers=facilities.map(facility=>{
    const cells=matrix.filter(x=>normFacility(x.facility)===normFacility(facility));
    const onTime=cells.filter(x=>x.state==='onTime').length,late=cells.filter(x=>x.state==='late').length,missing=cells.filter(x=>x.state==='missing').length;
    const lateWithinTolerance=cells.filter(x=>x.state==='late'&&x.lateDays<=2).length;
    const lateMoreThanTolerance=cells.filter(x=>x.state==='late'&&x.lateDays>2).length;
    const due=onTime+late+missing,received=onTime+late,noncompliant=late+missing;
    const lateCells=cells.filter(x=>x.state==='late');
    const duplicates=cells.reduce((n,x)=>n+Math.max(0,x.submissions-1),0);
    return {facility,onTime,late,lateWithinTolerance,lateMoreThanTolerance,missing,due,received,noncompliant,duplicates,rate:due?onTime/due*100:null,
      avgLate:lateCells.length?lateCells.reduce((a,x)=>a+x.lateDays,0)/lateCells.length:null,
      lateDays:lateCells.reduce((a,x)=>a+x.lateDays,0),cells};
  }).sort((a,b)=>b.noncompliant-a.noncompliant||b.late-a.late||(a.rate==null?101:a.rate)-(b.rate==null?101:b.rate)||a.facility.localeCompare(b.facility));
  const months=selected.map(period=>{
    const cells=matrix.filter(x=>x.period===period);
    const onTime=cells.filter(x=>x.state==='onTime').length,late=cells.filter(x=>x.state==='late').length,missing=cells.filter(x=>x.state==='missing').length;
    const lateWithinTolerance=cells.filter(x=>x.state==='late'&&x.lateDays<=2).length;
    const lateMoreThanTolerance=cells.filter(x=>x.state==='late'&&x.lateDays>2).length;
    const notDue=cells.filter(x=>x.state==='notDue').length,due=onTime+late+missing,received=onTime+late;
    return {period,label:monthLabel(period),dueDate:deadlineFor(period),onTime,late,lateWithinTolerance,lateMoreThanTolerance,missing,notDue,due,received,rate:due?onTime/due*100:null,cells};
  });
  const onTime=matrix.filter(x=>x.state==='onTime').length;
  const late=matrix.filter(x=>x.state==='late').length;
  const lateWithinTolerance=matrix.filter(x=>x.state==='late'&&x.lateDays<=2).length;
  const lateMoreThanTolerance=matrix.filter(x=>x.state==='late'&&x.lateDays>2).length;
  const missing=matrix.filter(x=>x.state==='missing').length;
  const due=onTime+late+missing,received=onTime+late;
  const lateCells=matrix.filter(x=>x.state==='late');
  const outOfScope=rows.filter(r=>!facilities.some(f=>normFacility(f)===normFacility(r.facility))).length;
  return {asOf,facilities,periods:selected,allPeriods:all,matrix,months,centers,onTime,late,lateWithinTolerance,lateMoreThanTolerance,missing,due,received,
    noncompliant:late+missing,rate:due?onTime/due*100:null,lateRate:received?late/received*100:null,
    avgLate:lateCells.length?lateCells.reduce((a,x)=>a+x.lateDays,0)/lateCells.length:null,
    lateDays:lateCells.reduce((a,x)=>a+x.lateDays,0),lateCells,
    missingCells:matrix.filter(x=>x.state==='missing'),notDue:matrix.filter(x=>x.state==='notDue').length,
    repeated:centers.filter(x=>x.noncompliant>=3&&x.due>0),outOfScope};
}
function rateText(n){ return n==null?'—':Math.round(n)+'%'; }
function oneDecimal(n){ return n==null?'—':(Math.round(n*10)/10).toFixed(1); }
function cellTone(state){ return state==='onTime'?'teal':state==='late'?'rose':state==='missing'?'amber':'slate'; }
function stateLabel(state){ return state==='onTime'?'On time':state==='late'?'Late':state==='missing'?'Not received':'Not due'; }
function cellStatusLabel(cell){
  if(cell.state!=='late') return stateLabel(cell.state);
  return cell.lateDays<=2?'Late (1–2 days; within the two-day tolerance)':'Late (>2 days)';
}
function currentRangeLabel(model){
  if(!model.periods.length) return 'No reporting periods imported';
  return monthLabel(model.periods[0])+' – '+monthLabel(model.periods[model.periods.length-1]);
}
function notDueSentence(model){
  const open=Array.from(new Set(model.matrix.filter(x=>x.state==='notDue').map(x=>x.period))).sort();
  if(!open.length) return '';
  return open.map(period=>{
    const due=deadlineFor(period);
    return 'The '+monthLabel(period)+' reporting period is not yet due; its report must be received before 5 '+MONTHS[+due.slice(5,7)-1]+' (no later than '+formatDateLong(due)+') and it is excluded from the performance rate.';
  }).join(' ');
}
function hero(model,data){
  const imported=data.importedAt?U.fmtDT(data.importedAt):'No workbook imported';
  return '<div class="hiv-hero"><div class="hiv-hero-main"><div class="eyebrow">GAKENKE DISTRICT · HIV TESTING REPORTS</div>'
    +'<h1>On time means <em>before the 5th.</em></h1>'
    +'<p>Import each month as reports are gathered. New submissions join the saved history, so earlier months remain available while you track timeliness and repeat delays.</p>'
    +'<div class="hero-actions"><button class="btn primary" data-hiv-import>'+UI.ic('upload',14)+'Import Excel / CSV</button><button class="btn" data-hiv-restore>'+UI.ic('folder-open',14)+'Restore JSON backup</button>'
    +(data.rows.length?'<button class="btn" data-hiv-summary>'+UI.ic('download',14)+'Export summary</button><button class="btn" data-hiv-letter-dg>'+UI.ic('file-text',14)+'Letter to DG</button><button class="btn" data-hiv-letter-hc>'+UI.ic('file-check',14)+'Draft DG notice</button>':'')
    +'</div><div class="hiv-local"><span class="pill blue">Local only</span><span>Only centre, report month and completion time are kept in this browser; no form answers or contact details are imported.</span></div></div>'
    +'<div class="hiv-deadline"><div class="eyebrow">DEADLINE RULE</div><div class="hiv-deadline-date">4<small>th</small></div><div class="strong">of the following month</div>'
    +'<p>A report submitted on or after the 5th is late. A month still within its submission window is shown as <b>Not due</b>, not penalised.</p>'
    +'<div class="hiv-source">'+(data.rows.length?escape(data.fileName||'Imported workbook')+' · imported '+escape(imported):'Import the Microsoft Forms response workbook or a CSV export to start.')+'</div></div></div>';
}
function stats(model){
  const due=model.due;
  const chronic=model.repeated.length;
  return '<div class="grid-12 stagger hiv-kpis">'
    +'<div class="c3">'+UI.stat({label:'On-time rate',value:model.rate||0,dec:1,unit:'%',formatted:model.rate==null?'—':oneDecimal(model.rate),icon:'calendar-check',cls:'hiv-kpi-good',note:model.onTime+' on time of '+due+' due obligations'})+'</div>'
    +'<div class="c3">'+UI.stat({label:'Late submissions (all late)',value:model.late,icon:'clock',cls:'hiv-kpi-late',note:model.lateWithinTolerance+' late by 1–2 days (within tolerance); '+model.lateMoreThanTolerance+' late by >2 days'})+'</div>'
    +'<div class="c3">'+UI.stat({label:'Overdue / missing',value:model.missing,icon:'alert-triangle',cls:'hiv-kpi-missing',note:model.missing?'Report(s) not received after the deadline':'All due reports have been received'})+'</div>'
    +'<div class="c3">'+UI.stat({label:'Repeat non-compliance',value:chronic,icon:'refresh-cw',cls:'hiv-kpi-repeat',note:'Centres with 3+ late or overdue cycles in this window'})+'</div></div>';
}
function rangeControls(model){
  if(!model.allPeriods.length) return '';
  const from=view.from&&model.allPeriods.includes(view.from)?view.from:model.allPeriods[0];
  const to=view.to&&model.allPeriods.includes(view.to)?view.to:model.allPeriods[model.allPeriods.length-1];
  view.from=from; view.to=to;
  return '<div class="hiv-controls card pad"><div class="hiv-filter"><label>Reporting months</label><select class="select" data-hiv-from>'+model.allPeriods.map(k=>'<option value="'+k+'"'+(k===from?' selected':'')+'>'+escape(monthLabel(k))+'</option>').join('')+'</select>'
    +'<span class="hiv-dash">to</span><select class="select" data-hiv-to>'+model.allPeriods.map(k=>'<option value="'+k+'"'+(k===to?' selected':'')+'>'+escape(monthLabel(k))+'</option>').join('')+'</select></div>'
    +'<label class="hiv-asof">As of <input class="input" type="date" value="'+escape(view.asOf||model.asOf)+'" data-hiv-asof></label>'
    +'<span class="hiv-range-note">'+escape(currentRangeLabel(model))+' · '+model.facilities.length+' expected health centres</span></div>';
}
function monthTable(model){
  const rows=model.months.map(m=>{
    const status=m.due===0?'not due':(m.missing?'overdue':'closed');
    const rate=m.rate==null?'—':rateText(m.rate);
    const tone=m.due===0?'slate':m.missing?'amber':m.late?'rose':'teal';
    return '<tr><td><b>'+escape(m.label)+'</b></td><td class="num">'+formatDate(m.dueDate)+'</td><td class="num">'+(m.due?m.due:'—')+'</td>'
      +'<td class="num">'+(m.due?m.received:'—')+'</td><td class="num"><span class="pill teal">'+(m.due?m.onTime:'—')+'</span></td>'
      +'<td class="num"><span class="pill '+(m.lateWithinTolerance?'amber':'slate')+'">'+(m.due?m.lateWithinTolerance:'—')+'</span></td>'
      +'<td class="num"><span class="pill '+(m.lateMoreThanTolerance?'rose':'slate')+'">'+(m.due?m.lateMoreThanTolerance:'—')+'</span></td>'
      +'<td class="num"><span class="pill '+(m.missing?'amber':'slate')+'">'+m.missing+'</span></td><td class="num"><span class="pill '+tone+'">'+rate+'</span></td>'
      +'<td><span class="pill '+tone+'">'+(status==='not due'?'Not due':status==='overdue'?'Follow-up':'Closed')+'</span></td></tr>';
  }).join('');
  return UI.card({title:'Month-by-month compliance',sub:'Reporting month is taken from the form; the due date is the 4th of the following month.',icon:'calendar-days',
    body:'<div class="dt-scroll hiv-table-scroll"><table class="dt"><thead><tr><th>Reporting month</th><th>Deadline</th><th class="num">Expected</th><th class="num">Received</th><th class="num">On time</th><th class="num">Late 1–2 days¹</th><th class="num">Late >2 days</th><th class="num">Missing</th><th class="num">On-time rate</th><th>Status</th></tr></thead><tbody>'
      +(rows||'<tr><td colspan="10">No periods in this range.</td></tr>')+'</tbody></table></div>'
    +'<div class="hiv-table-note">¹ Both late categories remain late; the stated two-day tolerance does not change the on-time classification. On-time rate = reports received by the 4th divided by due health-centre reports. Future/not-yet-due periods are excluded.</div>'});
}
function centerTable(model){
  const rows=model.centers.map((c,i)=>{
    const rate=c.rate==null?'—':rateText(c.rate);
    const repeated=c.noncompliant>=3&&c.due>0;
    const pattern=repeated?'<span class="pill rose">Repeat follow-up</span>':c.due===0?'<span class="pill slate">No due period</span>':'<span class="pill teal">Within range</span>';
    return '<tr><td class="mono xs faint">'+(i+1)+'</td><td><b>'+escape(c.facility)+'</b></td><td class="num">'+c.due+'</td><td class="num"><span class="pill teal">'+c.onTime+'</span></td>'
      +'<td class="num"><span class="pill '+(c.lateWithinTolerance?'amber':'slate')+'">'+c.lateWithinTolerance+'</span></td><td class="num"><span class="pill '+(c.lateMoreThanTolerance?'rose':'slate')+'">'+c.lateMoreThanTolerance+'</span></td>'
      +'<td class="num"><span class="pill '+(c.missing?'amber':'slate')+'">'+c.missing+'</span></td><td class="num"><b>'+rate+'</b></td><td class="num">'+(c.duplicates?'<span class="pill amber">'+c.duplicates+'</span>':'—')+'</td><td class="num">'+(c.avgLate==null?'—':oneDecimal(c.avgLate)+' d')+'</td><td>'+pattern+'</td></tr>';
  }).join('');
  return UI.card({title:'Health-centre performance',sub:'Ranked by all late and overdue cycles. “Repeat follow-up” means 3 or more late/overdue cycles in the selected window.',icon:'building-2',
    body:'<div class="dt-scroll hiv-table-scroll"><table class="dt"><thead><tr><th>#</th><th>Health centre</th><th class="num">Due cycles</th><th class="num">On time</th><th class="num">Late 1–2 days¹</th><th class="num">Late >2 days</th><th class="num">Missing</th><th class="num">On-time rate</th><th class="num">Duplicate entries</th><th class="num">Mean late days²</th><th>Pattern</th></tr></thead><tbody>'
      +(rows||'<tr><td colspan="11">No health-centre data.</td></tr>')+'</tbody></table></div>'
    +'<div class="hiv-table-note">¹ Both late categories remain late; the two-day tolerance does not change the on-time classification. ² Mean delay is calculated from late submissions received only. Missing reports are shown separately; delay is measured in calendar days after the 4th.</div>'});
}
function lateTable(model){
  const rows=model.lateCells.slice().sort((a,b)=>b.lateDays-a.lateDays||a.period.localeCompare(b.period)||a.facility.localeCompare(b.facility));
  const body=rows.map(x=>'<tr><td>'+escape(x.facility)+'</td><td>'+escape(monthLabel(x.period))+'</td><td>'+formatDate(x.chosen&&x.chosen.submittedOn)+'</td>'
    +'<td><span class="pill '+(x.lateDays<=2?'amber':'rose')+'">Late · '+(x.lateDays<=2?'within two-day tolerance':'more than two days')+'</span></td>'
    +'<td class="num"><span class="pill rose">'+x.lateDays+' day'+(x.lateDays===1?'':'s')+'</span></td><td class="num">'+(x.submissions>1?'<span class="pill amber">'+x.submissions+' entries</span>':'—')+'</td></tr>').join('');
  return UI.card({title:'Late submissions',sub:rows.length+' late report'+(rows.length===1?'':'s')+' received within the selected window; both severity bands remain late.',icon:'clock',
    body:rows.length?'<div class="dt-scroll hiv-table-scroll"><table class="dt"><thead><tr><th>Health centre</th><th>Reporting month</th><th>Completed</th><th>Classification</th><th class="num">Days late</th><th class="num">Duplicate entries</th></tr></thead><tbody>'+body+'</tbody></table></div>':'<div class="hiv-empty-inline">No late submission in the selected months.</div>'});
}
function missingTable(model){
  const rows=model.missingCells.slice().sort((a,b)=>b.overdueDays-a.overdueDays||a.period.localeCompare(b.period)||a.facility.localeCompare(b.facility));
  return UI.card({title:'Outstanding reports',sub:'Due before the 5th but not present in the imported records as of '+formatDate(model.asOf)+'.',icon:'triangle-alert',
    body:rows.length?'<div class="dt-scroll hiv-table-scroll"><table class="dt"><thead><tr><th>Health centre</th><th>Reporting month</th><th>Deadline</th><th class="num">Overdue by</th></tr></thead><tbody>'
      +rows.map(x=>'<tr><td><b>'+escape(x.facility)+'</b></td><td>'+escape(monthLabel(x.period))+'</td><td>'+formatDate(x.dueDate)+'</td><td class="num"><span class="pill amber">'+x.overdueDays+' day'+(x.overdueDays===1?'':'s')+'</span></td></tr>').join('')+'</tbody></table></div>'
      :'<div class="hiv-empty-inline">No overdue reports are missing in this window.</div>'});
}
function chart(model){
  if(!model.months.length) return '<div class="hiv-empty-inline">Import reporting data to see the monthly pattern.</div>';
  return '<div class="hiv-chart">'+model.months.map(m=>{
    const denominator=m.due||m.notDue||model.facilities.length||1;
    const on=m.due?m.onTime/denominator*100:0,lateWithin=m.due?m.lateWithinTolerance/denominator*100:0;
    const lateMore=m.due?m.lateMoreThanTolerance/denominator*100:0,missing=m.due?m.missing/denominator*100:0;
    const top=m.due?rateText(m.rate):'Open';
    const title=m.label+' · on time '+m.onTime+', late 1–2 days '+m.lateWithinTolerance+', late >2 days '+m.lateMoreThanTolerance+', missing '+m.missing;
    return '<div class="hiv-chart-col"><div class="hiv-chart-rate">'+top+'</div><div class="hiv-bar" title="'+escape(title)+'">'
      +(m.due?'<i class="on" style="height:'+on+'%"></i><i class="late-within" style="height:'+lateWithin+'%"></i><i class="late-more" style="height:'+lateMore+'%"></i><i class="missing" style="height:'+missing+'%"></i>':'<i class="future"></i>')
      +'</div><div class="hiv-chart-label">'+escape(m.label.replace(/ \d{4}$/,''))+'</div><div class="hiv-chart-due">'+(m.due?m.received+'/'+m.due+' received':'Not due')+'</div></div>';
  }).join('')+'</div><div class="hiv-chart-legend"><span><i class="on"></i>On time</span><span><i class="late-within"></i>Late 1–2 days (within tolerance, still late)</span><span><i class="late-more"></i>Late >2 days</span><span><i class="missing"></i>Missing after deadline</span><span><i class="future"></i>Not due</span></div>';
}
function analysisCard(model){
  const avg=model.avgLate==null?'—':oneDecimal(model.avgLate)+' days';
  const bullets=model.repeated.length?model.repeated.slice(0,4).map(c=>'<li><b>'+escape(c.facility)+'</b>: '+c.noncompliant+' late/overdue of '+c.due+' due cycles ('+rateText(c.rate)+' on time); '+c.lateWithinTolerance+' late by 1–2 days and '+c.lateMoreThanTolerance+' late by >2 days.</li>').join(''):'<li>No centre reached the repeated-follow-up threshold in this window.</li>';
  return UI.card({title:'Management read-out',sub:'A concise, evidence-led interpretation of the selected window.',icon:'scan-line',
    body:'<div class="hiv-readout"><div><div class="eyebrow">What the data says</div><p><b>'+model.onTime+' of '+model.due+'</b> due health-centre reporting obligations were on time ('+rateText(model.rate)+'). '
      +model.late+' reports were received late: '+model.lateWithinTolerance+' by 1–2 days (within the two-day tolerance) and '+model.lateMoreThanTolerance+' by more than two days. <b>Both categories remain late</b>. '
      +model.missing+' due report'+(model.missing===1?' is':'s are')+' still outstanding as of '+formatDate(model.asOf)+'. '
      +(model.avgLate==null?'':('The mean delay among late reports received was <b>'+avg+'</b>.'))+'</p><ul>'+bullets+'</ul></div>'
      +'<div class="hiv-readout-side"><span class="eyebrow">Window</span><b>'+escape(currentRangeLabel(model))+'</b><span class="eyebrow">Scope</span><b>'+model.facilities.length+' health centres</b><span class="eyebrow">Deadline</span><b>Before the 5th</b></div></div>'});
}
function emptyState(data){
  return '<div class="grid-12"><div class="c12"><div class="card hiv-empty"><div class="hiv-empty-icon">'+UI.ic('calendar-check',26)+'</div><h2>Start with the HIV reporting workbook</h2>'
    +'<p>Import the workbook or export its worksheet as CSV/TSV each month as reports are gathered. New rows are merged into the saved history; importing the same full-history export again will not duplicate matching submissions. The importer keeps only <b>Health Facility Name</b>, <b>Reporting Month</b> and <b>Completion time</b> for configured health centres.</p>'
    +'<div class="hiv-empty-actions"><button class="btn primary" data-hiv-import>'+UI.ic('upload',14)+'Choose workbook</button><button class="btn" data-hiv-restore>'+UI.ic('folder-open',14)+'Restore JSON backup</button><span class="xs faint">.xlsx · .csv · .tsv</span></div>'
    +'<div class="hiv-empty-foot">Ruli District Hospital is not counted as a health centre. The monthly cut-off is the 4th of the following month; a completion on the 5th is late.</div></div></div></div>';
}
function currentSummaryRows(model){
  const out=[['Health centre','Reporting month','Deadline','Status','Completion date','Days late','Submissions']];
  model.matrix.forEach(x=>out.push([x.facility,monthLabel(x.period),x.dueDate,cellStatusLabel(x),x.chosen?x.chosen.submittedOn:'',x.state==='late'?x.lateDays:x.state==='missing'?x.overdueDays:'',x.submissions||0]));
  return out;
}
function exportSummary(model){
  U.exportCSV('hiv-reporting-timeliness-'+model.asOf+'.csv',currentSummaryRows(model),{title:'HIV monthly reporting timeliness · '+currentRangeLabel(model),actor:LS.auth.user&&LS.auth.user.name});
}
function selectedModel(){
  const data=loadData(),asOf=view.asOf||todayISO();
  const raw=buildModel(data,asOf,expectedFacilities(),view.from,view.to);
  return {data,model:raw};
}
function letterTable(model){
  return '<table><thead><tr><th>Health centre</th><th>Due cycles</th><th>On time</th><th>Late 1–2 days¹</th><th>Late >2 days</th><th>Outstanding</th><th>On-time rate</th></tr></thead><tbody>'
    +model.centers.map(c=>'<tr><td>'+escape(c.facility)+'</td><td>'+c.due+'</td><td>'+c.onTime+'</td><td>'+c.lateWithinTolerance+'</td><td>'+c.lateMoreThanTolerance+'</td><td>'+c.missing+'</td><td>'+(c.rate==null?'—':rateText(c.rate))+'</td></tr>').join('')+'</tbody></table>'
    +'<p class="doc-note">¹ Reports completed 1–2 days after the deadline are still classified as late; the two-day tolerance is not an extension of the deadline.</p>';
}
function repeatedFindings(model){
  return model.repeated.map(c=>'<li><b>'+escape(c.facility)+'</b> — '+c.late+' late report'+(c.late===1?'':'s')+' ('+c.lateWithinTolerance+' by 1–2 days within tolerance; '+c.lateMoreThanTolerance+' by more than 2 days), '+c.missing+' outstanding, '+c.onTime+'/'+c.due+' on time.</li>').join('');
}
function letterBodyToDG(model){
  const lateAverage=model.avgLate==null?'—':oneDecimal(model.avgLate)+' calendar days';
  const range=currentRangeLabel(model);
  return '<div class="doc-meta"><span>Date: '+formatDateLong(model.asOf)+'</span><span>Our Ref: [Insert reference]</span></div>'
    +'<p><b>To:</b> The Director General<br><b>[Institution / Office]</b></p>'
    +'<p><b>Subject: Repeated late submission of monthly HIV testing reports by health centres ('+escape(range)+')</b></p>'
    +'<p>Dear Director General,</p>'
    +'<p>I respectfully submit this review of monthly HIV testing report submissions by the eight health centres in Gakenke District. Reporting months are taken from the form; the completion timestamp is the submission date. In accordance with the instruction that reports be submitted <b>before the 5th</b>, a report completed on or after the 5th of the following month is classified as late.</p>'
    +'<p>Across <b>'+model.due+' due centre-month obligations</b> in '+escape(range)+', '+model.onTime+' ('+rateText(model.rate)+') were on time, '+model.late+' were received late, and '+model.missing+' remained outstanding as of '+formatDate(model.asOf)+'. Of the late reports, '+model.lateWithinTolerance+' were completed 1–2 days late (within the stated two-day tolerance) and '+model.lateMoreThanTolerance+' were more than two days late. <b>All '+model.late+' are classified as late</b>; the tolerance does not change the deadline or on-time rate. Among the '+model.received+' reports received, '+rateText(model.lateRate)+' were late. The mean delay among late reports received was '+lateAverage+'.</p>'
    +(model.repeated.length?'<p>The most persistent pattern is:</p><ul>'+repeatedFindings(model)+'</ul>':'')
    +(model.missing?'<p>Reports still outstanding at the review date: '+model.missingCells.map(x=>escape(x.facility)+' ('+escape(monthLabel(x.period))+')').join('; ')+'.</p>':'')
    +(notDueSentence(model)?'<p>'+escape(notDueSentence(model))+' No future obligation is counted as a breach.</p>':'')
    +'<p>I recommend that your office issue a written direction to all health-centre managers restating the deadline, requiring immediate completion of outstanding reports, and directing that recurring late submissions be documented and escalated through the applicable administrative process. I also recommend a monthly follow-up register and advance reminder before each deadline.</p>'
    +'<p>Please advise whether the proposed directive may be issued.</p><p>Respectfully,</p>'
    +'<p style="margin-top:28px"><b>[Name of Laboratory Manager]</b><br>Laboratory Manager<br>Ruli District Hospital</p>'
    +'<p><b>Annex: Health-centre performance summary</b></p>'+letterTable(model)
    +'<p class="doc-note">Prepared from the imported HIV Testing Monthly Reporting workbook. Verify that the import is complete and reconcile subsequent submissions before signing or issuing follow-up. This analysis assesses timeliness only; it does not assess report accuracy or clinical quality.</p>';
}
function letterBodyDGNotice(model){
  const high=model.repeated.length?model.repeated.map(c=>'<tr><td>'+escape(c.facility)+'</td><td>'+c.lateWithinTolerance+'</td><td>'+c.lateMoreThanTolerance+'</td><td>'+c.missing+'</td><td>'+c.onTime+'/'+c.due+'</td></tr>').join(''):'';
  const missingText=model.missingCells.length?model.missingCells.map(x=>escape(x.facility)+' — '+escape(monthLabel(x.period))).join('; '):'None recorded in the selected window.';
  return '<div class="dg-heading"><b>[INSTITUTION NAME]</b><br><span>OFFICE OF THE DIRECTOR GENERAL</span></div>'
    +'<div class="doc-meta"><span>Date: '+formatDateLong(model.asOf)+'</span><span>Ref: [Insert reference]</span></div>'
    +'<p><b>To:</b> Managers of Health Centres, Gakenke District<br><b>Cc:</b> District Health Manager; District Laboratory Focal Person</p>'
    +'<p><b>Subject: Mandatory timely submission of monthly HIV testing reports</b></p>'
    +'<p>Dear Health-Centre Managers,</p>'
    +'<p>Management has reviewed the monthly HIV testing report submissions for '+escape(currentRangeLabel(model))+'. The review found '+model.onTime+' of '+model.due+' due centre-month reports submitted on time, '+model.late+' received late ('+model.lateWithinTolerance+' by 1–2 days within the stated two-day tolerance and '+model.lateMoreThanTolerance+' by more than two days), and '+model.missing+' still outstanding as of '+formatDate(model.asOf)+'. <b>Every report received after the deadline remains classified as late</b>; the tolerance does not convert a late submission into an on-time one. Timely reporting is necessary for reliable district oversight, commodity planning and continuity of HIV testing services.</p>'
    +'<p>Accordingly, each health centre must complete and submit its HIV testing report <b>before the 5th calendar day of the following month</b> (that is, no later than the 4th). A report completed on or after the 5th will be recorded as late. Lateness will no longer be treated as routine or acceptable. Repeated non-compliance will be documented and referred for administrative follow-up in accordance with applicable procedures.</p>'
    +'<p>As of '+formatDate(model.asOf)+', the following due report(s) were not present in the reviewed records: <b>'+missingText+'</b>. The responsible centres must submit them immediately and advise the District Laboratory Focal Person of any barrier that prevented timely submission.</p>'
    +(high?'<p>Facilities with three or more late or overdue cycles in the reviewed window are listed below for focused follow-up:</p><table><thead><tr><th>Health centre</th><th>Late 1–2 days¹</th><th>Late >2 days</th><th>Outstanding</th><th>On time / due</th></tr></thead><tbody>'+high+'</tbody></table><p class="doc-note">¹ Reports within the two-day tolerance remain late and are not treated as on time.</p>':'')
    +'<p>If a technical or connectivity problem threatens the deadline, the centre manager must notify the District Laboratory Focal Person <b>before the deadline</b> and use the approved alternative submission channel. An explanation after the due date does not automatically change the recorded submission date.</p>'
    +'<p>Managers are responsible for ensuring that a designated HIV reporting focal person is available, that the submission is checked before transmission, and that confirmation of receipt is retained. Please acknowledge receipt of this directive and ensure it is communicated to the relevant staff.</p>'
    +'<p>Yours faithfully,</p><p style="margin-top:28px"><b>[Name of Director General]</b><br>Director General<br>[Institution]</p>'
    +(notDueSentence(model)?'<p class="doc-note">'+escape(notDueSentence(model))+'</p>':'')
    +'<p class="doc-note">Draft for verification: confirm the imported response list is complete and check whether any reports were submitted after the stated cut-off before issuing individual follow-up.</p>';
}
function printPlainLetter(title,body){
  const css='@page{size:A4 portrait;margin:20mm}body{font-family:Arial,sans-serif;color:#111;font-size:11pt;line-height:1.5}h1{font-size:14pt;text-align:center;color:#132646;margin-bottom:22px}.dg-heading{text-align:center;font-size:14pt;line-height:1.45;border-bottom:2px solid #142847;padding-bottom:10px;margin-bottom:20px}.dg-heading span{font-size:10pt;letter-spacing:.09em}.doc-meta{display:flex;justify-content:space-between;font-size:9pt;margin:14px 0}.doc-note{font-size:9pt;color:#555;border-top:1px solid #ddd;padding-top:8px;margin-top:18px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #bbb;padding:5px 7px;text-align:left;font-size:9pt}th{background:#f1efe8}.sig{margin-top:34px}p{margin:0 0 11px}ul{margin-top:4px}';
  U.print('<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+escape(title)+'</title><style>'+css+'</style></head><body><h1>'+escape(title)+'</h1>'+body+'</body></html>');
}
function wire(){
  const r=rootEl; if(!r) return;
  r.querySelectorAll('[data-hiv-import]').forEach(b=>b.onclick=()=>{
    const input=document.createElement('input'); input.type='file'; input.accept='.xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values';
    input.onchange=async()=>{
      const file=input.files&&input.files[0]; if(!file) return;
      try{
        const parsed=await parseFile(file,expectedFacilities());
        const current=loadData(),merged=mergeRows(current.rows,parsed.records);
        const detail=parsed.validRows+' health-centre report row'+(parsed.validRows===1?'':'s')+' found; '+merged.added+' new row(s) will be added and '+merged.alreadyPresent+' already-saved matching row(s) will not be duplicated.'
          +(parsed.outside.length?' '+parsed.outside.length+' out-of-scope row(s), including hospital/non-catalogue facilities, will be excluded.':'')
          +(parsed.invalid.length?' '+parsed.invalid.length+' incomplete/unreadable row(s) will be skipped.':'')
          +' Earlier months already saved in this browser are preserved. Separate submissions for the same centre and month at different times are retained.';
        const ok=await UI.confirm({title:'Add monthly HIV reporting data?',body:escape(detail),confirm:'Import and merge'});
        if(!ok) return;
        const data={version:1,rows:merged.rows,importedAt:U.nowISO(),fileName:file.name,
          importMeta:{valid:parsed.validRows,invalid:parsed.invalid.length,outside:parsed.outside.length,added:merged.added,alreadyPresent:merged.alreadyPresent,total:merged.rows.length}};
        if(!saveData(data)) throw new Error('This browser could not save the imported data. Export or free local storage, then try again.');
        view={asOf:todayISO(),from:null,to:null};
        paint();
        UI.toast(merged.added?'Added '+merged.added+' new HIV report row'+(merged.added===1?'':'s')+' · '+merged.alreadyPresent+' matching row(s) already saved':'No new rows; existing monthly history is unchanged',{type:'ok',duration:6000});
      }catch(e){ UI.toast(e.message||'Could not read that file',{type:'err',duration:7000}); }
    };
    input.click();
  });
  r.querySelectorAll('[data-hiv-restore]').forEach(b=>b.onclick=()=>{
    const input=document.createElement('input'); input.type='file'; input.accept='.json,application/json';
    input.onchange=async()=>{
      const file=input.files&&input.files[0]; if(!file) return;
      try{
        const backup=JSON.parse(await file.text());
        if(!backup||!Array.isArray(backup.rows)) throw new Error('That file is not an HIV reporting backup.');
        const facilities=expectedFacilities();
        const rows=backup.rows.map(x=>{
          if(!x||!/^\d{4}-\d{2}$/.test(String(x.period||''))||+String(x.period).slice(5,7)<1||+String(x.period).slice(5,7)>12) return null;
          const stamp=parseTimestamp(x.completedAt||x.submittedOn);
          if(!stamp) return null;
          const facility=canonicalFacility(x.facility,facilities);
          if(!facilities.some(f=>normFacility(f)===normFacility(facility))) return null;
          return {facility,period:String(x.period),submittedOn:stamp.date,completedAt:stamp.date+'T'+stamp.time};
        }).filter(Boolean);
        if(!rows.length) throw new Error('The backup contains no valid health-centre reporting rows.');
        const ok=await UI.confirm({title:'Restore local HIV reporting backup?',body:escape(rows.length+' health-centre report row(s) will replace the current local dataset. The backup is not uploaded.'),confirm:'Restore and replace'});
        if(!ok) return;
        const restored={version:1,rows,importedAt:backup.importedAt||U.nowISO(),fileName:backup.fileName||file.name,importMeta:backup.importMeta||{valid:rows.length,invalid:0,outside:0}};
        if(!saveData(restored)) throw new Error('This browser could not save the backup.');
        view={asOf:todayISO(),from:null,to:null}; paint();
        UI.toast('HIV reporting backup restored on this device',{type:'ok'});
      }catch(e){ UI.toast(e.message||'Could not read that JSON backup',{type:'err',duration:7000}); }
    };
    input.click();
  });
  const asof=r.querySelector('[data-hiv-asof]'); if(asof) asof.onchange=()=>{ view.asOf=asof.value||todayISO(); paint(); };
  const from=r.querySelector('[data-hiv-from]'); if(from) from.onchange=()=>{ view.from=from.value; if(view.to&&view.to<view.from) view.to=view.from; paint(); };
  const to=r.querySelector('[data-hiv-to]'); if(to) to.onchange=()=>{ view.to=to.value; if(view.from&&view.from>view.to) view.from=view.to; paint(); };
  const summary=r.querySelector('[data-hiv-summary]'); if(summary) summary.onclick=()=>{ const {model}=selectedModel(); exportSummary(model); };
  const backup=r.querySelector('[data-hiv-backup]'); if(backup) backup.onclick=()=>{
    const data=loadData(); U.download('hiv-reporting-local-backup-'+todayISO()+'.json',JSON.stringify(data,null,2),'application/json');
    UI.toast('Local reporting backup downloaded',{type:'ok'});
  };
  const dg=r.querySelector('[data-hiv-letter-dg]'); if(dg) dg.onclick=()=>{
    const {model}=selectedModel();
    U.printDoc('HIV reporting timeliness — letter to the Director General',letterBodyToDG(model),{signatures:false,meta:'<span>Confidential draft · '+escape(currentRangeLabel(model))+'</span><span>Cut-off: before the 5th</span>'});
  };
  const hc=r.querySelector('[data-hiv-letter-hc]'); if(hc) hc.onclick=()=>{
    const {model}=selectedModel(); printPlainLetter('Draft directive from the Director General',letterBodyDGNotice(model));
  };
  const clear=r.querySelector('[data-hiv-clear]'); if(clear) clear.onclick=async()=>{
    const ok=await UI.confirm({title:'Clear local HIV reporting data?',body:'This removes only the separate HIV reporting dataset from this browser. It does not change the laboratory register or Supabase copy.',confirm:'Clear data',danger:true});
    if(!ok) return; try{ localStorage.removeItem(STORE_KEY); }catch(e){}
    view={asOf:todayISO(),from:null,to:null}; paint(); UI.toast('Local HIV reporting data cleared',{type:'ok'});
  };
}
function paint(){
  if(!rootEl) return;
  const data=loadData();
  const asOf=view.asOf||todayISO();
  const all=buildModel(data,asOf,expectedFacilities(),null,null);
  if(all.allPeriods.length){
    if(!view.from||!all.allPeriods.includes(view.from)) view.from=all.allPeriods[0];
    if(!view.to||!all.allPeriods.includes(view.to)) view.to=all.allPeriods[all.allPeriods.length-1];
    if(view.from>view.to) view.from=view.to;
  }
  const model=buildModel(data,asOf,expectedFacilities(),view.from,view.to);
  const versionButtons=data.rows.length?'<button class="btn xs" data-hiv-backup>'+UI.ic('download',12)+'Backup local data</button><button class="btn xs danger" data-hiv-clear>'+UI.ic('trash-2',12)+'Clear local data</button>':'';
  rootEl.innerHTML='<div class="page-head"><div><h1>Monthly Reports</h1><div class="sub">HIV reporting · add each month’s submissions as they arrive; saved history is preserved.</div></div><div class="actions">'+versionButtons+'</div></div>'
    +hero(model,data)
    +(data.rows.length?rangeControls(model)+stats(model)+'<div class="grid-12 hiv-grid">'
      +'<div class="c12">'+UI.card({title:'Timeliness trend',sub:'Each bar totals due health-centre reports for that reporting month.',icon:'chart-line',body:chart(model)})+'</div>'
      +'<div class="c12">'+analysisCard(model)+'</div>'
      +'<div class="c12">'+monthTable(model)+'</div>'
      +'<div class="c12">'+centerTable(model)+'</div>'
      +'<div class="c6">'+lateTable(model)+'</div><div class="c6">'+missingTable(model)+'</div></div>'
      +'<div class="hiv-footnote">The first (earliest) completion timestamp is used when a centre has duplicate entries for the same reporting month; duplicate count remains visible. The app stores imported rows on this browser only and does not sync this indicator with the shared register.</div>'
      :emptyState(data));
  wire();
}
M.render=function(root,params){
  rootEl=root;
  view.asOf=(params&&params.asof)||view.asOf||todayISO();
  paint();
};
M.analyse=buildModel;
M.parseImportGrid=recordsFromGrid;
M._test={dateOrdinal,reportMonthInfo,parseTimestamp,headerIndexes,parseDelimited,deadlineFor,buildModel,groupRows,cellStatusLabel,mergeRows};
})();
