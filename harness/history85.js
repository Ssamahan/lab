/* v6.9.85 — request #58: the workbook as a history.
   The district sends one spreadsheet with a sheet for every month. This suite drives
   the reader that opens that workbook on the device, the matcher that lays its rows
   onto the HMIS form, and the comparative analysis built on many months: month over
   month, year over year, and one examination followed through time. */
const {boot,ok,done}=require('./env');
const fs=require('fs'), path=require('path'), zlib=require('zlib');
const root=path.resolve(__dirname,'..');
const srcRep=fs.readFileSync(path.join(root,'assets/js/modules/report.js'),'utf8');
const srcRead=fs.readFileSync(path.join(root,'assets/js/core/xlsxread.js'),'utf8');
const srcSt=fs.readFileSync(path.join(root,'assets/js/core/store.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/modules.css'),'utf8');
const idx=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

/* ── a real .xlsx on disk, built here so the reader is tested on bytes ──── */
let CRC=null;
function crc32(buf){
  if(!CRC){ CRC=[]; for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; CRC[n]=c>>>0; } }
  let c=0xFFFFFFFF;
  for(let i=0;i<buf.length;i++) c=CRC[(c^buf[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}
function zip(files){
  const locals=[], central=[]; let off=0;
  Object.keys(files).forEach(name=>{
    const data=Buffer.from(files[name],'utf8'), comp=zlib.deflateRawSync(data);
    const nm=Buffer.from(name,'utf8'), crc=crc32(data);
    const lh=Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50,0); lh.writeUInt16LE(20,4); lh.writeUInt16LE(0,6); lh.writeUInt16LE(8,8);
    lh.writeUInt32LE(crc,14); lh.writeUInt32LE(comp.length,18); lh.writeUInt32LE(data.length,22);
    lh.writeUInt16LE(nm.length,26); lh.writeUInt16LE(0,28);
    locals.push(lh,nm,comp);
    const ch=Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50,0); ch.writeUInt16LE(20,4); ch.writeUInt16LE(20,6); ch.writeUInt16LE(0,8);
    ch.writeUInt16LE(8,10); ch.writeUInt32LE(crc,16); ch.writeUInt32LE(comp.length,20); ch.writeUInt32LE(data.length,24);
    ch.writeUInt16LE(nm.length,28); ch.writeUInt32LE(0,30); ch.writeUInt16LE(0,34); ch.writeUInt16LE(0,36);
    ch.writeUInt32LE(0,38); ch.writeUInt32LE(off,42);
    central.push(ch,nm);
    off+=30+nm.length+comp.length;
  });
  const cd=Buffer.concat(central), end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(0,4); end.writeUInt16LE(0,6);
  end.writeUInt16LE(Object.keys(files).length,8); end.writeUInt16LE(Object.keys(files).length,10);
  end.writeUInt32LE(cd.length,12); end.writeUInt32LE(off,16);
  return Buffer.concat(locals.concat([cd,end]));
}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
/* rows: [[label, n1, n2, …], …] — first cell shared string, the rest numbers */
function sheetXML(rows,strings){
  const body=rows.map((r,ri)=>{
    const cells=r.map((c,ci)=>{
      const ref=String.fromCharCode(65+ci)+(ri+1);
      if(typeof c==='number') return '<c r="'+ref+'"><v>'+c+'</v></c>';
      strings.push(c);
      return '<c r="'+ref+'" t="s"><v>'+(strings.length-1)+'</v></c>';
    }).join('');
    return '<row r="'+(ri+1)+'">'+cells+'</row>';
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+body+'</sheetData></worksheet>';
}
const OCT24=[['LABORATORY'],['Full Blood Count (FBC/NFS)',1180],['Blood Smears Plasmodium',40,80],['Amylase',12],['Creatinine',0,860],['ASAT',64]];
const SEP24=[['LABORATORY'],['Full Blood Count (FBC/NFS)',1024],['Blood Smears Plasmodium',30,70],['Amylase',18],['Creatinine',0,790],['ASAT',52]];
const OCT26=[['LABORATORY'],['Full Blood Count (FBC/NFS)',1364],['Blood Smears Plasmodium',2,86],['Amylase',41],['Creatinine',0,929],['ASAT',70]];
function workbook(){
  const strings=[];
  const s1=sheetXML(OCT24,strings), s2=sheetXML(SEP24,strings), s3=sheetXML(OCT26,strings);
  const ss='<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    strings.map(x=>'<si><t>'+esc(x)+'</t></si>').join('')+'</sst>';
  return zip({
    '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+
      '<sheet name="Oct 2024" sheetId="1" r:id="rId1"/><sheet name="Sep 2024" sheetId="2" r:id="rId2"/><sheet name="Oct 26" sheetId="3" r:id="rId3"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>',
    'xl/sharedStrings.xml':ss,
    'xl/worksheets/sheet1.xml':s1,'xl/worksheets/sheet2.xml':s2,'xl/worksheets/sheet3.xml':s3
  });
}
const fileLike=buf=>({name:'HMIS workbook.xlsx',size:buf.length,
  arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength)});

(async()=>{
  const buf=workbook();
  const {w,go,errors}=await boot('#/reports',{seed(win){
    /* jsdom has no inflater of its own; the browser does, and Node's is the same API */
    win.DecompressionStream=DecompressionStream; win.Blob=Blob; win.Response=Response; win.TextDecoder=TextDecoder;
  }});
  const d=w.document, S=w.LS.store, U=w.LSU;
  const tick=n=>new Promise(r=>setTimeout(r,n||200));
  const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const page=d.querySelector('#app');
  ok(!errors.length,'the console boots without console errors',errors.join(' | '));
  ok(typeof w.LSXLSX==='object'&&typeof w.LSXLSX.readWorkbook==='function','the workbook reader is loaded');
  ok(idx.indexOf('core/xlsxread.js')>0,'and it is on the page in index.html');
  ok(sw.indexOf("'./assets/js/core/xlsxread.js'")>0,'and precached by the service worker');

  /* ── 1 · the workbook, read from its own bytes ─────────────────────── */
  const sheets=await w.LSXLSX.readWorkbook(fileLike(buf));
  ok(sheets.length===3,'every sheet in the workbook is read, not just the first ('+sheets.length+')');
  ok(sheets.map(s=>s.name).join('|')==='Oct 2024|Sep 2024|Oct 26','in the workbook\u2019s own order',sheets.map(s=>s.name).join('|'));
  const o24=sheets[0].rows;
  ok(o24.length===6&&o24[0][0]==='LABORATORY','the rows arrive as they sit on the sheet');
  ok(o24[1][0]==='Full Blood Count (FBC/NFS)'&&o24[1][1]===1180,'a shared string and a number are both resolved',JSON.stringify(o24[1]));
  ok(o24[2][1]===40&&o24[2][2]===80,'two figures on the same row keep their columns');
  ok(sheets[2].rows[2][1]===2&&sheets[2].rows[2][2]===86,'the October 2026 sheet reads back exactly as the district sent it');

  /* ── 2 · a sheet name is a month ───────────────────────────────────── */
  const R=w.LS.modules.reports.__read;
  const mf=R.monthFromName;
  ok(mf('Oct 2024')==='2024-10','“Oct 2024” is October 2024',mf('Oct 2024'));
  ok(mf('Oct 26')==='2026-10','“Oct 26” is October 2026 — the year is two digits, as the district writes it',mf('Oct 26'));
  ok(mf('September 2024')==='2024-09','a month spelled out is read',mf('September 2024'));
  ok(mf('Sept 25')==='2025-09','and spelled short',mf('Sept 25'));
  ok(mf('Sep-25')==='2025-09','with a dash between',mf('Sep-25'));
  ok(mf('2024-11')==='2024-11','a written month passes through');
  ok(mf('Sheet1')==='','a name that says no month is not guessed at',JSON.stringify(mf('Sheet1')));
  ok(mf('Summary')==='','nor is a summary sheet');

  /* ── 3 · the rows laid onto the form ───────────────────────────────── */
  const m=R.matchSheet(o24);
  ok(m.matched===5,'every examination on the pasted sheet finds its line ('+m.matched+' of 5)');
  ok(m.unmatched.length===0,'nothing in that sheet is left unplaced',JSON.stringify(m.unmatched));
  ok(m.detail.every(x=>x.label!=='LABORATORY'),'the section heading is ignored rather than read as a test');
  const fbc=S.reportLines().find(l=>/full blood count/i.test(l.label));
  const mal=S.reportLines().find(l=>/blood smears plasmodium/i.test(l.label)&&l.mode==='pn2');
  const amp=S.reportLines().find(l=>/^amylase/i.test(l.label));
  const crea=S.reportLines().find(l=>/^creatinine/i.test(l.label));
  ok(m.values[fbc.id].total===1180,'the full blood count keeps its figure',JSON.stringify(m.values[fbc.id]));
  ok(m.values[mal.id].pos===40&&m.values[mal.id].neg===80,'positives and negatives land in their own fields');
  ok(m.values[amp.id].total===12,'a single figure on a quantitative line is the total');
  ok(m.values[crea.id].total===860,'and where the sheet leads with a zero, the total is the figure to its right — 860, not 0');
  ok(m.detail.length===5&&m.detail.every(x=>x.label),'the preview can name every figure it will record');
  ok(R.figureText(m.values[mal.id],'pn')==='pos 40 · neg 80','the preview reads the way it will be stored',R.figureText(m.values[mal.id],'pn'));

  /* a row that matches nothing is never invented */
  const junk=R.matchSheet([['Not an examination we run',5,6]]);
  ok(junk.matched===0&&Object.keys(junk.values).length===0,'a row that matches nothing records nothing');
  ok(R.parsePasted('Full Blood Count\t1180\n').matched===1,'a sheet can also be pasted from Excel — the shorter name the district writes still finds the line');

  /* ── 3b · the district's own layout: numbered labels, blocks side by side ── */
  const at=pairs=>{ const r=[]; pairs.forEach(p2=>{ r[p2[0]]=p2[1]; }); return r; };
  const real=[
    at([[0,'A) Report Identification'],[4,'5. Year'],[5,'2026/2027']]),
    at([[0,'1. Service Name'],[1,'Laboratory'],[4,'6. Month'],[5,'October'],[9,'1. Blood Smears Plasmodium'],[15,2],[16,86],[17,51],[18,37],[24,'4.1 Sugar'],[27,11],[28,24]]),
    at([[9,'1.1 Blood Smears Plasmodium Falciparum'],[15,2],[17,0],[18,2]]),
    at([[9,'2. Rapid Diagnostic Tests for Malaria'],[15,'NA']]),
    at([[9,'3. Stool Samples Total'],[15,268]]),
    at([[9,'of which']]),
    at([[9,'3.1 Ascaris'],[15,0],[16,0],[17,0]]),
    at([[9,'5.1 Vaginal Swab']]),
    at([[9,'5.1.a Fresh'],[15,8],[16,59]]),
    at([[9,'5.1.b Gram'],[15,8],[16,59]]),
    at([[9,'5.1.c of which Gram - Diplo'],[15,0]]),
    at([[9,'5.2 Urethral Swab']]),
    at([[9,'5.1.a Fresh'],[15,0],[16,0]]),
    at([[9,'5.3 Urine']]),
    at([[9,'5.1.a Fresh'],[15,6],[16,529]]),
    at([[9,'5.1.b Gram'],[15,6],[16,529]]),
    at([[9,'6.4 Full Blood Count'],[16,1364],[19,'B+'],[20,2],[21,25],[22,25],[23,24],[24,0],[25,0],[26,3]]),
    at([[9,'6.8 Amylase'],[16,41]]),
    at([[33,'Urea'],[36,0],[37,929],[38,929]]),
    at([[0,'2. Catchment Area Population'],[1,'115,897']])
  ];
  const rm=R.matchSheet(real);
  ok(rm.matched>=8,'a sheet whose labels carry the form\u2019s numbering is read ('+rm.matched+' lines)');
  ok(rm.values.m1&&rm.values.m1.pos===2&&rm.values.m1.neg===86&&rm.values.m1.a0===51&&rm.values.m1.a1===37,
     '“1. Blood Smears Plasmodium” finds line 1 with its positives, negatives and age split',JSON.stringify(rm.values.m1));
  ok(rm.values.m11&&rm.values.m11.pos===2,'and its falciparum breakdown finds 1.1');
  ok(rm.values.s1&&rm.values.s1.total===268,'“3. Stool Samples Total” is the 268 samples');
  ok(rm.values.u41&&rm.values.u41.pos===11&&rm.values.u41.neg===24,'“4.1 Sugar” lands on the urine sugar row');
  ok(rm.values.x64&&rm.values.x64.total===1364,
     'the full blood count takes 1,364 and not the blood-bank column further along the same row',JSON.stringify(rm.values.x64));
  ok(rm.values.x68&&rm.values.x68.total===41,'amylase is 41');
  ok(rm.values.b51a&&rm.values.b51a.pos===8&&rm.values.b51a.neg===59,'the vaginal swab keeps 8 of 59');
  ok(rm.values.b53a&&rm.values.b53a.pos===6&&rm.values.b53a.neg===529,
     'and the urine block\u2019s copy of “5.1.a Fresh” is read against its own heading — 6 of 529, not dropped',JSON.stringify(rm.values.b53a));
  ok(rm.values.oUrea&&rm.values.oUrea.neg===929,'“Urea” carries 929');
  ok(!rm.values.r1,'and “2. Catchment Area Population” is never taken for line 2, the malaria rapid test');
  ok(R.monthFromName('Oct 26')==='2026-10','the sheet\u2019s name gives its month');
  ok(R.monthFromRows(real)==='2026-10',
     'and when the name says nothing, the sheet\u2019s own “6. Month | October” and “5. Year | 2026/2027” do');

  /* ── 3c · the rows that cannot be placed are kept, not dropped ─────── */
  const odd=[[ 'TC/DC (total/differential)', 12, 40 ],[ 'Prothrombin time (INR)', 7, 21 ]];
  const om=R.matchSheet(odd);
  ok(om.matched===0,'two rows of wording the form does not use match nothing');
  ok(om.unmatched.length===2,'and both are handed back, with their figures',JSON.stringify(om.unmatched));
  ok(om.unmatched[0].label==='TC/DC (total/differential)'&&om.unmatched[0].nums[0]===12,'the label and the figures survive the trip');

  /* ── 3d · section VIII, the blood bank, on the same rows ───────────── */
  const bloodRows=[
    at([[0,'VIII. Blood Supply Group Type'],[9,'Present at the beginning'],[19,'Present at the end']]),
    at([[0,'A-'],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0]]),
    at([[0,'A+'],[1,2],[2,2],[3,2],[4,2],[5,0],[6,0],[7,2],[9,'6.4 Full Blood Count'],[16,900]]),
    at([[0,'AB+'],[1,0],[2,3],[3,3],[4,3],[5,0],[6,0],[7,0]]),
    at([[0,'B+'],[1,2],[2,25],[3,25],[4,24],[5,0],[6,0],[7,3]]),
    at([[0,'O+'],[1,2],[2,22],[3,22],[4,20],[5,0],[6,0],[7,4]]),
    at([[0,'O-'],[1,0],[2,2],[3,2],[4,2],[5,0],[6,0],[7,0]]),
    at([[0,'Sum'],[1,6],[2,54],[3,54],[4,51],[5,0],[6,0],[7,9]])
  ];
  const bm=R.matchSheet(bloodRows);
  ok(Object.keys(bm.blood).length===6,'six blood groups on the sheet are read — not just the ones the exam block sits beside ('+Object.keys(bm.blood).length+')');
  ok(bm.blood['A+']&&bm.blood['A+'].open===2&&bm.blood['A+'].recv===2&&bm.blood['A+'].used===2,
     'the A+ group carries opening, received and used',JSON.stringify(bm.blood['A+']));
  ok(bm.blood['B+'].used===24&&bm.blood['B+'].returned===0,'and B+ its own figures');
  ok(bm.blood['O+']&&bm.blood['O+'].used===20,'O+ transfused 20');
  ok(bm.blood['A-']&&bm.blood['A-'].open===0,'a group with nothing moving is still read, as zeros');
  ok(!bm.blood['Sum'],'the printed sum row is not stored as a group');
  ok(bm.bloodDetail.length===6,'and the preview can list each group');
  ok(bm.values.x64&&bm.values.x64.total===900,'the examination sharing that row is read at the same time');
  ok(bm.unmatched.length===0,'no blood row is offered as unplaceable');

  /* ── 4 · months loaded become a history ────────────────────────────── */
  S.reportImportMonth('2024-09',R.matchSheet(SEP24).values,{meta:{source:'District workbook · sheet “Sep 2024”'}});
  S.reportImportMonth('2024-10',R.matchSheet(OCT24).values,{meta:{source:'District workbook · sheet “Oct 2024”'}});
  ok(S.reportMonths().length===3,'three months are on file now',S.reportMonths().join(', '));
  /* the blood bank travels with the month */
  S.reportImportMonth('2024-09',{},{blood:bm.blood});
  const bsum=S.reportSummary('2024-09').bloodTotals;
  ok(bsum.open===6&&bsum.recv===54&&bsum.used===51&&bsum.end===9,
     'and September 2024\u2019s blood supply is stored exactly as read — 6 opening, 54 received, 51 used, 9 left',JSON.stringify(bsum));
  ok(S.reportSummary('2024-09').blood['O+'].end===4,'the closing balance of O+ is worked out from its own figures');
  /* a month with no blood block is a gap, not a month of zero packs */
  ok(S.reportSeries().find(m=>m.key==='2024-09').bloodKnown===true,'a month with section VIII is marked as having a blood bank');
  ok(S.reportSeries().find(m=>m.key==='2024-10').bloodKnown===false,'and a month loaded without one is marked as a gap');
  ok(S.reportSeries().find(m=>m.key==='2026-10').bloodKnown===true,'October 2026, on file since the first release, still has its blood bank');

  /* the blood bank through the months, with the gap kept as a gap */
  await go('#/reports'); await tick(350);
  click(page.querySelector('.rep-tab[data-tab="analysis"]')); await tick(400);
  ok(!!page.querySelector('#repBloodTrend svg'),'the blood bank is charted across the months');
  const bloodFoot=[].slice.call(page.querySelectorAll('.card')).find(c=>/blood bank over time/i.test(c.textContent));
  ok(bloodFoot&&/No blood-supply block for Oct 24/.test(bloodFoot.textContent),
     'and the card names the month that has none, rather than drawing a zero',bloodFoot&&bloodFoot.textContent.replace(/\s+/g,' ').slice(0,160));
  ok(S.reportMonths().indexOf('2024-10')>=0,'and October 2024 is one of them — the month named in the request');
  const a24=S.reportSummary('2024-10');
  ok(a24.meta.source.indexOf('Oct 2024')>0,'the month carries where it came from',a24.meta.source);
  ok(a24.lines.find(r=>r.id===fbc.id).total===1180,'the return shows the copies of the figures, not a re-typing');
  const s24=S.reportSummary('2024-09');
  ok(s24.lines.find(r=>r.id===fbc.id).total===1024,'the month before it has its own');

  /* ── 5 · the series, month over month ──────────────────────────────── */
  const series=S.reportSeries();
  ok(series.length===3,'the series carries every month on file');
  ok(series.map(x=>x.key).join(',')==='2024-09,2024-10,2026-10','oldest first, so a trend reads left to right',series.map(x=>x.key).join(','));
  ok(series.every(x=>x.label&&x.label.length),'each month has a short label for the charts',series.map(x=>x.label).join(' '));
  const c=S.reportCompare('2024-10');
  ok(c.prev&&c.prev.key==='2024-09','October 2024 is compared with September 2024',c.prev&&c.prev.key);
  const exp=Math.round((series[1].tests-series[0].tests)/series[0].tests*1000)/10;
  ok(c.vsPrev&&c.vsPrev.tests===exp,'the month-over-month change is worked out from the two months, not assumed',c.vsPrev&&c.vsPrev.tests+' vs '+exp);
  ok(c.vsPrev.delta===series[1].tests-series[0].tests,'and so is the head-count change');
  ok(c.lastYear===null,'October 2025 was never entered, so there is no year-over-year figure — a gap, not a zero');
  ok(c.vsYear===null,'and nothing is filled in for it');
  const c26=S.reportCompare('2026-10');
  ok(c26.lastYear===null,'the same holds for October 2026 against October 2025');
  ok(c26.prev===null,'its previous month (September 2026) is not on file, so no month-over-month claim is made');

  /* ── 6 · yearly ───────────────────────────────────────────────────── */
  const roll=S.reportRollup();
  ok(roll.years.length===2,'two calendar years are on file',roll.years.map(y=>y.key).join(','));
  const y2024=roll.years.find(y=>y.key==='2024');
  ok(y2024.months===2,'2024 counts its two months',y2024.months);
  ok(y2024.avg===Math.round(y2024.tests/2),'the year average is the year divided by the months entered',y2024.avg);
  ok(y2024.tests===series[0].tests+series[1].tests,'the year total is the sum of its months');
  ok(roll.fy.some(f=>f.key==='2024/2025'),'and the financial year (July–June) is rolled up too',roll.fy.map(f=>f.key).join(','));
  const fy24=roll.fy.find(f=>f.key==='2024/2025');
  ok(fy24.months===2,'September and October 2024 both fall in 2024/2025');

  /* ── 7 · one examination through time ─────────────────────────────── */
  const tr=S.reportTestSeries(fbc.id);
  ok(tr.length===3,'the trend of one examination has a point for every month');
  ok(tr.map(p=>p.total).join(',')==='1024,1180,1364','full blood counts went 1,024 → 1,180 → 1,364',tr.map(p=>p.total).join(','));
  const trAmp=S.reportTestSeries(amp.id);
  ok(trAmp.map(p=>p.total).join(',')==='18,12,41','amylase fell then rose — 18 → 12 → 41',trAmp.map(p=>p.total).join(','));
  ok(S.reportTestSeries(mal.id).map(p=>p.pos).join(',')==='30,40,2','positives are followed too, not just totals');

  /* ── 8 · what moved ───────────────────────────────────────────────── */
  const mv=S.reportMovers('2024-09','2024-10');
  ok(mv.length>0,'movements between two months are listed');
  ok(mv.every((x,i)=>i===0||Math.abs(mv[i-1].change)>=Math.abs(x.change)),'biggest movement first');
  const fbcMv=mv.find(x=>x.id===fbc.id);
  ok(fbcMv.from===1024&&fbcMv.to===1180&&fbcMv.change===156,'the full blood count rose by 156');
  ok(S.reportMovers('2024-10','2024-10').length===0,'a month against itself has nothing to report');

  /* ── 9 · on the page, as a reader would find it ───────────────────── */
  await go('#/reports'); await tick(400);
  const tabs=[].slice.call(page.querySelectorAll('.rep-tab'));
  ok(tabs.length===2,'Monthly Reports now has two readings: the return and the history',tabs.map(t=>t.textContent.trim()).join(' | '));
  ok(/Analysis & history/.test(tabs[1].textContent),'the second is labelled Analysis & history');
  click(tabs[1]); await tick(300);
  ok(page.querySelectorAll('.rep-cmp-card').length===3,'a month is set against last month, last year, and the history on file');
  ok(page.querySelectorAll('.rep-hist tr[data-month]').length===3,'every month on file is a row of the month-by-month table');
  ok(/2,236/.test(page.querySelector('.rep-hist').textContent),'and the table carries the month\u2019s own total — 2,236 tests in Oct 2024');
  const opts=[].slice.call(page.querySelectorAll('#repMonth option')).map(o=>o.value);
  ok(opts.indexOf('2024-10')>=0,'October 2024 is in the month picker — the month named in the request',opts.join(','));
  const sel=page.querySelector('#repMonth'); sel.value='2024-10'; sel.dispatchEvent(new w.Event('change')); await tick(350);
  ok(page.querySelector('.rep-cmp').textContent.indexOf('Sep 2024')>0,
     'choosing it puts the page on October 2024, compared with September 2024');
  const tabs2=[].slice.call(page.querySelectorAll('.rep-tab'));
  click(tabs2[1]); await tick(300);
  ok(page.querySelector('.rep-tl-chip.on').textContent.indexOf('Oct 24')===0,'and the strip marks that month');
  ok(/Sep 2024/.test(page.querySelector('.rep-cmp').textContent),'against the month before it — September 2024');
  ok(!!page.querySelector('#repTestTrend svg')||/rep-trend-single/.test(page.innerHTML),'one examination is charted across the months');
  ok(!!page.querySelector('#repSecTrend'),'and the sections are charted month by month');
  ok(!!page.querySelector('[data-load-wb]'),'the workbook is loaded from this page, where the history is');
  ok(!!page.querySelector('[data-import]'),'or a single sheet is pasted');

  /* the month table is a way back in time */
  const row2024=[].slice.call(page.querySelectorAll('.rep-hist tr[data-month]')).find(tr=>tr.dataset.month==='2024-10');
  click(row2024); await tick(350);
  ok(page.querySelector('#repMonth').value==='2024-10','clicking October 2024 opens that month\u2019s return',page.querySelector('#repMonth').value);
  ok(/Oct 2024/.test(page.querySelector('#repMonth option:checked').textContent),'and the page says so');

  /* ── 9b · a row that found no line is placed by hand, once ─────────── */
  const sel0=page.querySelector('#repMonth'); sel0.value='2024-10'; sel0.dispatchEvent(new w.Event('change')); await tick(350);
  S.reportStashUnmatched('2024-10',[{label:'TC/DC (total/differential)',nums:[12,40]}]);
  click(page.querySelector('.rep-tab[data-tab="analysis"]')); await tick(350);
  ok(!!page.querySelector('[data-map-rows]'),'a row with figures but no line is shown on the page, not dropped');
  click(page.querySelector('[data-map-rows]')); await tick(250);
  const place=d.querySelector('[data-place="0"]');
  ok(!!place,'the mapping screen lists it against every line of the form');
  ok(place.options.length>40,'with the whole form to choose from ('+place.options.length+' lines)');
  place.value='oClotting';
  const savePlace=d.querySelector('[data-save]'); click(savePlace); await tick(500);
  ok(S.reportMonth('2024-10').values.oClotting&&S.reportMonth('2024-10').values.oClotting.pos===12,
     'the figures land on the line chosen — 12 positives',JSON.stringify(S.reportMonth('2024-10').values.oClotting));
  ok(S.reportUnmatched('2024-10').length===0,'and the row leaves the unplaced list');
  ok(!page.querySelector('[data-map-rows]'),'the warning disappears from the page');
  ok(R.matchSheet([['TC/DC (total/differential)',12,40]]).matched===1,
     'the wording is remembered: the same row in next month\u2019s sheet places itself');

  /* ── 10 · the numbers are the district's, not the app's ───────────── */
  const before=JSON.stringify(S.reportMonth('2024-10').values);
  ok(before.indexOf('"neg":80')>0,'the negatives are stored as they were read');
  ok(S.reportMonth('2024-10').values[amp.id].total===12,'and a quantitative figure is stored once, as a total');
  ok(S.reportSummary('2024-09').totals.tests>0,'a month of only five examinations still totals honestly');

  /* ── 11 · the code is in place ───────────────────────────────────── */
  ok(/S\.reportSeries=function/.test(srcSt)&&/S\.reportCompare=function/.test(srcSt)&&/S\.reportRollup=function/.test(srcSt),
     'the store computes the series, the comparison and the roll-up');
  ok(/S\.reportTestSeries=function/.test(srcSt)&&/S\.reportMovers=function/.test(srcSt),'the per-test trend and the movers too');
  ok(/readWorkbook/.test(srcRead)&&/DecompressionStream/.test(srcRead),'the reader unpacks the workbook with the browser\u2019s own inflater');
  ok(/\.rep-cmp\{/.test(css)&&/\.rep-tabs\{/.test(css)&&/\.rep-loadbar\{/.test(css),'the history is styled like the rest of the module');

  /* ── 12 · the workbook through the page, as the reader would do it ─── */
  click(page.querySelector('.rep-tab[data-tab="analysis"]')); await tick(250);
  const wbBtn=page.querySelector('[data-load-wb]');
  click(wbBtn); await tick(250);
  ok(!!d.querySelector('#wbFile'),'a file can be chosen from the page');
  const fileEl=d.querySelector('#wbFile');
  Object.defineProperty(fileEl,'files',{value:[fileLike(workbook())],configurable:true});
  fileEl.dispatchEvent(new w.Event('change')); await tick(800);
  const rows=d.querySelectorAll('[data-wbmonth]');
  ok(rows.length===3,'every sheet of the workbook is listed, each with the month it becomes ('+rows.length+')');
  ok(rows[0].value==='2024-10','and the month is read off the sheet\u2019s name — Oct 2024',rows[0].value);
  ok(rows[2].value==='2026-10','“Oct 26” is read as October 2026',rows[2].value);
  const saveBtn=d.querySelector('[data-save]');
  ok(saveBtn&&!saveBtn.disabled,'the months can be loaded once they are matched');
  click(saveBtn); await tick(800);
  ok(!d.querySelector('#wbFile'),'the dialog closes on load');
  ok(S.reportMonths().length===3,'the months are on file after loading from the workbook',S.reportMonths().join(','));
  ok(/Oct 2024/.test(S.reportMonth('2024-10').meta.source||''),'and each month remembers the sheet it came from',S.reportMonth('2024-10').meta.source);
  ok(page.querySelectorAll('.rep-cmp-card').length===3,'the page lands on the analysis it just filled in');

  /* ── 13 · winding the record back ──────────────────────────────────── */
  const del=S.reportDeltaSeries();
  ok(del.length===3,'every month on file carries its movement');
  const sep=del.find(x=>x.key==='2024-09'), oct24=del.find(x=>x.key==='2024-10'), oct26=del.find(x=>x.key==='2026-10');
  ok(sep.change===null&&sep.pct===null,'the earliest month has nothing before it — no zero is invented');
  ok(oct24.change===oct24.tests-sep.tests,'the change is the difference between the two months',oct24.change);
  ok(oct24.pct===Math.round((oct24.tests-sep.tests)/sep.tests*1000)/10,'and the percentage is that difference over the month before',oct24.pct);
  ok(oct26.change===null,'October 2026 has no September 2026 on file, so it has no movement — a gap, not a drop to nothing');
  ok(S.reportAcrossYears('2024-10').map(x=>x.key).join(',')==='2024-10,2026-10','both Octobers on file are found together');
  ok(S.reportAcrossYears('2024-09').map(x=>x.key).join(',')==='2024-09','and the helper lists the same month across the years that exist');

  click(page.querySelector('.rep-tab[data-tab="analysis"]')); await tick(400);
  ok(page.querySelectorAll('[data-tl]').length===3,'the months are a strip you can walk along ('+page.querySelectorAll('[data-tl]').length+')');
  ok(!!page.querySelector('.rep-tl-chip.on'),'the month being read is marked on the strip');
  ok(!!page.querySelector('#repDelta svg'),'the movement of every month is charted');
  ok(page.querySelectorAll('#repDelta [data-key]').length===3,'each bar is a month you can go back to');
  ok(!!page.querySelector('#repPositivity svg'),'positivity is charted through the months');
  ok(!!page.querySelector('#repBloodTrend svg'),'and so is the blood bank');
  ok(page.querySelector('#repDelta [data-key="2024-09"]')!==null,'September 2024 has its own bar');
  page.querySelector('#repDelta [data-key="2024-09"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await tick(400);
  ok(page.querySelector('#repMonth').value==='2024-09','clicking a bar winds the page back to that month',page.querySelector('#repMonth').value);
  ok(/Sep 2024 in full/.test(page.querySelectorAll('.rep-analysis-head h2')[0].textContent),'and the whole page follows — the rankings are that month\u2019s');
  page.querySelector('[data-tl="2024-10"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await tick(400);
  ok(page.querySelector('.rep-tl-chip.on').textContent.indexOf('Oct 24')===0,'a chip on the strip does the same');
  const cmpText=page.querySelector('.rep-cmp').textContent;
  ok(/tests/.test(cmpText)&&/positives/.test(cmpText),'the comparison reads tests and positives, not just a headline');
  ok(new RegExp('[+-]'+Math.abs(oct24.change).toLocaleString().replace(/,/g,'')).test(cmpText.replace(/\s+/g,' '))||cmpText.indexOf(String(Math.abs(oct24.change)))>0,
     'it states the count it moved by ('+oct24.change+')');
  ok(cmpText.indexOf(String(oct24.pct)+'%')>0,'and the percentage of that change ('+oct24.pct+'%)');
  ok(page.querySelectorAll('.rep-cmp-line').length>=2,'the comparison is broken into metrics, line by line');
  d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  await tick(400);
  ok(page.querySelector('#repMonth').value==='2026-10','→ walks forward a month',page.querySelector('#repMonth').value);
  d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
  await tick(400);
  ok(page.querySelector('#repMonth').value==='2024-10','← walks back again',page.querySelector('#repMonth').value);
  ok(typeof w.LS.charts.delta==='function','the diverging chart is part of the chart set');
  ok(/\.rep-tl\{/.test(css)&&/\.rep-cmp-line\{/.test(css),'the strip and the comparison rows are styled');

  done('history85');
})();
