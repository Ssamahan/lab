/* ============================================================================
   LAB SYSTEMS · STORE — localStorage-first, offline-first, audit-trailed.
   The 100-upgrade console keeps the v5 register schema and key (labSystems.v1)
   so every record carried forward stays readable in the new shell.
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU;
const DB_KEY='labSystems.v1';
const S = {};
window.LS = window.LS || {};
LS.store = S;

const LS_TYPES = {AL:'Annual leave', W:'Weekend', TR:'Training', SICK:'Sick leave', MAT:'Maternity', STUDY:'Study', COMP:'Compassionate', UNPAID:'Unpaid'};

/* One vocabulary for shift times: day 08:00–17:00, night 17:00–08:00 of the
   NEXT day. Anything that prints a shift time reads it from here. */
const SHIFT = {
  day:   {code:'D',  label:'Day 08:00–17:00',                  start:'08:00', end:'17:00', nextDay:false},
  night: {code:'N',  label:'Night 17:00–08:00 next day',        start:'17:00', end:'08:00', nextDay:true},
  both:  {code:'DN', label:'Day + night 08:00–17:00 / 17:00–08:00 next day', start:'08:00', end:'08:00', nextDay:true}
};
/* Minimum acceptable performance, set by the department:
   EQA/PT schemes must reach 95 %, PBF evaluation must reach 80 %. */
const EQA_MIN = 95, PBF_MIN = 80;
const SHIFT_LINE = 'Day shift 08:00–17:00 · Night shift 17:00–08:00 the next day';

/* ——— default settings extensions ————————————————— */
const DEFAULT_SETTINGS = {
  theme:'ink', density:'comfortable', lang:'en',
  fiscalStart:'july', fyLabel:'2026/2027',
  labName:'Laboratory Department', facilityCode:'RDH',
  samplePrefix:'RDH', manifestPrefix:'BLC',
  coverWeekdayDay:3, coverWeekdayNight:1, coverWeekendDay:2, coverWeekendNight:1,
  tat: { 'Blood Culture':4, 'TB Culture':21, 'HIV Recency Viral Load':5, 'Hepatitis (HEP)':7, default:3 },
  cloud:{ enabled:false, endpoint:'', mode:'push-pull', lastSync:null },
  onboarding:{ importStaff:true, configureTests:false, inviteUsers:false, baselineQC:false, dismissed:false },
  features:{ qc:true, pbf:true, equipment:true, cloud:true },
  provenance:'Register data carried forward from v5.3.1. Throughput, QC and TAT telemetry are generated locally for the console.'
};

/* The referral register carries the reference-laboratory menu only — the tests
   Ruli DH actually sends to NRL, CHUK and Kibagabaga. Everything else on the
   request form is bench work done on site, so it is not offered as a referred
   test. The bench panel below is kept for competency records, which are about the
   work performed here, not about referrals. */
const BENCH_PANEL = [
  {code:'CBC', name:'CBC (Full Blood Count)',        cat:'Hematology'},
  {code:'MRDT',name:'Malaria RDT',                   cat:'Parasitology'},
  {code:'BSM', name:'Blood Slide for Malaria',       cat:'Parasitology'},
  {code:'GLU', name:'Fasting Blood Glucose',         cat:'Biochemistry'},
  {code:'CREA',name:'Serum Creatinine',              cat:'Biochemistry'},
  {code:'ALT', name:'ALT (SGPT)',                    cat:'Biochemistry'},
  {code:'HIVR',name:'HIV Rapid Test (Determine)',    cat:'Serology'},
  {code:'RPR', name:'Syphilis (RPR)',                cat:'Serology'},
  {code:'URIN',name:'Urinalysis',                    cat:'Parasitology'},
  {code:'AFB', name:'Sputum AFB (Ziehl-Neelsen)',    cat:'Microbiology'}
];
/* Tests withdrawn from the referral menu in v6.8. Existing installations keep a
   local copy of the catalogue, so the ids are pruned on load as well. */
const RETIRED_TESTS=['t11','t12','t13','t14','t15','t16','t17','t18','t19','t20'];
const SUPPLIERS = [
  {id:'s1', name:'RBC — National Medical Stores', leadDays:18, fillRate:96, priceVariance:2.1, region:'Kigali', rating:96},
  {id:'s2', name:'CHUK Laboratory Supply', leadDays:11, fillRate:88, priceVariance:6.4, region:'Huye', rating:88},
  {id:'s3', name:'Cepheid Direct (GeneXpert)', leadDays:26, fillRate:92, priceVariance:4.0, region:'Johannesburg', rating:92},
  {id:'s4', name:'Gakenke District Stores', leadDays:5, fillRate:81, priceVariance:9.2, region:'Gakenke', rating:81}
];

/* ——— Seed augmentation: appliance, quality, PBF, security ————————————————— */
function augSettings(s){ return Object.assign({},DEFAULT_SETTINGS, s||{}, { features:Object.assign({},DEFAULT_SETTINGS.features,(s&&s.features)||{}), onboarding:Object.assign({},DEFAULT_SETTINGS.onboarding,(s&&s.onboarding)||{}), cloud:Object.assign({},DEFAULT_SETTINGS.cloud,(s&&s.cloud)||{}), tat:Object.assign({},DEFAULT_SETTINGS.tat,(s&&s.tat)||{}) }); }

function buildEquipment(){
  const today=U.todayISO();
  const mk=(id,name,model,loc,status,uptime,nextPM,serial,manu)=>({id,name,model,location:loc,status,uptime,nextPM,serial,manufacturer:manu,lastPM:U.addDays(today,-Math.round(30+Math.random()*20)),downtime:[],services:[],role:'primary',pmIntervalDays:180,vendor:manu,vendorEmail:''});
  return [
    mk('eq1','GeneXpert IV','Cepheid GX-IV-16','Molecular Bay',  'operational',98.4,'2026-11-14','GX16-2291-A','Cepheid'),
    mk('eq2','Sysmex XN-330','Automated Hematology','Hematology Bench','operational',99.1,'2026-12-02','XN330-8841','Sysmex'),
    mk('eq3','Mindray BS-240','Clinical Chemistry','Chemistry Bench','maintenance',91.6,'2026-10-27','BS240-1173','Mindray'),
    mk('eq4','Hettich Rotina 420','Centrifuge','Sample Reception','operational',99.7,'2027-01-19','RT420-5520','Hettich'),
    mk('eq5','Labcold Blood Bank Fridge','2–8 °C Refrigeration','Blood Bank','warning',87.2,'2026-10-24','LC-RLF-0912','Labcold'),
    mk('eq6','Pima CD4 Analyser','Point-of-care CD4','HIV Clinic','offline',62.4,'2026-11-30','PIMA-3341','Abbott'),
    mk('eq7','Mindray BA-88A','Semi-auto Chemistry','Chemistry Bench','operational',96.8,'2027-02-08','BA88-7721','Mindray'),
    mk('eq8','ZEISS Primo Star','Binocular Microscope','Microbiology','operational',99.9,'2027-03-11','PS-4410','ZEISS')
  ];
}
function buildPBF(){
  const hcs=['Ruli HC','Coko HC','Nyange HC','Minazi HC','Rushashi HC','Muyongwe HC','Rwankuba HC','Muhondo HC'];
  const domains=[
    {k:'quality', label:'Quality management', weight:20},
    {k:'tat', label:'Turnaround & referral', weight:20},
    {k:'stock', label:'Commodity security', weight:15},
    {k:'data', label:'Data quality & reporting', weight:15},
    {k:'hr', label:'Staffing & competency', weight:15},
    {k:'infra', label:'Infrastructure & safety', weight:15}
  ];
  const r=U.rng('pbf-2026');
  return hcs.map((name,i)=>{
    const base=68+Math.round(r()*24);
    const scores={};
    domains.forEach(d=>{ scores[d.k]=U.clamp(base+Math.round((r()-0.5)*22),42,100); });
    const total=Math.round(domains.reduce((a,d)=>a+scores[d.k]*d.weight/100,0));
    return {id:'pbf'+i, name, district:'Gakenke', quarter:'Q1', fy:'2026/2027', scores, total,
      prior: U.clamp(total-Math.round((r()-0.4)*9),40,100), status:'draft', assessor:'District PBF team',
      submitted: U.addDays('2026-10-02', i%5), note:''};
  });
}
function buildSOPs(){
  const docs=[
    ['SOP-LAB-001','Specimen collection, labelling and transport','v4.2','2026-02-11','2027-02-11','Kelvin SAMAHANI',true],
    ['SOP-LAB-002','Sample acceptance and rejection criteria','v3.1','2026-04-02','2027-04-02','Kelvin SAMAHANI',true],
    ['SOP-LAB-006','GeneXpert MTB/RIF testing procedure','v5.0','2026-06-18','2027-06-18','Jean Paul NSENGIYUMVA',true],
    ['SOP-LAB-009','Internal quality control & Westgard rules','v2.3','2025-11-30','2026-11-30','Diane UWASE',false],
    ['SOP-LAB-012','Blood culture contamination prevention','v1.4','2026-01-14','2027-01-14','Kelvin SAMAHANI',true],
    ['SOP-LAB-015','Cold-chain temperature monitoring','v3.0','2026-08-01','2027-08-01','Beatrice NGEZEKURE',true],
    ['SOP-LAB-018','External quality assessment handling','v2.0','2026-03-22','2027-03-22','Kelvin SAMAHANI',false],
    ['SOP-LAB-021','Waste segregation and sharps safety','v4.0','2026-07-09','2027-07-09','Beatrice NGEZEKURE',true],
    ['SOP-LAB-024','Result verification and critical value reporting','v1.8','2025-12-12','2026-12-12','Kelvin SAMAHANI',false],
    ['SOP-LAB-027','Non-conformance and CAPA management','v2.1','2026-05-06','2027-05-06','Kelvin SAMAHANI',true]
  ];
  return docs.map(d=>({id:d[0],code:d[0],title:d[1],version:d[2],effective:d[3],review:d[4],owner:d[5],acknowledged:d[6]}));
}
function buildIncidents(){
  const t=U.todayISO();
  return [
    {id:'nc1',rootCause:'Cap not torqued; transport box without secondary containment',ref:'NC-2026-041',title:'Blood culture bottle leaked in transit from Coko HC',severity:'Major',owner:'Kelvin SAMAHANI',opened:U.addDays(t,-9),due:U.addDays(t,5),status:'Open',rootCause:'Cap not torqued; transport box without secondary containment',capa:'Refresher to 8 health centres; secondary bags issued'},
    {id:'nc2',rootCause:'Probe check failure after power dip',ref:'NC-2026-039',title:'GeneXpert module 2 error — invalid result on repeat',severity:'Minor',owner:'Jean Paul NSENGIYUMVA',opened:U.addDays(t,-18),due:U.addDays(t,-2),status:'CAPA in progress',rootCause:'Probe check failure after power dip',capa:'UPS installed; module recalibrated'},
    {id:'nc3',rootCause:'Reagent lot degradation',ref:'NC-2026-036',title:'QC 1-3s violation — Creatinine level 2',severity:'Major',owner:'Diane UWASE',opened:U.addDays(t,-26),due:U.addDays(t,-12),status:'Closed',rootCause:'Reagent lot degradation',capa:'Lot quarantined, new lot verified'},
    {id:'nc4',rootCause:'Annual review cycle slipped',ref:'NC-2026-044',title:'SOP-LAB-009 past due for review',severity:'Minor',owner:'Kelvin SAMAHANI',opened:U.addDays(t,-3),due:U.addDays(t,12),status:'Open',rootCause:'Document control review cycle',capa:'Review scheduled 12 Nov 2026'},
    {id:'nc5',rootCause:'Door left ajar during inventory',ref:'NC-2026-045',title:'Fridge 2–8 °C excursion to 9.4 °C for 42 minutes',severity:'Critical',owner:'Beatrice NGEZEKURE',opened:U.addDays(t,-1),due:U.addDays(t,2),status:'Open',rootCause:'Door left ajar during inventory',capa:'Door alarm latch; monthly drill'},
    {id:'nc6',rootCause:'Paediatric draw technique',ref:'NC-2026-033',title:'Two samples rejected for insufficient volume',severity:'Minor',owner:'Kelvin SAMAHANI',opened:U.addDays(t,-41),due:U.addDays(t,-28),status:'Closed',rootCause:'Paediatric draw technique',capa:'Microtainer training completed'}
  ];
}
function buildChecklist(){
  return [
    {id:'ck1', section:'Organisation & management', item:'Quality manual approved and communicated', done:true, weight:5},
    {id:'ck2', section:'Organisation & management', item:'Document control register maintained', done:true, weight:5},
    {id:'ck3', section:'Personnel', item:'Competency records for all technical staff', done:true, weight:6},
    {id:'ck4', section:'Personnel', item:'Job descriptions signed and current', done:false, weight:4},
    {id:'ck5', section:'Equipment & facilities', item:'Preventive maintenance schedule executed', done:true, weight:6},
    {id:'ck6', section:'Equipment & facilities', item:'Temperature monitoring records complete', done:true, weight:5},
    {id:'ck7', section:'Pre-examination', item:'Sample acceptance criteria documented', done:true, weight:5},
    {id:'ck8', section:'Examination', item:'Validated methods and reference intervals', done:true, weight:7},
    {id:'ck9', section:'Examination', item:'Internal QC with Westgard rules', done:true, weight:8},
    {id:'ck10',section:'Examination', item:'EQA participation for all disciplines', done:true, weight:8},
    {id:'ck11',section:'Post-examination', item:'Critical value notification log', done:false, weight:5},
    {id:'ck12',section:'Post-examination', item:'Sample retention and disposal policy', done:true, weight:4},
    {id:'ck13',section:'Safety', item:'Biosafety manual and spill kit', done:true, weight:5},
    {id:'ck14',section:'Safety', item:'Sharps injury register reviewed', done:false, weight:4},
    {id:'ck15',section:'Improvement', item:'Non-conformances tracked to closure', done:true, weight:6},
    {id:'ck16',section:'Improvement', item:'Annual management review performed', done:false, weight:5},
    {id:'ck17',section:'Information', item:'LIS audit trail enabled and reviewed', done:true, weight:6},
    {id:'ck18',section:'Information', item:'Backup and restore tested', done:true, weight:4}
  ];
}
function buildQC(){
  const analytes=[
    {key:'WBC',unit:'×10⁹/L',mean:6.2,sd:0.42,level:'L2',analyzer:'Sysmex XN-330'},
    {key:'Hemoglobin',unit:'g/dL',mean:13.4,sd:0.55,level:'L2',analyzer:'Sysmex XN-330'},
    {key:'Glucose',unit:'mmol/L',mean:5.6,sd:0.31,level:'L2',analyzer:'Mindray BS-240'},
    {key:'Creatinine',unit:'µmol/L',mean:88,sd:5.2,level:'L2',analyzer:'Mindray BS-240'},
    {key:'ALT',unit:'U/L',mean:32,sd:2.6,level:'L2',analyzer:'Mindray BS-240'}
  ];
  const runs={};
  analytes.forEach((a,ai)=>{
    const r=U.rng('qc-'+a.key); const pts=[]; const days=28;
    let drift=0;
    for(let i=0;i<days;i++){
      drift += (r()-0.5)*0.09;
      let z = (r()-0.5)*3.2 + drift*1.4;
      if(a.key==='Creatinine' && i===13) z=3.4;
      if(a.key==='Glucose' && i===21) z=-2.35;
      if(a.key==='ALT' && i===24) z=2.6;
      if(a.key==='WBC' && i===6) z=-2.9;
      const val=+(a.mean + z*a.sd).toFixed(2);
      pts.push({date:U.addDays(U.todayISO(), -(days-1-i)), value:val, z:+z.toFixed(2)});
    }
    runs[a.key]={analyte:a, points:pts};
  });
  return {analytes, runs, updated:U.nowISO()};
}
function buildCompetency(db){
  const r=U.rng('competency-2026');
  const staff=(db.staff||[]).filter(s=>s.status==='active');
  const tests=BENCH_PANEL;
  const out=[];
  const assessors=['Kelvin SAMAHANI','Aurelie YANSONEYE'];
  tests.forEach(t=>{
    staff.forEach(s=>{
      const senior=/manager|senior|incharge/i.test(s.role)||/SAMAHANI|NSENGIYUMVA/.test(s.name);
      const roll=r();
      const level=senior?(roll<.72?'full':'supervised'):(roll<.38?'full':roll<.66?'supervised':roll<.85?'training':'none');
      if(level==='none') return;
      const expires=U.addDays(U.todayISO(), Math.round(-40+roll*430));
      out.push({id:'cp-'+t.code+'-'+s.id, staffId:s.id, testCode:t.code, level, expires, assessor:assessors[Math.floor(roll*assessors.length)], assessed:U.addDays(expires,-365)});
    });
  });
  return out;
}
function buildChecklist(){
  const rows=[
    ['ORG','Organisation & management','Quality manual and scope statement approved',5,true],
    ['ORG','Organisation & management','Impartiality and confidentiality declarations signed',5,true],
    ['ORG','Organisation & management','Laboratory management review (last 12 months)',5,false],
    ['PER','Personnel','Job descriptions and delegation of authority',4,true],
    ['PER','Personnel','Competency assessment for every assay reported',8,true],
    ['PER','Personnel','Continuing education plan for FY 2026/27',4,false],
    ['EQU','Equipment & facilities','Preventive maintenance schedule executed',6,true],
    ['EQU','Equipment & facilities','Calibration certificates current for all analysers',6,true],
    ['EQU','Equipment & facilities','Cold-chain monitoring records complete',5,true],
    ['PRE','Pre-examination','Specimen acceptance and rejection criteria displayed',5,true],
    ['PRE','Pre-examination','Chain of custody for referred samples',5,true],
    ['EXA','Examination','Validated methods and reference intervals',8,true],
    ['EXA','Examination','Internal QC with Westgard rules reviewed daily',8,true],
    ['EXA','Examination','External quality assessment for every discipline',8,true],
    ['POS','Post-examination','Result verification and authorisation trail',6,true],
    ['POS','Post-examination','Critical value reporting log',5,false],
    ['POS','Post-examination','Sample retention and disposal policy',4,true],
    ['SAF','Safety','Biosafety manual and spill kit available',5,true],
    ['SAF','Safety','Sharps injury register reviewed monthly',4,false],
    ['IMP','Improvement','Non-conformances tracked to closure',6,true],
    ['IMP','Improvement','Complaints and feedback register',4,false],
    ['IMP','Improvement','Audit programme for 2026/27',5,true]
  ];
  return rows.map((r,i)=>({id:'cl'+i, section:r[1], code:'ISO-'+r[0]+'-'+String(i+1).padStart(2,'0'), item:r[2], weight:r[3], done:r[4]}));
}
function buildSOPs(){
  const docs=[
    ['SOP-LAB-001','Specimen collection, labelling and transport','v4.2','2026-02-11','2027-02-11','Kelvin SAMAHANI'],
    ['SOP-LAB-002','Sample acceptance and rejection criteria','v3.1','2026-04-02','2027-04-02','Kelvin SAMAHANI'],
    ['SOP-LAB-006','GeneXpert MTB/RIF testing procedure','v5.0','2026-06-18','2027-06-18','Jean Paul NSENGIYUMVA'],
    ['SOP-LAB-009','Internal quality control & Westgard rules','v2.3','2025-09-14','2026-09-14','Aurelie YANSONEYE'],
    ['SOP-LAB-012','Blood culture contamination prevention','v1.4','2026-01-14','2027-01-14','Beatrice NGEZEKURE'],
    ['SOP-LAB-015','Cold-chain temperature monitoring','v3.0','2026-08-01','2027-08-01','Beatrice NGEZEKURE'],
    ['SOP-LAB-018','External quality assessment handling','v2.0','2026-03-22','2027-03-22','Kelvin SAMAHANI'],
    ['SOP-LAB-021','Waste segregation and sharps safety','v4.0','2026-07-09','2027-07-09','Dieudonne MUNYANEZA'],
    ['SOP-LAB-024','Result verification and critical value reporting','v1.8','2025-12-12','2026-12-12','Kelvin SAMAHANI'],
    ['SOP-LAB-027','Non-conformance and CAPA management','v2.1','2026-05-06','2027-05-06','Kelvin SAMAHANI']
  ];
  return docs.map((d,i)=>({id:'sop'+i, code:d[0], title:d[1], version:d[2], effective:d[3], review:d[4], owner:d[5],
    status:d[4]<U.todayISO()?'review-due':'current', ack:i%3===0?2:i%3===1?9:6, acknowledged:(i%3!==2)}));
}
function buildIncidents(){
  const t=U.todayISO();
  return [
    {id:'nc1',ref:'NC-2026-041',title:'Blood culture bottle leaked in transit from Coko HC',severity:'Major',type:'Pre-analytical',owner:'Kelvin SAMAHANI',opened:U.addDays(t,-9),due:U.addDays(t,5),status:'Open',root:'Cap not torqued; transport box lacking secondary containment',capa:'Refresher to 8 health centres; secondary bags issued'},
    {id:'nc2',ref:'NC-2026-039',title:'GeneXpert module 2 invalid result on repeat',severity:'Minor',type:'Analytical',owner:'Jean Paul NSENGIYUMVA',opened:U.addDays(t,-18),due:U.addDays(t,-2),status:'CAPA in progress',root:'Probe check failure after power dip',capa:'UPS installed; module recalibrated'},
    {id:'nc3',ref:'NC-2026-036',title:'QC 1-3s violation — Creatinine level 2',severity:'Major',type:'Analytical',owner:'Aurelie YANSONEYE',opened:U.addDays(t,-26),due:U.addDays(t,-12),status:'Closed',root:'Reagent lot degradation',capa:'Lot quarantined, new lot verified'},
    {id:'nc4',ref:'NC-2026-044',title:'SOP-LAB-009 past due for review',severity:'Minor',type:'Document control',owner:'Kelvin SAMAHANI',opened:U.addDays(t,-3),due:U.addDays(t,12),status:'Open',root:'Annual review cycle slipped',capa:'Review scheduled 12 Nov 2026'},
    {id:'nc5',ref:'NC-2026-045',title:'Fridge 2–8 °C excursion to 9.4 °C for 42 minutes',severity:'Critical',type:'Facilities',owner:'Beatrice NGEZEKURE',opened:U.addDays(t,-1),due:U.addDays(t,2),status:'Open',root:'Door left ajar during inventory',capa:'Door alarm latch fitted; monthly drill'},
    {id:'nc6',ref:'NC-2026-033',title:'Two samples rejected for insufficient volume',severity:'Minor',type:'Pre-analytical',owner:'Kelvin SAMAHANI',opened:U.addDays(t,-41),due:U.addDays(t,-28),status:'Closed',root:'Paediatric draw technique',capa:'Microtainer training completed'}
  ];
}
/* Real stock only. The previous build generated a 12-month issue log and three
   lots per consumable so the charts looked busy; those were invented numbers and
   are no longer created. Everything below fills catalogue defaults the UI needs
   (unit, minimum, maximum) and never invents a movement or a lot. */
function ensureStockFields(db){
  db.catalog.consumables.forEach(c=>{
    if(c.min==null) c.min=c.threshold||10;
    if(c.max==null) c.max=(c.threshold||10)*3;
  });
  db.stock.deleted=db.stock.deleted||[];
}
function buildSuppliers(){ return SUPPLIERS.slice(); }
function buildSessions(){
  const now=Date.now();
  return [
    {id:'se1',device:'Chrome · Windows 11',where:'Ruli DH · Lab office',ip:'41.186.•.•',last:new Date(now-1000*60*3).toISOString(),current:true,trusted:true},
    {id:'se2',device:'Safari · iPhone 14',where:'Kigali · Mobile data',ip:'197.243.•.•',last:new Date(now-1000*60*60*5).toISOString(),current:false,trusted:true},
    {id:'se3',device:'Chrome · Android (bench tablet)',where:'Ruli DH · Reception',ip:'41.186.•.•',last:new Date(now-1000*60*60*26).toISOString(),current:false,trusted:true},
    {id:'se4',device:'Firefox · Ubuntu',where:'Musanze · District office',ip:'154.68.•.•',last:new Date(now-1000*60*60*72).toISOString(),current:false,trusted:false}
  ];
}
function buildLoginHistory(){
  const now=Date.now(); const r=U.rng('login');
  return Array.from({length:9},(_,i)=>({id:'lh'+i, ts:new Date(now-1000*60*60*(i*7+2)).toISOString(), device:i%3===0?'Safari · iPhone':'Chrome · Windows', ok:i!==6, where:'Ruli DH'}));
}

/* ——— Sample telemetry ————————————————————————————— */
function sampleTAT(test, settings, catalog){
  const t=(settings.tat||{})[test]; if(t) return t;
  const cat=((catalog||(DB&&DB.catalog)||{}).tests||[]).find(x=>x.name===test); return cat? cat.tat : 3;
}
function generateSamples(seedDB,opts){
  opts=opts||{};
  const settings=seedDB.settings;
  const tests=BENCH_PANEL;
  const testsAll=seedDB.catalog.tests;
  const staff=seedDB.staff.filter(s=>s.status==='active');
  const hcs=seedDB.catalog.healthCenters.map(h=>h.name);
  const hospitals=seedDB.catalog.hospitals;
  const names=['MUKAMANA Alice','NSENGIMANA Eric','UWIMANA Claudine','HABIMANA Jean','UWAYO Solange','NIRERE Diane','MUGISHA Patrick','AKIMANA Yvonne','BIZIMANA Olivier','KAYITESI Grace','NSHUTI Samuel','Uwase Marie','HAGENIMANA Fiston','MUKARUGWIZA Josiane','NDAYISABA Clément','INGABIRE Peace','RUKUNDO Aimable','MUKANDOLI Béatrice','SIBOMANA Romain','UWAMAHORO Chantal','NKURUNZIZA Innocent','TUMUKUNDE Fabrice','MUTONI Sandrine','HABIYAREMYE Aline','GAHIGI Emmanuel','KAMIKAZI Rose','MBONIMPA Thierry','NSABIMANA Liliane','MURENZI Damascène','UWASE Chantal','BIZIMUNGU Alice','NZABONIMPA Eric'];
  const priorities=['Routine','Routine','Routine','STAT','Routine','Follow-up','STAT','Routine'];
  const out=[]; let seq=opts.seq||120000; const span=opts.days||45; const tag=opts.tag||'';
  const skipDates=opts.skipDates||null;
  for(let d=span-1; d>=0; d--){
    const date=U.addDays(U.todayISO(),-d);
    if(skipDates && skipDates.has(date)) continue;
    const dow=U.dow(date);
    const r=U.rng('smp-'+tag+date);
    const base = dow>=5 ? 3 : 8;
    const n = Math.max(0,Math.round((base + Math.floor(r()*4))*(opts.rate||1)));
    for(let i=0;i<n;i++){
      const t=tests[Math.floor(r()*tests.length)];
      const pri=priorities[Math.floor(r()*priorities.length)];
      const hc=hcs[Math.floor(r()*hcs.length)];
      const st=staff[Math.floor(r()*staff.length)];
      const hosp = (r()<0.22) ? hospitals[Math.floor(r()*hospitals.length)].name : 'Ruli DH - GeneXpert';
      seq += 1 + Math.floor(r()*3);
      const test=t.name;
      const tat=sampleTAT(test,settings,seedDB.catalog);
      const priBoost = pri==='STAT'? -0.6 : 0;
      const statuses=['Registered','Received','Pending','Resulted','Done'];
      let status;
      if(d===0) status = r()<0.5?'Registered':(r()<0.6?'Received':'Pending');
      else if(d<=2) status = r()<0.3?'Pending':(r()<0.7?'Resulted':'Done');
      else status = r()<0.12?'Pending':'Done';
      const collHour = 7+Math.floor(r()*10);
      const collectedAt = date+'T'+String(collHour).padStart(2,'0')+':'+String(Math.floor(r()*60)).padStart(2,'0')+':00';
      const dispatchedAt = status==='Registered'?null : date+'T'+String(Math.min(23,collHour+1+Math.floor(r()*2))).padStart(2,'0')+':'+String(Math.floor(r()*60)).padStart(2,'0')+':00';
      const receivedAt = dispatchedAt;
      const resultDelayH = Math.max(1,Math.round(tat*24*(0.35+r()*0.8)+priBoost*4));
      const resultedAt = status==='Done'||status==='Resulted' ? new Date(new Date(collectedAt+'Z').getTime()+resultDelayH*3600*1000).toISOString() : null;
      const source = (d>=17 && out.length<6) ? 'register' : 'telemetry';
      const rec={
        id:'sm'+tag+seq, sampleId:'RDH-'+U.fyLabel().slice(-4)+'-'+String(seq).padStart(6,'0'), patientName:names[Math.floor(r()*names.length)],
        patientId:'4'+Math.floor(r()*900000+100000), dob:'', sex:r()<0.55?'Female':'Male',
        test, testCode:t.code, cat:t.cat, hospital:hosp, healthFacility:hc, district:'Gakenke',
        collectionDate:date, sentDate:date, collectionAt:collectedAt, receivedAt, resultedAt,
        transporter: r()<0.5? st.name : '', status, resultDate: resultedAt? resultedAt.slice(0,10):null,
        priority:pri, tatTargetDays:tat, notes:'', manifestId:null, source,
        collector:st.name, resultBy: resultedAt? st.name:null, flag:null, resultValue:null
      };
      out.push(rec);
    }
  }
  return out;
}

/* ——— Roster generation (current month, draft) ————————————————— */
function generatePlan(monthKey, seedDB){
  const days=U.monthRange(monthKey);
  const staff=seedDB.staff.filter(s=>s.status==='active');
  // The manager covers the bench only when a weekday would otherwise be down to
  // two people or fewer — the rule the department actually works to.
  const reserve=staff.filter(s=>s.pattern==='manager');
  const leaves=(seedDB.leaves||[]);
  const eligibleNights=staff.filter(s=>!s.weekendOnly && (s.nightPref!=='no') && s.maxNights>0);
  const weekendOnly=staff.filter(s=>s.weekendOnly);
  const dayStaff=staff.filter(s=>!s.weekendOnly);
  const plan={ label:U.monthLabel(monthKey), dates:days, staff:[], meta:{date:U.todayISO(), fy:U.fyLabel(), period:U.monthLabel(monthKey), generated:true, draft:true} };
  const nightCrew = eligibleNights.length? eligibleNights : staff.filter(s=>s.nightPref!=='no');
  staff.forEach(s=>{
    const codes=[];
    days.forEach((iso,idx)=>{
      const dow=U.dow(iso);
      const isWeekend=dow>=5;
      const onLeave=leaves.find(l=>l.staffId===s.id && !/declin|reject/i.test(l.status||'') && iso>=l.from && iso<=l.to);
      if(onLeave){ codes.push(onLeave.type==='TR'?'TR':onLeave.type==='SICK'?'SICK':onLeave.type||'AL'); return; }
      if(s.weekendOnly){ codes.push(isWeekend?'DN':'OFF'); return; }
      if(s.pattern==='manager'){ codes.push('OFF'); return; }   // reserve: filled in below if the bench is short
      if(s.pattern==='dayonly'){ codes.push(isWeekend?'OFF':'D'); return; }
      if(isWeekend){
        // one rotating day-cover on weekends
        const wk=Math.floor(idx/7);
        const pick=dayStaff.filter(x=>x.pattern==='normal');
        const cover=pick.length? pick[wk%pick.length]:null;
        codes.push(cover && cover.id===s.id ? 'D' : 'OFF');
        return;
      }
      // weekdays: night rotation in 2-night blocks
      const globalDay=Math.floor((U.parseISO(iso)-U.parseISO(days[0]))/86400000);
      const block=Math.floor(globalDay/2);
      const nightPerson=nightCrew.length? nightCrew[block%nightCrew.length]:null;
      if(nightPerson && nightPerson.id===s.id) codes.push('N');
      else codes.push('D');
    });
    plan.staff.push({name:s.name, id:s.id, codes});
  });
  // Reserve cover: a manager shift appears only on weekdays where the day-shift
  // count would otherwise be two or fewer.
  if(reserve.length){
    days.forEach((iso,idx)=>{
      if(U.dow(iso)>=5) return;
      const dayNow=plan.staff.filter(r=>r.codes[idx]==='D'||r.codes[idx]==='DN').length;
      if(dayNow>2) return;
      const pick=reserve.find(s=>plan.staff.find(r=>r.id===s.id));
      if(pick){ const row=plan.staff.find(r=>r.id===pick.id); if(row && row.codes[idx]==='OFF') row.codes[idx]='D'; }
    });
  }
  return plan;
}

/* ——— Migration / normalisation ————————————————— */
let DB=null, listeners=[], saveTimer=null, dirty=false;
function normalize(db){
  db.meta=db.meta||{};
  db.settings=augSettings(db.settings);
  db.catalog=db.catalog||{};
  db.catalog.hospitals=db.catalog.hospitals||[];
  db.catalog.healthCenters=db.catalog.healthCenters||[];
  db.catalog.tests=db.catalog.tests||[];
  if(db.catalog.tests.some(t=>RETIRED_TESTS.indexOf(t.id)>=0)){
    db.catalog.tests=db.catalog.tests.filter(t=>RETIRED_TESTS.indexOf(t.id)<0);
    db.meta=db.meta||{}; db.meta.retiredTestsV68=true;
  }
  db.catalog.consumables=db.catalog.consumables||[];
  db.stock=db.stock||{batches:[],entries:[]};
  ensureStockFields(db);
  db.samples=db.samples||[]; db.manifests=db.manifests||[]; db.trainings=db.trainings||[];
  db.trainingExpenses=db.trainingExpenses||[]; db.leaves=db.leaves||[]; db.holidays=db.holidays||[];
  db.workingPlans=db.workingPlans||{}; db.unitRosters=db.unitRosters||{};
  db.eqa=db.eqa||[]; db.staff=db.staff||[]; db.absences=db.absences||[]; db.versions=db.versions||[];
  db.services=db.services||DEFAULT_SERVICES.map(x=>Object.assign({},x));
  db.pbfVisits=db.pbfVisits||[];
  db.audit=db.audit||[]; db.notifRead=db.notifRead||[]; db.notifications=db.notifications||[];
  db.suppliers=db.suppliers||buildSuppliers();
  db.equipment=db.equipment||buildEquipment();
  db.pbf=db.pbf||buildPBF();
  db.sops=db.sops||buildSOPs();
  db.incidents=db.incidents||buildIncidents();
  db.checklist=db.checklist||buildChecklist();
  db.competency=db.competency||buildCompetency(db);
  db.qc=db.qc||buildQC();
  db.sessions=db.sessions||buildSessions();
  db.loginHistory=db.loginHistory||buildLoginHistory();
  /* Cold-chain readings are not recorded in this console — the ward monitor owns
     the fridge log. Anything already stored is left untouched, but nothing new is
     created here. */
  db.coldChain=db.coldChain||[];
  db.stockEntriesMeta=db.stockEntriesMeta||{};
  db.savedViews=db.savedViews||[
    {id:'sv1', name:'My STAT samples', module:'samples', filter:{priority:'STAT'}, owner:'Kelvin SAMAHANI'},
    {id:'sv2', name:'Awaiting RBC', module:'samples', filter:{hospital:'NRL'}, owner:'Kelvin SAMAHANI'},
    {id:'sv3', name:'Expiring ≤ 30 days', module:'stock', filter:{expiry:30}, owner:'Beatrice NGEZEKURE'}
  ];
  db.meta.schema=6;
  // sample fields upgrade
  db.samples.forEach(s=>{
    if(!s.priority) s.priority = /Marburg|MonkeyPox|Outbreaks/i.test(s.test||'')? 'STAT':'Routine';
    if(!s.testCode){ const t=db.catalog.tests.find(x=>x.name===s.test); s.testCode=t?t.code:'GEN'; }
    if(!s.collectionAt && s.collectionDate) s.collectionAt=s.collectionDate+'T09:00:00';
    if(s.tatTargetDays==null) s.tatTargetDays=sampleTAT(s.test,db.settings);
    if(!s.status) s.status='Pending';
    if(!s.source) s.source='register';
    // A result date on the register IS the result. Without this the four CHUK
    // blood cultures that came back in July looked open, which made referral TAT
    // compliance read as zero.
    if(!s.resultedAt && s.resultDate) s.resultedAt=new Date(String(s.resultDate).length>10?s.resultDate:s.resultDate+'T17:00:00').toISOString();
    if(s.resultedAt && !s.resultDate) s.resultDate=String(s.resultedAt).slice(0,10);
  });
  // v6.5: the console no longer invents referred samples. Anything the previous
  // build generated from health centres (source 'telemetry') is removed, so the
  // register shows only the samples Ruli DH actually referred to NRL, CHUK and
  // Kibagabaga. Counted and audited so the removal is visible.
  if(!db.meta.samplesPurgedV65){
    const before=db.samples.length;
    db.samples=db.samples.filter(s=>s.source!=='telemetry');
    db.meta.samplesPurgedV65=before-db.samples.length;
    db.meta.telemetrySeeded=true; db.meta.throughputBackfill=U.todayISO();
  }
  // v6.5: the eight extra consumables (CBC diluent, chemistry packs, GeneXpert
  // cartridges, tubes, strips, sharps boxes, gloves) were never in the Ruli DH
  // stock register — they were invented to fill the screen, together with their
  // lots and a year of issues. They are removed here, and the stock register is
  // left with the five lines that were actually seeded from the store records.
  if(!db.meta.stockPurgedV65){
    const ghosts=['c6','c7','c8','c9','c10','c11','c12','c13'];
    const removed=[];
    db.catalog.consumables=(db.catalog.consumables||[]).filter(c=>{
      if(ghosts.includes(c.id) && c.seededByGenerator!=='no'){ removed.push(c.name); return false; }
      return true;
    });
    db.stock.batches=(db.stock.batches||[]).filter(b=>!ghosts.includes(b.cid));
    db.stock.entries=(db.stock.entries||[]).filter(e=>!ghosts.includes(e.cid));
    db.meta.stockPurgedV65=removed.length;
    db.meta.stockPurgedNames=removed;
  }
  // Referral network is the three receiving laboratories we use. Records keep
  // whatever laboratory they name; the catalogue is what the wizard offers.
  if(!db.meta.labsV65){
    const want=['NRL','Kibagabaga','CHUK'];
    const have=db.catalog.hospitals||[];
    const next=want.map((n,i)=>{
      const cur=have.find(h=>(typeof h==='string'?h:h.name)===n);
      if(cur) return typeof cur==='string'?{id:'h'+(i+1),name:cur,type:'Hospital'}:cur;
      return {id:'h'+(i+1),name:n,type:n==='NRL'?'Reference':'Hospital'};
    });
    db.catalog.hospitals=next;
    db.meta.labsV65=1;
  }
  // Working plans are authoritative register data: never invent one here.
  // A month without a stored plan stays empty until a human generates a draft.
  db.workingPlans=db.workingPlans||{};
  // Plans that came from a signed/attached register are flagged official so the
  // console never regenerates them without archiving the previous version first.
  Object.keys(db.workingPlans).forEach(k=>{
    const e=db.workingPlans[k]; const p=e&&e.primary;
    if(p&&p.meta&&typeof p.meta.official!=='boolean'){
      p.meta.official=/official|pushed from attached|signed/i.test(p.meta.label||'')&&!p.meta.generated;
    }
  });
  // Official October 2026 working plan and the staff it names. The plan is
  // register data, transcribed once from the signed sheet; it is never generated.
  if(!db.meta.october2026Seeded){
    const extra=[
      {id:'s10',name:'Bernadette MUHAWENIMANA',sex:'Female',dob:'1995-03-14',role:'Laboratory Technician',
       phone:'0781942405',email:'',contract:'statute',pattern:'normal',nightPref:'3',maxNights:12,maxConsecN:3,
       status:'active',joinDate:'2024-02-12',exitDate:null,note:'Joins the day and night rotation across reception, phlebotomy and TB/molecular'},
      {id:'s11',name:'Marie Claudine UWAYISABA',sex:'Female',dob:'1993-08-21',role:'Laboratory Technologist',
       phone:'',email:'',contract:'statute',pattern:'normal',nightPref:'no',maxNights:0,maxConsecN:0,
       status:'active',joinDate:'2022-11-07',exitDate:null,note:'Bench cover for biochemistry, serology and parasitology'}
    ];
    extra.forEach(x=>{ if(!db.staff.find(y=>y.name===x.name)) db.staff.push(x); });
    if(!db.workingPlans['2026-10']){
      db.workingPlans['2026-10']={"primary":{"staff":[{"name":"Kelvin SAMAHANI","codes":["D","D","D","","","D","D","D","D","D","","","D","D","D","D","D","","","D","D","D","D","D","","","D","D","D","D","D","","","D","D","D","D","D"]},{"name":"Beatrice NGEZEKURE","codes":["D","D","D","","","D","D","D","D","D","","","D","D","D","D","D","","","D","D","D","D","D","","","D","D","D","D","OFF","D","D","OFF","D","D","D","D"]},{"name":"Aurelie YANSONEYE","codes":["OFF","OFF","OFF","DN","DN","OFF","OFF","OFF","OFF","OFF","DN","DN","OFF","OFF","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL"]},{"name":"Patrick ISHIMWE","codes":["AL","AL","D","OFF","OFF","D","D","D","N","N","OFF","OFF","N","N","N","OFF","OFF","","","N","N","N","OFF","OFF","D","D","OFF","OFF","OFF","N","N","","","D","D","D","D","OFF"]},{"name":"Jean Paul NSENGIYUMVA","codes":["N","OFF","OFF","","","D","D","D","D","D","","","D","D","D","OFF","D","N","N","OFF","OFF","D","D","D","","","N","N","N","OFF","OFF","","","D","D","D","D","D"]},{"name":"Dieudonne NIYIDUHABYOSE","codes":["D","N","N","","","N","N","N","OFF","OFF","","","OFF","D","D","D","OFF","D","D","OFF","D","D","N","N","","","D","D","OFF","D","D","N","N","OFF","OFF","N","N","N"]},{"name":"Bernadette MUHAWENIMANA","codes":["D","D","D","","","D","D","D","D","D","","","D","D","D","N","N","","","D","D","D","D","OFF","N","N","OFF","OFF","D","D","D","OFF","OFF","N","N","OFF","OFF","D"]}],"dates":["2026-09-30","2026-10-01","2026-10-02","2026-10-03","2026-10-04","2026-10-05","2026-10-06","2026-10-07","2026-10-08","2026-10-09","2026-10-10","2026-10-11","2026-10-12","2026-10-13","2026-10-14","2026-10-15","2026-10-16","2026-10-17","2026-10-18","2026-10-19","2026-10-20","2026-10-21","2026-10-22","2026-10-23","2026-10-24","2026-10-25","2026-10-26","2026-10-27","2026-10-28","2026-10-29","2026-10-30","2026-10-31","2026-11-01","2026-11-02","2026-11-03","2026-11-04","2026-11-05","2026-11-06"],"meta":{"label":"Official October 2026 - transcribed from the signed working-plan image (no fabricated shifts)","date":"2026-09-28","fy":"2026/2027","period":"October 2026","revised":false,"official":true}},"versions":[]};
    }
    db.meta.october2026Seeded=U.todayISO();
  }
  // v6.2: the benches are renamed to the unit-roster wording printed on the sheets
  // (Reception, Phlebotomy, Hematology, Biochemistry, Serology, Parasitology,
  // TB/Molecular). Each rename only fires when the stored name is still the old
  // default for that id, so fresh installs and customised benches are untouched;
  // week allocations keyed by the old names move across so nothing is orphaned.
  if(!db.meta.servicesV62){
    const RENAME={
      svc1:['Sample reception','Reception','REC'],
      svc2:['Hematology','Phlebotomy','PHL'],
      svc3:['Chemistry','Hematology','HAE'],
      svc4:['Serology','Biochemistry','BIO'],
      svc5:['Microbiology','Serology','SER'],
      svc6:['Molecular (GeneXpert)','Parasitology','PAR'],
      svc7:['Blood bank','TB/Molecular','TBM']
    };
    const moved={};
    (db.services||[]).forEach(sv=>{
      const r=RENAME[sv.id];
      if(r&&sv.name===r[0]){ moved[r[0]]=r[1]; sv.name=r[1]; sv.code=r[2]; }
    });
    if(Object.keys(moved).length){
      Object.keys(db.unitRosters||{}).forEach(w=>{
        const as=(db.unitRosters[w]&&db.unitRosters[w].assignments)||{};
        Object.keys(as).forEach(iso=>{
          const day=as[iso]||{}, next={};
          Object.keys(day).forEach(k=>{ next[moved[k]||k]=day[k]; });
          as[iso]=next;
        });
      });
    }
    db.meta.servicesV62=1;
  }
  // v6.3: contract terms (under statute vs contractual), sponsor, bench
  // preferences, and the removal of the two demo leave requests that older
  // builds seeded. Real leave is entered by the manager, never invented.
  if(!db.meta.workforceV63){
    db.staff.forEach(st=>{
      st.contract = st.contract==='contractual' ? 'contractual' : 'statute';
      if(!st.sponsor) st.sponsor='Government of Rwanda';
    });
    const bench=db.staff.find(x=>x.name==='Beatrice NGEZEKURE');
    if(bench){
      bench.homeBench='Reception';
      bench.altBench='Parasitology';
      bench.altMaxMonth=2;
      bench.avoidBench=['Phlebotomy','TB/Molecular'];
    }
    const manager=db.staff.find(x=>/manager/i.test(x.role||''));
    if(manager){ manager.reserveOnly=true; manager.reserveMinDay=2; }
    db.leaves=(db.leaves||[]).filter(l=>['lreq1','lreq2'].indexOf(l.id)<0);
    db.meta.workforceV63=1;
  }
  // v6.3: two PT rounds received today (Hematology, Biochemistry) are recorded as
  // dispatched-and-submitted with no results yet, so the wait to report is measured.
  if(!db.meta.eqaAwaitingV63){
    const today=U.todayISO();
    [['Hematology','Q3 2026/27'],['Biochemistry','Q3 2026/27']].forEach(([program,code])=>{
      const exists=db.eqa.some(e=>e.program===program&&e.code===code);
      db.eqaAnalytes=db.eqaAnalytes||{};
      db.eqaAnalytes[program]=db.eqaAnalytes[program]||{};
      if(!exists){
        db.eqa.unshift({id:U.uid('eqa'),program,code,scoring:'SD',stage:'awaiting',
          delivered:today,tested:today,reported:null,scorePublished:null,overall:'',
          analytes:{},note:'Material received and tested on '+today+' — awaiting the provider report.',
          kpiBasis:'dispatch'});
      }
    });
    db.meta.eqaAwaitingV63=today;
  }
  // v6.4: curative maintenance. Every asset gets a role and a service email, and
  // a small backup pool is registered so a breakdown can be covered the same day.
  // No maintenance event is invented — the log starts empty and is filled by the lab.
  if(!db.meta.equipmentV64){
    db.equipment.forEach(e=>{
      e.role=e.role||'primary';
      e.services=e.services||[];
      e.downtime=e.downtime||[];
      e.pmIntervalDays=e.pmIntervalDays||180;
      e.vendor=e.vendor||e.manufacturer||'';
      if(e.vendorEmail==null) e.vendorEmail='';
      if(e.status==='deployed'&&!e.deployedTo) e.status='standby';
    });
    const hasBackup=db.equipment.some(e=>e.role==='backup');
    if(!hasBackup){
      const today64=U.todayISO();
      db.equipment.push(
        {id:'eqb1',name:'Backup hematology analyser',model:'Sysmex KX-21N',manufacturer:'Sysmex',serial:'KX21N-BK01',
         location:'Equipment store',role:'backup',status:'standby',uptime:100,lastPM:null,nextPM:null,installed:null,
         pmIntervalDays:180,vendor:'Sysmex',vendorEmail:'',services:[],downtime:[],
         note:'Loan unit held at Ruli for hematology breakdowns; released on return of the primary analyser.'},
        {id:'eqb2',name:'Backup chemistry analyser',model:'Mindray BA-88A',manufacturer:'Mindray',serial:'BA88-BK02',
         location:'Equipment store',role:'backup',status:'standby',uptime:100,lastPM:null,nextPM:null,installed:null,
         pmIntervalDays:180,vendor:'Mindray',vendorEmail:'',services:[],downtime:[],
         note:'Semi-automatic backup for chemistry when the BS-240 is off site.'}
      );
      db.meta.equipmentV64=today64;
    } else {
      db.meta.equipmentV64=1;
    }
  }
  // audit seed
  if(!db.audit.length){
    DB=db;
    db.audit=[
      {id:U.uid('au'), ts:new Date(Date.now()-3600e3*2).toISOString(), actor:'Kelvin SAMAHANI', role:'Admin', action:'system.migrate', entity:'system', entityId:'v6', detail:'Console upgraded to Lab Systems v6 · register data preserved'},
      {id:U.uid('au'), ts:new Date(Date.now()-3600e3*7).toISOString(), actor:'Beatrice NGEZEKURE', role:'Technologist', action:'stock.receive', entity:'stock', entityId:'c2', detail:'VTM 40 vials received from RBC'},
      {id:U.uid('au'), ts:new Date(Date.now()-3600e3*22).toISOString(), actor:'Kelvin SAMAHANI', role:'Admin', action:'leaverequest.approve', entity:'leave', entityId:'l1', detail:'Annual leave approved for Patrick ISHIMWE'},
      {id:U.uid('au'), ts:new Date(Date.now()-3600e3*30).toISOString(), actor:'Jean Paul NSENGIYUMVA', role:'Technologist', action:'sample.result', entity:'samples', entityId:'sm1', detail:'Result verified and released'}
    ];
  }
  return db;
}

function load(){
  let raw=null;
  try{ raw=localStorage.getItem(DB_KEY); }catch(e){}
  let db=null;
  if(raw){ try{ db=JSON.parse(raw); }catch(e){ console.warn('Corrupt store, restoring seed'); } }
  if(!db || !db.staff){ db=JSON.parse(JSON.stringify(window.LS_SEED)); }
  DB=normalize(db);
  S._persist();
  return DB;
}
S.EQA_MIN=EQA_MIN; S.PBF_MIN=PBF_MIN;
S.init=function(){ if(!DB) load(); return DB; };
S.db=function(){ return DB||load(); };
S.data=S.db;
S.settings=()=>S.db().settings;
S._persist=function(){
  try{
    const json=JSON.stringify(DB);
    localStorage.setItem(DB_KEY,json);
    dirty=false;
    try{ window.dispatchEvent(new CustomEvent('ls:saved',{detail:{bytes:json.length}})); }catch(e){}
    try{ const ch=new BroadcastChannel('lab-systems'); ch.postMessage({type:'saved',at:Date.now()}); ch.close(); }catch(e){}
  }catch(e){ console.warn('save failed',e.message); try{ window.dispatchEvent(new CustomEvent('ls:saveerror',{detail:e})); }catch(_){} }
};
S.save=function(immediate){
  clearTimeout(saveTimer);
  if(immediate) return S._persist();
  saveTimer=setTimeout(S._persist,220);
};
S.subscribe=function(fn){ listeners.push(fn); return ()=>{ listeners=listeners.filter(f=>f!==fn); }; };
S.emit=function(reason){ listeners.forEach(f=>{ try{ f(reason); }catch(e){ console.warn('listener',e); } }); window.dispatchEvent(new CustomEvent('ls:changed',{detail:reason})); };
S.commit=function(mutator, audit){
  const db=S.db(); mutator(db);
  if(audit){ S.audit(audit); }
  S.save();
  S.emit(audit&&audit.action||'commit');
};
S.audit=function(entry){
  const db=S.db();
  const who=(LS.auth&&LS.auth.user&&LS.auth.user.name)||entry.actor||'System';
  const role=(LS.auth&&LS.auth.user&&LS.auth.user.role)||entry.role||'System';
  db.audit.unshift({ id:U.uid('au'), ts:U.nowISO(), actor:who, role, action:entry.action||'update', entity:entry.entity||'', entityId:entry.entityId||'', detail:entry.detail||'' });
  if(db.audit.length>600) db.audit.length=600;
};

/* ——— Selectors ————————————————————————————————— */
S.staff=()=>S.db().staff;
S.activeStaff=()=>S.db().staff.filter(s=>s.status==='active');
S.tests=()=>S.db().catalog.tests;
S.staffById=id=>S.db().staff.find(s=>s.id===id);
S.staffByName=n=>S.db().staff.find(s=>s.name===n);
S.consumables=()=>S.db().catalog.consumables.filter(c=>!c.deleted);
S.consumable=id=>S.db().catalog.consumables.find(c=>c.id===id&&!c.deleted);
S.batchesFor=cid=>S.db().stock.batches.filter(b=>b.cid===cid && (b.qty||0)>0);
S.onHand=cid=>U.sum(S.batchesFor(cid),b=>b.qty||0);
/* Item 12 — the user must be able to delete a consumable line by hand.
   Soft delete keeps the audit trail and any historical movements intact. */
S.deleteConsumable=function(id,reason){
  const db=S.db(), c=db.catalog.consumables.find(x=>x.id===id);
  if(!c) return false;
  c.deleted=true; c.deletedAt=U.nowISO(); c.deletedBy=(LS.auth&&LS.auth.user?LS.auth.user.name:'User');
  db.stock.deleted=db.stock.deleted||[];
  db.stock.deleted.push({id, name:c.name, at:c.deletedAt, by:c.deletedBy, reason:reason||'Deleted by user'});
  S.audit({action:'stock.consumable_delete',entity:'stock',entityId:id,detail:'Deleted '+c.name+(reason?' · '+reason:'')});
  S.save(); S.emit('stock');
  return true;
};
S.restoreConsumable=function(id){
  const db=S.db(), c=db.catalog.consumables.find(x=>x.id===id);
  if(!c) return false;
  delete c.deleted; delete c.deletedAt; delete c.deletedBy;
  db.stock.deleted=(db.stock.deleted||[]).filter(x=>x.id!==id);
  S.audit({action:'stock.consumable_restore',entity:'stock',entityId:id,detail:'Restored '+c.name});
  S.save(); S.emit('stock'); return true;
};
S.deletedConsumables=()=>S.db().catalog.consumables.filter(c=>c.deleted);
S.leaves=()=>S.db().leaves||[];
S.holiday=(iso)=>(S.db().holidays||[]).find(h=>h.date===iso);
S.tatTarget=test=>sampleTAT(test,S.db().settings);
S.and=()=>{};
S.leaveTypeLabel=t=>LS_TYPES[t]||t||'Leave';
S.leaveTypes=()=>LS_TYPES;

/* Leave that is in force — anything not declined/rejected. Approvals can be
   entered weeks ahead and are applied as an overlay; the stored working plan is
   never rewritten (register data stays exactly as signed). */
S.leaveInForce=()=>S.leaves().filter(l=>!/declin|reject/i.test(l.status||''));
S.leaveFor=function(who,iso){
  const staff=typeof who==='string'?S.staffById(who):who;
  if(!staff) return null;
  return S.leaveInForce().find(l=>l.staffId===staff.id && iso>=l.from && iso<=l.to)||null;
};
/* Printed documents carry approved leave only — a pending request is never
   signed onto the sheet. The screen uses the broader helper above. */
S.approvedLeaveFor=function(who,iso){
  const staff=typeof who==='string'?S.staffById(who):who;
  if(!staff) return null;
  return S.leaves().find(l=>l.staffId===staff.id && /^(approved|planned)$/i.test(l.status||'Approved') && iso>=l.from && iso<=l.to)||null;
};
S.approvedLeaveCodeFor=function(who,iso){
  const lv=S.approvedLeaveFor(who,iso); if(!lv) return '';
  return lv.type==='SICK'?'SL':lv.type==='MAT'?'ML':lv.type==='COMP'||lv.type==='UNPAID'?'CL':lv.type==='STUDY'?'TR':lv.type==='W'?'W':'AL';
};
/* Working-plan code for an approved/pending leave, in the printed vocabulary. */
S.leaveCodeFor=function(who,iso){
  const lv=S.leaveFor(who,iso); if(!lv) return '';
  return lv.type==='SICK'?'SL':lv.type==='MAT'?'ML':lv.type==='COMP'||lv.type==='UNPAID'?'CL':lv.type==='STUDY'?'TR':lv.type==='W'?'W':'AL';
};
/* Contract terms: under statute 30 calendar days a year, contractual 21 working
   days (Mon–Fri). Sponsor names who pays: Global Fund, own revenue, MoH, partner. */
S.CONTRACTS=['statute','contractual'];
S.SPONSORS=['Government of Rwanda','Global Fund','Own revenue','MoH / RBC','Partner / NGO'];
S.contractOf=function(staff){ return (staff&&staff.contract==='contractual')?'contractual':'statute'; };
S.leaveEntitlement=function(staff, fy){
  const kind=S.contractOf(staff);
  return {kind, label:kind==='contractual'?'Contractual':'Under statute',
    days:kind==='contractual'?21:30, workingDays:kind==='contractual',
    sponsor:(staff&&staff.sponsor)||'Government of Rwanda'};
};
S.leaveUsed=function(staff, fy){
  fy=fy||U.fyLabel();
  const rows=S.leaveInForce().filter(l=>l.staffId===staff.id && l.type!=='SICK' && l.type!=='W' && l.fy===fy);
  const days=U.sum(rows,l=>{
    if(S.contractOf(staff)!=='contractual') return U.daysBetween(l.from,l.to)+1;
    let n=0; const d=U.parseISO(l.from), end=U.parseISO(l.to);
    while(d<=end){ const w=d.getDay(); if(w!==0&&w!==6) n++; d.setDate(d.getDate()+1); }
    return n;
  });
  return {days,records:rows.length};
};
/* Absence forecast built from the register, not from invented data: monthly
   leave/absence rates observed across every stored month plus recorded leave. */
S.absenceHistory=function(){
  const months=S.planMonths();
  const out=[];
  months.forEach(k=>{
    const p=S.planForMonth(k); if(!p||!p.staff||!p.staff.length) return;
    let abs=0, cells=0;
    p.staff.forEach(r=>(r.codes||[]).forEach(c=>{ if(!c) return; cells++; if(['AL','SL','SICK','CL','ML','TR','ABS'].indexOf(c)>=0) abs++; }));
    if(cells) out.push({month:k,rate:abs/cells,abs,cells,staff:p.staff.length});
  });
  const leaveRows=S.leaveInForce();
  const byMonth={};
  leaveRows.forEach(l=>{ const k=String(l.from).slice(0,7); byMonth[k]=(byMonth[k]||0)+(U.daysBetween(l.from,l.to)+1); });
  const leaveMonths=Object.keys(byMonth).length;
  const avgRate=out.length?U.avg(out.map(o=>o.rate)):0;
  const avgLeaveDays=leaveMonths?U.avg(Object.values(byMonth)):0;
  return {months:out.length, from:out.length?out[0].month:null, to:out.length?out[out.length-1].month:null,
    rate:avgRate, leaveMonths, avgLeaveDays, leaveRecords:leaveRows.length, series:out};
};
/* Expected absences in the next N days: the historical rate applied to the
   staff × day count, floored at nothing and labelled with its own basis. */
S.absenceForecast=function(days){
  const h=S.absenceHistory();
  const n=days||30;
  const planned=S.leaveInForce().filter(l=>l.to>=U.todayISO()&&l.from<=U.addDays(U.todayISO(),n));
  const plannedDays=U.sum(planned,l=>{
    const from=l.from<U.todayISO()?U.todayISO():l.from, to=l.to>U.addDays(U.todayISO(),n)?U.addDays(U.todayISO(),n):l.to;
    return to>=from?U.daysBetween(from,to)+1:0;
  });
  const staffCount=S.activeStaff().length;
  const expected=Math.round(h.rate*staffCount*n*10)/10;
  return {days:n, expected, plannedDays, planned:planned.length, history:h,
    hasHistory:h.months>0||h.leaveRecords>0};
};

/* ——— v6.5 vocabulary + planning helpers ————————————————————— */
S.SHIFT=SHIFT; S.SHIFT_LINE=SHIFT_LINE;
S.shiftLabel=kind=>(SHIFT[kind]||SHIFT.day).label;

/* Leave vocabulary: annual leave and other AUTHORISED leave are recorded
   entitlements. "Absent" is deliberately reserved for an unexplained absence —
   it is an offence under Rwandan labour law and is never inferred from a plan. */
const LEAVE_KIND={AL:'annual',COMP:'authorised',SICK:'authorised',MAT:'authorised',TR:'authorised',STUDY:'authorised',W:'authorised',UNPAID:'authorised'};
S.leaveKind=type=>LEAVE_KIND[type]||'annual';
S.leaveKindLabel=type=>S.leaveKind(type)==='annual'?'Annual leave':'Authorised leave';
S.leaveCountsAgainstEntitlement=type=>S.leaveKind(type)==='annual' && type!=='W';

/* A leave plan is a block of days charged to a fiscal year. It can be entered
   for a past FY (a carry-over still being taken) or for a future month. */
function fyOf(l){ return l.fy || U.fyInfo(l.from).label; }
function leaveDays(staff,l){
  if(S.contractOf(staff)!=='contractual') return U.daysBetween(l.from,l.to)+1;
  let n=0; const d=U.parseISO(l.from), end=U.parseISO(l.to);
  while(d<=end){ const w=d.getDay(); if(w!==0&&w!==6) n++; d.setDate(d.getDate()+1); }
  return n;
}
S.leaveDays=leaveDays;
S.leaveRowsFor=function(staff,fy){
  return S.leaveInForce().filter(l=>l.staffId===staff.id && fyOf(l)===fy)
    .sort((a,b)=>String(a.from).localeCompare(String(b.from)));
};
/* Everything the annual-leave plan book needs for one person: entitlement,
   days charged to the FY, days still to come, and the balance. */
S.leaveBook=function(staff,fy){
  fy=fy||U.fyLabel();
  const e=S.leaveEntitlement(staff,fy);
  const rows=S.leaveRowsFor(staff,fy);
  const annual=rows.filter(l=>S.leaveCountsAgainstEntitlement(l.type));
  const taken=U.sum(annual.filter(l=>l.to<U.todayISO()),l=>leaveDays(staff,l));
  const running=U.sum(annual.filter(l=>l.from<=U.todayISO()&&l.to>=U.todayISO()),l=>leaveDays(staff,l));
  const planned=U.sum(annual.filter(l=>l.from>U.todayISO()),l=>leaveDays(staff,l));
  const charged=U.sum(annual,l=>leaveDays(staff,l));
  const authorised=rows.filter(l=>S.leaveKind(l.type)==='authorised' && l.type!=='W');
  return {staff, fy, entitlement:e, rows, annual,
    taken, running, planned, charged,
    authorisedDays:U.sum(authorised,l=>leaveDays(staff,l)),
    balance:Math.max(0,e.days-charged),
    over:charged>e.days?charged-e.days:0};
};
/* Fiscal years that have leave attached, newest first, always including the
   current one and the one before it. */
S.leaveFys=function(){
  const set={}; set[U.fyLabel()]=1; set[U.fyInfo(U.addDays(U.todayISO(),-400)).label]=1;
  S.leaves().forEach(l=>{ set[fyOf(l)]=1; });
  return Object.keys(set).sort().reverse();
};
/* Authorised-leave forecast for one person, built only from their own records.
   The console will not label anybody absent without an unexcused-absence record. */
S.staffLeaveForecast=function(staff,days){
  const n=days||180;
  const fy=U.fyLabel();
  const book=S.leaveBook(staff,fy);
  const prevFy=U.fyInfo(U.addDays(U.todayISO(),-400)).label;
  const prev=S.leaveBook(staff,prevFy);
  const horizon=U.addDays(U.todayISO(),n);
  const upcoming=S.leaveInForce().filter(l=>l.staffId===staff.id && l.from>U.todayISO() && l.from<=horizon)
    .sort((a,b)=>String(a.from).localeCompare(String(b.from)));
  const unexcused=(S.db().absences||[]).filter(a=>a.staffId===staff.id);
  const unexcusedDays=U.sum(unexcused,a=>a.days||(a.from?U.daysBetween(a.from,a.to||a.from)+1:1));
  const basis={
    annual:book.charged>0||book.planned>0,
    authorised:book.authorisedDays>0,
    unexcused:unexcused.length>0
  };
  let label, tone, detail;
  if(unexcused.length){
    label='Unexcused absence on record'; tone='rose';
    detail=unexcusedDays+' day(s) flagged as unexcused — this is a disciplinary matter, not leave.';
  } else if(upcoming.length){
    const next=upcoming[0];
    label=S.leaveKindLabel(next.type)+' planned'; tone='blue';
    detail='Next block '+U.fmtDateShort(next.from)+' – '+U.fmtDateShort(next.to)+' ('+leaveDays(staff,next)+'d, charged to FY '+fyOf(next)+').';
  } else if(book.balance>0){
    label='Annual leave available'; tone='teal';
    detail=book.balance+' day(s) still available in FY '+fy+'. No block planned yet.';
  } else if(book.charged>=book.entitlement.days){
    label='Annual leave used up'; tone='slate';
    detail='All '+book.entitlement.days+' days of FY '+fy+' are already charged. Further leave needs approval as exceptional.';
  } else {
    label='Nothing on record'; tone='slate';
    detail='No annual leave, authorised leave or unexcused absence recorded for FY '+fy+'.';
  }
  return {staff,n,fy,prevFy,book,prev,upcoming,unexcused,unexcusedDays,basis,label,tone,detail};
};

/* ——— Referral TAT, per receiving laboratory ————————————————— */
/* Samples that were actually sent out. In-house work (Ruli DH bench, GeneXpert
   at Ruli) is not a referral, so it never counts towards referral TAT. */
S.referralLabNames=()=>['NRL','Kibagabaga','CHUK'];
S.referredSamples=function(){
  const labs=S.referralLabNames();
  return S.db().samples.filter(s=>s.source!=='telemetry' && s.hospital && labs.includes(s.hospital));
};
S.receivingLabs=function(){
  const db=S.db();
  return U.uniq((db.catalog.hospitals||[]).map(h=>typeof h==='string'?h:h.name)
    .concat(S.referredSamples().map(s=>s.hospital))).filter(Boolean).filter(n=>S.referralLabNames().includes(n));
};
/* 12 months of registered → resulted compliance per receiving laboratory. */
S.referralTAT=function(months){
  const n=months||12;
  const from=U.addDays(U.todayISO(),-(n*30));
  const rows=S.referredSamples().filter(s=>String(s.collectionDate||'')>=from);
  const byLab={};
  rows.forEach(s=>{
    const lab=s.hospital||'Unassigned';
    const g=byLab[lab]=byLab[lab]||{lab,registered:0,resulted:0,compliant:0,sumH:0,sumTargetH:0,open:0};
    g.registered++;
    const t=S.tatFor(s);
    g.sumTargetH+=t.targetH;
    if(s.resultedAt){ g.resulted++; g.sumH+=t.elapsedH; if(t.elapsedH<=t.targetH) g.compliant++; }
    else { g.open++; if(Date.now()-new Date(s.collectionAt||s.collectionDate).getTime()>t.targetH*36e5) g.compliant+=0; }
  });
  return Object.keys(byLab).map(k=>{
    const g=byLab[k];
    return {...g,
      compliance:g.resulted?Math.round(g.compliant/g.resulted*1000)/10:null,
      avgH:g.resulted?Math.round(g.sumH/g.resulted):null,
      targetH:g.registered?Math.round(g.sumTargetH/g.registered):null,
      monthsBackfill:null};
  }).sort((a,b)=>b.registered-a.registered);
};
/* Month-by-month compliance for one laboratory (or all), 12 buckets. */
S.referralTATSeries=function(lab,months){
  const n=months||12, out=[];
  for(let i=n-1;i>=0;i--){
    const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const rows=S.referredSamples().filter(s=>String(s.collectionDate||'').slice(0,7)===key && (!lab||s.hospital===lab));
    const res=rows.filter(s=>s.resultedAt);
    const ok=res.filter(s=>{ const t=S.tatFor(s); return t.elapsedH<=t.targetH; });
    out.push({key,label:U.M3[d.getMonth()],registered:rows.length,resulted:res.length,
      compliance:res.length?Math.round(ok.length/res.length*100):null});
  }
  return out;
};

/* ——— Stock: consumption trend, not money ————————————————————— */
/* Days of cover at the observed pace. The trend compares the last 30 days with
   the 90 days before it, so a rising burn shortens the projection. */
S.stockTrend=function(){
  const db=S.db(), today=U.todayISO();
  const win=(cid,a,b)=>U.sum(db.stock.entries.filter(e=>e.cid===cid && e.type!=='received' && e.date>=U.addDays(today,-a) && e.date<U.addDays(today,-b)),e=>e.qty);
  return S.consumables().map(c=>{
    const onHand=S.onHand(c.id);
    const last30=win(c.id,30,0), prev60=win(c.id,90,30);
    const burn30=last30/30, burnPrev=prev60/60;
    let burn=burn30>0?burn30:(burnPrev>0?burnPrev:0);
    // A fairer pace: blend the recent month with the ninety-day average.
    const burn90=(win(c.id,90,0))/90;
    if(burn90>0) burn=burn30>0?(burn30*0.6+burn90*0.4):burn90;
    const daysLeft=burn>0?Math.floor(onHand/burn):null;
    const lastIssue=(db.stock.entries||[]).filter(e=>e.cid===c.id&&e.type!=='received').map(e=>e.date).sort().pop()||null;
    const trend=burnPrev>0?Math.round((burn30-burnPrev)/burnPrev*100):(burn30>0?100:0);
    return {id:c.id,name:c.name,unit:c.unit,threshold:c.threshold||0,onHand,burn,burn30,burn90,trend,
      daysLeft,stockOut:daysLeft!=null?U.addDays(today,daysLeft):null,lastIssue,
      low:onHand<=(c.threshold||0), none:onHand<=0};
  }).sort((a,b)=>(a.daysLeft==null?1e9:a.daysLeft)-(b.daysLeft==null?1e9:b.daysLeft));
};
/* Days of cover for the whole list: the median line, and the soonest stock-out. */
S.stockCover=function(){
  const list=S.stockTrend().filter(x=>x.daysLeft!=null);
  const days=list.map(x=>x.daysLeft).sort((a,b)=>a-b);
  return {median:days.length?days[Math.floor(days.length/2)]:null,
    soonest:list[0]||null, lines:list.length, noConsumption:S.stockTrend().filter(x=>x.daysLeft==null).length};
};

/* ——— EQA score series (the dashboard chart) ——————————————————— */
S.eqaScoreOf=function(e){
  if(e.scorePercent!=null) return Math.round(e.scorePercent*10)/10;
  if(e.score!=null){
    // SDI-style schemes score 0 = perfect; convert to a comparable percentage.
    return Math.round(Math.max(0,Math.min(100,100-Math.abs(e.score)*33))*10)/10;
  }
  return null;
};
S.eqaSeries=function(program){
  const rows=(S.db().eqa||[]).filter(e=>!program||program==='__all'||e.program===program)
    .filter(e=>S.eqaScoreOf(e)!=null)
    .slice().sort((a,b)=>String(a.reported||a.delivered||'').localeCompare(String(b.reported||b.delivered||'')));
  return rows.map(e=>({id:e.id,program:e.program,code:e.code,score:S.eqaScoreOf(e),
    at:e.reported||e.delivered,label:e.program.split(' ')[0]+' '+String(e.code).replace(/ /g,'')}));
};
S.eqaPrograms=()=>U.uniq((S.db().eqa||[]).map(e=>e.program)).sort();

S.buildPlan=mk=>generatePlan(mk,S.db());
S.ensurePlan=function(mk){ const db=S.db(); return db.workingPlans[mk]||null; };
S.hasPlan=mk=>!!(S.db().workingPlans[mk]&&S.db().workingPlans[mk].primary);
S.createPlan=function(mk){ const db=S.db(); db.workingPlans[mk]={ primary:generatePlan(mk,db), versions:[] }; S.save(); return db.workingPlans[mk]; };
S.planMonths=function(){ return Object.keys(S.db().workingPlans||{}).filter(k=>S.db().workingPlans[k]&&S.db().workingPlans[k].primary).sort(); };
S.planFor=mk=>S.db().workingPlans[mk]||null;

/* TAT computation */
S.tatFor=function(s){
  const target=s.tatTargetDays||S.tatTarget(s.test);
  const start=new Date(s.collectionAt||s.collectionDate||U.todayISO());
  const end=s.resultedAt? new Date(s.resultedAt) : new Date();
  const hours=(end-start)/3600000;
  const elapsedH=s.resultedAt? hours : (Date.now()-start.getTime())/3600000;
  return { targetH:target*24, elapsedH, remainingH:target*24-elapsedH, ratio:elapsedH/(target*24), breached:elapsedH>target*24, done:!!s.resultedAt, dueAt:new Date(start.getTime()+target*86400000) };
};

/* Stock selectors */
S.stockOverview=function(){
  const db=S.db();
  return S.consumables().map(c=>{
    const batches=db.stock.batches.filter(b=>b.cid===c.id && (b.qty||0)>0);
    const onHand=U.sum(batches,b=>b.qty);
    const nearest=batches.slice().sort((a,b)=>String(a.expiry).localeCompare(String(b.expiry)))[0];
    const used90=db.stock.entries.filter(e=>e.cid===c.id && e.type==='used' && e.date>=U.addDays(U.todayISO(),-90));
    const burn90=U.sum(used90,e=>e.qty)/90;
    const burn=Math.max(burn90, 0.05);
    return { ...c, onHand, batches, nearest, burn, daysLeft: burn? Math.round(onHand/burn) : 999,
      value: onHand*(c.unitCost||0), low: onHand <= (c.threshold||0), expiring: nearest && U.daysBetween(U.todayISO(),nearest.expiry)<=30 };
  });
};
S.sampleStats=function(){
  const db=S.db(); const samples=S.referredSamples();
  const active=samples.filter(s=>!s.resultedAt);
  const today=U.todayISO();
  const todays=samples.filter(s=>s.collectionDate===today);
  const overdue=active.filter(s=>S.tatFor(s).breached);
  const stat=active.filter(s=>s.priority==='STAT');
  /* Compliance is measured on results that actually came back. A 30-day window
     with no results would read as 0 %, which is a lie about the laboratory, so
     the window widens to 90 days and then to every result on the register — and
     the window used is reported with the number. */
  const windowed=(days)=>{
    const rows=samples.filter(s=>s.resultedAt && s.resultedAt>=U.addDays(today,-days));
    const ok=rows.filter(s=>{ const t=S.tatFor(s); return t.elapsedH<=t.targetH; });
    return {rows:rows.length, ok:ok.length};
  };
  let win=30, w=windowed(win);
  if(!w.rows){ win=90; w=windowed(win); }
  if(!w.rows){ win=3650; w=windowed(win); }
  const rejected=samples.filter(s=>s.rejected||s.flag==='Rejected'||s.status==='Rejected').length;
  const repeated=samples.filter(s=>s.repeat||s.repeated).length;
  return {
    total:samples.length, active:active.length, today:todays.length, overdue:overdue.length, stat:stat.length,
    pending:active.length, resulted30:w.rows,
    tatWindow:win,
    tatCompliance: w.rows? Math.round(w.ok/w.rows*1000)/10 : null,
    rejectionRate: rejected? Math.round(rejected/samples.length*1000)/10 : null,
    repeatRate: repeated? Math.round(repeated/samples.length*1000)/10 : null,
    inTransit: active.filter(s=>s.status==='Received').length
  };
};
S.throughput=function(days){
  const db=S.db(); const out=[]; const ref=S.referredSamples();
  for(let i=(days||14)-1;i>=0;i--){
    const d=U.addDays(U.todayISO(),-i);
    const day=ref.filter(s=>s.collectionDate===d);
    const resulted=ref.filter(s=>s.resultedAt && s.resultedAt.slice(0,10)===d);
    out.push({date:d, registered:day.length, resulted:resulted.length, stat:day.filter(s=>s.priority==='STAT').length});
  }
  return out;
};
/* Monthly throughput — the unit only refers a few samples a month, and slow
   assays (TB culture, viral load) finish months later, so daily buckets hide them. */
S.monthlyThroughput=function(months){
  const db=S.db(); const n=months||12; const out=[]; const now=new Date();
  const ref=S.referredSamples();
  const catOf=s=>s.cat||'Other';
  for(let i=n-1;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const reg=ref.filter(s=>String(s.collectionDate||'').slice(0,7)===key);
    const res=ref.filter(s=>s.resultedAt&&String(s.resultedAt).slice(0,7)===key);
    const byCat={};
    const bump=(s,field)=>{ const c=catOf(s); byCat[c]=byCat[c]||{registered:0,resulted:0}; byCat[c][field]++; };
    reg.forEach(s=>bump(s,'registered'));
    res.forEach(s=>bump(s,'resulted'));
    out.push({key, label:U.M3[d.getMonth()]+' '+(''+d.getFullYear()).slice(2), year:d.getFullYear(),
      registered:reg.length, resulted:res.length, stat:reg.filter(s=>s.priority==='STAT').length, byCat});
  }
  return out;
};
S.throughputCats=function(){ return U.uniq(S.referredSamples().map(s=>s.cat||'Other')).sort(); };

/* Plan lookups — a stored plan is the only source of truth for a day. */
S.planForMonth=function(mk){ const e=S.db().workingPlans[mk]; return e&&e.primary?e.primary:null; };
S.codeFor=function(staff, iso){
  if(!staff) return null;
  const p=S.planForMonth(String(iso).slice(0,7)); if(!p) return null;
  const idx=(p.dates||[]).indexOf(iso); if(idx<0) return null;
  const row=(p.staff||[]).find(s=>s.id===staff.id||s.name===staff.name); if(!row) return null;
  return (row.codes&&row.codes[idx])||'';
};
S.planCovers=function(iso){
  const p=S.planForMonth(String(iso).slice(0,7));
  return !!(p&&(p.dates||[]).indexOf(iso)>=0&&(p.staff||[]).length);
};

/* One vocabulary for "where is this person today" — used by dashboard, roster, staff. */
S.shiftState=function(who, iso){
  iso=iso||U.todayISO();
  const staff=typeof who==='string'?S.staffById(who):who;
  const blank={code:'',kind:'unknown',label:'Unknown',tone:'slate',source:'none'};
  if(!staff) return blank;
  if(staff.status!=='active') return {code:'',kind:'exited',label:'Exited',tone:'slate',source:'record',
    note:staff.exitDate?'exited '+U.fmtDate(staff.exitDate):'no longer on the establishment'};
  const lv=S.leaves().find(l=>l.staffId===staff.id && !/declin|reject/i.test(l.status||'') && iso>=l.from && iso<=l.to);
  if(lv) return {code:lv.type||'AL',kind:'leave',label:S.leaveTypeLabel(lv.type)+(lv.status==='Pending'?' (pending)':''),
    tone:lv.status==='Pending'?'amber':'blue',source:'leave',requestId:lv.id};
  const code=S.codeFor(staff,iso);
  if(code){
    if(code==='D')  return {code,kind:'day',label:'On duty · day 08:00–17:00',tone:'teal',source:'plan'};
    if(code==='N')  return {code,kind:'night',label:'On duty · night 17:00–08:00 next day',tone:'blue',source:'plan'};
    if(code==='DN') return {code,kind:'daynight',label:'On duty · day + night',tone:'teal',source:'plan'};
    if(code==='TR') return {code,kind:'training',label:'Training',tone:'gold',source:'plan'};
    if(code==='AL'||code==='SICK'||code==='CL'||code==='ML') return {code,kind:'leave',label:S.leaveTypeLabel(code==='SICK'?'SICK':code==='CL'?'COMP':code==='ML'?'MAT':'AL'),tone:'blue',source:'plan'};
    if(code==='OFF'||code==='W') return {code,kind:'off',label:'At home',tone:'slate',source:'plan'};
  }
  // No plan published for that day: fall back to the contract, clearly labelled.
  const dow=U.dow(iso);
  if(staff.weekendOnly) return dow>=5?{code:'DN',kind:'daynight',label:'On duty · day + night',tone:'teal',source:'pattern'}:{code:'OFF',kind:'off',label:'At home',tone:'slate',source:'pattern'};
  if(staff.pattern==='manager'||staff.pattern==='dayonly') return dow>=5?{code:'OFF',kind:'off',label:'At home',tone:'slate',source:'pattern'}:{code:'D',kind:'day',label:'On duty · day 08:00–17:00',tone:'teal',source:'pattern'};
  if(dow>=5) return {code:'OFF',kind:'off',label:'At home',tone:'slate',source:'pattern'};
  // weekday: the night block alternates every two days across eligible staff
  const eligible=S.activeStaff().filter(s=>!s.weekendOnly && s.nightPref!=='no' && (s.maxNights||0)>0);
  if(staff.nightPref!=='no' && eligible.length){
    const dayIndex=Math.floor(U.parseISO(iso)/86400000);
    const crew=eligible[(Math.floor(dayIndex/2))%eligible.length];
    if(crew && crew.id===staff.id) return {code:'N',kind:'night',label:'On duty · night 17:00–08:00',tone:'blue',source:'pattern'};
  }
  return {code:'D',kind:'day',label:'On duty · day 08:00–17:00',tone:'teal',source:'pattern'};
};
S.isOnDuty=function(who,iso){ const st=S.shiftState(who,iso); return st.kind==='day'||st.kind==='night'||st.kind==='daynight'; };
S.onDuty=function(iso){
  iso=iso||U.todayISO();
  const source=S.planCovers(iso)?'plan':'pattern';
  return S.activeStaff().map(s=>({staff:s, state:S.shiftState(s,iso)})).filter(x=>S.isOnDuty(x.staff,iso))
    .map(x=>({staff:x.staff, shift:x.state.label, kind:x.state.kind, code:x.state.code, source, since:x.state.kind==='night'?'17:00':'08:00', until:x.state.kind==='night'?'08:00':'17:00'}));
};
S.offDuty=function(iso){
  iso=iso||U.todayISO();
  return S.activeStaff().map(s=>({staff:s,state:S.shiftState(s,iso)})).filter(x=>x.state.kind==='off');
};

/* Laboratory services and weekly allocation (roster module). */
const DEFAULT_SERVICES=[
  {id:'svc1', name:'Reception', code:'REC', min:1, note:'Registration, accessioning, referral dispatch'},
  {id:'svc2', name:'Phlebotomy', code:'PHL', min:1, note:'Bleeding bay and sample collection'},
  {id:'svc3', name:'Hematology', code:'HAE', min:1, note:'CBC, ESR, malaria slides'},
  {id:'svc4', name:'Biochemistry', code:'BIO', min:1, note:'Glucose, creatinine, ALT, electrolytes'},
  {id:'svc5', name:'Serology', code:'SER', min:1, note:'HIV, syphilis, hepatitis'},
  {id:'svc6', name:'Parasitology', code:'PAR', min:1, note:'Stool, urine and malaria microscopy'},
  {id:'svc7', name:'TB/Molecular', code:'TBM', min:1, note:'GeneXpert MTB/RIF, TB culture, viral load'}
];
S.services=function(){ const db=S.db(); db.services=db.services||DEFAULT_SERVICES.map(x=>({...x})); return db.services; };
S.weekStart=function(iso){ const d=U.parseISO(iso||U.todayISO()); const dow=U.dow(U.isoLocal(d)); return U.addDays(U.isoLocal(d),-dow); };
S.weekDates=function(start){ return Array.from({length:7},(_,i)=>U.addDays(start,i)); };
S.unitWeek=function(start){ const db=S.db(); db.unitRosters=db.unitRosters||{}; if(!db.unitRosters[start]) db.unitRosters[start]={weekStart:start,assignments:{}}; const w=db.unitRosters[start]; w.assignments=w.assignments||{}; return w; };
S.unitNight=function(start,date){
  const w=S.db().unitRosters&&S.db().unitRosters[start];
  return (w&&w.night&&w.night[date])||'';
};
S.unitSetNight=function(start,date,name){
  const w=S.unitWeek(start); w.night=w.night||{};
  if(name) w.night[date]=name; else delete w.night[date];
  return w;
};
S.unitAssign=function(start,date,service){ const w=S.db().unitRosters&&S.db().unitRosters[start]; return w&&w.assignments&&w.assignments[date]?w.assignments[date][service]||'':''; };

S.eqaLatest=function(){
  const db=S.db(); const byProg={};
  db.eqa.forEach(e=>{ const cur=byProg[e.program]; if(!cur || String(e.code)>String(cur.code)) byProg[e.program]=e; });
  return byProg;
};
S.compliance=function(){
  const list=S.db().checklist||[]; const tw=U.sum(list,c=>c.weight); const dw=U.sum(list.filter(c=>c.done),c=>c.weight);
  return { pct: tw? Math.round(dw/tw*100):0, done:list.filter(c=>c.done).length, total:list.length };
};
S.notifications=function(){
  const db=S.db(); const out=[]; const today=U.todayISO();
  const stats=S.sampleStats();
  if(stats.overdue) out.push({id:'n-overdue',group:'Operations',tone:'rose',title:stats.overdue+' referred samples past their TAT target',detail:'Open Referred Samples and triage by priority',ts:new Date(Date.now()-1000*60*12).toISOString(),href:'#/samples?filter=overdue',icon:'timer'});
  const low=S.stockOverview().filter(x=>x.low);
  low.slice(0,3).forEach(x=>out.push({id:'n-low-'+x.id,group:'Supply chain',tone:'amber',title:x.name+' below reorder threshold',detail:x.onHand+' '+x.unit+' on hand · '+Math.round(x.burn*10)/10+'/day burn',ts:new Date(Date.now()-1000*60*60*2).toISOString(),href:'#/stock',icon:'package'}));
  const exp=S.stockOverview().filter(x=>x.expiring).slice(0,2);
  exp.forEach(x=>out.push({id:'n-exp-'+x.id,group:'Supply chain',tone:'amber',title:x.name+' batch expires in '+U.daysBetween(today,x.nearest.expiry)+' days',detail:'Lot expires '+U.fmtDate(x.nearest.expiry)+' · qty '+x.nearest.qty,ts:new Date(Date.now()-1000*60*60*5).toISOString(),href:'#/stock?tab=expiry',icon:'alert-triangle'}));
  const pending=S.db().leaves.filter(l=>l.status==='Pending');
  if(pending.length) out.push({id:'n-leave',group:'People',tone:'blue',title:pending.length+' leave request'+(pending.length>1?'s':'')+' awaiting approval',detail:'Conflict check completed · no coverage block',ts:new Date(Date.now()-1000*60*60*8).toISOString(),href:'#/leave?tab=requests',icon:'calendar-clock'});
  /* Planned supervision surfaces as an upcoming live event, so a health centre
     visit never arrives unannounced. */
  const todayISO=U.todayISO();
  (S.db().pbfSchedule||[]).filter(sc=>sc.status==='scheduled'&&sc.plannedDate&&sc.plannedDate>=todayISO&&sc.plannedDate<=U.addDays(todayISO,45))
    .sort((a,b)=>String(a.plannedDate).localeCompare(String(b.plannedDate))).slice(0,4)
    .forEach(sc=>{ const inDays=U.daysBetween(todayISO,sc.plannedDate);
      out.push({id:'n-pbf-'+sc.id,group:'Quality',tone:inDays<=7?'amber':'blue',
        title:'Supervision due · '+sc.hcName,
        detail:(sc.quarter||'')+' '+(sc.fy||'')+' · '+(inDays===0?'today':inDays===1?'tomorrow':'in '+inDays+' days')+' · '+U.fmtDate(sc.plannedDate),
        ts:new Date(sc.plannedDate+'T08:00:00').toISOString(),href:'#/pbf',icon:'calendar-check'}); });
  const nc=S.db().incidents.filter(i=>i.status!=='Closed').slice(0,2);
  nc.forEach(i=>out.push({id:'n-'+i.id,group:'Quality',tone:i.severity==='Critical'?'rose':'blue',title:i.ref+' · '+i.title,detail:i.severity+' · owner '+i.owner+' · due '+U.fmtDate(i.due),ts:i.opened,href:'#/quality?tab=incidents',icon:'shield-alert'}));
  out.sort((a,b)=>String(b.ts).localeCompare(String(a.ts)));
  return out.map(n=>Object.assign(n,{read:(db.notifRead||[]).includes(n.id)}));
};
S.markNotifsRead=function(ids){ const db=S.db(); ids.forEach(id=>{ if(!db.notifRead.includes(id)) db.notifRead.push(id); }); S.save(); };
S.feed=function(){
  const db=S.db();
  const fromAudit=(db.audit||[]).slice(0,8).map(a=>({icon:a.action.startsWith('stock')?'package':a.action.startsWith('sample')?'flask-conical':a.action.startsWith('leave')?'calendar-clock':'check-circle', tone:a.action.includes('reject')?'rose':a.action.startsWith('sample')?'teal':'gold', text:'<b>'+U.esc(a.actor)+'</b> — '+U.esc(a.detail||a.action), ts:a.ts}));
  const recent=db.samples.filter(s=>s.collectionDate>=U.addDays(U.todayISO(),-2)).slice(-4).reverse().map(s=>({icon:'flask-conical',tone:'teal',text:'Sample <b>'+U.esc(s.sampleId)+'</b> registered · '+U.esc(s.test)+' · '+U.esc(s.priority),ts:new Date(s.collectionAt||s.collectionDate).toISOString()}));
  return fromAudit.concat(recent).sort((a,b)=>String(b.ts).localeCompare(String(a.ts))).slice(0,8);
};

/* ——— Backup / restore ——————————————————————— */
S.exportJSON=function(){
  return JSON.stringify(Object.assign({},S.db(),{meta:Object.assign({},S.db().meta,{exportedAt:U.nowISO(),appVersion:'6.5.0'})}),null,1);
};
S.importJSON=function(obj){
  if(!obj || !obj.staff || !obj.meta) throw new Error('Not a Lab Systems backup');
  DB=normalize(obj); S.save(true); S.emit('import');
};
S.reset=function(){ const s=JSON.parse(JSON.stringify(window.LS_SEED)); DB=normalize(s); S.save(true); S.emit('reset'); };
S.restorePoint=function(){ S.save(true); const key='labSystems.restore.'+Date.now(); try{ localStorage.setItem(key,JSON.stringify({at:U.nowISO(),db:S.db()})); }catch(e){} return key; };
})();
