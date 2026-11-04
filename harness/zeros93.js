/* v6.9.92 — a blank is a blank, and a written 0 is a 0.
   The district's sheet leaves many cells empty and writes 0 in others on purpose: RPR 0|0
   is a statement, an empty cell is silence. The return now keeps the two apart — on the
   form, on the printed sheet and in the Excel export — instead of printing a dash across
   both. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms||180));
const click=el=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));

(async()=>{
  const {w,go,errors}=await boot('#/reports');
  const S=w.LS.store, U=w.LSU, doc=w.document;
  const R=w.LS.modules.reports.__read;
  ok(!errors.length,'the console boots clean',errors.join(' | '));

  /* ── 1 · the sheet as the district fills it ─────────────────────────── */
  const SHEET=[
    ['6. Blood'],
    ['6.1 RPR',            0,    0],
    ['6.2 HIV final Result', 0,  0],
    ['6.3 ESR',            0],
    ['6.4 Full Blood Count (FBC/NFS)', 1364],
    ['6.5 ALAT (GPT)',     917],
    ['6.9 CD4',            0],
    ['6.12 HBV',           5,    431],
    ['6.13 HCV',           0,    0],
    ['9. Other Lab Tests'],
    ['Urea',               0,    929]
  ];
  const m=R.matchSheet(SHEET);
  ok(m.matched>=8,'the sheet finds its lines ('+m.matched+' placed)');

  ok(m.values.x61&&m.values.x61.pos===0&&m.values.x61.neg===0,
     'RPR 0 | 0 is read as two zeroes, not as two blanks',JSON.stringify(m.values.x61));
  ok(m.values.x63&&m.values.x63.total===0,'a single 0 on a quantitative line is kept as 0',JSON.stringify(m.values.x63));
  ok(m.values.x69&&m.values.x69.total===0,'CD4 0 is kept',JSON.stringify(m.values.x69));
  ok(m.values.x64&&m.values.x64.total===1364,'and a real figure is still a real figure',JSON.stringify(m.values.x64));
  ok(!m.values.x66,'a line the sheet never names has no entry at all — absence is not zero');

  /* ── 2 · stored, and read back as written ───────────────────────────── */
  S.reportImportMonth('2026-11',m.values,{meta:{source:'District workbook · sheet “Oct 26”'}});
  const month=S.reportMonth('2026-11');
  ok(month.values.x61&&month.values.x61.pos===0,'the stored month keeps the zero for RPR positive');
  ok(month.values.x61.neg===0,'and for its negative');
  ok(!month.values.x66,'and stores nothing for the examination the sheet left out');

  const lines=S.reportLines();
  const rowOf=id=>S.reportRow(month,lines.find(l=>l.id===id));
  const rpr=rowOf('x61');
  ok(rpr.present.pos===true&&rpr.present.neg===true,'the row knows that both cells were written');
  ok(rpr.any===true,'so the row counts as carrying figures, even though both are 0');
  ok(rowOf('x66').any===false,'and a row nobody wrote on carries none');
  ok(rowOf('x66').present.total===false,'with no cell marked as written');

  /* ── 3 · the form on screen ─────────────────────────────────────────── */
  await go('#/reports'); await tick(400);
  const sel=doc.querySelector('#repMonth');
  if(sel){ sel.value='2026-11'; sel.dispatchEvent(new w.Event('change')); await tick(400); }
  const cell=(lineId,field)=>doc.querySelector('.rep-in[data-line="'+lineId+'"][data-field="'+field+'"]');
  const total=(lineId)=>doc.querySelector('[data-total="'+lineId+'"]');

  ok(cell('x61','pos')&&cell('x61','pos').value==='0','RPR positive prints 0, not a dash and not an empty box');
  ok(cell('x61','neg')&&cell('x61','neg').value==='0','RPR negative prints 0 as well');
  ok(total('x61')&&total('x61').textContent==='0','and the row total is 0, because 0 + 0 is a real total');
  ok(total('x61').textContent!=='—','the total is not a dash');
  ok(cell('x64','total')&&cell('x64','total').value==='1364','the full blood count prints its figure');
  ok(cell('x66','total')&&cell('x66','total').value==='','an examination the sheet left blank is left blank on the form');
  ok(total('x66')&&total('x66').textContent==='','and its total is blank, as the paper form is');
  ok(total('x66').textContent!=='—','no dash is printed where nothing was written');
  ok(cell('x69','total').value==='0','CD4 0 prints 0');
  ok(/has/.test(cell('x61','pos').className),'a written 0 is marked as written, like any other figure');
  ok(!/has/.test(cell('x66','total').className),'a blank cell is not');

  /* the blood bank follows the same rule */
  S.reportImportMonth('2026-11',{},{blood:{'A-':{open:0,req:0,recv:0,used:0,expired:0,returned:0},
    'O+':{open:2,req:22,recv:22,used:20,expired:0,returned:0}}});
  await go('#/reports'); await tick(400);
  const sel2=doc.querySelector('#repMonth');
  if(sel2){ sel2.value='2026-11'; sel2.dispatchEvent(new w.Event('change')); await tick(400); }
  const bcell=(g,f)=>doc.querySelector('.rep-in[data-blood-group="'+g+'"][data-blood-field="'+f+'"]');
  ok(bcell('A-','open')&&bcell('A-','open').value==='0','a group the sheet records as all zeroes prints zeroes');
  ok(bcell('A-','used').value==='0','every column of it');
  ok(doc.querySelector('[data-blood-end="A-"]').textContent==='0','and its closing balance is 0, not a dash');
  ok(bcell('B+','open')&&bcell('B+','open').value==='','a group the sheet never mentions is left blank');
  ok(doc.querySelector('[data-blood-end="B+"]').textContent==='','with a blank closing balance');

  /* ── 4 · clearing a cell returns it to blank, typing 0 keeps a zero ─── */
  const ed=cell('x64','total');
  ed.value=''; ed.dispatchEvent(new w.Event('change',{bubbles:true})); await tick(300);
  ok(!S.reportMonth('2026-11').values.x64,'clearing a cell removes the figure — it does not become a 0');
  ok(S.reportMonth('2026-11').values.x65&&S.reportMonth('2026-11').values.x65.total===917,'the rest of the month is untouched');

  S.reportSet('2026-11','x64','total','0');
  const after=S.reportRow(S.reportMonth('2026-11'),S.reportLines().find(l=>l.id==='x64'));
  ok(after.any===true&&after.total===0,'typing 0 by hand stores a zero that is a zero');
  ok(after.present.total===true,'and the form can tell it from a blank');

  /* ── 5 · the printed return ─────────────────────────────────────────── */
  /* the real figures are put back, so the page is the one the district receives */
  S.reportImportMonth('2026-11',m.values,{});
  w.TextEncoder=require('util').TextEncoder;
  const pages=w.LS.sheets.reportSheets(S.reportSummary('2026-11'));
  const svg=pages.join('');
  ok(pages.length>=1&&svg.indexOf('<svg')===0,'the printed return is drawn ('+pages.length+' page'+(pages.length===1?'':'s')+')');
  ok(svg.indexOf('\\u2014')<0&&svg.indexOf('—')<0,'nothing is printed as a dash — the paper form has blanks, not dashes');
  const texts=[...svg.matchAll(/>([^<>]*)</g)].map(x=>x[1].trim()).filter(Boolean);
  ok(texts.includes('1,364'),'the full blood count is printed');
  ok(texts.filter(t=>t==='0').length>=1,'a written 0 is printed as 0');
  ok(texts.indexOf('917')>=0,'and a real figure keeps its place');
  ok(pages.join('').indexOf('\u2014')<0,'the whole return prints blank where the sheet is blank');

  const OrigBlob=w.Blob; let parts=null;
  w.Blob=function(p,o){ parts=p; return new OrigBlob(p,o); };
  w.Blob.prototype=OrigBlob.prototype;
  const xlsx=w.LS.sheets.reportXLSX(S.reportSummary('2026-11'));
  ok(!!xlsx,'the Excel export is produced');
  const bytes=(parts||[]).reduce((n,x)=>n+(x&&x.length||0),0);
  const sheetXml=(parts||[]).map(x=>Buffer.from(Array.from(x||[])).toString('latin1')).join('');
  ok(bytes>4000,'with content ('+bytes+' bytes)');
  ok(!/—/.test(sheetXml),'the workbook carries no dash in place of a figure');
  ok(!/\u2014/.test(sheetXml),'nor an escaped one');
  ok(/<v>0<\/v>/.test(sheetXml),'a written 0 is a 0 in the workbook too');

  /* ── 6 · the rules reach the source, so a later edit cannot undo them ─ */
  const fs=require('fs'), path=require('path');
  const st=fs.readFileSync(path.join(__dirname,'..','assets/js/core/store.js'),'utf8');
  const rep=fs.readFileSync(path.join(__dirname,'..','assets/js/modules/report.js'),'utf8');
  const sh=fs.readFileSync(path.join(__dirname,'..','assets/js/core/sheets.js'),'utf8');
  ok(/r\.present=/.test(st),'the row carries which cells were written');
  ok(/isFinite\(\+v\[f\]\)/.test(st),'the importer keeps a written zero');
  ok(/delete v\[field\]/.test(st),'and an emptied cell is removed rather than zeroed');
  ok(/bloodPresent/.test(rep),'the blood table reads what the month carries');
  ok(/present&&r\.present\[c\]/.test(sh),'the printed sheet and the export read the same map');

  done('zeros93');
})();
