/* Public, reduced timeliness feed. Deploy from this directory, not the static site.
   The workbook URL is a runtime Worker secret, never code or a build variable. */
import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
const parse=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',parseTagValue:false,processEntities:false});
const arr=x=>x==null?[]:Array.isArray(x)?x:[x];
const centres=['Coko HC','Minazi HC','Muhondo HC','Muyongwe HC','Nyange HC','Ruli HC','Rushashi HC','Rwankuba HC'];
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
function guardZip(bytes){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) if(dv.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0) throw Error('Invalid workbook');
 let n=dv.getUint16(end+10,true),p=dv.getUint32(end+16,true),total=0;
 if(n>300)throw Error('Workbook too large');
 for(let i=0;i<n;i++){
  if(p+46>bytes.length||dv.getUint32(p,true)!==0x02014b50)throw Error('Invalid workbook');
  const uncompressed=dv.getUint32(p+24,true);total+=uncompressed;if(total>8*1024*1024)throw Error('Workbook too large');
  p+=46+dv.getUint16(p+28,true)+dv.getUint16(p+30,true)+dv.getUint16(p+32,true);
 }
}
function text(x){if(x==null)return '';if(typeof x==='string'||typeof x==='number')return String(x);if(x['#text']!=null)return String(x['#text']);if(x.t!=null)return text(x.t);return arr(x.r).map(v=>text(v.t)).join('');}
function excelDate(n){
 const num=Number(n);if(!Number.isFinite(num)||num<30000||num>100000)return null;
 const d=new Date(Date.UTC(1899,11,30)+Math.round(num*86400000));
 return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,19);
}
export function readTimeliness(bytes){
 guardZip(bytes);const zip=unzipSync(bytes), get=n=>{if(!zip[n])throw Error('Missing workbook component');return parse.parse(strFromU8(zip[n]));};
 const wb=get('xl/workbook.xml').workbook;
 if(['1','true'].includes(String(wb.workbookPr?.['@_date1904']||'').toLowerCase()))throw Error('Unsupported workbook date system');
 const sheet=arr(wb.sheets?.sheet).find(s=>s['@_name']==='Ruli HIV Reports');if(!sheet)throw Error('Expected report sheet not found');
 const rel=arr(get('xl/_rels/workbook.xml.rels').Relationships?.Relationship).find(r=>r['@_Id']===sheet['@_r:id']);
 const target=String(rel?.['@_Target']||'').replace(/^\//,'');if(!/^(xl\/)?worksheets\/sheet\d+\.xml$/.test(target))throw Error('Invalid worksheet path');
 const strings=zip['xl/sharedStrings.xml']?arr(get('xl/sharedStrings.xml').sst?.si).map(text):[];
 const rows=arr(get(target.startsWith('xl/')?target:'xl/'+target).worksheet?.sheetData?.row);
 if(rows.length>5000)throw Error('Too many workbook rows');
 const readCell=c=>c['@_t']==='s'?strings[Number(c.v)]??'':c['@_t']==='inlineStr'?text(c.is):text(c.v);
 const values=rows.map(r=>{let out={};for(const c of arr(r.c)){let col=String(c['@_r']||'').match(/^[A-Z]+/i)?.[0];if(col)out[col]=readCell(c);}return out;});
 if(!values.length||String(values[0].C||'').toLowerCase()!=='completion time'||String(values[0].D||'').toLowerCase()!=='health facility name'||String(values[0].G||'').toLowerCase()!=='reporting month')throw Error('Workbook headings changed');
 const entries=[],unknown=[];
 for(const [i,r] of values.entries()){
  if(!i||(!r.C&&!r.D&&!r.G))continue;
  const facility=centres.find(x=>x.toLowerCase()===String(r.D||'').replace(/\s+/g,' ').trim().toLowerCase());
  if(!facility){
   const name=String(r.D||'').replace(/\s+/g,' ').trim();
   if(name.toLowerCase()==='ruli dh')continue;
   // A new or misspelled centre must not silently disappear from the report.
   if(name)throw Error('Unknown facility name in source');
   if(r.C||r.G)throw Error('A source row has no facility');
   continue;
  }
  const completed=excelDate(r.C), month=months.indexOf(String(r.G||'').trim().toLowerCase())+1;
  if(!completed||!month){unknown.push(i+1);continue;}
  const cy=Number(completed.slice(0,4)),cm=Number(completed.slice(5,7)),year=cy-(month>=cm?1:0);
  const period=year+'-'+String(month).padStart(2,'0');
  entries.push({facility,period,completed});
 }
 if(unknown.length)throw Error('Some facility entries have an invalid date or reporting month');
 // Multiple responses for one facility and period can be corrections; show earliest,
 // with an explicit duplicate count so the user knows the record needs review.
 const unique=new Map();for(const e of entries){const k=e.facility+'|'+e.period,prior=unique.get(k);if(!prior)unique.set(k,{...e,responses:1});else{prior.responses++;if(e.completed<prior.completed)prior.completed=e.completed;}}
 return [...unique.values()].sort((a,b)=>a.period.localeCompare(b.period)||a.facility.localeCompare(b.facility));
}
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','cache-control':'no-store','x-content-type-options':'nosniff'}});
export default {async fetch(request,env){
 if(request.method!=='GET')return reply({error:'Method not allowed'},405);
 try{
  if(!env.SOURCE_URL)return reply({error:'Live source is not configured'},503);
  const u=new URL(env.SOURCE_URL);if(u.protocol!=='https:'||u.hostname!=='1drv.ms')throw Error('Invalid source configuration');u.searchParams.set('download','1');
  const response=await fetch(u.toString(),{signal:AbortSignal.timeout(20000),headers:{'cache-control':'no-cache'}});
  if(!response.ok)throw Error('Source unavailable');const buffer=await response.arrayBuffer();if(buffer.byteLength>2*1024*1024)throw Error('Workbook too large');
  return reply({version:1,checkedAt:new Date().toISOString(),records:readTimeliness(new Uint8Array(buffer))});
 }catch(e){console.error('Timeliness feed error:',e.message);return reply({error:'Unable to read the live workbook. Try again later.'},503);}
}};
