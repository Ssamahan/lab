'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const LS = {modules:{},ui:{},store:{db:()=>({catalog:{healthCenters:[]}})},auth:{user:{name:'Test Manager'}}};
const window = {LSU:{esc:s=>String(s==null?'':s)}};
const context = {window,LS,console,Date,Math,Number,String,Array,Object,Set,Map,RegExp,TextDecoder,Uint8Array,DataView,Blob,Response,DecompressionStream};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/js/modules/hiv-reporting.js'),'utf8'),context,{filename:'hiv-reporting.js'});
const H=LS.modules['hiv-reporting'];
const T=H._test;

assert.deepEqual(JSON.parse(JSON.stringify(T.reportMonthInfo('May','2026-06-03'))),{year:2026,month:4});
assert.deepEqual(JSON.parse(JSON.stringify(T.reportMonthInfo('December','2026-01-03'))),{year:2025,month:11});
assert.equal(T.deadlineFor('2026-05'),'2026-06-04');

const june4=T.parseTimestamp('2026-06-04 23:59:59');
const june5=T.parseTimestamp('2026-06-05 00:00:01');
assert.equal(june4.date,'2026-06-04');
assert.equal(june5.date,'2026-06-05');
const serial=Date.UTC(2026,5,4,12)/86400000+25569;
assert.equal(T.parseTimestamp(serial).date,'2026-06-04');

const grid=T.parseDelimited('Id,Completion time,Health Facility Name,Reporting Month,Comments\r\n1,"2026-06-04 09:20:00",Alpha HC,May,"works, fine"\r\n2,"2026-06-05 08:10:00",Beta HC,May,late');
const imported=H.parseImportGrid(grid,['Alpha HC','Beta HC']);
assert.equal(imported.records.length,2);
assert.equal(imported.records[0].period,'2026-05');
assert.equal(imported.records[0].submittedOn,'2026-06-04');

const facs=['Alpha HC','Beta HC'];
const duplicateRows=[
  {facility:'Alpha HC',period:'2026-05',completedAt:'2026-06-05T08:00:00',submittedOn:'2026-06-05'},
  {facility:'Alpha HC',period:'2026-05',completedAt:'2026-06-03T08:00:00',submittedOn:'2026-06-03'},
  {facility:'Beta HC',period:'2026-05',completedAt:'2026-06-05T08:00:00',submittedOn:'2026-06-05'},
  {facility:'Alpha HC',period:'2026-06',completedAt:'2026-07-04T18:00:00',submittedOn:'2026-07-04'},
  {facility:'Beta HC',period:'2026-06',completedAt:'2026-07-07T18:00:00',submittedOn:'2026-07-07'},
  {facility:'Beta HC',period:'2026-07',completedAt:'2026-08-06T18:00:00',submittedOn:'2026-08-06'}
];
const model=T.buildModel({rows:duplicateRows},'2026-11-09',facs,'2026-05','2026-11');
assert.equal(model.due,12);             // six due reporting months × two centres
assert.equal(model.onTime,2);           // first Alpha/May + Alpha/June
assert.equal(model.late,3);             // one-, two- and three-day late reports
assert.equal(model.lateWithinTolerance,2);
assert.equal(model.lateMoreThanTolerance,1);
assert.equal(model.missing,7);          // all other due centre-months
assert.equal(model.months.find(x=>x.period==='2026-05').lateWithinTolerance,1);
assert.equal(model.months.find(x=>x.period==='2026-06').lateMoreThanTolerance,1);
assert.equal(model.months.find(x=>x.period==='2026-07').lateWithinTolerance,1);
assert.equal(model.matrix.find(x=>x.facility==='Beta HC'&&x.period==='2026-05').lateBand,'withinTolerance');
assert.equal(model.matrix.find(x=>x.facility==='Beta HC'&&x.period==='2026-06').lateBand,'beyondTolerance');
assert.equal(model.matrix.find(x=>x.facility==='Alpha HC'&&x.period==='2026-05').submissions,2);
assert.equal(model.matrix.find(x=>x.facility==='Alpha HC'&&x.period==='2026-05').state,'onTime');
assert.equal(T.cellStatusLabel(model.matrix.find(x=>x.facility==='Beta HC'&&x.period==='2026-05')),'Late (1–2 days; within the two-day tolerance)');
assert.equal(T.cellStatusLabel(model.matrix.find(x=>x.facility==='Beta HC'&&x.period==='2026-06')),'Late (>2 days)');
assert.equal(model.matrix.find(x=>x.facility==='Beta HC'&&x.period==='2026-07').lateDays,2);
assert.equal(T.cellStatusLabel(model.matrix.find(x=>x.facility==='Beta HC'&&x.period==='2026-07')),'Late (1–2 days; within the two-day tolerance)');
assert.equal(model.matrix.find(x=>x.facility==='Alpha HC'&&x.period==='2026-11').state,'notDue');

// Monthly imports accumulate; identical rows already saved are skipped while
// distinct source submissions with the same centre/month are preserved.
const saved=[{facility:'Alpha HC',period:'2026-05',submittedOn:'2026-06-04',completedAt:'2026-06-04T09:20:00'}];
const same=saved[0];
const later={facility:'Alpha HC',period:'2026-05',submittedOn:'2026-06-06',completedAt:'2026-06-06T10:00:00'};
const merged=T.mergeRows(saved,[same,later]);
assert.equal(merged.added,1);
assert.equal(merged.alreadyPresent,1);
assert.equal(merged.rows.length,2);
assert.equal(T.mergeRows(merged.rows,[same,later]).added,0);
assert.equal(T.mergeRows(merged.rows,[same,later]).alreadyPresent,2);
const identicalSourceDuplicates=T.mergeRows([], [same,{...same}]);
assert.equal(identicalSourceDuplicates.rows.length,2);

const retro=T.buildModel({rows:duplicateRows},'2026-10-31',facs,'2026-05','2026-10');
assert.equal(retro.matrix.find(x=>x.facility==='Alpha HC'&&x.period==='2026-10').state,'notDue');
assert.equal(retro.matrix.some(x=>x.period==='2026-11'),false);

// Render smoke test: the monthly UI exposes both late bands and future periods.
LS.store.db=()=>({catalog:{healthCenters:facs.map(name=>({name}))}});
LS.ui.ic=()=>'';
LS.ui.stat=o=>'<div>'+o.label+' '+(o.formatted||o.value)+' '+o.note+'</div>';
LS.ui.card=o=>'<section><h2>'+o.title+'</h2>'+o.body+'</section>';
window.LSU.todayISO=()=> '2026-11-09';
window.LSU.fmtDT=()=> '9 Nov 2026';
context.localStorage={getItem:()=>JSON.stringify({version:1,rows:duplicateRows,importedAt:'2026-11-09T00:00:00Z',fileName:'test.xlsx'})};
const root={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};
H.render(root,{asof:'2026-11-09'});
assert.match(root.innerHTML,/Late 1–2 days/);
assert.match(root.innerHTML,/Late >2 days/);
assert.match(root.innerHTML,/within tolerance, still late/);
assert.match(root.innerHTML,/Not due/);

const shellSource=fs.readFileSync(path.join(__dirname,'../assets/js/core/shell.js'),'utf8');
const qualitySource=fs.readFileSync(path.join(__dirname,'../assets/js/modules/quality.js'),'utf8');
const i18nSource=fs.readFileSync(path.join(__dirname,'../assets/js/core/i18n.js'),'utf8');
assert.match(shellSource,/'hiv-reporting':\{title:'Monthly Reports'.*group:'Reports'/);
assert.match(shellSource,/const GROUPS=\[[^\]]*'Reports'/);
assert.match(i18nSource,/'nav\.reports':'Reports'/);
assert.doesNotMatch(qualitySource,/Monthly Reports|hiv-reporting/);

console.log('HIV reporting tests passed');
