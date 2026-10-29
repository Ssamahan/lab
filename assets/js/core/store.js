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

/* One vocabulary of leave abbreviations, used on the working plan, in the leave
   register and on the printed sheet — the same letters the department writes by hand:
     AL annual · ML maternal · PL paternal · SL sick · CL circumstantial ·
     AA authorised · H public holiday · WD work desertion / unauthorised absence
   Training (TR) is not leave, but it is an absence from the bench, so it keeps a code. */
const LS_TYPES = {AL:'Annual leave', ML:'Maternal leave', PL:'Paternal leave', SL:'Sick leave',
  CL:'Circumstantial leave', AA:'Authorised leave', H:'Public holiday',
  WD:'Work desertion / unauthorised absence', TR:'Training', BE:'Before employment'};
/* The older sheets and earlier builds used other letters. Anything stored under an
   old letter is read as its standard one; nothing is silently dropped. */
const LEAVE_ALIAS = {SICK:'SL', MAT:'ML', MATERNITY:'ML', PAT:'PL', PATERNAL:'PL',
  IL:'CL', COMP:'AA', COMPASSIONATE:'AA', STUDY:'AA', W:'AA', UNPAID:'AA', ABS:'WD',
  AWOL:'WD', OFF:'OFF', RBW:'RBW'};
S.leaveCode=function(type){
  const t=String(type||'').toUpperCase();
  if(LS_TYPES[t]) return t;
  return LEAVE_ALIAS[t]||'AL';
};
/* Codes that mean "away from the bench on leave or absence". A public holiday (H) is
   a date, not a person's leave, so it is kept apart: it is never counted as absence. */
S.LEAVE_CODES=['AL','ML','PL','SL','CL','AA','WD'];
S.isLeaveCode=code=>S.LEAVE_CODES.indexOf(String(code||'').toUpperCase())>=0;
S.isHolidayCode=code=>String(code||'').toUpperCase()==='H';
/* Circumstantial leave (IL on the 2025 working plans) is the bereavement leave the
   department gives when a member of staff loses their spouse or a close relative.
   It is leave in force like any other, and it is never written up as an absence. */

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
  /* 'auto' follows the operating system; the site itself reads light by default
     because most desktop browsers report no dark preference at all. */
  theme:'auto', density:'comfortable', lang:'en',
  fiscalStart:'july', fyLabel:'2026/2027',
  labName:'Laboratory Department', facilityCode:'RDH',
  samplePrefix:'RDH', manifestPrefix:'BLC',
  /* A weekday carries the day bench and one name on the night. A weekend carries
     one person on the days and one on the nights: the weekend technologist alone on
     day + night fills both. */
  coverWeekdayDay:3, coverWeekdayNight:1, coverWeekendDay:1, coverWeekendNight:1,
  tat: { 'Blood Culture':4, 'TB Culture':21, 'HIV Recency Viral Load':5, 'Hepatitis (HEP)':7, default:3 },
  cloud:{ enabled:false, endpoint:'', anonKey:'', email:'', password:'', anonAuth:false, live:true, pollMs:2500, pushMs:700, mode:'push-pull', lastSync:null },
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
  {code:'CREA',name:'Serum Creatinine',              cat:'Biochemistry'},
  {code:'ALT', name:'ALT (SGPT)',                    cat:'Biochemistry'},
  {code:'HIVR',name:'HIV Rapid Test (Determine)',    cat:'Serology'},
  {code:'RPR', name:'Syphilis (RPR)',                cat:'Serology'},
  {code:'URIN',name:'Urinalysis',                    cat:'Parasitology'}
];
/* Tests withdrawn from the referral menu in v6.8. Existing installations keep a
   local copy of the catalogue, so the ids are pruned on load as well. */
const RETIRED_TESTS=['t11','t12','t13','t14','t15','t16','t17','t18','t19','t20'];
/* Tests the department never refers anywhere. They are not offered, not generated,
   and any record carrying one is removed on load: a bench test belongs in the
   bench register, not on the referral list. */
const NEVER_REFERRED=['CBC (Full Blood Count)','Malaria RDT','Blood Slide for Malaria','Fasting Blood Glucose','Sputum AFB (Ziehl-Neelsen)'];
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
        id:'sm'+tag+seq, sampleId:'RDH-'+U.fyLabel().slice(-4)+'-'+String(seq).padStart(6,'0'), patientName:U.CONFIDENTIAL,
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

/* ——— Roster generation ————————————————————————————————————————————
   The plan the department works to, in their own words:

     · ONE name on the night — never two;
     · a night is held in a block of two or three consecutive nights. A single
       night is never handed out: two is the floor, three the ceiling, and the
       ceiling is only reached by the two who are contracted for it;
     · the weekend carries one person on the day and one on the night. Every
       other weekend cell is left blank — nobody is rostered at the weekend to
       fill the grid;
     · only the weekend technologist ever works `DN`, and only at the weekend.
       When she is away the weekend is split: one takes the days, another the
       nights — never a `DN` for anybody else;
     · the roster runs at least a week past the month it is named for, and the
       new month takes that week over from the month before. The first days of
       the month are therefore already planned while the monthly reports are
       being written — that week is the buffer;
     · the manager works the bench on weekdays like everybody else. No nights,
       no weekends, no public holidays — and never a month of his own leave.
*/
/* ——— A newcomer ———— (used by the plan generator and by the screens) ————
   Somebody's first thirty days in the department are day shifts only: they carry the
   bench on a weekday and are exempt from the weekend rota and from nights until the
   month of induction is over. `newcomerUntil` is the last day of that month; after it
   they are an ordinary member of the roster. `joinDate` is the first day they can be
   on a plan at all — before it, the sheet is hatched, not blank. */
function newcomerUntilOf(st){
  if(!st) return null;
  if(st.newcomerUntil) return String(st.newcomerUntil).slice(0,10);
  if(!st.joinDate) return null;
  return U.addDays(String(st.joinDate).slice(0,10),29);
}
function isNewcomerAt(st,iso){
  const until=newcomerUntilOf(st); if(!until||!iso) return false;
  return iso<=until;
}
function joinedBy(st,iso){
  const from=st&&st.joinDate?String(st.joinDate).slice(0,10):null;
  return !from||!iso||iso>=from;
}

function generatePlan(monthKey, seedDB){
  /* the rows run in the order the department reads its roster: the manager first,
     then the two post-holders, then the bench, and the weekend technologist last */
  const staff=S.rosterSorted(seedDB.staff.filter(s=>s.status==='active'));
  const leaves=(seedDB.leaves||[]).filter(l=>!/declin|reject/i.test(l.status||''));
  const idOf={}; (seedDB.staff||[]).forEach(s=>{ idOf[s.name]=s.id; });
  const leaveOn=(name,iso)=>{
    const id=idOf[name]; if(!id) return null;
    const l=leaves.find(x=>x.staffId===id && iso>=x.from && iso<=x.to);
    return l?S.leaveCode(l.type):null;
  };
  const onLeave=(name,iso)=>!!leaveOn(name,iso);
  /* A public holiday is a rest day for the department: the bench runs on one
     name for the days and one for the nights, exactly as a weekend does. */
  const holDays={}; (seedDB.holidays||[]).forEach(h=>{ if(h.date) holDays[h.date]=h.name||'Public holiday'; });
  const isHol=iso=>!!holDays[iso];

  /* ——— the span: the month, and the first week of the next ———
     The plan runs exactly seven days past the month it is named for — never more.
     Running on to the following Sunday looked tidy on paper but pushed a November
     plan into the middle of December, and the next month's own plan starts there. */
  const monthDays=U.monthRange(monthKey);
  const end=U.addDays(monthDays[monthDays.length-1],7);
  const dates=[];
  for(let iso=monthKey+'-01'; iso<=end; iso=U.addDays(iso,1)) dates.push(iso);

  /* ——— taking over from the month before ———
     The previous plan's own tail is adopted exactly as it stands, so the new
     month begins where the last one finished and nothing is re-decided twice. */
  const prevKey=U.monthKey(U.addDays(monthKey+'-01',-1));
  const prevEntry=seedDB.workingPlans&&seedDB.workingPlans[prevKey];
  const prev=prevEntry&&prevEntry.primary;
  const carried={};
  if(prev&&prev.dates){
    dates.forEach(iso=>{
      const pi=prev.dates.indexOf(iso);
      if(pi<0) return;
      const day={};
      (prev.staff||[]).forEach(r=>{ const c=(r.codes||[])[pi]; if(c) day[r.name]=c; });
      if(Object.keys(day).length) carried[iso]=day;
    });
  }
  /* ——— who answers for the department ————
     While the manager is on leave somebody acts for him, and that person is then
     the manager for every roster rule: no nights, no weekend nights, and the
     service requisition. It is a fact of the month, not a setting. */
  const managerRow=staff.filter(s=>s.pattern==='manager')[0]||null;
  const managerAway=!!(managerRow && dates.some(iso=>onLeave(managerRow.name,iso)));
  const actingRow=managerAway? (staff.filter(s=>s.actingManager&&s.status==='active')[0]||null) : null;
  const isActing=s=>!!(actingRow&&s.name===actingRow.name);

  const grid={};                       // name -> one code per date (null = still to decide)
  staff.forEach(s=>{ grid[s.name]=dates.map(()=>null); });
  dates.forEach((iso,di)=>{
    const day=carried[iso]; if(!day) return;
    staff.forEach(s=>{
      const c=day[s.name]; if(c===undefined) return;
      const lv=leaveOn(s.name,iso);
      /* the leave register is the authority. A week carried over from the month
         before cannot keep somebody on leave the register has already ended, and
         it cannot keep anybody at work through leave the register records. */
      if(lv){ grid[s.name][di]=lv; return; }
      if(S.isLeaveCode(c)) return;                 // the leave is over: let the plan decide
      grid[s.name][di]=c;
    });
  });

  /* the nights already settled by the take-over, and who holds day + night */
  const nights={}, dnOwner={};
  dates.forEach((iso,di)=>staff.forEach(s=>{
    const c=grid[s.name][di];
    if(c==='N'||c==='DN') nights[iso]=s.name;
    if(c==='DN') dnOwner[iso]=s.name;
  }));

  const crew=staff.filter(s=>!s.weekendOnly && s.pattern!=='manager'
    && s.nightPref!=='no' && (s.maxNights||0)>0 && !isActing(s));
  const weekendTechnologist=staff.filter(s=>s.weekendOnly);
  /* A night counts against the ceiling of the month it falls in: the plan runs a
     week into the next month, and that week belongs to that month's count. */
  const nightCount={}; staff.forEach(s=>{ nightCount[s.name]={}; });
  const nightOf=(name,m)=>((nightCount[name]||{})[m]||0);
  dates.forEach(iso=>{ const n=nights[iso]; if(!n) return; const m=iso.slice(0,7);
    nightCount[n][m]=(nightCount[n][m]||0)+1; });

  const weekendDay={};                 // iso -> name, when the weekend is split
  const holidayDay={};                 // iso -> name, the public-holiday day shift
  const holidayNight={};               // iso -> name, the public-holiday night
  const restOff={}, restRbw={};
  /* the holiday rota: a count per person, carried over from the month before so
     the duty really does alternate instead of restarting every month. */
  const holCount={}; staff.forEach(s=>{ holCount[s.name]=0; });
  let holCursor=0;
  if(prev&&prev.dates){
    prev.dates.forEach((iso,pi)=>{
      if(!isHol(iso)) return;
      (prev.staff||[]).forEach(r=>{ const c=(r.codes||[])[pi];
        if(c==='D'||c==='N'||c==='DN') holCount[r.name]=(holCount[r.name]||0)+1; });
    });
  }
  const markRest=(box,name,iso)=>{ (box[name]=box[name]||{})[iso]=true; };
  const runBefore=(name,iso)=>{ let n=0, d=U.addDays(iso,-1);
    while(nights[d]===name && n<4){ n++; d=U.addDays(d,-1); } return n; };
  const canTake=(s,block)=>{
    if(!block.every(iso=>!onLeave(s.name,iso))) return false;
    /* the first thirty days are dayshifts: no night inside the induction month */
    if(block.some(iso=>isNewcomerAt(s,iso))) return false;
    const per={}; block.forEach(iso=>{ const m=iso.slice(0,7); per[m]=(per[m]||0)+1; });
    return Object.keys(per).every(m=>nightOf(s.name,m)+per[m]<=(s.maxNights||12));
  };
  /* The load a pick is weighed by is the whole run of the plan, not the calendar
     month of the block: the plan runs a week into the next month, and counting
     only that week would put a name who has carried nothing all month level with
     one who has just finished a block. The ceiling stays per month, above. */
  const loadOf=s=>dates.reduce((n,iso)=>n+(nights[iso]===s.name?1:0),0);

  /* ——— week by week ——— */
  const weekStarts=[]; dates.forEach((iso,i)=>{ if(U.dow(iso)===0||i===0) weekStarts.push(i); });
  weekStarts.forEach(wi=>{
    const week=[];
    for(let j=wi;j<dates.length;j++){ if(j>wi && U.dow(dates[j])===0) break; week.push(dates[j]); }
    const isOpen=iso=>!carried[iso];

    /* ——— the weekend ——— */
    const sat=week.filter(iso=>U.dow(iso)===5)[0];
    const sun=week.filter(iso=>U.dow(iso)===6)[0];
    const wkDays=[sat,sun].filter(iso=>iso&&isOpen(iso));
    if(wkDays.length){
      /* a newcomer is exempt from the weekend until the month of induction is over */
      const eligible=s=>wkDays.every(iso=>!isNewcomerAt(s,iso));
      const own=weekendTechnologist.filter(s=>eligible(s)&&wkDays.every(iso=>!onLeave(s.name,iso)))[0];
      if(own){
        /* she takes Saturday and Sunday, day and night, on `DN` — and she is the
           only person on the roster ever given `DN` */
        wkDays.forEach(iso=>{ nights[iso]=own.name; dnOwner[iso]=own.name; });
      } else {
        /* she is away: one takes the days, another the nights */
        const fri=week.filter(iso=>U.dow(iso)===4)[0];
        const friNight=fri?nights[fri]:null;
        const free=staff.filter(s=>!s.weekendOnly && s.pattern!=='manager' && !isActing(s)
          && eligible(s) && wkDays.every(iso=>!onLeave(s.name,iso)));
        const dayPick=free.filter(s=>crew.indexOf(s)<0 && s.name!==friNight)[0]
          || free.filter(s=>s.name!==friNight)[0] || free[0] || null;
        const nightPick=crew.filter(s=>s!==dayPick && s.name!==friNight && canTake(s,wkDays))
          .sort((a,b)=>loadOf(a)-loadOf(b))[0] || null;
        if(dayPick){
          wkDays.forEach(iso=>{ weekendDay[iso]=dayPick.name; });
          /* the day worker is off the Friday before — the week never runs seven
             days — and off again on the Monday after */
          markRest(restOff,dayPick.name,U.addDays(wkDays[0],-1));
          markRest(restOff,dayPick.name,U.addDays(wkDays[wkDays.length-1],1));
        }
        if(nightPick){
          wkDays.forEach(iso=>{ nights[iso]=nightPick.name;
            const m=iso.slice(0,7); nightCount[nightPick.name][m]=(nightCount[nightPick.name][m]||0)+1; });
          /* ——— RBW · Rest Before Work ———
             Nobody covered the weekend, so this person carried both weekend
             nights on top of their week. The day that owes them is taken on the
             Friday BEFORE the weekend, not on the Tuesday after it: Tuesday is a
             heavy clinic day and the bench keeps every pair of hands it has for
             Monday to Wednesday. That is the only case in which RBW is ever
             written onto a plan — it is not a mechanical second day off after
             every block of nights. */
          if(fri && !nights[fri]) markRest(restRbw,nightPick.name,fri);
        }
      }
    }

    /* ——— the public holidays ———
       A holiday is rostered as a weekend: one name on the days, one on the
       nights, and the duty alternates so it is shared fairly. The rotation
       starts from what the previous plan already gave people, and the manager
       is never put on a holiday unless he has chosen to work them. */
    const holWk=week.filter(iso=>isHol(iso) && isOpen(iso) && U.dow(iso)<5);
    holWk.forEach(iso=>{
      if(nights[iso]) return;
      const free=staff.filter(s=>!s.weekendOnly && (s.pattern!=='manager'||s.worksHolidays)
        && !isNewcomerAt(s,iso) && !onLeave(s.name,iso));
      if(!free.length) return;
      /* the rota turns one place each time, and the lightest holiday load wins:
         two rules that both push the duty onto somebody who has not had it */
      const turn=holCursor%free.length;
      const rota=free.slice(turn).concat(free.slice(0,turn));
      const byRota=list=>list.slice().sort((a,b)=>
        (holCount[a.name]||0)-(holCount[b.name]||0)
        || rota.indexOf(a)-rota.indexOf(b));
      const dayPick=byRota(rota)[0] || null;
      const nightPick=dayPick? (byRota(rota.filter(s=>s!==dayPick && (s.maxNights||0)>0 && s.nightPref!=='no'))[0]||null) : null;
      if(dayPick){
        holidayDay[iso]=dayPick.name;
        holCount[dayPick.name]=(holCount[dayPick.name]||0)+1;
        /* the day worker is off the day before and the day after, the same
           breathing space the weekend day worker gets */
        markRest(restOff,dayPick.name,U.addDays(iso,-1));
        markRest(restOff,dayPick.name,U.addDays(iso,1));
      }
      if(nightPick){
        nights[iso]=nightPick.name;
        holidayNight[iso]=nightPick.name;
        const m=iso.slice(0,7); nightCount[nightPick.name][m]=(nightCount[nightPick.name][m]||0)+1;
        holCount[nightPick.name]=(holCount[nightPick.name]||0)+1;
      }
      holCursor++;
    });

    /* ——— the weekdays ——— */
    const runs=[]; let cur=[];
    week.filter(iso=>U.dow(iso)<5 && !isHol(iso)).forEach(iso=>{
      if(isOpen(iso)) cur.push(iso);
      else if(cur.length){ runs.push(cur); cur=[]; }
    });
    if(cur.length) runs.push(cur);
    const sizesOf=n=>{ if(n<=0) return []; if(n===1) return [1]; if(n===2) return [2];
      if(n===3) return [3]; if(n===4) return [2,2]; return [3].concat(sizesOf(n-3)); };
    runs.forEach(run=>{
      let at=0, lastHolder=null;
      sizesOf(run.length).forEach(size=>{
        const block=run.slice(at,at+size); at+=size;
        let pick=null;
        /* a block that begins where the one before it ended is continued while it
           still has room: a block is never cut in half by the edge of the plan */
        let prevName=nights[U.addDays(block[0],-1)];
        /* a holiday night is a single duty: it does not run on into the working
           week, where it would quietly turn a two-night block into three */
        if(prevName && holidayNight[U.addDays(block[0],-1)]===prevName) prevName=null;
        if(prevName){
          /* the block is continued by somebody who works weekday nights — the
             weekend technologist is on `DN` at the weekend and rests on the
             Monday, so a night handed to her there would disappear into her OFF */
          const p=staff.filter(s=>s.name===prevName && crew.indexOf(s)>=0)[0];
          if(p && runBefore(prevName,block[0])+block.length<=3 && canTake(p,block)) pick=p;
        }
        if(!pick){
          /* nobody begins a block the day after a night of their own: that would
             run their nights on without a break, past the three-night ceiling */
          const dayBefore=U.addDays(block[0],-1);
          const pool=crew.filter(s=>s.name!==lastHolder && nights[dayBefore]!==s.name && canTake(s,block));
          if(size===3){
            /* a three-night block only goes to somebody whose ceiling allows it,
               and among those it goes to whoever is carrying the fewest nights —
               the rotation is what shares the nights out, not one name's rank */
            const byLoad=list=>list.slice().sort((a,b)=>loadOf(a)-loadOf(b));
            const allowed=pool.filter(s=>(s.maxConsecN||0)>=3);
            const best=byLoad(allowed.length?allowed:pool)[0];
            pick=best||null;
          } else {
            pick=pool.slice().sort((a,b)=>loadOf(a)-loadOf(b))[0] || null;
          }
        }
        if(!pick) return;
        block.forEach(iso=>{ nights[iso]=pick.name;
          const m=iso.slice(0,7); nightCount[pick.name][m]=(nightCount[pick.name][m]||0)+1; });
        lastHolder=pick.name;
      });
    });
  });

  /* ——— every night is paid back with a day off ——————————————
     One night worked is one day owed.
       · a block inside the working week finishes with as many days off as it had
         nights, starting the morning after the last night;
       · a block over a weekend or a public holiday is settled the way the weekend
         is always settled — the rest before it (RBW on the Friday) and the Monday
         after it — so a two-night weekend costs the bench one weekday, not two.
     A day owed that lands on a Saturday or Sunday is NOT written into the grid —
     the weekend stays clean — but it is recorded on the plan in `meta.compOffs`,
     so the debt is visible even when the cell is empty. */
  const compOff={};                    // name -> iso -> true (written as OFF)
  const compOffWeekend={};             // name -> iso -> true (recorded, left blank)
  const owedTotals={};                 // name -> {owed, written, withheld, settledBefore}
  const addOwed=(name,iso)=>{          // one day owed, written or only recorded
    const t=owedTotals[name]=owedTotals[name]||{owed:0,written:0,withheld:0,settledBefore:0};
    t.owed++;
    if(U.dow(iso)>=5||isHol(iso)){
      compOffWeekend[name]=compOffWeekend[name]||{};
      if(!compOffWeekend[name][iso]&&!(compOff[name]&&compOff[name][iso])){ compOffWeekend[name][iso]=true; t.withheld++; }
      return;
    }
    compOff[name]=compOff[name]||{};
    if(!compOff[name][iso]&&!(compOffWeekend[name]&&compOffWeekend[name][iso])){ compOff[name][iso]=true; t.written++; }
  };
  staff.forEach(s=>{
    if(s.weekendOnly) return;          // she rests Monday to Friday by definition
    let i=0;
    while(i<dates.length){
      if(nights[dates[i]]!==s.name){ i++; continue; }
      let j=i; while(j+1<dates.length && nights[dates[j+1]]===s.name) j++;
      const from=dates[i], to=dates[j], len=j-i+1;
      const overRest=U.dow(from)>=5||isHol(from)||U.dow(to)>=5||isHol(to);
      if(overRest){
        /* the Monday after is written; anything beyond that was already paid in
           the rest taken before the weekend */
        const mon=U.addDays(to,1);
        if(mon<=dates[dates.length-1]&&nights[mon]!==s.name) addOwed(s.name,mon);
        const t=owedTotals[s.name]=owedTotals[s.name]||{owed:0,written:0,withheld:0,settledBefore:0};
        t.owed+=Math.max(0,len-1); t.settledBefore+=Math.max(0,len-1);
      } else {
        for(let k=1;k<=len;k++){
          const iso=U.addDays(to,k);
          if(iso>dates[dates.length-1]) break;
          if(nights[iso]===s.name) continue;          // on duty: nothing to write
          addOwed(s.name,iso);
        }
      }
      i=j+1;
    }
  });
  const compOffs=Object.keys(owedTotals).map(name=>{
    const t=owedTotals[name];
    return {name, owed:t.owed, written:t.written, withheld:t.withheld,
      settledBefore:t.settledBefore,
      days:Object.keys(compOff[name]||{}).sort(),
      weekendDays:Object.keys(compOffWeekend[name]||{}).sort()};
  }).filter(r=>r.owed>0);

  /* ——— the daily grid ——— */
  dates.forEach((iso,di)=>{
    const weekend=U.dow(iso)>=5||isHol(iso);
    staff.forEach(s=>{
      if(grid[s.name][di]!==null) return;               // taken over from the month before
      const lv=leaveOn(s.name,iso);
      if(lv){ grid[s.name][di]=lv; return; }
      /* the days before somebody's first day are hatched, not blank: the sheet says
         “not yet employed” rather than “at home” */
      if(!joinedBy(s,iso)){ grid[s.name][di]='BE'; return; }
      if(weekend){
        /* only the people actually rostered carry a code at the weekend; every
           other weekend cell stays blank */
        if(nights[iso]===s.name){ grid[s.name][di]=dnOwner[iso]===s.name?'DN':'N'; return; }
        if(weekendDay[iso]===s.name||holidayDay[iso]===s.name){ grid[s.name][di]='D'; return; }
        grid[s.name][di]=''; return;
      }
      if(s.weekendOnly){ grid[s.name][di]='OFF'; return; }
      if(nights[iso]===s.name){ grid[s.name][di]='N'; return; }
      /* the days a block of nights has earned, written in the working week */
      if((compOff[s.name]||{})[iso]){ grid[s.name][di]='OFF'; return; }
      if((restOff[s.name]||{})[iso]){ grid[s.name][di]='OFF'; return; }
      if((restRbw[s.name]||{})[iso]){ grid[s.name][di]='RBW'; return; }
      grid[s.name][di]='D';
    });
  });

  const carriedKeys=Object.keys(carried).sort();
  const carriedFrom=carriedKeys[0]||null;
  const carriedThrough=carriedKeys[carriedKeys.length-1]||null;
  const plan={
    label:U.monthLabel(monthKey), dates,
    staff:staff.map(s=>({name:s.name, id:s.id, codes:grid[s.name]})),
    meta:{date:U.todayISO(), fy:U.fyInfo(monthKey+'-01').label, period:U.monthLabel(monthKey),
      generated:true, draft:true, carriedFrom, carriedThrough,
      actingManager:actingRow?actingRow.name:null,
      /* the days owed for nights, including the ones that fell on a weekend and
         are therefore recorded only — the grid stays clean, the debt does not
         disappear */
      compOffs,
      runsThrough:dates[dates.length-1],
      note:carriedFrom?('Takes over from the '+U.monthLabel(prevKey)+' plan to '+U.addDays(carriedFrom,-1)
        +'; runs through '+U.fmtDateShort(dates[dates.length-1])):('Runs through '+U.fmtDateShort(dates[dates.length-1]))}
  };
  return plan;
}

/* ——— Migration / normalisation ————————————————— */
let DB=null, listeners=[], saveTimer=null, dirty=false;
/* ——— Identifiers ————————————————————————————————
   A reference laboratory does not number samples by the sending hospital. The test
   and the month carry the meaning, so the ID is readable without a lookup table:

     sample    R + <test code> + MMYY + 4 digits    RBC10260001
               remote · blood culture · October 2026 · first sample of that month

     manifest  <test code> + YYMMDD + 4 alphanumerics  BC261027A001
               blood culture manifest · created 27 October 2026 · tail A001, A002 … A00A

   Counters live in `meta.sampleCounters` and `meta.manifestSerial`, so a number is
   never reused on this device even after the month rolls over. */
function pad2(n){ return String(n).padStart(2,'0'); }
function idDate(when){
  if(!when) return new Date();
  const d=new Date(String(when).slice(0,10)+'T12:00:00');
  return isNaN(d)?new Date():d;
}
/* The code on the test menu is the code in the ID. Never the hospital, never an initial. */
S.testCode=function(testName){
  const list=(S.allTests?S.allTests():(S.db().catalog.tests||[]));
  const t=list.find(x=>x&&x.name===testName);
  if(t&&t.code) return String(t.code).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);
  const words=String(testName||'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').trim().split(/\s+/).filter(Boolean);
  const guess=words.map(w=>w[0]).join('').slice(0,3);
  return guess||'GEN';
};
S.sampleId=function(testName,when){
  const d=idDate(when), code=S.testCode(testName);
  const tag=pad2(d.getMonth()+1)+String(d.getFullYear()).slice(-2);
  const key='S'+code+tag;
  const c=((S.db().meta.sampleCounters)||{})[key]||0;
  return 'R'+code+tag+String(c+1).padStart(4,'0');
};
/* Bump the counter. Called inside the commit that stores the sample. */
S.takeSampleId=function(testName,when,db){
  const d=idDate(when), code=S.testCode(testName);
  const tag=pad2(d.getMonth()+1)+String(d.getFullYear()).slice(-2);
  const key='S'+code+tag;
  db.meta.sampleCounters=db.meta.sampleCounters||{};
  const next=(db.meta.sampleCounters[key]||0)+1;
  db.meta.sampleCounters[key]=next;
  return 'R'+code+tag+String(next).padStart(4,'0');
};
/* The tail is four characters and it is alphanumeric, not a plain number: the serial is
   written in base 36 with the first character filled from the letter range (36³ = A000),
   so the first manifest of a day reads A001, the tenth A00A, the thirty-seventh A010 —
   still ordered, still unique, and never a run of digits only. */
const TAIL_OFFSET=10*36*36*36;   /* A000 in base 36 */
function manifestTail(serial){
  const n=Math.max(1,Number(serial)||1);
  return (n+TAIL_OFFSET).toString(36).toUpperCase().padStart(4,'0');
}
S.manifestTail=manifestTail;
S.manifestId=function(testName,when){
  const d=idDate(when), code=S.testCode(testName);
  const stamp=String(d.getFullYear()).slice(-2)+pad2(d.getMonth()+1)+pad2(d.getDate());
  return code+stamp+manifestTail(Number((S.db().meta.manifestSerial)||0)+1);
};
S.takeManifestId=function(testName,when,db){
  const d=idDate(when), code=S.testCode(testName);
  const stamp=String(d.getFullYear()).slice(-2)+pad2(d.getMonth()+1)+pad2(d.getDate());
  db.meta.manifestSerial=(Number(db.meta.manifestSerial)||0)+1;
  return code+stamp+manifestTail(db.meta.manifestSerial);
};

/* ——— One month, one row per person ————————————————
   A month's plan is a roster: each member of staff is one row, each day one column.
   Older builds could append an archived version's rows to the plan in force — which
   put the same name on the sheet several times — and a plan that has been through
   that repair reads as a mess. This puts a plan back into shape: the first row for a
   name is kept (that is the row in force; the copies came after it), later duplicates
   are dropped, and a repeated date is dropped with its column. It changes nothing
   else — no shift is moved, no leave is touched, no name is added. */
function tidyPlan(p){
  if(!p||typeof p!=='object') return false;
  let changed=false;
  const dates=Array.isArray(p.dates)?p.dates:[];
  const seenDate={}, cols=[];
  dates.forEach((iso,i)=>{ if(seenDate[iso]){ changed=true; return; } seenDate[iso]=1; cols.push(i); });
  if(cols.length!==dates.length){
    p.dates=cols.map(i=>dates[i]);
    (p.staff||[]).forEach(r=>{ if(Array.isArray(r.codes)) r.codes=cols.map(i=>r.codes[i]); });
  }
  const seenName={}, rows=[];
  (p.staff||[]).forEach(r=>{
    const key=String((r&&r.name)||'').trim().toLowerCase();
    if(!key) { changed=true; return; }
    if(Object.prototype.hasOwnProperty.call(seenName,key)){ changed=true; return; }
    seenName[key]=1; rows.push(r);
  });
  if(rows.length!==(p.staff||[]).length){ p.staff=rows; changed=true; }
  /* a row whose codes are not one per day is padded or trimmed to the columns —
     a short row leaves cells that cannot be clicked and cannot be read */
  (p.staff||[]).forEach(r=>{
    if(!Array.isArray(r.codes)){ r.codes=p.dates.map(()=>''); changed=true; return; }
    if(r.codes.length<p.dates.length){ while(r.codes.length<p.dates.length) r.codes.push(''); changed=true; }
    else if(r.codes.length>p.dates.length){ r.codes.length=p.dates.length; changed=true; }
  });
  return changed;
}
S.tidyPlan=tidyPlan;

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
  db.workingPlans=db.workingPlans||{};
  /* v6.9.56 — every stored month is put back to one row per person, every load. The
     repair is idempotent, so a plan that is already in shape is untouched. */
  Object.keys(db.workingPlans).forEach(k=>{
    const e=db.workingPlans[k]; if(!e) return;
    if(e.primary) tidyPlan(e.primary);
    (e.versions||[]).forEach(v=>tidyPlan(v));
  });
  /* two records for one person are one record: the staff list itself is de-duplicated
     by id, which is what the plan, the leave register and the audit trail key on */
  if(Array.isArray(db.staff)){
    const seenStaff={}, staff=[];
    db.staff.forEach(st=>{
      const key=String((st&&st.id)||'');
      if(!key){ staff.push(st); return; }
      if(seenStaff[key]) return;
      seenStaff[key]=1; staff.push(st);
    });
    if(staff.length!==db.staff.length) db.staff=staff;
  } db.unitRosters=db.unitRosters||{};
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
  /* v6.9.30 — the register identifies a specimen by its ID, never by a person.
     Any name already stored is replaced here, once, on load: screens, sheets,
     exports and the shared copy all carry the same single word. */
  if(!db.meta.patientNamesMasked){
    db.meta.patientNamesMasked=true;
    db.samples.forEach(x=>{ if(x && x.patientName!==U.CONFIDENTIAL) x.patientName=U.CONFIDENTIAL; });
  }
  /* v6.9.40 — a three-night block is earned, not rotated. Only the two technologists
     whose contract allows three consecutive nights may hold it, and Patrick carries
     it most often. The flag lives on the staff record so it can be changed in the
     staff editor without a code change. */
  if(!db.meta.nightRuleV6940){
    db.meta.nightRuleV6940=1;
    (db.staff||[]).forEach(st=>{
      const n=String(st.name||'');
      const can=(st.maxConsecN||0)>=3 && st.nightPref!=='no' && !st.weekendOnly && st.pattern!=='manager';
      if(can && /patrick\s+ishimwe/i.test(n)){ st.threeNight=true; st.nightRank=1; }
      else if(can && /jean\s*paul\s+nsengiyumva/i.test(n)){ st.threeNight=true; st.nightRank=2; }
      else if(can && st.threeNight && st.nightRank==null){ st.nightRank=3; }
      else if(!can) st.threeNight=false;
    });
  }
  /* v6.9.40 — training organisers are a picklist, grown from what is already in the
     registry so nothing has to be typed twice, plus the bodies this department
     actually deals with. */
  if(!db.meta.trainingOrganizersV6943){
    db.meta.trainingOrganizersV6943=1;
    const seen=[];
    ['RBC','WHO','Africa CDC','PHAMALAB','UR','Roche Diagnostics','Ruli DH']
      .concat((db.trainings||[]).map(t=>String(t.organizer||'').trim()).filter(Boolean))
      .forEach(n=>{ if(seen.map(x=>x.toLowerCase()).indexOf(n.toLowerCase())<0) seen.push(n); });
    db.trainingOrganizers=seen;
  }
  /* v6.9.43 — the manager's carried-over thirty days of 2025/2026 leave start on
     19 November 2026, and the end date is the start plus twenty-nine days. The
     block is corrected here once; the November draft is rebuilt from it if it has
     not been published yet. */
  if(!db.meta.leaveCarryV6943){
    db.meta.leaveCarryV6943=1;
    const carry=(db.leaves||[]).find(l=>l.id==='l18'&&l.staffId==='s1');
    if(carry){
      const from='2026-11-19';
      Object.assign(carry,{from,to:U.addDays(from,29),backOn:U.addDays(from,30),days:30,
        note:'Carry-over — the whole 30-day FY 2025/26 entitlement was left unused and is taken from 19 November 2026; no annual leave was drawn in FY 2025/26. The two days pencilled for 8-9 December fall inside this block and are part of the same thirty.',
        autoEnd:true});
      /* One absence, one record: the shorter block that used to sit inside the
         window would otherwise be counted a second time. Only that seeded row is
         removed — anything entered by hand is left alone. */
      const to=U.addDays(from,29);
      db.leaves=(db.leaves||[]).filter(l=>!(l.id==='l7'&&l.staffId==='s1'&&l.from>=from&&l.to<=to));
    }
    const nov=db.workingPlans&&db.workingPlans['2026-11'];
    if(nov&&nov.primary&&!(nov.primary.meta&&nov.primary.meta.official)){
      nov.versions=(nov.versions||[]).concat([nov.primary]);
      nov.primary=generatePlan('2026-11',db);
      nov.primary.meta=Object.assign({},nov.primary.meta,{
        label:'Draft for November 2026 — built from the department\'s rules and the record of previous months; review before publishing',
        period:'November 2026', reference:'August 2026 and November 2025 plans'
      });
    }
  }
  /* v6.9.46 — one set of leave letters, everywhere. The older sheets and earlier
     builds used SICK, MAT, IL, COMP, STUDY, W and UNPAID; the department writes SL,
     ML, CL, AA. Every stored record and every stored plan cell is rewritten to the
     standard letter here, so nothing is left reading as an unexplained absence and
     nothing is counted twice. */
  if(!db.meta.leaveAcronymsV6946){
    db.meta.leaveAcronymsV6946=1;
    (db.leaves||[]).forEach(l=>{ if(l.type) l.type=S.leaveCode(l.type); });
    (db.absences||[]).forEach(a=>{ if(a.type) a.type=S.leaveCode(a.type); });
    /* Every row of every version is rewritten, but on a LIST — pushing a version's
       rows into the plan in force was what put five copies of every name into a
       single month. Nothing is added to a plan here; only the letters change. */
    Object.keys(db.workingPlans||{}).forEach(k=>{
      const p=db.workingPlans[k];
      const rows=((p.primary&&p.primary.staff)||[]).concat(
        (p.versions||[]).reduce((all,v)=>all.concat(v.staff||[]),[]));
      rows.forEach(r=>{ if(r.codes) r.codes=r.codes.map(c=>S.leaveCode(c)===c?c:(S.LEAVE_CODES.indexOf(S.leaveCode(c))>=0&&['SICK','MAT','IL','COMP','STUDY','W','UNPAID','ABS'].indexOf(c)>=0?S.leaveCode(c):c)); });
    });
  }
  /* v6.9.44 — the working plans on file, month by month, as a record. Each month is
     transcribed from the department's own workbook into assets/data/plan-archive.js
     and installed here unless the console already holds a plan in force for it: an
     official plan is never overwritten by a record. A transcribed month is not
     official — it is a record of what the paper said, and it is labelled as one.
     Every month carries a stamp of its content, so a month that is read again (or
     added later) is installed once, on the next load, without disturbing the rest. */
  if(!db.meta.planArchiveStamps) db.meta.planArchiveStamps={};
  {
    const A=(typeof window!=='undefined'&&window.LS_PLAN_ARCHIVE)||{};
    const hol=(db.holidays||[]);
    Object.keys(A).forEach(k=>{
      const e=A[k];
      if(!e||!e.from||!e.staff||!e.staff.length) return;
      const stamp=k+'@'+e.from+'/'+e.staff.map(r=>r.codes.join('')).join('|');
      if(db.meta.planArchiveStamps[k]===stamp) return;
      const entry=db.workingPlans[k]=db.workingPlans[k]||{versions:[]};
      const prev=entry.primary;
      /* a plan in force stands: only a generated draft or an earlier record is replaced */
      if(prev && !(prev.meta&&(prev.meta.generated||prev.meta.transcribed))) return;
      const n=e.days||Math.max.apply(null,e.staff.map(r=>r.codes.length));
      const dates=[]; for(let i=0;i<n;i++) dates.push(U.addDays(e.from,i));
      const staff=e.staff.map(r=>{
        const c=r.codes.slice(0,n);
        while(c.length<n) c.push('');
        /* The paper shades a public holiday across every row. A cell left blank on
           such a date is written H here, so a closed day is not read as an
           unrostered gap: nobody is on the bench because the hospital is closed. */
        return {name:r.name, codes:c.map((code,i)=>code||(hol.some(h=>h.date===dates[i])?'H':''))};
      });
      if(prev) entry.versions=(entry.versions||[]).concat([prev]);
      entry.primary={
        label:U.monthLabel(k)+' — transcribed from the working plan on file',
        dates, staff,
        meta:{date:U.todayISO(), fy:U.fyInfo(e.from).label, period:U.monthLabel(k),
          generated:false, draft:false, transcribed:true, source:e.source||'',
          label:U.monthLabel(k)+' — transcribed from the working plan on file'}
      };
      entry.versions=entry.versions||[];
      db.meta.planArchiveStamps[k]=stamp;
    });
  }
  /* v6.9.43 — September 2026, read again against the sheet on file, cell by cell.
     The sheet (printed 06-09-2026) runs Patrick's annual leave to 1 October, puts a
     single day on 2 October, leaves the weekend of 3-4 October blank — that weekend
     belongs to the weekend technologist — and starts his two nights on 5 October.
     The six cells at the tail of that row were out of step with the sheet; they are
     put right here. Nothing else on the month is touched: every other row already
     matches the sheet, and the October plan keeps its own record of the same days. */
  if(!db.meta.sepTailV6943){
    db.meta.sepTailV6943=1;
    const sep=db.workingPlans&&db.workingPlans['2026-09'];
    const row=sep&&sep.primary&&(sep.primary.staff||[]).find(r=>/Patrick ISHIMWE/.test(r.name));
    if(row&&sep.primary.dates&&sep.primary.dates[31]==='2026-10-01'&&sep.primary.dates[36]==='2026-10-06'){
      row.codes.splice(31,6,'AL','D','','','N','N');
    }
  }
  /* v6.9.41 — November 2026 is built once, as a draft, from the department's own
     rules and the record of the previous months: three-night blocks for the two who
     take them (Patrick first), two for everybody else, the weekend technologist on
     Saturday and Sunday, and the manager's carried-over annual leave exactly where
     the leave register already puts it. It is a draft: nothing is published until
     the department reviews the grid. An existing November plan is never touched. */
  if(!db.meta.novPlanV6941){
    db.meta.novPlanV6941=1;
    const key='2026-11';
    const has=db.workingPlans[key]&&db.workingPlans[key].primary;
    if(!has){
      const built=generatePlan(key,db);
      built.meta=Object.assign({},built.meta,{
        label:'Draft for November 2026 — built from the department\'s rules and the record of previous months; review before publishing',
        period:'November 2026', reference:'August 2026 and November 2025 plans'
      });
      db.workingPlans[key]=db.workingPlans[key]||{versions:[]};
      db.workingPlans[key].primary=built;
    }
  }
  /* v6.9.40 — five bench tests were still on the referral list although nothing is
     ever referred for them: CBC, Malaria RDT, Blood Slide for Malaria, Fasting Blood
     Glucose and Sputum AFB. The catalogue entries go, and so do the records that were
     generated against them. Nothing else is touched. */
  if(!db.meta.neverReferredV6940){
    db.meta.neverReferredV6940=1;
    const gone=NEVER_REFERRED.slice();
    db.catalog.tests=(db.catalog.tests||[]).filter(t=>gone.indexOf(t.name)<0);
    const before=(db.samples||[]).length;
    db.samples=(db.samples||[]).filter(x=>gone.indexOf(x.test)<0);
    db.meta.neverReferredRemoved=before-db.samples.length;
    (db.manifests||[]).forEach(m=>{ m.samples=(m.samples||[]).filter(id=>db.samples.some(x=>x.id===id)); });
  }
  /* v6.9.38 — the laboratory that sends these specimens is the hospital's own, Ruli DH.
     Orders registered in this console were being filed under the first health centre in
     the list (Ruli HC); they are corrected to Ruli DH, which is also the new default.
     A specimen genuinely collected at a health centre keeps whatever was chosen for it. */
  if(!db.meta.originRuliDhV6938){
    db.meta.originRuliDhV6938=1;
    (db.samples||[]).forEach(x=>{ if(x && x.source==='register' && x.healthFacility==='Ruli HC') x.healthFacility='Ruli DH'; });
    if(db.catalog && db.catalog.healthCenters && !db.catalog.healthCenters.some(h=>h.name==='Ruli DH')){
      db.catalog.healthCenters.unshift({id:'hc0',name:'Ruli DH'});
    }
  }
  /* v6.9.38 — a manifest code is always <code><YYMMDD><4 alphanumeric>. Anything stored in
     another shape (an old seed code, or one made before the tail was alphanumeric) is
     rebuilt from its own creation date, in the order the manifests were made. */
  if(!db.meta.manifestCodesV6938){
    db.meta.manifestCodesV6938=1;
    const shape=/^[A-Z]{2,3}\d{6}[A-Z0-9]{4}$/;
    const ordered=(db.manifests||[]).slice().sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    ordered.forEach(m=>{
      /* A numeric tail is rewritten too: the fourth character onward must be alphanumeric. */
      const tail=String(m&&m.manifestId||'').slice(-4);
      if(m && m.manifestId && shape.test(m.manifestId) && /[A-Z]/.test(tail)) return;
      const first=(m.samples||[]).map(id=>(db.samples||[]).find(s=>s.id===id)).find(Boolean);
      /* DB is not published yet while normalize runs, so read the catalog from `db` — never
         through S.db(), which would re-enter this function. */
      const menu=(db.catalog&&db.catalog.tests)||[];
      const entry=menu.find(t=>t&&t.name===(first&&first.test));
      const code=String(entry&&entry.code||'GEN').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);
      const d=idDate(m.createdAt);
      const stamp=String(d.getFullYear()).slice(-2)+pad2(d.getMonth()+1)+pad2(d.getDate());
      db.meta.manifestSerial=(Number(db.meta.manifestSerial)||0)+1;
      m.manifestId=code+stamp+manifestTail(db.meta.manifestSerial);
    });
  }
  db.meta.sampleCounters=db.meta.sampleCounters||{};
  db.meta.manifestSerial=Number(db.meta.manifestSerial)||0;
  /* v6.9.36 — a blood culture is never ordered alone. Gram Stain and Cytology are
     performed as routine with it, so they belong in the test menu and travel on the same
     order, listed first on the manifest: Cytology · Gram Stain · Blood Culture. */
  if(!db.meta.companionTestsV6936){
    db.meta.companionTestsV6936=1;
    db.catalog.tests=db.catalog.tests||[];
    [{name:'Cytology',code:'CYT',cat:'General',tat:7},{name:'Gram Stain',code:'GS',cat:'General',tat:4}]
      .forEach(t=>{ if(!db.catalog.tests.some(x=>x.name===t.name)) db.catalog.tests.push(Object.assign({id:'t-'+t.code.toLowerCase()},t)); });
  }
  /* v6.9.5 — monthly ceilings on consumables. The bench plans in months ("no more
     than five blood-culture bottles a month"), so a ceiling can be set per line.
     The blood-culture ceiling is the district's own figure; the other lines start
     blank and are set by the department. */
  if(!db.meta.stockCapsV695){
    db.meta.stockCapsV695=1;
    (db.catalog.consumables||[]).forEach(c=>{
      if(c.monthlyCap==null && /blood culture/i.test(c.name||'')) c.monthlyCap=5;
    });
  }
  /* v6.9.40 — the ceilings the bench actually works to, stated by the department:
     at most three HIV-EID cartridges a month, at most five VTM vials a month for our
     own use (transfers to health centres are counted apart), and blood culture at
     about two paediatric plus one adult bottle a month. The earlier 5-bottle
     blood-culture figure was a round guess and is corrected here. */
  if(!db.meta.stockCapsV6940){
    db.meta.stockCapsV6940=1;
    (db.catalog.consumables||[]).forEach(c=>{
      const n=String(c.name||'');
      if(/blood culture/i.test(n)){
        c.monthlyCapPrev=c.monthlyCap==null?null:c.monthlyCap;
        c.monthlyCap=3;
        c.capSplit={'Pediatric/Neonatal':2,'Adult':1};
        c.capNote='About two paediatric/neonatal bottles and one adult bottle a month';
      }
      else if(/hiv[- ]?eid/i.test(n)){ c.monthlyCap=c.monthlyCap==null?3:Math.min(c.monthlyCap,3); c.capNote='At most three cartridges a month'; }
      else if(/\bVTM\b|viral transport/i.test(n)){ c.monthlyCap=c.monthlyCap==null?5:Math.min(c.monthlyCap,5); c.transfersExempt=true; c.capNote='At most five vials a month for our own use · transfers to health centres are counted apart'; }
    });
  }
  /* v6.9.5 — the seeded record that placed a week of annual leave in May 2026
     for the manager was wrong: no annual leave was drawn in FY 2025/26, the whole
     entitlement was carried and is being taken in November 2026. Only that seeded
     row is corrected; any block entered by hand is left exactly as it is. */
  if(!db.meta.leaveCarryV695){
    db.meta.leaveCarryV695=1;
    const seeded=(db.leaves||[]).find(l=>l.id==='l18'&&l.staffId==='s1'&&l.from==='2026-05-25');
    if(seeded) Object.assign(seeded,{from:'2026-11-02',to:'2026-12-01',backOn:'2026-12-02',fy:'2026/2027',
      note:'Carry-over — the whole 30-day FY 2025/26 entitlement was left unused and is taken in November 2026; no annual leave was drawn in FY 2025/26'});
    const dec=(db.leaves||[]).find(l=>l.id==='l7'&&/carry-over from previous FY/i.test(l.note||''));
    if(dec) dec.note='Two days in December — from the new FY 2026/27 entitlement';
    try{ S.save(); }catch(e){}
  }
  /* v6.9.5 — a leave record's fiscal year comes from its dates. Older records
     carried a hand-set `fy`; where that label disagrees with the dates it is
     rewritten, so nobody shows up in a year they were never away in. */
  if(!db.meta.leaveFyV695){
    db.meta.leaveFyV695=1;
    (db.leaves||[]).forEach(l=>{ if(l.from) l.fy=U.fyInfo(l.from).label; });
  }
  /* v6.9 — light is the default. Older builds shipped 'ink' as the stored theme,
     so an untouched setting is migrated to auto once; an explicit choice is kept. */
  if(!db.meta.themeAutoV69){
    if(!db.meta.themeChosen && db.settings.theme!=='porcelain') db.settings.theme='auto';
    if(!db.settings.theme) db.settings.theme='auto';
    db.meta.themeAutoV69=1;
  }

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
      {id:'s11',name:'Jeanne Claudine UWAYISABA',sex:'Female',dob:'1993-08-21',role:'Laboratory Technologist',
       phone:'',email:'',contract:'statute',pattern:'normal',nightPref:'no',maxNights:0,maxConsecN:0,
       status:'active',joinDate:'2022-11-07',exitDate:null,note:'Bench cover for biochemistry, serology and parasitology'}
    ];
    extra.forEach(x=>{ if(!db.staff.find(y=>y.name===x.name)) db.staff.push(x); });
    if(!db.workingPlans['2026-10']){
      db.workingPlans['2026-10']={"primary":{"staff":[{"name":"Kelvin SAMAHANI","codes":["D","D","D","","","D","D","D","D","D","","","D","D","D","D","D","","","D","D","D","D","D","","","D","D","D","D","D","","","D","D","D","D","D"]},{"name":"Beatrice NGEZEKURE","codes":["D","D","D","","","D","D","D","D","D","","","D","D","D","D","D","","","D","D","D","D","D","","","D","D","D","D","OFF","D","D","OFF","D","D","D","D"]},{"name":"Aurelie YANSONEYE","codes":["OFF","OFF","OFF","DN","DN","OFF","OFF","OFF","OFF","OFF","DN","DN","OFF","OFF","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL","AL"]},{"name":"Patrick ISHIMWE","codes":["AL","AL","D","OFF","OFF","D","D","D","N","N","OFF","OFF","N","N","N","OFF","OFF","","","N","N","N","OFF","OFF","D","D","OFF","OFF","OFF","N","N","","","D","D","D","D","OFF"]},{"name":"Jean Paul NSENGIYUMVA","codes":["N","OFF","OFF","","","D","D","D","D","D","","","D","D","D","OFF","D","N","N","OFF","OFF","D","D","D","","","N","N","N","OFF","OFF","","","D","D","D","D","D"]},{"name":"Dieudonne NIYIDUHABYOSE","codes":["D","N","N","","","N","N","N","OFF","OFF","","","OFF","D","D","D","OFF","D","D","OFF","D","D","N","N","","","D","D","OFF","D","D","N","N","OFF","OFF","N","N","N"]},{"name":"Bernadette MUHAWENIMANA","codes":["D","D","D","","","D","D","D","D","D","","","D","D","D","N","N","","","D","D","D","D","OFF","N","N","OFF","OFF","D","D","D","OFF","OFF","N","N","OFF","OFF","D"]}],"dates":["2026-09-30","2026-10-01","2026-10-02","2026-10-03","2026-10-04","2026-10-05","2026-10-06","2026-10-07","2026-10-08","2026-10-09","2026-10-10","2026-10-11","2026-10-12","2026-10-13","2026-10-14","2026-10-15","2026-10-16","2026-10-17","2026-10-18","2026-10-19","2026-10-20","2026-10-21","2026-10-22","2026-10-23","2026-10-24","2026-10-25","2026-10-26","2026-10-27","2026-10-28","2026-10-29","2026-10-30","2026-10-31","2026-11-01","2026-11-02","2026-11-03","2026-11-04","2026-11-05","2026-11-06"],"meta":{"label":"Official October 2026 - transcribed from the signed working-plan image (no fabricated shifts)","date":"2026-09-28","fy":"2026/2027","period":"October 2026","revised":false,"official":true}},"versions":[]};
    }
    db.meta.october2026Seeded=U.todayISO();
  }
  /* v6.9.48 — a draft is rebuilt to the roster the department actually works to:
     one name on the night, nights in blocks of two or three, the weekend blank
     for everybody except the two on shift, and every month taking its first week
     over from the month before. An official plan — and a month transcribed from
     the paper — is never touched. The draft that is replaced is kept as a
     version, so nothing is lost. */
  /* v6.9.49 — posts held by name. Jean holds the laboratory quality post and
     Dieudonné the safety post; training aimed at either post skips the queue for
     them, exactly as it does for the manager. */
  if(!db.meta.rolePostsV6949){
    db.meta.rolePostsV6949=1;
    const put=(id,duty,post)=>{ const s=(db.staff||[]).find(x=>x.id===id);
      if(s){ s.duty=duty; s.post=post; } };
    put('s6','qualityManager','Laboratory Quality Manager');
    put('s9','safetyOfficer','Laboratory Safety Officer');
  }
  /* v6.9.49 — the manager's own annual leave belongs to FY 2026/2027. It is his
     turn after Aurélie and it is charged to the year he takes it in, not
     described as a carry-over from a year whose leave was never recorded.
     The stale fifteen-day block that would double-book the same thirty days is
     removed; nothing entered by hand is touched. */
  if(!db.meta.leaveOwnYearV6949){
    db.meta.leaveOwnYearV6949=1;
    const k=(db.leaves||[]).find(l=>l.id==='l18'&&l.staffId==='s1');
    if(k) Object.assign(k,{fy:'2026/2027',
      note:'FY 2026/27 — the manager\u2019s own 30-day annual leave, the next turn after Aurelie, charged to the year it is taken in.'});
    db.leaves=(db.leaves||[]).filter(l=>!(l.id==='l3'&&l.staffId==='s1'&&l.from==='2027-03-01'));
  }
  /* v6.9.55 — the order the roster is read in, and who holds the nights.
     The manager's row is first because he signs the plan; then the two who hold a
     post; then the bench in the order the department calls it; the weekend
     technologist is always the last row. Jeanne Claudine joins the night rotation
     so that Dieudonné is not carrying it with Bernadette alone, Jean Paul is named
     as the person acting for the manager, and the manager carries the weekly
     service requisition. */
  /* v6.9.57 — the post a person holds is the name on the sheet. The department
     writes “Lab Technician” on the plan, not “Laboratory Technician”, and a person
     who holds a post is titled by the post: Jean Paul is the Lab Quality Manager,
     Dieudonné the Lab Safety Officer. Beatrice stays the Lab Technologist — she is
     the only one the department calls that. Nothing else changes: duty codes, night
     rules and the leave of each record are untouched. */
  if(!db.meta.rolesV6957){
    db.meta.rolesV6957=1;
    const ROLE={'s3':'Lab Technologist','s5':'Lab Technician','s9':'Lab Safety Officer',
      's10':'Lab Technician','s11':'Lab Technician'};
    Object.keys(ROLE).forEach(id=>{
      const st=(db.staff||[]).find(x=>x.id===id);
      if(st) st.role=ROLE[id];
    });
    const jean=(db.staff||[]).find(x=>x.id==='s6');
    if(jean){ jean.role='Lab Quality Manager'; jean.post='Lab Quality Manager'; }
    const dieu=(db.staff||[]).find(x=>x.id==='s9');
    if(dieu){ dieu.post='Lab Safety Officer'; }
  }
  /* v6.9.58 — Jeanne Claudine UWAYISABA arrived on 6 October 2026. Her record said
     2022, which put her on the establishment for years she was not there; the date
     is corrected and she takes her place on the October plan. Before the 6th the
     sheet is hatched (BE — before employment), and from the 6th she works the bench
     on dayshifts as a newcomer: no weekend, no night, until her thirty days of
     induction are over on 4 November 2026. Nothing else on the October plan is
     touched — every other row stays exactly as it was signed. */
  if(!db.meta.arrivalV6958){
    db.meta.arrivalV6958=1;
    const marie=(db.staff||[]).find(x=>x.id==='s11');
    if(marie){
      marie.joinDate='2026-10-06';
      marie.newcomerUntil=U.addDays('2026-10-06',29);      /* 4 November 2026 */
      marie.orientationStart='2026-10-06';
      marie.note='Joined 6 October 2026 — day shifts as a newcomer; exempt from the weekend and from nights until 4 November 2026';
    }
    const oct=db.workingPlans&&db.workingPlans['2026-10'];
    const p=oct&&oct.primary;
    if(p&&marie&&Array.isArray(p.dates)){
      const dates=p.dates;
      const codes=dates.map(iso=>{
        if(iso<'2026-10-06') return 'BE';                  /* not yet employed */
        return U.dow(iso)<5 ? 'D' : '';                    /* dayshifts; the weekend is exempt */
      });
      const row={name:marie.name, id:marie.id, codes};
      if(!Array.isArray(p.staff)) p.staff=[];
      const at=p.staff.findIndex(r=>r&&r.name===marie.name);
      if(at>=0){
        /* the row is already there: fill the days it does not answer for yet */
        const cur=p.staff[at];
        if(!Array.isArray(cur.codes)||cur.codes.length!==dates.length) cur.codes=codes;
        else cur.codes=cur.codes.map((c,i)=>(c===''||c===null||c===undefined)?codes[i]:c);
      } else {
        /* her place in the roster: after Bernadette, before the weekend technologist */
        const before=p.staff.findIndex(r=>r&&/YANSONEYE/.test(r.name));
        if(before>=0) p.staff.splice(before,0,row); else p.staff.push(row);
      }
      p.meta=p.meta||{};
      p.meta.revised=true;
      p.meta.revisedNote='6 October 2026 — Jeanne Claudine UWAYISABA joins the plan; the days before her arrival are hatched.';
    }
    /* a draft built before her arrival learned nothing of it: rebuild the drafts
       (never an official or a transcribed month), keeping what they replaced */
    Object.keys(db.workingPlans||{}).forEach(k=>{
      const e=db.workingPlans[k]; const q=e&&e.primary;
      if(!q||!q.meta||!q.meta.generated||q.meta.official||q.meta.transcribed) return;
      const built=generatePlan(k,db);
      built.meta=Object.assign({},built.meta,{label:'Draft for '+U.monthLabel(k)+
        ' — built from the department\'s rules and the record of previous months; review before publishing'});
      e.versions=(e.versions||[]).concat([q]);
      e.primary=built;
    });
  }
  /* v6.9.60 — her name is Jeanne Claudine, not Marie Claudine. The record, every row
     of every plan and version, the weekly unit rosters, the trainings she attended and
     any swap asked for in her favour are rewritten once, so nothing in the register
     still calls her by the wrong name. It is the same person throughout — the staff id
     (s11) is what joins the records, so nothing is left orphaned. */
  if(!db.meta.nameFixV6960){
    db.meta.nameFixV6960=1;
    const OLD='Marie Claudine UWAYISABA', NEW='Jeanne Claudine UWAYISABA';
    const fix=v=>v===OLD?NEW:v;
    (db.staff||[]).forEach(st=>{ if(st.name===OLD) st.name=NEW; });
    const fixRows=rows=>(rows||[]).forEach(r=>{ if(r&&r.name===OLD) r.name=NEW; });
    Object.keys(db.workingPlans||{}).forEach(k=>{
      const e=db.workingPlans[k]; if(!e) return;
      fixRows(e.primary&&e.primary.staff);
      (e.versions||[]).forEach(v=>fixRows(v&&v.staff));
    });
    Object.keys(db.unitRosters||{}).forEach(w=>{
      const rec=db.unitRosters[w]; if(!rec) return;
      Object.keys(rec.assignments||{}).forEach(iso=>{
        const day=rec.assignments[iso]||{};
        Object.keys(day).forEach(bench=>{ day[bench]=fix(day[bench]); });
      });
      Object.keys(rec.night||{}).forEach(iso=>{ rec.night[iso]=fix(rec.night[iso]); });
      Object.keys(rec.orientation||{}).forEach(name=>{
        if(name===OLD){ rec.orientation[NEW]=rec.orientation[name]; delete rec.orientation[OLD]; }
      });
    });
    (db.trainings||[]).forEach(t=>{ if(Array.isArray(t.attendees)) t.attendees=t.attendees.map(fix); });
    (db.swaps||[]).forEach(sw=>{ sw.from=fix(sw.from); sw.to=fix(sw.to); });
    if((db.settings||{}).prepared===OLD) db.settings.prepared=NEW;
  }
  /* v6.9.59 — Jeanne Claudine's contact details. The contact list printed a dash
     where a number should be, and the staff card had no way to reach her. */
  if(!db.meta.contactV6959){
    db.meta.contactV6959=1;
    const marie=(db.staff||[]).find(x=>x.id==='s11');
    if(marie){
      marie.phone='0784063985';
      marie.email='uwayjeanneclaudine@gmail.com';
    }
  }
  if(!db.meta.rosterOrderV6955){
    db.meta.rosterOrderV6955=1;
    const by=(id)=>db.staff.find(x=>x.id===id);
    const order={'s1':1,'s6':2,'s9':3,'s3':4,'s5':5,'s10':6,'s11':7,'s4':900};
    Object.keys(order).forEach(id=>{ const st=by(id); if(st) st.order=order[id]; });
    (db.staff||[]).forEach(st=>{ if(st.weekendOnly||st.pattern==='weekendonly') st.order=900; });
    const marie=by('s11');
    if(marie){
      /* two nights at a time, as the department works them — she was on the bench
         and never on the night, which left the nights shared between two people */
      if(!(marie.maxNights>0)){ marie.nightPref='2'; marie.maxNights=12; marie.maxConsecN=2; }
    }
    const jean=by('s6');
    if(jean) jean.actingManager=true;
    const mgr=db.staff.find(x=>x.pattern==='manager');
    if(mgr){ mgr.requisition=true; mgr.requisitionNote=S.REQUISITION_NOTE; }
  }
  /* v6.9.55 — the manager's thirty days are a carry-over of what FY 2025/2026
     never recorded: they are taken from 16 November 2026 and they run for the
     full thirty days, so the block ends on 15 December. The days come out of the
     year they were earned in; the dates stay where the department takes them. */
  if(!db.meta.leaveCarryV6955){
    db.meta.leaveCarryV6955=1;
    const k=(db.leaves||[]).find(l=>l.id==='l18'&&l.staffId==='s1');
    if(k){
      Object.assign(k,{type:'AL',from:'2026-11-16',to:'2026-12-15',backOn:'2026-12-16',
        days:30,status:'Planned',fy:'2026/2027',chargedFy:'2025/2026',autoEnd:true,
        note:'FY 2025/2026 carry-over \u2014 the manager\u2019s thirty days, taken from 16 November 2026 to 15 December 2026.'});
      /* one absence, one record: the two days pencilled for 8-9 December fall
         inside this block and are part of the same thirty */
      db.leaves=(db.leaves||[]).filter(l=>!(l.id==='l7'&&l.staffId==='s1'&&l.from>='2026-11-16'&&l.to<='2026-12-15'));
    }
  }
  if(!db.meta.rosterRulesV6948){
    db.meta.rosterRulesV6948=1;
    Object.keys(db.workingPlans||{}).sort().forEach(k=>{
      const e=db.workingPlans[k]; const p=e&&e.primary;
      if(!p||!p.meta||!p.meta.generated||p.meta.official||p.meta.transcribed) return;
      const built=generatePlan(k,db);
      built.meta=Object.assign({},built.meta,{label:'Draft for '+U.monthLabel(k)+
        ' — built from the department\'s rules and the record of previous months; review before publishing'});
      e.versions=(e.versions||[]).concat([p]);
      e.primary=built;
    });
  }
  /* v6.9.55 — the drafts are rebuilt under the roster rules above: the manager's
     own thirty days now sit on his row, nobody who is acting for him takes a
     night, the nights are shared by the four who are on the bench, and RBW only
     appears where the weekend had no cover. November 2026 had never been planned
     — the month the department is about to work is built here, as a draft, with
     the previous month's last week taken over as it stands. */
  if(!db.meta.rosterRulesV6955){
    db.meta.rosterRulesV6955=1;
    const rebuild=k=>{
      const e=db.workingPlans[k]; const p=e&&e.primary;
      if(!p||!p.meta||!p.meta.generated||p.meta.official||p.meta.transcribed) return;
      const built=generatePlan(k,db);
      built.meta=Object.assign({},built.meta,{label:'Draft for '+U.monthLabel(k)+
        ' — built from the department\'s rules and the record of previous months; review before publishing'});
      e.versions=(e.versions||[]).concat([p]);
      e.primary=built;
    };
    Object.keys(db.workingPlans||{}).sort().forEach(rebuild);
    if(!db.workingPlans['2026-11'] || !db.workingPlans['2026-11'].primary){
      const built=generatePlan('2026-11',db);
      built.meta=Object.assign({},built.meta,{label:'Draft for November 2026 — built from the department\'s rules, the annual-leave plan and the October plan it takes over from; review before publishing'});
      db.workingPlans['2026-11']={primary:built,versions:[((db.workingPlans['2026-11']||{}).primary)].filter(Boolean)};
    }
  }
  /* v6.9.61 — the drafts are rebuilt under the rest and span rules: a night block is
     repaid with as many days at home as it had nights, a day owed that falls on a
     weekend is recorded rather than written, and no plan runs more than seven days
     past its own month. A draft already on the machine was generated under the old
     rules and would read 13 December and a single day of rest, so it is rebuilt —
     the month it replaces is kept in `versions`, an official or transcribed month is
     never touched, and a month with no plan at all is left without one. */
  if(!db.meta.restV6961){
    db.meta.restV6961=1;
    Object.keys(db.workingPlans||{}).sort().forEach(k=>{
      const e=db.workingPlans[k]; const p=e&&e.primary;
      if(!p||!p.meta||!p.meta.generated||p.meta.official||p.meta.transcribed) return;
      const built=generatePlan(k,db);
      built.meta=Object.assign({},built.meta,{label:(p.meta&&p.meta.label)||('Draft for '+U.monthLabel(k)
        +' — built from the department\'s rules and the record of previous months; review before publishing')});
      e.versions=(e.versions||[]).concat([p]);
      e.primary=built;
    });
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
  /* v6.9 — bench contract for the two named people, stored as data rather than
     hard-coded in a view: Beatrice is the reception desk, with roughly one week a
     month on parasitology, biochemistry only in a pinch, and never phlebotomy or
     TB. Kelvin is reserve cover and appears on the grid only when a weekday would
     otherwise be down to two people. */
  if(!db.meta.workforceV69){
    const bea=(db.staff||[]).find(x=>/^Beatrice/i.test(x.name||''));
    if(bea){
      bea.homeBench='Reception'; bea.altBench='Parasitology'; bea.altMaxMonth=6;
      bea.avoidBench=['Phlebotomy','TB/Molecular'];
      bea.rareBench=['Biochemistry'];
    }
    db.staff.forEach(x=>{ if(/manager/i.test(x.role||'')){ x.reserveOnly=true; x.reserveMinDay=2; } });
    (db.trainings||[]).forEach(t=>{ if(/Rwanda Biomedical/i.test(t.organizer||'')) t.organizer='RBC'; });
    db.meta.workforceV69=1;
  }
  /* v6.9.10 — the bench contract as three strengths, stored as data:
       neverBench — a hard block (only a recorded manual override can place them)
       soloBench  — allowed only when they are the only person on duty that day
       reserveOnly/reserveMinDay — on the weekly roster only when the day's plan
                    carries no more than that many staff.
     Beatrice: never Biochemistry, Serology or TB; Phlebotomy only when she is
     alone. Kelvin: reserve cover, at most a two-person day. */
  if(!db.meta.workforceV610){
    const bea=(db.staff||[]).find(x=>/^Beatrice/i.test(x.name||''));
    if(bea){
      bea.homeBench='Reception'; bea.altBench='Parasitology'; bea.altMaxMonth=6;
      bea.neverBench=['Biochemistry','Serology','TB/Molecular'];
      bea.soloBench=['Phlebotomy'];
      bea.avoidBench=['TB/Molecular'];
      bea.rareBench=[];
    }
    (db.staff||[]).forEach(x=>{
      x.neverBench=[].concat(x.neverBench||[]);
      x.soloBench=[].concat(x.soloBench||[]);
      if(/manager/i.test(x.role||'')){ x.reserveOnly=true; if(x.reserveMinDay==null) x.reserveMinDay=2; }
    });
    db.meta.workforceV610=1;
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
/* The storage key, and a way to adopt what another tab wrote. Without this two windows
   of the same browser quietly diverge until one is closed. */
S.STORAGE_KEY=DB_KEY;
S.reloadFromStorage=function(){
  try{
    const raw=localStorage.getItem(DB_KEY); if(!raw) return false;
    const next=JSON.parse(raw);
    DB=normalize(next); dirty=false;
    S.emit('tab');
    return true;
  }catch(e){ return false; }
};
S.save=function(immediate){
  clearTimeout(saveTimer);
  if(immediate) return S._persist();
  saveTimer=setTimeout(S._persist,220);
};
S.subscribe=function(fn){ listeners.push(fn); return ()=>{ listeners=listeners.filter(f=>f!==fn); }; };
S.emit=function(reason){ listeners.forEach(f=>{ try{ f(reason); }catch(e){ console.warn('listener',e); } }); window.dispatchEvent(new CustomEvent('ls:changed',{detail:reason})); };
/* Local edits waiting to reach the shared copy. The sync layer reads this to know
   whether a pull would overwrite work that has not been pushed yet. */
let pending=0;
try{ pending=Number(localStorage.getItem('labSystems.pending.v1')||0)||0; }catch(e){}
function setPending(n){ pending=Math.max(0,n|0); try{ localStorage.setItem('labSystems.pending.v1',String(pending)); }catch(e){} }
S.pendingChanges=()=>pending;
S.clearPending=()=>setPending(0);
S.commit=function(mutator, audit){
  /* Behind the hidden buttons and disabled inputs: a read-only role — the visitor
     view, or any Viewer account — cannot write to the register at all. */
  if(LS.auth && LS.auth.user && !LS.auth.can('edit')){
    try{ LS.ui.toast('This is a read-only view — sign in to make changes',{type:'warn'}); }catch(e){}
    return false;
  }
  const db=S.db(); mutator(db);
  if(audit){ S.audit(audit); }
  delete db.meta.syncedAt;
  S.save();
  setPending(pending+1);
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
/* ——— The order the roster is read in —————————————————————
   The manager signs the plan, so his row is first; then the two technologists who
   hold a post; then the bench in the order the department calls it; and the weekend
   technologist last, because her row only ever carries Saturday and Sunday. A name
   nobody has placed yet joins at the end of the weekday staff — never above a named
   row, never below the weekend one. */
S.ROSTER_ORDER=['Kelvin SAMAHANI','Jean Paul NSENGIYUMVA','Dieudonne NIYIDUHABYOSE',
  'Beatrice NGEZEKURE','Patrick ISHIMWE','Bernadette MUHAWENIMANA',
  'Jeanne Claudine UWAYISABA','Aurelie YANSONEYE'];
S.rosterRank=function(staff){
  if(!staff) return 999;
  if(staff.weekendOnly || staff.pattern==='weekendonly') return 900;   // always the last row
  if(staff.order!=null && staff.order>0) return staff.order;
  const i=S.ROSTER_ORDER.indexOf(staff.name);
  if(i>=0) return i+1;
  return 500;                                                          // somebody new
};
S.rosterSorted=function(list){
  return (list||[]).slice().sort((a,b)=>S.rosterRank(a)-S.rosterRank(b)
    || String(a.name||'').localeCompare(String(b.name||'')));
};
S.activeStaff=()=>S.rosterSorted(S.db().staff.filter(s=>s.status==='active'));
/* ——— Who requests the lab commodities ———————————————
   Every Monday the department sends its week's request for reagents and
   consumables to the main pharmacy. The manager signs that request for as long as
   he is on the premises; a month he is away for the whole of (or any part of) is
   answered for by the person acting for him — in November 2026, Jean Paul. */
S.requisitionOfficer=function(monthKey){
  const mk=monthKey||U.monthKey();
  const days=U.monthRange(mk);
  const from=days[0], to=days[days.length-1];
  const staff=S.activeStaff();
  const mgr=staff.filter(s=>s.pattern==='manager')[0]||null;
  const away=mgr&&S.leaveInForce().some(l=>l.staffId===mgr.id && !(l.to<from||l.from>to));
  if(mgr && !away) return {name:mgr.name, id:mgr.id, acting:false, monthKey:mk};
  const act=staff.filter(s=>s.actingManager)[0]||null;
  if(act) return {name:act.name, id:act.id, acting:true, forName:mgr?mgr.name:null, monthKey:mk};
  return mgr?{name:mgr.name, id:mgr.id, acting:false, monthKey:mk}:null;
};
/* What the requisition means, in one line, wherever it is shown. */
S.REQUISITION_NOTE='Lab commodities are requested from the main pharmacy every Monday, for the whole week.';
/* The test menu is the department's, not the seed's. A test can be switched off
   (kept for history, gone from every picker) or deleted outright. */
S.allTests=()=>S.db().catalog.tests.filter(t=>!t.deleted);
S.tests=()=>S.allTests().filter(t=>t.active!==false);
S.testByName=n=>(S.db().catalog.tests||[]).find(t=>t.name===n)||null;
S.staffById=id=>S.db().staff.find(s=>s.id===id);
S.staffByName=n=>S.db().staff.find(s=>s.name===n);

/* ——— Orientation ———————————————————————————————————————————
   A new technologist spends the first 30 days rotating through the benches in four
   weeks, then sits an end-of-orientation assessment on the Wednesday (or Thursday)
   of week 4 — always before the thirtieth day.

     W1  Phlebotomy for the first three working days, then Reception
     W2  Haematology · Parasitology · TB
     W3  Biochemistry · Serology
     W4  works as a full member of staff and is assessed Wed or Thu */
const ORIENT_WEEKS=[
  {n:1, label:'Week 1 · Phlebotomy, then Reception',
   days:['Phlebotomy','Phlebotomy','Phlebotomy','Reception','Reception']},
  {n:2, label:'Week 2 · Haematology, Parasitology, TB', benches:['Hematology','Parasitology','TB/Molecular']},
  {n:3, label:'Week 3 · Biochemistry, Serology', benches:['Biochemistry','Serology']},
  {n:4, label:'Week 4 · full staff, end-of-orientation assessment', benches:[]}
];
S.orientationStart=function(st){
  if(!st) return null;
  const v=st.orientationStart||st.joinDate;
  return v?String(v).slice(0,10):null;
};
/* working days only — a weekend day does not count toward the five-day rotation */
S.workingDaysBetween=function(from,to){
  const out=[]; let d=U.parseISO(from), guard=0;
  while(U.isoLocal(d)<=to&&guard++<400){
    const dow=U.dow(U.isoLocal(d));
    if(dow<5) out.push(U.isoLocal(d));
    d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);
  }
  return out;
};
S.orientationPlan=function(st, iso){
  iso=iso||U.todayISO();
  const start=S.orientationStart(st);
  if(!start) return null;
  const day0=U.parseISO(start), target=U.parseISO(iso);
  const elapsed=Math.round((target-day0)/86400000);
  if(elapsed<0||elapsed>=30) return null;
  /* which five-day block is this date in, counting working days from the start */
  const worked=S.workingDaysBetween(start,iso).filter(d=>d<iso).length;
  const week=Math.min(4,Math.floor(worked/5)+1);
  const inWeek=worked%5;
  let benches=[];
  if(week===1){ benches=[ORIENT_WEEKS[0].days[Math.min(4,inWeek)]]; }
  else if(week===2){ benches=[ORIENT_WEEKS[1].benches[Math.min(2,inWeek%3)]]; }
  else if(week===3){ benches=[ORIENT_WEEKS[2].benches[Math.min(1,inWeek%2)]]; }
  else { benches=[]; }                       /* week 4: a full member of staff */
  /* the assessment falls on the Wednesday of week 4, Thursday if the Wednesday
     would land on or after the thirtieth day */
  let exam=null;
  const w4=S.workingDaysBetween(start, U.addDays(start,29));
  const idx=w4.findIndex(d=>Math.floor((U.parseISO(d)-day0)/86400000)>=21);
  const block=w4.slice(idx<0?w4.length:idx, (idx<0?w4.length:idx)+5);
  const pick=(dow)=>block.find(d=>U.dow(d)===dow);
  exam=pick(2)||pick(3)||null;
  return {start,week,weekLabel:ORIENT_WEEKS[week-1].label,benches,exam,
    dayNo:elapsed+1, remaining:30-(elapsed+1),
    weeks:ORIENT_WEEKS};
};
/* Every active person still inside their first thirty days. */
S.onOrientation=function(){
  return S.activeStaff().map(st=>({staff:st, plan:S.orientationPlan(st, U.todayISO())}))
    .filter(x=>x.plan);
};
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
/* ——— Posts that are held by name, not by turns ————————————————
   The laboratory manager, the laboratory quality manager and the laboratory
   safety officer hold a post. Training aimed at one of those posts is not a
   turn in the FIFO queue: the person who holds it goes. */
S.ROLE_POSTS={manager:'Laboratory Manager',qualityManager:'Lab Quality Manager',
  safetyOfficer:'Lab Safety Officer'};
S.postOf=function(staff){
  if(!staff) return '';
  if(staff.post) return staff.post;
  const key=staff.duty||(staff.pattern==='manager'?'manager':'');
  return S.ROLE_POSTS[key]||staff.role||'';
};
S.dutyKeyOf=function(staff){ return (staff&&(staff.duty||(staff.pattern==='manager'?'manager':'')))||''; };
S.isRolePost=function(staff){ return !!S.dutyKeyOf(staff); };
S.tatTarget=test=>sampleTAT(test,S.db().settings);
S.and=()=>{};
S.leaveTypeLabel=t=>LS_TYPES[S.leaveCode(t)]||t||'Leave';
S.leaveTypes=()=>LS_TYPES;

/* Leave that is in force — anything not declined/rejected. Approvals can be
   entered weeks ahead and are applied as an overlay; the stored working plan is
   never rewritten (register data stays exactly as signed). */
S.leaveInForce=()=>S.leaves().filter(l=>!/declin|reject/i.test(l.status||''));
/* `who` is a staff record, an id or a name — the working plan only ever has the
   name on a row, and the leave register only ever has the id. */
/* ——— A newcomer ——————————————————————————————————————————
   Somebody's first thirty days in the department are day shifts only: they carry the
   bench on a weekday and are exempt from the weekend rota and from nights until the
   month of induction is over. `newcomerUntil` is the last day of that month; after it
   they are an ordinary member of the roster. `joinDate` is the first day they can be
   on a plan at all — before it, the sheet is hatched, not blank. */
S.newcomerUntil=newcomerUntilOf; S.isNewcomer=isNewcomerAt; S.joinedBy=joinedBy;
S.leaveFor=function(who,iso){
  const staff=typeof who==='string'?(S.staffById(who)||S.staffByName(who)):who;
  if(!staff) return null;
  return S.leaveInForce().find(l=>l.staffId===staff.id && iso>=l.from && iso<=l.to)||null;
};
/* Printed documents carry approved leave only — a pending request is never
   signed onto the sheet. The screen uses the broader helper above. */
S.approvedLeaveFor=function(who,iso){
  const staff=typeof who==='string'?(S.staffById(who)||S.staffByName(who)):who;
  if(!staff) return null;
  return S.leaves().find(l=>l.staffId===staff.id && /^(approved|planned)$/i.test(l.status||'Approved') && iso>=l.from && iso<=l.to)||null;
};
S.approvedLeaveCodeFor=function(who,iso){
  const lv=S.approvedLeaveFor(who,iso); if(!lv) return '';
  return S.leaveCode(lv.type);
};
/* Working-plan code for an approved/pending leave, in the printed vocabulary. */
S.leaveCodeFor=function(who,iso){
  const lv=S.leaveFor(who,iso); if(!lv) return '';
  return S.leaveCode(lv.type);
};
/* Contract terms: under statute 30 calendar days a year, contractual 21 working
   days (Mon–Fri). Sponsor names who pays: Global Fund, own revenue, MoH, partner. */
S.CONTRACTS=['statute','contractual'];
S.SPONSORS=['Government of Rwanda','Global Fund','Own revenue','MoH / RBC','Partner / NGO'];
S.contractOf=function(staff){ return (staff&&staff.contract==='contractual')?'contractual':'statute'; };
/* ——— Training organisers ——————————————————————————————
   A short, growable picklist: the bodies and hotels that run the sessions this
   department sends staff to. Adding one from the form adds it for good. */
S.trainingOrganizers=function(){
  const db=S.db();
  db.trainingOrganizers=db.trainingOrganizers||[];
  (db.trainings||[]).forEach(t=>{
    const n=String(t.organizer||'').trim();
    if(n && db.trainingOrganizers.map(x=>x.toLowerCase()).indexOf(n.toLowerCase())<0) db.trainingOrganizers.push(n);
  });
  return db.trainingOrganizers.slice().sort((a,b)=>String(a).localeCompare(String(b)));
};
S.addTrainingOrganizer=function(name){
  name=String(name||'').trim(); if(!name) return false;
  const db=S.db(); db.trainingOrganizers=db.trainingOrganizers||[];
  if(db.trainingOrganizers.map(x=>x.toLowerCase()).indexOf(name.toLowerCase())>=0) return false;
  db.trainingOrganizers.push(name); db.trainingOrganizers.sort((a,b)=>String(a).localeCompare(String(b)));
  try{ S.save(); }catch(e){}
  return true;
};

S.leaveEntitlement=function(staff, fy){
  const kind=S.contractOf(staff);
  return {kind, label:kind==='contractual'?'Contractual':'Under statute',
    days:kind==='contractual'?21:30, workingDays:kind==='contractual',
    sponsor:(staff&&staff.sponsor)||'Government of Rwanda'};
};
S.leaveUsed=function(staff, fy){
  fy=fy||U.fyLabel();
  const rows=S.leaveInForce().filter(l=>l.staffId===staff.id && S.leaveCountsAgainstEntitlement(l.type) && chargedFy(l)===fy);
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
    p.staff.forEach(r=>(r.codes||[]).forEach(c=>{ if(!c) return; cells++; if(S.isLeaveCode(c)) abs++; }));
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
/* Only annual leave (AL) comes out of the thirty days. Sick, maternal, paternal,
   circumstantial, authorised leave and a public holiday are given, not drawn from the
   entitlement. Work desertion is recorded, but it is not leave and it is not granted. */
const LEAVE_KIND={AL:'annual',ML:'authorised',PL:'authorised',SL:'authorised',CL:'authorised',
  AA:'authorised',H:'authorised',TR:'authorised',WD:'unauthorised',BE:'none'};
S.leaveKind=type=>LEAVE_KIND[S.leaveCode(type)]||'annual';
S.leaveKindLabel=type=>{ const k=S.leaveKind(type);
  return k==='annual'?'Annual leave':k==='unauthorised'?'Unauthorised absence':k==='none'?'Not yet employed':'Authorised leave'; };
S.leaveCountsAgainstEntitlement=type=>S.leaveKind(type)==='annual' && S.leaveCode(type)==='AL';

/* A leave plan is a block of days charged to a fiscal year. It can be entered
   for a past FY (a carry-over still being taken) or for a future month. */
/* The fiscal year of a leave record is decided by its dates, never by a label
   typed on it. A block that starts in August 2026 is 2026/2027 whatever was
   written in the form — that is what stops a record appearing under the wrong
   year when you toggle between them. */
function fyOf(l){ return U.fyInfo(l.from||l.to||U.todayISO()).label; }
/* The year a block is CHARGED to. It is the year the leave falls in — except for a
   block that is being taken out of last year's balance, which says so on the record
   and is charged back to the year it was earned. The dates never move; only the
   book the days come out of does. */
function chargedFy(l){ return l&&l.chargedFy && /^\d{4}\/\d{4}$/.test(l.chargedFy) ? l.chargedFy : fyOf(l); }
function leaveDays(staff,l){
  if(S.contractOf(staff)!=='contractual') return U.daysBetween(l.from,l.to)+1;
  let n=0; const d=U.parseISO(l.from), end=U.parseISO(l.to);
  while(d<=end){ const w=d.getDay(); if(w!==0&&w!==6) n++; d.setDate(d.getDate()+1); }
  return n;
}
S.leaveDays=leaveDays;
S.leaveChargedFy=function(l){ return chargedFy(l); };
/* The annual-leave plan is the authority the working plan reads. This writes every
   block in the register onto the cells it covers, on a plan that may be blank or
   hand-edited — used when a month is created, and by the button on the roster. */
S.applyLeaveToPlan=function(plan){
  if(!plan||!Array.isArray(plan.dates)||!Array.isArray(plan.staff)) return 0;
  let written=0;
  plan.staff.forEach(row=>{
    plan.dates.forEach((iso,di)=>{
      const lv=S.leaveCodeFor(row.name,iso);
      if(lv && row.codes[di]!==lv){ row.codes[di]=lv; written++; }
    });
  });
  return written;
};
S.leaveRowsFor=function(staff,fy){
  return S.leaveInForce().filter(l=>l.staffId===staff.id && chargedFy(l)===fy)
    .sort((a,b)=>String(a.from).localeCompare(String(b.from)));
};
/* Everything the annual-leave plan book needs for one person: entitlement,
   days charged to the FY, days still to come, and the balance. */
/* Unused annual leave does not evaporate at the year boundary: it is carried into
   the next fiscal year and taken there. The carry is capped at one year's
   entitlement and only counts leave already in the past — a block planned for a
   future month is not "unused". */
S.leaveCarryOver=function(staff,fy){
  fy=fy||U.fyLabel();
  const prevLabel=(function(){
    /* 2026/2027 begins in 2026, so the year before it is 2025/2026 — both
       halves move back, which is what makes the previous-year lookup find
       anything at all. */
    const m=String(fy).match(/^(\d{4})\/(\d{4})$/); if(m) return (+m[1]-1)+'/'+(+m[2]-1);
    const info=U.fyInfo(U.addDays(U.todayISO(),-400)); return info.label;
  })();
  if(prevLabel===fy) return {prevFy:null,days:0,taken:0,entitlement:0};
  const ent=S.leaveEntitlement(staff,prevLabel);
  const prevRows=S.leaveRowsFor(staff,prevLabel);
  /* A carry-over is only real when that year was actually being recorded. If the
     register holds nothing at all for the person in the previous fiscal year, no
     leave was being tracked then, and turning that silence into "thirty days
     unused" would invent a balance — so nothing is carried. */
  if(!prevRows.length) return {prevFy:prevLabel,days:0,taken:0,entitlement:ent.days,unrecorded:true};
  const rows=prevRows.filter(l=>S.leaveCountsAgainstEntitlement(l.type));
  const taken=U.sum(rows,l=>leaveDays(staff,l));
  const days=Math.max(0,Math.min(ent.days,ent.days-taken));
  return {prevFy:prevLabel,days,taken,entitlement:ent.days};
};
/* Everything the plan book needs for one person, for one fiscal year — read from
   two angles that must not be confused:
     · what is TAKEN in the year — the blocks whose dates fall inside it, which is
       what a reader looking at November needs to see on the row;
     · what is CHARGED to the year — the blocks whose days come out of that year's
       entitlement, which is what the balance is counted from.
   A carry-over taken in November belongs to both books: it is taken in 2026/27 and
   charged to 2025/26. Showing only the charge hid the manager's own thirty days
   from the year he is actually away in. */
S.leaveBook=function(staff,fy){
  fy=fy||U.fyLabel();
  const e=S.leaveEntitlement(staff,fy);
  const chargedRows=S.leaveRowsFor(staff,fy);
  const datedRows=S.leaveInForce().filter(l=>l.staffId===staff.id && fyOf(l)===fy);
  const byId={}; datedRows.concat(chargedRows).forEach(l=>{ byId[l.id]=l; });
  const rows=Object.keys(byId).map(id=>byId[id])
    .sort((a,b)=>String(a.from).localeCompare(String(b.from)));
  const annual=datedRows.filter(l=>S.leaveCountsAgainstEntitlement(l.type))
    .sort((a,b)=>String(a.from).localeCompare(String(b.from)));
  const taken=U.sum(annual.filter(l=>l.to<U.todayISO()),l=>leaveDays(staff,l));
  const running=U.sum(annual.filter(l=>l.from<=U.todayISO()&&l.to>=U.todayISO()),l=>leaveDays(staff,l));
  const planned=U.sum(annual.filter(l=>l.from>U.todayISO()),l=>leaveDays(staff,l));
  const charged=U.sum(chargedRows.filter(l=>S.leaveCountsAgainstEntitlement(l.type)),l=>leaveDays(staff,l));
  /* a block that is taken here but charged to the year it was earned in */
  const chargedElsewhere=annual.filter(l=>chargedFy(l)!==fy)
    .map(l=>({id:l.id, from:l.from, to:l.to, fy:chargedFy(l), days:leaveDays(staff,l)}));
  const authorised=rows.filter(l=>S.leaveKind(l.type)==='authorised' && l.type!=='W');
  const carry=S.leaveCarryOver(staff,fy);
  const pool=e.days+carry.days;
  return {staff, fy, entitlement:e, rows, annual, chargedRows, chargedElsewhere,
    taken, running, planned, charged, carry, pool,
    authorisedDays:U.sum(authorised,l=>leaveDays(staff,l)),
    balance:Math.max(0,pool-charged),
    over:charged>pool?charged-pool:0};
};
/* Fiscal years that have leave attached, newest first, always including the
   current one and the one before it. */
S.leaveFys=function(){
  const set={}; set[U.fyLabel()]=1; set[U.fyInfo(U.addDays(U.todayISO(),-400)).label]=1;
  S.leaves().forEach(l=>{ set[chargedFy(l)]=1; });
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
    const g=byLab[lab]=byLab[lab]||{lab,registered:0,resulted:0,compliant:0,sumH:0,sumTargetH:0,open:0,unreceived:0};
    g.registered++;
    const t=S.tatFor(s);
    g.sumTargetH+=t.targetH;
    if(s.resultedAt){ g.resulted++; g.sumH+=t.elapsedH; if(t.elapsedH<=t.targetH) g.compliant++; }
    /* An open sample whose clock has not started yet — nothing has been received
       at this laboratory — cannot be compliant or late. It is counted apart. */
    else { g.open++; if(t.from!=='reception') g.unreceived=(g.unreceived||0)+1; }
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

/* Every path that produces a plan goes through here, so the leave register is
   always written over the grid it returns — a generated month, a rebuilt draft, a
   month created from the console. */
S.buildPlan=mk=>{ const p=generatePlan(mk,S.db()); S.applyLeaveToPlan(p); return p; };
S.ensurePlan=function(mk){ const db=S.db(); return db.workingPlans[mk]||null; };
S.hasPlan=mk=>!!(S.db().workingPlans[mk]&&S.db().workingPlans[mk].primary);
S.createPlan=function(mk){
  const db=S.db();
  /* the register is written over the generated grid, so a month created today
     never shows a person at work through leave that is already on the books */
  const plan=S.buildPlan(mk);
  db.workingPlans[mk]={ primary:plan, versions:[] };
  S.save(); return db.workingPlans[mk];
};
S.planMonths=function(){ return Object.keys(S.db().workingPlans||{}).filter(k=>S.db().workingPlans[k]&&S.db().workingPlans[k].primary).sort(); };
S.planFor=mk=>S.db().workingPlans[mk]||null;

/* TAT computation */
/* The clock starts when the specimen is received at this laboratory — not when it
   was collected at the health centre. A sample that travelled overnight must not
   spend those hours against the receiving laboratory's target. Where a reception
   stamp exists it is used; where it does not, the collection time is the only
   honest fallback, and the selector says which one it used. */
S.tatStartOf=function(s){
  const at=(s&&s.receivedAt)||null;
  if(at) return {at:new Date(at), from:'reception'};
  const c=(s&&(s.collectionAt||s.collectionDate))||null;
  if(c) return {at:new Date(c), from:'collection'};
  return {at:new Date(), from:'unknown'};
};
/* Records written before the reception stamp existed have none. Their status and
   their dispatch date prove the specimen was received, so the clock is running and
   the earliest defensible start — collection — is used. Nothing is invented: an
   order that is still only Registered has no clock at all. */
S.receivedEvidence=function(s){
  if(!s) return false;
  if(s.receivedAt||s.resultedAt||s.sentDate) return true;
  return /^(Received|Pending|Resulting|Resulted|Done|Positive|Negative)$/i.test(String(s.status||''));
};
S.tatFor=function(s){
  const target=s.tatTargetDays||S.tatTarget(s.test);
  const from=S.tatStartOf(s), start=from.at;
  const started=from.from==='reception'||S.receivedEvidence(s);
  const end=s.resultedAt? new Date(s.resultedAt) : new Date();
  const hours=(end-start)/3600000;
  const elapsedH=s.resultedAt? hours : (Date.now()-start.getTime())/3600000;
  return { targetH:target*24, elapsedH, remainingH:target*24-elapsedH, ratio:elapsedH/(target*24),
    /* A clock that has not started cannot have run out. Until reception stamps the
       specimen, the order is underlined as "awaiting reception", never as late. */
    breached:started && elapsedH>target*24, done:!!s.resultedAt, started, startFrom:from.from,
    awaitingReception:!started, dueAt:new Date(start.getTime()+target*86400000) };
};

/* ——— Consumables an order actually draws ——————————————————————
   A blood-culture order takes one bottle off the shelf and no other registration
   takes anything. The bottle is the neonatal/paediatric one when the patient is
   fifteen or younger and the adult one after that. The movement carries the order's
   id, so deleting the order puts the same bottle back; nothing is ever invented. */
S.BOTTLE_TEST='Blood Culture';
S.bottleAgeGroup=function(sample){
  let age=sample&&sample.age!==''&&sample.age!=null?parseFloat(sample.age):NaN;
  if(isNaN(age)&&sample&&sample.dob) age=parseFloat(U.ageFromDob(sample.dob));
  if(isNaN(age)) return null;                        // age unknown: no guess
  return age<=15?'Pediatric/Neonatal':'Adult';
};
S.bloodCultureOf=function(sample){
  const tests=(sample&&sample.tests&&sample.tests.length?sample.tests:[sample&&sample.test]).filter(Boolean);
  return tests.indexOf(S.BOTTLE_TEST)>=0;
};
S.drawBottle=function(d,sample){
  if(!sample||!S.bloodCultureOf(sample)) return null;
  const c=(d.catalog.consumables||[]).find(x=>/blood culture/i.test(x.name||''))||null;
  if(!c) return null;
  d.stock=d.stock||{batches:[],entries:[]};
  const want=S.bottleAgeGroup(sample);
  const lots=(d.stock.batches||[]).filter(b=>b.cid===c.id&&(b.qty||0)>0);
  let lot=want?lots.filter(b=>(b.ageGroup||'')===want).sort((a,b)=>String(a.expiry).localeCompare(String(b.expiry)))[0]:null;
  let note='Drawn for order '+sample.sampleId;
  if(!lot){ lot=lots.sort((a,b)=>String(a.expiry).localeCompare(String(b.expiry)))[0]||null;
    if(lot&&want&&(lot.ageGroup||'')!==want) note+=' · no '+want+' bottle on the shelf, took '+(lot.ageGroup||'unlabelled'); }
  if(lot) lot.qty=Math.max(0,(lot.qty||0)-1);
  const entry={id:U.uid('e'),cid:c.id,date:U.todayISO(),type:'used',ageGroup:lot?(lot.ageGroup||want||null):want,
    qty:1,batch:lot?lot.id:null,sampleId:sample.id,order:sample.sampleId,note};
  d.stock.entries=d.stock.entries||[]; d.stock.entries.push(entry);
  return entry;
};
/* Deleting an order returns its bottle, and only its own bottle. */
S.restoreBottle=function(d,sampleId){
  d.stock=d.stock||{batches:[],entries:[]};
  const mine=(d.stock.entries||[]).filter(e=>e.type==='used'&&e.sampleId===sampleId);
  mine.forEach(e=>{
    const b=(d.stock.batches||[]).find(x=>x.id===e.batch);
    if(b) b.qty=(b.qty||0)+(e.qty||1);
    d.stock.entries=d.stock.entries.filter(x=>x!==e);
  });
  return mine.length;
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
    /* Consumption is also stated in months, because that is how the bench plans:
       "no more than five blood-culture bottles in a month". `monthlyCap` is that
       ceiling; `perMonth` is what the issue log says is actually used. */
    const usedIn=days=>U.sum(db.stock.entries.filter(e=>e.cid===c.id && e.type==='used' && e.date>=U.addDays(U.todayISO(),-days)),e=>e.qty);
    const used30=usedIn(30), used90Total=U.sum(used90,e=>e.qty);
    /* The real 90-day average, not the floored burn used for days-of-cover. No
       issues at all means no monthly usage — never a nominal 1.5 a month. */
    const perMonth=Math.round((used90Total/3)*10)/10;
    const cap=+c.monthlyCap||null;
    /* The ceiling is checked against the last thirty days, which is the month the
       bench is standing in. Blood culture is also split by bottle, because the
       ceiling is two paediatric and one adult. */
    const since30=U.addDays(U.todayISO(),-30);
    const useByAge=g=>U.sum(db.stock.entries.filter(e=>e.cid===c.id&&e.type==='used'&&e.date>=since30&&((e.ageGroup||'')===g)),e=>e.qty);
    const byAge=c.capSplit?Object.keys(c.capSplit).map(g=>({group:g,used:useByAge(g),cap:c.capSplit[g]})):null;
    return { ...c, onHand, batches, nearest, burn, daysLeft: burn? Math.round(onHand/burn) : 999,
      used30, perMonth, cap, capPct: cap? Math.min(999,Math.round(perMonth/cap*100)) : null,
      usedMonth:used30, overCap: !!(cap&&used30>cap), byAge,
      monthsLeft: perMonth? Math.round(onHand/perMonth*10)/10 : null,
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
/* Is this person's row actually on the plan for that day? A blank cell and a person
   who is not on the plan at all both read as '' from codeFor, and they are different
   facts: one was left off the duty, the other was never drawn into the month. */
S.planRowFor=function(staff, iso){
  if(!staff) return null;
  const p=S.planForMonth(String(iso).slice(0,7)); if(!p) return null;
  if((p.dates||[]).indexOf(iso)<0) return null;
  return (p.staff||[]).find(s=>s.id===staff.id||s.name===staff.name)||null;
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
    if(S.isLeaveCode(code)) return {code,kind:'leave',label:S.leaveTypeLabel(code),tone:'blue',source:'plan'};
    if(code==='BE') return {code,kind:'off',label:'Before employment',tone:'slate',source:'plan'};
    if(code==='MS') return {code,kind:'training',label:'Mentorship — outbreaks surveillance and HIV service delivery',tone:'gold',source:'plan'};
    if(code==='OFF'||code==='W') return {code,kind:'off',label:'At home',tone:'slate',source:'plan'};
    if(code==='RBW') return {code,kind:'off',label:'Rest before work',tone:'slate',source:'plan'};

  }
  /* A blank cell in a plan that covers the day is not a missing answer — it is the
     answer. The person is at home: the plan drew the duty and left them off it, so
     they must not appear as day cover on the strength of their contract. Someone who
     has no row on that plan at all is in the same position — they are not on the
     duty that was drawn — so the plan speaks for them too. Only when no plan covers
     the day does the contract get to speak. */
  if(S.planCovers(iso)){
    const listed=!!S.planRowFor(staff,iso);
    return {code:'',kind:'off',label:'At home',tone:'slate',source:'plan',blank:!listed,
      note:listed?'blank cell on the working plan':'not on the published working plan'};
  }
  // No plan published for that day: fall back to the contract, clearly labelled.
  const dow=U.dow(iso);
  if(staff.weekendOnly) return dow>=5?{code:'DN',kind:'daynight',label:'On duty · day + night',tone:'teal',source:'pattern'}:{code:'OFF',kind:'off',label:'At home',tone:'slate',source:'pattern'};
  if(staff.pattern==='manager'){
    /* The manager is reserve cover: never on the grid, only called in when a
       weekday would otherwise be down to two people or fewer. */
    if(dow>=5) return {code:'OFF',kind:'off',label:'At home',tone:'slate',source:'pattern'};
    const peers=S.activeStaff().filter(s=>s.id!==staff.id && s.pattern!=='manager');
    const atHome=(s)=>{ if(s.weekendOnly) return true; if(s.pattern==='dayonly') return false; return false; };
    const available=peers.filter(s=>!atHome(s)).length;
    return available<=2
      ? {code:'D',kind:'day',label:'Reserve cover · day',tone:'teal',source:'pattern'}
      : {code:'OFF',kind:'off',label:'At home · reserve only',tone:'slate',source:'pattern'};
  }
  if(staff.pattern==='dayonly') return dow>=5?{code:'OFF',kind:'off',label:'At home',tone:'slate',source:'pattern'}:{code:'D',kind:'day',label:'On duty · day 08:00–17:00',tone:'teal',source:'pattern'};
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
/* Who is on nights on a date. The working plan is the source of truth: a night code
   (N) or a day+night code (DN) names the person, and that name is what the roster
   shows. A night entered by hand in the unit roster still wins — the override is
   always available — and where no plan covers the day the contract pattern is used,
   labelled as such so nobody mistakes it for the plan. */
S.nightCover=function(iso){
  const start=S.weekStart(iso);
  const manual=S.unitNight(start,iso);
  if(manual) return {name:manual, source:'manual', code:'N'};
  const p=S.planForMonth(String(iso).slice(0,7));
  if(p&&(p.dates||[]).indexOf(iso)>=0){
    const di=p.dates.indexOf(iso);
    const row=(p.staff||[]).find(st=>{ const c=(st.codes||[])[di]; return c==='N'||c==='DN'; });
    if(row) return {name:row.name, source:'plan', code:(row.codes||[])[di], staff:row.id?S.staffById(row.id):S.staffByName(row.name)||null};
    return {name:'', source:'plan', code:''};
  }
  const pat=S.activeStaff().find(st=>{ const k=S.shiftState(st,iso).kind; return k==='night'||k==='daynight'; });
  return pat?{name:pat.name, source:'pattern', code:'N', staff:pat}:{name:'', source:'none', code:''};
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
/* Live activity reads the referral register in both directions: a sample being
   registered and a result being released are separate events with separate
   timestamps, so the feed shows the same registered → resulted story the
   throughput chart draws. */
S.feed=function(){
  const db=S.db();
  const fromAudit=(db.audit||[]).slice(0,8).map(a=>({icon:a.action.startsWith('stock')?'package':a.action.startsWith('sample')?'flask-conical':a.action.startsWith('leave')?'calendar-clock':'check-circle', tone:a.action.includes('reject')?'rose':a.action==='sample.result'?'teal':a.action.startsWith('sample')?'gold':'gold', text:'<b>'+U.esc(a.actor||'System')+'</b> — '+U.esc(a.detail||a.action), ts:a.ts}));
  const ref=S.referredSamples();
  const registered=ref.filter(s=>String(s.collectionDate||'')>=U.addDays(U.todayISO(),-2)).slice(-5).reverse().map(s=>({
    icon:'flask-conical', tone:'gold',
    text:'<b>'+U.esc(s.sampleId)+'</b> registered · '+U.esc(s.test)+' · '+U.esc(s.priority)+' → '+U.esc(s.hospital||'referral'),
    ts:new Date(s.collectionAt||s.collectionDate).toISOString()}));
  const resulted=ref.filter(s=>s.resultedAt && String(s.resultedAt).slice(0,10)>=U.addDays(U.todayISO(),-3)).slice(-5).reverse().map(s=>({
    icon:'check-circle', tone:'teal',
    text:'Result back on <b>'+U.esc(s.sampleId)+'</b> · '+U.esc(s.test)+' · '+U.esc(s.resultValue||'released'),
    ts:new Date(s.resultedAt).toISOString()}));
  return fromAudit.concat(registered,resulted).sort((a,b)=>String(b.ts).localeCompare(String(a.ts))).slice(0,10);
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
