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

const EXTRA_TESTS = [
  {id:'t11',name:'CBC (Full Blood Count)',cat:'Hematology',code:'CBC',tat:1,bench:true,price:2500},
  {id:'t12',name:'Malaria RDT',cat:'Parasitology',code:'MRDT',tat:1,bench:true,price:1000},
  {id:'t13',name:'Fasting Blood Glucose',cat:'Biochemistry',code:'GLU',tat:1,bench:true,price:1500},
  {id:'t14',name:'Serum Creatinine',cat:'Biochemistry',code:'CREA',tat:1,bench:true,price:2000},
  {id:'t15',name:'ALT (SGPT)',cat:'Biochemistry',code:'ALT',tat:1,bench:true,price:2000},
  {id:'t16',name:'HIV Rapid Test (Determine)',cat:'Serology',code:'HIVR',tat:1,bench:true,price:0},
  {id:'t17',name:'Syphilis (RPR)',cat:'Serology',code:'RPR',tat:1,bench:true,price:1000},
  {id:'t18',name:'Urinalysis',cat:'Parasitology',code:'URIN',tat:1,bench:true,price:800},
  {id:'t19',name:'Sputum AFB (Ziehl-Neelsen)',cat:'Microbiology',code:'AFB',tat:2,bench:true,price:1200},
  {id:'t20',name:'Blood Slide for Malaria',cat:'Parasitology',code:'BSM',tat:1,bench:true,price:800}
];
const EXTRA_CONSUMABLES = [
  {id:'c6',name:'CBC Diluent',unit:'L',threshold:2,ageGroup:false,coldChain:false,unitCost:38000,supplier:'s1',min:2,max:8},
  {id:'c7',name:'Chemistry Reagent Pack',unit:'packs',threshold:4,ageGroup:false,coldChain:true,minTemp:2,maxTemp:8,unitCost:64000,supplier:'s2',min:4,max:12},
  {id:'c8',name:'GeneXpert MTB Cartridges',unit:'cartridges',threshold:20,ageGroup:false,coldChain:true,minTemp:15,maxTemp:28,unitCost:12500,supplier:'s3',min:20,max:80},
  {id:'c9',name:'EDTA Blood Tubes',unit:'tubes',threshold:150,ageGroup:false,coldChain:false,unitCost:220,supplier:'s1',min:150,max:600},
  {id:'c10',name:'Sodium Citrate Tubes',unit:'tubes',threshold:80,ageGroup:false,coldChain:false,unitCost:280,supplier:'s1',min:80,max:300},
  {id:'c11',name:'Glucose Test Strips',unit:'strips',threshold:100,ageGroup:false,coldChain:false,unitCost:180,supplier:'s4',min:100,max:500},
  {id:'c12',name:'Sharps Disposal Boxes',unit:'boxes',threshold:10,ageGroup:false,coldChain:false,unitCost:3200,supplier:'s4',min:10,max:40},
  {id:'c13',name:'Nitrile Examination Gloves',unit:'boxes',threshold:20,ageGroup:false,coldChain:false,unitCost:9500,supplier:'s4',min:20,max:80}
];
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
  const mk=(id,name,model,loc,status,uptime,nextPM,serial,manu)=>({id,name,model,location:loc,status,uptime,nextPM,serial,manufacturer:manu,lastPM:U.addDays(today,-Math.round(30+Math.random()*20)),downtime:[]});
  return [
    mk('eq1','GeneXpert IV','Cepheid GX-IV-16','Molecular Bay',  'operational',98.4,'2026-11-14','GX16-2291-A','Cepheid'),
    mk('eq2','Sysmex XN-330','Automated Hematology','Hematology Bench','operational',99.1,'2026-12-02','XN330-8841','Sysmex'),
    mk('eq3','Mindray BS-240','Clinical Chemistry','Chemistry Bench','maintenance',91.6,'2026-10-27','BS240-1173','Mindray'),
    mk('eq4','Hettich Rotina 420','Centrifuge','Sample Reception','operational',99.7,'2027-01-19','RT420-5520','Hettich'),
    mk('eq5','Labcold Blood Bank Fridge','2–8 °C Cold Chain','Blood Bank','warning',87.2,'2026-10-24','LC-RLF-0912','Labcold'),
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
  const tests=((db.catalog||{}).tests||[]).filter(t=>t.bench);
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
const COSTS={c1:8500,c2:1200,c3:14500,c4:14500,c5:16000};
const BURN={c1:1.8,c2:7.4,c3:0.55,c4:0.42,c5:1.15,c6:0.23,c7:0.31,c8:2.2,c9:9.5,c10:3.1,c11:4.6,c12:0.22,c13:0.55};
const DAYS=[42,12,68,25,9,55,18,120,36,75,27,90,48];
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
function buildStockTelemetry(db){
  const today=U.todayISO();
  db.catalog.consumables.forEach((c,i)=>{
    if(c.unitCost==null) c.unitCost=COSTS[c.id]||(1800+i*900);
    if(!c.supplier) c.supplier='s'+((i%4)+1);
    if(c.min==null) c.min=c.threshold||10;
    if(c.max==null) c.max=(c.threshold||10)*3;
    if(c.leadDays==null) c.leadDays=SUPPLIERS[i%4].leadDays;
  });
  const entries=[]; const batches=[];
  db.catalog.consumables.forEach((c,i)=>{
    const r=U.rng('stock-'+c.id);
    const burn=BURN[c.id]||0.5;
    const target=Math.max(2,Math.round(burn*DAYS[i%DAYS.length]));
    // 12 months of issue log
    for(let m=11;m>=0;m--){
      const base=new Date(); base.setDate(1); base.setMonth(base.getMonth()-m);
      const monthQty=Math.max(1,Math.round(burn*30*(0.75+r()*0.55)));
      const n=Math.min(3,Math.max(1,Math.round(monthQty/6)));
      let left=monthQty;
      for(let k=0;k<n;k++){
        const qty=k===n-1?left:Math.max(1,Math.round(left*(0.35+r()*0.3)));
        left-=qty;
        const day=Math.min(27,3+Math.floor(r()*24));
        const d=new Date(base.getFullYear(),base.getMonth(),day);
        entries.push({id:'e'+c.id+'m'+m+'k'+k, cid:c.id, date:U.isoLocal(d), type:'used', qty, note:'Issued to bench'});
      }
      if(m%3===0){
        entries.push({id:'e'+c.id+'r'+m, cid:c.id, date:U.isoLocal(new Date(base.getFullYear(),base.getMonth(),Math.min(25,4+Math.floor(r()*18)))), type:'received', qty:Math.round(monthQty*1.25), note:'Received from '+(SUPPLIERS[i%4].name)});
      }
    }
    // three lots summing to target
    const splits=[0.55,0.3,0.15];
    splits.forEach((sp,k)=>{
      const qty=Math.max(0,Math.round(target*sp));
      if(!qty) return;
      const expDays = k===0 ? (i%5===0? -6 : 8+Math.round(r()*38)) : (k===1? 90+Math.round(r()*140) : 260+Math.round(r()*240));
      batches.push({id:'b'+c.id+'l'+k, cid:c.id, qty, received:U.addDays(today,-Math.round(20+r()*120)),
        expiry:U.addDays(today,expDays), ageGroup:c.ageGroup?(k%2?'Adult':'Pediatric/Neonatal'):undefined,
        lot:'LOT-'+String(2600+i*7+k), note:k===0&&i%5===0?'Excursion assessed — pending disposal':''});
    });
  });
  db.stock.entries=entries.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  db.stock.batches=batches;
  db.meta.stockSeeded=true;
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
  const tests=seedDB.catalog.tests.filter(t=>t.bench);
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
      const onLeave=leaves.find(l=>l.staffId===s.id && iso>=l.from && iso<=l.to);
      if(onLeave){ codes.push(onLeave.type==='TR'?'TR':onLeave.type==='SICK'?'SICK':onLeave.type||'AL'); return; }
      if(s.weekendOnly){ codes.push(isWeekend?'DN':'OFF'); return; }
      if(s.pattern==='manager'||s.pattern==='dayonly'){ codes.push(isWeekend?'OFF':'D'); return; }
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
  EXTRA_TESTS.forEach(t=>{ if(!db.catalog.tests.find(x=>x.id===t.id)) db.catalog.tests.push(Object.assign({},t)); });
  db.catalog.consumables=db.catalog.consumables||[];
  EXTRA_CONSUMABLES.forEach(c=>{ if(!db.catalog.consumables.find(x=>x.id===c.id)) db.catalog.consumables.push(Object.assign({},c)); });
  db.stock=db.stock||{batches:[],entries:[]};
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
  db.coldChain=db.coldChain||[
    {id:'cc1', at:new Date(Date.now()-3600e3*5).toISOString(), device:'Blood Bank Fridge', temp:9.4, min:2,max:8, duration:42, action:'Door closed; contents assessed, no discard', actor:'Beatrice NGEZEKURE'},
    {id:'cc2', at:new Date(Date.now()-86400e3*9).toISOString(), device:'Chemistry Reagent Fridge', temp:7.8, min:2,max:8, duration:0, action:'In range', actor:'System'},
    {id:'cc3', at:new Date(Date.now()-86400e3*16).toISOString(), device:'Blood Bank Fridge', temp:2.9, min:2,max:8, duration:0, action:'In range', actor:'System'}
  ];
  if(!db.meta.stockSeeded){ buildStockTelemetry(db); }
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
  });
  // telemetry on first run of v6
  if(!db.meta.telemetrySeeded){
    const gen=generateSamples(db).filter(g=>!db.samples.some(s=>s.sampleId===g.sampleId));
    db.samples=db.samples.concat(gen);
    const seqs=db.samples.map(s=>{ const m=/^[A-Z]+-\d{4}-(\d+)$/.exec(String(s.sampleId||'')); return m?parseInt(m[1],10):0; });
    db.meta.sampleSeq=Math.max.apply(null,seqs.concat([120000]));
    db.meta.telemetrySeeded=true;
  }
  // Twelve months of collection history so the monthly throughput view can show
  // slow assays (TB culture, viral load) that report months after registration.
  if(!db.meta.throughputBackfill){
    const have=new Set(db.samples.map(s=>s.collectionDate).filter(Boolean));
    const hist=generateSamples(db,{days:395,seq:800000,tag:'h',skipDates:have,rate:0.35});
    db.samples=db.samples.concat(hist);
    db.meta.throughputBackfill=U.todayISO();
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
S.staffById=id=>S.db().staff.find(s=>s.id===id);
S.staffByName=n=>S.db().staff.find(s=>s.name===n);
S.tests=()=>S.db().catalog.tests;
S.consumables=()=>S.db().catalog.consumables;
S.consumable=id=>S.db().catalog.consumables.find(c=>c.id===id);
S.batchesFor=cid=>S.db().stock.batches.filter(b=>b.cid===cid && (b.qty||0)>0);
S.onHand=cid=>U.sum(S.batchesFor(cid),b=>b.qty||0);
S.leaves=()=>S.db().leaves||[];
S.holiday=(iso)=>(S.db().holidays||[]).find(h=>h.date===iso);
S.tatTarget=test=>sampleTAT(test,S.db().settings);
S.and=()=>{};
S.leaveTypeLabel=t=>LS_TYPES[t]||t||'Leave';
S.leaveTypes=()=>LS_TYPES;
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
  return db.catalog.consumables.map(c=>{
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
  const db=S.db(); const samples=db.samples;
  const active=samples.filter(s=>!s.resultedAt);
  const today=U.todayISO();
  const todays=samples.filter(s=>s.collectionDate===today);
  const overdue=active.filter(s=>S.tatFor(s).breached);
  const stat=active.filter(s=>s.priority==='STAT');
  const resulted30=samples.filter(s=>s.resultedAt && s.resultedAt>=U.addDays(today,-30));
  const compliant30=resulted30.filter(s=>{ const t=S.tatFor(s); return t.elapsedH<=t.targetH; });
  return {
    total:samples.length, active:active.length, today:todays.length, overdue:overdue.length, stat:stat.length,
    pending:active.length, resulted30:resulted30.length,
    tatCompliance: resulted30.length? Math.round(compliant30.length/resulted30.length*1000)/10 : 0,
    rejectionRate: 1.8, repeatRate: 2.4,
    inTransit: active.filter(s=>s.status==='Received').length
  };
};
S.throughput=function(days){
  const db=S.db(); const out=[];
  for(let i=(days||14)-1;i>=0;i--){
    const d=U.addDays(U.todayISO(),-i);
    const day=db.samples.filter(s=>s.collectionDate===d);
    const resulted=db.samples.filter(s=>s.resultedAt && s.resultedAt.slice(0,10)===d);
    out.push({date:d, registered:day.length, resulted:resulted.length, stat:day.filter(s=>s.priority==='STAT').length});
  }
  return out;
};
/* Monthly throughput — the unit only refers a few samples a month, and slow
   assays (TB culture, viral load) finish months later, so daily buckets hide them. */
S.monthlyThroughput=function(months){
  const db=S.db(); const n=months||12; const out=[]; const now=new Date();
  const catOf=s=>s.cat||'Other';
  for(let i=n-1;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const reg=db.samples.filter(s=>String(s.collectionDate||'').slice(0,7)===key);
    const res=db.samples.filter(s=>s.resultedAt&&String(s.resultedAt).slice(0,7)===key);
    const byCat={};
    const bump=(s,field)=>{ const c=catOf(s); byCat[c]=byCat[c]||{registered:0,resulted:0}; byCat[c][field]++; };
    reg.forEach(s=>bump(s,'registered'));
    res.forEach(s=>bump(s,'resulted'));
    out.push({key, label:U.M3[d.getMonth()]+' '+(''+d.getFullYear()).slice(2), year:d.getFullYear(),
      registered:reg.length, resulted:res.length, stat:reg.filter(s=>s.priority==='STAT').length, byCat});
  }
  return out;
};
S.throughputCats=function(){ return U.uniq(S.db().samples.map(s=>s.cat||'Other')).sort(); };

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
    if(code==='D')  return {code,kind:'day',label:'On duty · day',tone:'teal',source:'plan'};
    if(code==='N')  return {code,kind:'night',label:'On duty · night',tone:'blue',source:'plan'};
    if(code==='DN') return {code,kind:'daynight',label:'On duty · day + night',tone:'teal',source:'plan'};
    if(code==='TR') return {code,kind:'training',label:'Training',tone:'gold',source:'plan'};
    if(code==='AL'||code==='SICK') return {code,kind:'leave',label:S.leaveTypeLabel(code),tone:'blue',source:'plan'};
    if(code==='OFF'||code==='W') return {code,kind:'off',label:'Off duty',tone:'slate',source:'plan'};
  }
  // No plan published for that day: fall back to the contract, clearly labelled.
  const dow=U.dow(iso);
  if(staff.weekendOnly) return dow>=5?{code:'DN',kind:'daynight',label:'On duty · day + night',tone:'teal',source:'pattern'}:{code:'OFF',kind:'off',label:'Off duty',tone:'slate',source:'pattern'};
  if(staff.pattern==='manager'||staff.pattern==='dayonly') return dow>=5?{code:'OFF',kind:'off',label:'Off duty',tone:'slate',source:'pattern'}:{code:'D',kind:'day',label:'On duty · day',tone:'teal',source:'pattern'};
  if(dow>=5) return {code:'OFF',kind:'off',label:'Off duty',tone:'slate',source:'pattern'};
  // weekday: the night block alternates every two days across eligible staff
  const eligible=S.activeStaff().filter(s=>!s.weekendOnly && s.nightPref!=='no' && (s.maxNights||0)>0);
  if(staff.nightPref!=='no' && eligible.length){
    const dayIndex=Math.floor(U.parseISO(iso)/86400000);
    const crew=eligible[(Math.floor(dayIndex/2))%eligible.length];
    if(crew && crew.id===staff.id) return {code:'N',kind:'night',label:'On duty · night',tone:'blue',source:'pattern'};
  }
  return {code:'D',kind:'day',label:'On duty · day',tone:'teal',source:'pattern'};
};
S.isOnDuty=function(who,iso){ const st=S.shiftState(who,iso); return st.kind==='day'||st.kind==='night'||st.kind==='daynight'; };
S.onDuty=function(iso){
  iso=iso||U.todayISO();
  const source=S.planCovers(iso)?'plan':'pattern';
  return S.activeStaff().map(s=>({staff:s, state:S.shiftState(s,iso)})).filter(x=>S.isOnDuty(x.staff,iso))
    .map(x=>({staff:x.staff, shift:x.state.label, kind:x.state.kind, code:x.state.code, source, since:x.state.kind==='night'?'20:00':'08:00'}));
};
S.offDuty=function(iso){
  iso=iso||U.todayISO();
  return S.activeStaff().map(s=>({staff:s,state:S.shiftState(s,iso)})).filter(x=>x.state.kind==='off');
};

/* Laboratory services and weekly allocation (roster module). */
const DEFAULT_SERVICES=[
  {id:'svc1', name:'Sample reception', code:'REC', min:1, note:'Registration, accessioning, rejection'},
  {id:'svc2', name:'Hematology', code:'HAE', min:1, note:'CBC, ESR, malaria slides'},
  {id:'svc3', name:'Chemistry', code:'CHE', min:1, note:'Glucose, creatinine, ALT'},
  {id:'svc4', name:'Serology', code:'SER', min:1, note:'HIV, syphilis, hepatitis'},
  {id:'svc5', name:'Microbiology', code:'MIC', min:1, note:'Blood culture, TB, AFB'},
  {id:'svc6', name:'Molecular (GeneXpert)', code:'MOL', min:1, note:'MTB/RIF, viral load'},
  {id:'svc7', name:'Blood bank', code:'BBK', min:1, note:'Grouping, cross-match'}
];
S.services=function(){ const db=S.db(); db.services=db.services||DEFAULT_SERVICES.map(x=>({...x})); return db.services; };
S.weekStart=function(iso){ const d=U.parseISO(iso||U.todayISO()); const dow=U.dow(U.isoLocal(d)); return U.addDays(U.isoLocal(d),-dow); };
S.weekDates=function(start){ return Array.from({length:7},(_,i)=>U.addDays(start,i)); };
S.unitWeek=function(start){ const db=S.db(); db.unitRosters=db.unitRosters||{}; if(!db.unitRosters[start]) db.unitRosters[start]={weekStart:start,assignments:{}}; const w=db.unitRosters[start]; w.assignments=w.assignments||{}; return w; };
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
  const cc=S.db().coldChain.find(c=>c.temp>c.max);
  if(cc) out.push({id:'n-cold',group:'Quality',tone:'rose',title:'Cold-chain excursion recorded — '+cc.device,detail:cc.temp+' °C for '+cc.duration+' min · corrective action logged',ts:cc.at,href:'#/stock?tab=coldchain',icon:'thermometer'});
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
  return JSON.stringify(Object.assign({},S.db(),{meta:Object.assign({},S.db().meta,{exportedAt:U.nowISO(),appVersion:'6.0.0'})}),null,1);
};
S.importJSON=function(obj){
  if(!obj || !obj.staff || !obj.meta) throw new Error('Not a Lab Systems backup');
  DB=normalize(obj); S.save(true); S.emit('import');
};
S.reset=function(){ const s=JSON.parse(JSON.stringify(window.LS_SEED)); DB=normalize(s); S.save(true); S.emit('reset'); };
S.restorePoint=function(){ S.save(true); const key='labSystems.restore.'+Date.now(); try{ localStorage.setItem(key,JSON.stringify({at:U.nowISO(),db:S.db()})); }catch(e){} return key; };
})();
