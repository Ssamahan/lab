/* ============================================================================
   MODULE · QUALITY & COMPLIANCE — SOPs and incidents
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.quality=M;
let rootEl=null, tab='overview';

// Hide only untouched examples; leave persisted data and any edits intact across sync.
const exampleSops=[
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
function isExample(s){
  const i=Number(String(s.id).slice(3));
  if(s.id!=='sop'+i || !exampleSops[i]) return false;
  const keys=['code','title','version','effective','review','owner'];
  return keys.every((key,n)=>s[key]===exampleSops[i][n]) &&
    s.ack===[2,9,6][i%3] && s.acknowledged===(i%3!==2) &&
    ['current','review-due'].includes(s.status) &&
    Object.keys(s).every(key=>keys.concat(['id','ack','acknowledged','status']).includes(key));
}
function registeredSops(){ return S.db().sops.filter(s=>!isExample(s)); }
const sourceSops=[
  ['RliDHL-BIO-SOP-001-VERS-005','Glucose Testing using Cobas c 111'],
  ['RliDHL-HEM-SOP-001-VERS-002','Venous Blood Sample Collection'],
  ['RliDHL-HEM-SOP-005-VERS-001','Sysmex XN-330 examination'],
  ['RliDHL-HEM-SOP-006-VERS-001','Sysmex XQ-320 examination'],
  ['RliDHL-IMM-SOP-005-VERS-001','Alere Pima CD4 examination'],
  ['RliDHL-ADM-SOP-050-VERS-001','Use, Care and Preventive Maintenance of the Microscope','13cFatvwV1FzYRygDGku_4S3_iK7S_Da3','a44342383275216bbc99a22641ba0729'],
  ['RliDHL-ADM-SOP-051-VERS-001','Operation, Care and Preventive Maintenance of the Centrifuge','1wtl4fNgOmmS8P45w6mC1-OkjkMbTol0S','c29f21ac13f81970ab6429937a3efc13'],
  ['RliDHL-ADM-SOP-052-VERS-001','Operation, Care and Preventive Maintenance of the Water Bath','1Xg77ZUbUHmf6-DUPwTImw-UP5AwqyPlZ','cf735331507cfd44d45ebfdc761290dd'],
  ['RliDHL-ADM-SOP-060-VERS-001','Management and Maintenance of Non-Medical Laboratory Equipment','13IjTFY12v_DCXsYr291YWNlbg-l1EJWj','0d526796468c3df7a224453ce809bfd2'],
  ['RliDHL-ADM-SOP-061-VERS-001','Maintenance of Laboratory ICT Equipment and the Laboratory Information System','11oahJ0Ul2F1FqTfYTq_vZij6KPWk2mem','7772dbff247b5155e5b317ca303432f6'],
  ['RliDHL-ADM-SOP-062-VERS-001','Use, Care and Preventive Maintenance of Hematology Analysers','1rNrhxrCvk8KdurpN3KFKRl3zwqTJt48b','041b0dfac08d58e28f099570efddd1f3'],
  ['RliDHL-ADM-SOP-063-VERS-001','Use, Care and Preventive Maintenance of the GeneXpert Dx System','1M_6rmFZAB-k3TFHBYV7jO7m81OmMWehe','99277edb6d2a80a994f7a8f9af521395'],
  ['RliDHL-MYC-SOP-002-VERS-005','TB Bacilloscopy using Auramine (Fluorescence Microscopy)','1_CRblz0nnxRDPcBYR71nUiwiY0MOWT7Z','aeb899cab28c10c3c7f543725dd5e9b1'],
  ['RliDHL-SER-SOP-002-VERS-005','Diagnosis of Syphilis using Rapid Plasma Reagin (RPR)','1IcKQ_qrGtHqSNadwJV3Qrq6mgPgUMPj2','d3319df312f98c60b71e45fe7d7d8477'],
  ['RliDHL-SER-SOP-009-VERS-005','HIV Rapid Testing using Alere HIV Combo Ag-Ab','1K8bMbTA7QUQHhwkBUdE_mwfS9UIno8WZ','4055be614ea7aa796d270cd7582ae74b'],
  ['RliDHL-SER-SOP-003-VERS-005','HIV Rapid Testing using STAT-PAK','1nfPVrJRZMJQ6HQKkvzTBszY9E06MgtU4','dc51bd88638de72ef624716ab48818f2'],
  ['RliDHL-MOL-SOP-004-VERS-002','Hepatitis C Virus Viral Load using GeneXpert','1AFFJt726bIWc7AdaNXJ-5kiyncxxA8Yd','26b9bf33c174ec80d0b39a331dc6d8ec'],
  ['RliDHL-MOL-SOP-003-VERS-002','Hepatitis B Virus Viral Load using GeneXpert','13yLD85imSCeNXgDr-Nv5o_SIOa798_Js','eec561c90905286085b20eb880f20267'],
  ['RliDHL-MOL-SOP-002-VERS-002','HIV Early Infant Diagnosis (EID) using GeneXpert','1sYqTLNtmpC_2rADoxjIVDSYjTvZzS2Qi','5c1de943b5c99d09c020814bacc44b7e'],
  ['RliDHL-HEM-SOP-007-VERS-004','Indirect Antiglobulin (Coombs) Test (IAT)','1-bS5Wf_RuhjrvIqauMejNdBvgk38O5dK','b66124056ba4a6ab76ec8a07d151cd06'],
  ['RliDHL-HEM-SOP-009-VERS-004','Quality Control of Anti-sera Reagents','1BMxvuMr1sRcts2Pe3NhKGM6gI_D_RNhV','4cd0bc4b150b380864c31d625c5166cd'],
  ['RliDHL-HEM-SOP-008-VERS-004','Coombs Control (Check) Cells Preparation','1Ja3fQudaatGpyKGCAM3TJ2usYEg6HpZt','08c18ad002b24279172fba412f88250c']
];
// Conflicts are observations from the review register and opened draft headers, not resolved findings.
const sourceIssues={
  'RliDHL-BIO-SOP-001-VERS-005':'A different draft with the same code is in Drive; compare both versions before use.',
  'RliDHL-HEM-SOP-007-VERS-004':'Earlier document used SER-SOP 003, conflicting with STAT-PAK; confirm the corrected code and master-list entry.',
  'RliDHL-HEM-SOP-008-VERS-004':'Earlier version carries a 35-month review interval; check the intended date and code.',
  'RliDHL-HEM-SOP-009-VERS-004':'Earlier header and history disagree on dates and used BIO-SOP 008; verify the correction.',
  'RliDHL-MOL-SOP-002-VERS-002':'Previous document review date differs from the master list; verify before updating it.',
  'RliDHL-MOL-SOP-003-VERS-002':'Previous document review date differs from the master list; verify before updating it.',
  'RliDHL-MOL-SOP-004-VERS-002':'Previous document review date differs from the master list; verify before updating it.',
  'RliDHL-MYC-SOP-002-VERS-005':'Previous document header and master list have different dates; verify before updating it.',
  'RliDHL-SER-SOP-009-VERS-005':'Draft changes the prior SER-SOP 004 code; confirm and update the master list.',
  'RliDHL-SER-SOP-003-VERS-005':'Earlier IAT document used the same SER-SOP 003 code; confirm the correction.'
};
function issueActions(code){ return (S.db().sopIssueActions||[]).filter(x=>x.code===code); }
function sourceIssueMarkup(code){
  const issue=sourceIssues[code]; if(!issue) return '';
  const comments=issueActions(code).map(x=>'<div class="xs">'+U.esc(x.comment)+' · '+U.esc(x.by)+' · '+U.esc(U.fmtDate(x.at))+'</div>').join('');
  const alternate=code==='RliDHL-BIO-SOP-001-VERS-005'?'<a href="https://drive.google.com/file/d/10pvM8GV8m9eK4ZW0Zn-XK4ZvaEZHnuld/view" target="_blank" rel="noopener noreferrer">Open Drive draft</a> · ':'';
  return '<div class="hint">'+U.esc(issue)+'<br>'+alternate+'<a href="https://drive.google.com/file/d/1P8CmmhIm8FvXO2wmyPCk61KBY_EkucHT/view" target="_blank" rel="noopener noreferrer">Review register</a> '+(LS.auth.can('edit')?'<button class="btn xs" data-source-action="'+U.esc(code)+'">Record action</button>':'')+comments+'</div>';
}
function recordSourceAction(code){
  const row=reviewRegister.find(item=>'register:'+item.no===code);
  const issue=sourceIssues[code] || (row && (row.notes || row.status || row.title));
  if(!LS.auth.guard('edit')||!issue) return;
  UI.modal({title:'Record action',sub:'Record a follow-up on the documented issue. Do not include patient details.',
    body:'<p class="small">'+U.esc(code)+' · '+U.esc(issue)+'</p><label>Action / comment<textarea class="textarea" data-source-comment></textarea></label>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save-source-action>Save action</button>',
    onMount:(el,close)=>{el.querySelector('[data-save-source-action]').onclick=()=>{
      if(!LS.auth.guard('edit')) return;
      const comment=el.querySelector('[data-source-comment]').value.trim();
      if(!comment) return UI.toast('Enter an action or comment',{type:'warn'});
      S.commit(d=>{(d.sopIssueActions=d.sopIssueActions||[]).push({id:U.uid('sia'),code,comment,at:U.nowISO(),by:LS.auth.user.name});},
        {action:'quality.sop.issue.action',entity:'sopIssueActions',entityId:code,detail:'SOP issue action recorded'});
      close();paint();
    };}
  });
}
// Snapshot of the Register sheet, prepared 13 November 2026; row numbers preserve code collisions.
const reviewRegister=[
  {
    "no": "1",
    "section": "Haematology",
    "code": "RliDHL-HEM-SOP 007-VERS 003",
    "title": "Indirect Coombs Test (IAT)",
    "effective": "2023-10-22",
    "review": "2025-09-22",
    "status": "In Review 2026",
    "due": "Yes",
    "latest": "Review 2026 / SOP - Indirect Antiglobulin Test (IAT).docx (original: 2023-2024 / 1. Hematology & Immunohematology, 23/04/2025)",
    "documentDates": "RliDHL-SER-SOP 003-VERS 003, effective 16/02/2025, review 16/02/2027",
    "notes": "Master list still shows the 2023 version (overdue since 22/09/2025). The document's code differs from the master list and duplicates STAT-PAK's. History dates version 003 as 23/04/2025, the header as 16/02/2025."
  },
  {
    "no": "2",
    "section": "Haematology",
    "code": "RliDHL-HEM-SOP 008-VERS 003",
    "title": "Coombs Control/Check Cells Preparation",
    "effective": "2024-01-22",
    "review": "2026-12-22",
    "status": "In Review 2026",
    "due": "Yes",
    "latest": "Review 2026 / SOP - Coombs Check Control Cell Preparation.docx (original: 2023-2024 / 1. Hematology & Immunohematology, 16/04/2024)",
    "documentDates": "HEM-SOP08-VERS 003, effective 22/01/2024, revision date 22/12/2026",
    "notes": "Dates agree, but the interval is 35 months. Earlier versions were 23 months apart, which would give 22/12/2025; if that was intended it is already overdue. Same code (008) as Vein Blood Collection."
  },
  {
    "no": "3",
    "section": "Molecular biology",
    "code": "RliDHL-MOL-SOP 002-VERS 001",
    "title": "HIV - Early Infant Diagnosis (EID) Testing using GeneXpert",
    "effective": "2025-02-17",
    "review": "2027-02-17",
    "status": "In Review 2026",
    "due": "Yes",
    "latest": "Review 2026 / 5. SOP - HIV-EID Vers01.docx (originals in Crosscutting: two copies, 26/04/2025 and 14/05/2025)",
    "documentDates": "MOL-SOP 002-Vers-001, effective 17 Feb 2025, review 16 Jan 2027",
    "notes": "Review date differs: master list 17/02/2027, document 16/01/2027. Overlaps with the HIV-1 Qualitative SOP."
  },
  {
    "no": "4",
    "section": "Molecular biology",
    "code": "RliDHL-MOL-SOP 003-VERS 001",
    "title": "Hepatitis B Virus Viral Load Testing using GeneXpert",
    "effective": "2025-02-17",
    "review": "2027-02-17",
    "status": "In Review 2026",
    "due": "Yes",
    "latest": "Review 2026 / 3. SOP - HBV VL Vers01.docx (original: Crosscutting, 22/07/2025)",
    "documentDates": "MOL-SOP 003-Vers-001, effective 17 Feb 2025, review 16 Jan 2027",
    "notes": "Review date differs: master list 17/02/2027, document 16/01/2027."
  },
  {
    "no": "5",
    "section": "Molecular biology",
    "code": "RliDHL-MOL-SOP 004-VERS 001",
    "title": "Hepatitis C Virus Viral Load Testing using GeneXpert",
    "effective": "2025-02-17",
    "review": "2027-02-17",
    "status": "In Review 2026",
    "due": "Yes",
    "latest": "Review 2026 / 6. SOP HCV VL Testing MOL Vers001.docx (original: Crosscutting, 22/07/2025)",
    "documentDates": "MOL-SOP 004-Vers-001, effective 17 Feb 2025, review 16 Jan 2027",
    "notes": "Review date differs: master list 17/02/2027, document 16/01/2027."
  },
  {
    "no": "6",
    "section": "Mycobacteriology",
    "code": "RliDHL-MYC-SOP 002-VERS 004",
    "title": "TB Bacilloscopy Testing using Auramine",
    "effective": "2025-02-20",
    "review": "2027-02-20",
    "status": "In Review 2026",
    "due": "Yes",
    "latest": "Review 2026 / 7. TB microscopy by Fluorescence.doc (original: Crosscutting, 28/04/2025)",
    "documentDates": "MYC-SOP 002-VERS 004, effective 16/03/2025, review 16/03/2027",
    "notes": "Dates differ: master list 20/02, document header 16/03, document history 20/02/2025."
  },
  {
    "no": "7",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 003-VERS 004",
    "title": "HIV Rapid Testing using STAT-PAK HIV-1/2 Kit",
    "effective": "2025-02-20",
    "review": "2027-02-20",
    "status": "In Review 2026",
    "due": "Yes",
    "latest": "Review 2026 / SOP STAT-PAK HIV Version 004.doc and .pdf (probable original: Crosscutting / 5. SOP stat Pak HIV.doc, 26/04/2025)",
    "documentDates": "SER-SOP 003-VERS 004, effective 20/02/2025, review 20/02/2027 (both files)",
    "notes": "Dates agree. The IAT document carries the same number (SER-SOP 003)."
  },
  {
    "no": "8",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 002-VERS 004",
    "title": "Diagnosis of Syphilis using Rapid Plasma Reagin (RPR)",
    "effective": "2025-02-22",
    "review": "2027-02-22",
    "status": "In Review 2026",
    "due": "Yes",
    "latest": "Review 2026 / SOP - Syphilis using Rapid Plasma Reagin (RPR).docx (original: General - Lab / NEW docs SOPs, 23/04/2025)",
    "documentDates": "SER-SOP 002-VERS 004, effective 22/02/2025, review 22/02/2027",
    "notes": "Dates agree."
  },
  {
    "no": "9",
    "section": "Clinical chemistry",
    "code": "RliDHL-BIO-SOP 001-VERS 004",
    "title": "Glucose Testing using COBAS C111",
    "effective": "2025-03-16",
    "review": "2027-03-16",
    "status": "In Review 2026",
    "due": "Yes",
    "latest": "Review 2026 / 7. SOP GLUCOSE USING COBAS C111.docx (original: General - Lab / NEW docs SOPs, 14/05/2025)",
    "documentDates": "BIO-SOP 001-VERS 004, effective 16/03/2025, review 16/03/2027",
    "notes": "Dates agree. The history dates version 001 as 15/05/2029."
  },
  {
    "no": "10",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 004-VERS 004",
    "title": "Alere HIV Combo Ag-Ab",
    "effective": "2025-03-18",
    "review": "2027-03-18",
    "status": "In Review 2026",
    "due": "Yes",
    "latest": "Review 2026 / SOP Alere Combo HIV Ag-Ab.docx (probable original: 1. SOPs / SOP 24 / NEW SOP Alere Combo HIV Ag-Ab.docx, 23/04/2025)",
    "documentDates": "SER-SOP 004-VERS 004, effective 18/03/2025, review 18/03/2027",
    "notes": "Dates agree. Same code (004) as the HBsAg rapid test on the master list."
  },
  {
    "no": "11",
    "section": "Not on master list",
    "code": "RliDHL-BIO-SOP08-VERS 003 (in document)",
    "title": "Quality Control of Anti-sera Reagents",
    "effective": "",
    "review": "",
    "status": "In Review 2026",
    "due": "Yes",
    "latest": "Review 2026 / CHECK DATES - SOP QC of Anti-sera.docx (original: 2023-2024 / 1. Hematology & Immunohematology, 16/01/2024)",
    "documentDates": "Header: effective 22/01/2023, revision date 22/01/2025. History: version 002 on 22/02/2023, version 003 on 22/01/2025",
    "notes": "Header and history conflict. Whichever is right, it falls due inside the window; on the header dates it has been overdue since 22/01/2025. The original was last saved on 16/01/2024, before the 22/01/2025 date its history gives for version 003. The master list uses code BIO-SOP 008 for ASAT."
  },
  {
    "no": "12",
    "section": "Not on master list",
    "code": "RliDHL-MOL-SOP 001-VERS 003 (in document)",
    "title": "HIV-1 Qualitative Testing Using Xpert HIV-1 Assays",
    "effective": "",
    "review": "",
    "status": "Due - not yet in Review 2026",
    "due": "Yes",
    "latest": "2024-2025 / 2. SOPs and Guidelines / Crosscutting / pdf 2025 / 4. SOP_HIV1_Qualitative Testing Using Xpert HIV-1 Qual assay.pdf. Word file: 1. SOPs / SOP 24 / SOP_HIV1_Qualitative Testing Using Xpert HIV-1 Qual assay - Copy.doc (23/04/2025)",
    "documentDates": "MOL-SOP 001-VERS 003, effective 16/02/2025, review 16/02/2027",
    "notes": "Decide whether it is still in force or has been replaced by the HIV-EID SOP (MOL-SOP 002). Its number clashes with GeneXpert maintenance on the master list."
  },
  {
    "no": "13",
    "section": "Clinical chemistry",
    "code": "RliDHL-BIO-SOP 008-VERS 003",
    "title": "Aspartate Aminotransferase Test (ASAT) using Cobas C 111",
    "effective": "2024-02-10",
    "review": "2026-01-10",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "1. SOPs / SOP 24 / SOP AST COBAS 111 2024.doc (12/04/2024), not opened",
    "documentDates": "",
    "notes": "A source file is in Lab 2026 and can be copied to Review 2026. Same code (008) as Total Bilirubin (HumaStar 80)."
  },
  {
    "no": "14",
    "section": "Clinical chemistry",
    "code": "RliDHL-BIO-SOP 008-VERS 003",
    "title": "Total Bilirubin (HumaStar 80)",
    "effective": "2024-02-10",
    "review": "2026-01-10",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No 2024 file found. Older: 1. SOPs / Biochemistry SOP / 8.  SOP of BILIRUBIN TOTAL TEST.doc (2016)",
    "documentDates": "",
    "notes": "Confirm whether the HumaStar 80 is still in service; if not, retire this SOP. Same code (008) as ASAT."
  },
  {
    "no": "15",
    "section": "Crosscutting",
    "code": "RliDHL-ADM-SOP 034- VERS 003",
    "title": "Laboratory Waste Management",
    "effective": "2024-03-10",
    "review": "2026-02-10",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No 2024 file found. Older: General - Lab / 9. VERSION II Cross Cutting / 21. Laboratory Waste management 2.doc (2018)",
    "documentDates": "",
    "notes": "Same code (034) as Handling of biological spills."
  },
  {
    "no": "16",
    "section": "Haematology",
    "code": "RliDHL-HEM-SOP 001-VERS 004",
    "title": "Blood Cross Match / Compatibility Testing",
    "effective": "2024-03-16",
    "review": "2026-02-13",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No 2024 file found. Older: 1. SOPs / Imminohematology / Blood Cross match.docx (2017). Search index shows this topic inside General - Lab / SOPs RTGO.zip (24/04/2024), which I cannot open",
    "documentDates": "",
    "notes": ""
  },
  {
    "no": "17",
    "section": "Haematology",
    "code": "RliDHL-HEM-SOP 004-VERS 004",
    "title": "Hematology Sample Analysis using Sysmex KX-21N",
    "effective": "2024-03-16",
    "review": "2026-02-16",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No 2024 file found. Older: 1. SOPs / Hematology SOP / 4. KX.21N.doc (2017)",
    "documentDates": "",
    "notes": "Confirm the analyser is still in service: the manual and maintenance logs in Lab 2026 are for Sysmex XN-330 and XQ-320."
  },
  {
    "no": "18",
    "section": "Haematology",
    "code": "RliDHL-HEM-SOP 005-VERS 004",
    "title": "Hematology Sample Analysis using Sysmex XS-500i",
    "effective": "2024-03-16",
    "review": "2026-02-16",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No Ruli file found. General - Lab / 066 SYSMEX 2024-2026.doc is a Rutongo District Hospital SOP (RUDH-LAB-SOP-066 vers 003, effective 1 July 2020)",
    "documentDates": "",
    "notes": "Same question about which analysers are in service. Treat the Rutongo file as reference only."
  },
  {
    "no": "19",
    "section": "Haematology",
    "code": "RliDHL-HEM-SOP 016-VERS 004",
    "title": "Full Blood Count Testing",
    "effective": "2024-03-17",
    "review": "2026-02-17",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No loose file found. Search index shows this topic inside General - Lab / SOPs RTGO.zip (24/04/2024), which I cannot open",
    "documentDates": "",
    "notes": ""
  },
  {
    "no": "20",
    "section": "Clinical chemistry",
    "code": "RliDHL-BIO-SOP 012-VERS 004",
    "title": "Electrolytes Test using Cobas C 111",
    "effective": "2024-04-19",
    "review": "2026-03-19",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No loose file found. Search index shows this topic inside General - Lab / SOPs RTGO.zip (24/04/2024), which I cannot open",
    "documentDates": "",
    "notes": ""
  },
  {
    "no": "21",
    "section": "Clinical chemistry",
    "code": "RliDHL-BIO-SOP 004-VERS 003",
    "title": "Alanine Aminotransferase Test (ALAT) using Cobas C 111",
    "effective": "2024-04-20",
    "review": "2026-03-20",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No 2024 file found. Older: 1. SOPs / Biochemistry SOP / 4 . SOP OF ALAT TEST.doc (2016). Search index shows this topic inside General - Lab / SOPs RTGO.zip (24/04/2024), which I cannot open",
    "documentDates": "",
    "notes": ""
  },
  {
    "no": "22",
    "section": "Clinical chemistry",
    "code": "RliDHL-BIO-SOP 015-VERS 003",
    "title": "Cholesterol Test using Cobas C 111",
    "effective": "2024-04-20",
    "review": "2026-03-20",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No loose file found. Search index shows this topic inside General - Lab / SOPs RTGO.zip (24/04/2024), which I cannot open",
    "documentDates": "",
    "notes": ""
  },
  {
    "no": "23",
    "section": "Haematology",
    "code": "RliDHL-HEM-SOP 019-VERS 004",
    "title": "Bleed Time (Duke Method)",
    "effective": "2024-04-22",
    "review": "2026-03-22",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No loose file found. Search index shows this topic inside General - Lab / SOPs RTGO.zip (24/04/2024), which I cannot open",
    "documentDates": "",
    "notes": ""
  },
  {
    "no": "24",
    "section": "Haematology",
    "code": "RliDHL-HEM-SOP 023-VERS 004",
    "title": "Clotting Time",
    "effective": "2024-04-26",
    "review": "2026-03-26",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No loose file found. Search index shows this topic inside General - Lab / SOPs RTGO.zip (24/04/2024), which I cannot open",
    "documentDates": "",
    "notes": ""
  },
  {
    "no": "25",
    "section": "Crosscutting",
    "code": "RliDHL-ADM-SOP 009- VERS 002",
    "title": "Disposal of sharps and needles",
    "effective": "2024-04-29",
    "review": "2026-03-29",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No file found",
    "documentDates": "",
    "notes": ""
  },
  {
    "no": "26",
    "section": "Haematology",
    "code": "RliDHL-HEM-SOP 010-VERS 003",
    "title": "CD4 Testing using Pima CD4 Analyzer",
    "effective": "2024-04-06",
    "review": "2026-04-06",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "Not in Lab 2026. Elsewhere in your Drive: older 'SOPs' folder / 010. Pima CD4 Vers01.doc (14/04/2024), not opened",
    "documentDates": "",
    "notes": "Copy the 2024 file into Lab 2026 or Review 2026."
  },
  {
    "no": "27",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 014-VERS 003",
    "title": "Hepatitis C Virus (HCV) Antibody Testing",
    "effective": "2024-04-06",
    "review": "2026-04-06",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "Not in Lab 2026. Elsewhere in your Drive: older 'SOPs' folder / 014. Anti HCV Vers01.doc (14/04/2024), not opened",
    "documentDates": "",
    "notes": "The master list types the review date as '06/024/2026'. Copy the 2024 file into Lab 2026 or Review 2026."
  },
  {
    "no": "28",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 012-VERS 003",
    "title": "Toxoplasma gondii (TOXO) IgG/IgM - Rapid Testing",
    "effective": "2024-04-06",
    "review": "2026-04-06",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "Not in Lab 2026. Elsewhere in your Drive: older 'SOPs' folder / 012. Toxo Vers01.doc (12/04/2024), not opened",
    "documentDates": "",
    "notes": "Copy the 2024 file into Lab 2026 or Review 2026."
  },
  {
    "no": "29",
    "section": "Clinical chemistry",
    "code": "RliDHL-BIO-SOP 027-VERS 004",
    "title": "Direct Bilirubin (Cobas C 111)",
    "effective": "2024-05-07",
    "review": "2026-04-07",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "1. SOPs / SOP 24 / . BILIRUBIN DIRECT COBAS 111 2024.doc (12/04/2024), not opened",
    "documentDates": "",
    "notes": "A source file is in Lab 2026 and can be copied to Review 2026."
  },
  {
    "no": "30",
    "section": "Clinical chemistry",
    "code": "RliDHL-BIO-SOP 026-VERS 004",
    "title": "Total Bilirubin (Cobas C 111)",
    "effective": "2024-05-07",
    "review": "2026-04-07",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "1. SOPs / SOP 24 / 8.  SOP of BILIRUBIN TOTAL TEST 2022.doc (29/01/2024), not opened; may be an earlier version",
    "documentDates": "",
    "notes": "Confirm whether the SOP 24 file is the 2024 version."
  },
  {
    "no": "31",
    "section": "Clinical chemistry",
    "code": "RliDHL-BIO-SOP 031-VERS 003",
    "title": "Total Protein Test",
    "effective": "2024-05-07",
    "review": "2026-04-07",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No loose file found. Search index shows this topic inside General - Lab / SOPs RTGO.zip (24/04/2024), which I cannot open",
    "documentDates": "",
    "notes": ""
  },
  {
    "no": "32",
    "section": "Crosscutting",
    "code": "RliDHL-ADM-SOP 024- VERS 004",
    "title": "Quality Control and Quality Assurance",
    "effective": "2024-05-10",
    "review": "2026-04-10",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No 2024 file found. Older: General - Lab / 9. VERSION II Cross Cutting / 5. Quality control and quality assurance II.doc (2019)",
    "documentDates": "",
    "notes": "Locate the 2024 version, or decide to rebuild from the 2019 text."
  },
  {
    "no": "33",
    "section": "Crosscutting",
    "code": "RliDHL-ADM-SOP 034- VERS 003",
    "title": "Handling of biological spills",
    "effective": "2024-05-29",
    "review": "2026-04-28",
    "status": "Overdue - no later version found",
    "due": "Yes",
    "latest": "No 2024 file found. Older: General - Lab / 8. Guidelines / 7. spill handeling guideline.docx",
    "documentDates": "",
    "notes": "Same code (034) as Laboratory Waste Management."
  },
  {
    "no": "34",
    "section": "Parasitology",
    "code": "RliDHL-PAR-SOP 017-VERS 004",
    "title": "Use and Maintenance of a Microscope",
    "effective": "2024-03-20",
    "review": "2026-02-20",
    "status": "Overdue - possibly superseded (confirm)",
    "due": "Check",
    "latest": "No 2024 file found. Older: 1. SOPs / Parasitology SOP / .SOP of uses of optic microscope-.doc (2016)",
    "documentDates": "",
    "notes": "Confirm whether the 2026 SOP 'Use and Maintenance of Biomedical Equipment' replaces it."
  },
  {
    "no": "35",
    "section": "Clinical chemistry",
    "code": "RliDHL-BIO-SOP 021-VERS 004",
    "title": "Use and Preventive Maintenance of Cobas C 111",
    "effective": "2024-04-29",
    "review": "2026-03-29",
    "status": "Overdue - possibly superseded (confirm)",
    "due": "Check",
    "latest": "No 2024 file found. Manufacturer manual: General - Lab / 19. Manuals / Cobas c111 Manual.pdf",
    "documentDates": "",
    "notes": "Confirm whether the 2026 SOP 'Use and Maintenance of Biomedical Equipment' replaces it."
  },
  {
    "no": "36",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 030-VERS 004",
    "title": "Use and Maintenance of Electric Centrifuge",
    "effective": "2024-05-05",
    "review": "2026-04-05",
    "status": "Overdue - possibly superseded (confirm)",
    "due": "Check",
    "latest": "No separate 2024 file found",
    "documentDates": "",
    "notes": "The 2026 SOP 'Use and Maintenance of Biomedical Equipment' lists its own version 004 as 05/05/2024, the same date, so it appears to replace this one. Confirm. Same code (030) as Pregnancy Testing."
  },
  {
    "no": "37",
    "section": "Manuals",
    "code": "RliDHL-ADM-MAN 001-VERS 006",
    "title": "Laboratory Quality Control Manual",
    "effective": "2025-04-12",
    "review": "2027-03-12",
    "status": "Check date",
    "due": "Check",
    "latest": "2024-2025 / 1. Manual / QUALITY MANUAL UPDATED 2024-2025.pdf (the .doc was edited later, on 01/05/2026, and was not opened)",
    "documentDates": "PDF: ADM-MAN 001-VERS 006, effective 12/04/2025, review 12/04/2027",
    "notes": "Master list says review 12/03/2027 (inside the window); the PDF says 12/04/2027 (outside). Confirm which is right."
  },
  {
    "no": "38",
    "section": "Haematology",
    "code": "RliDHL-HEM-SOP 032-VERS 003",
    "title": "Weak D Determination",
    "effective": "2024-04-30",
    "review": "2026-03-30",
    "status": "Later version found (2025)",
    "due": "No",
    "latest": "2024-2025 / 2. SOPs and Guidelines / Weak D Determination.docx (21/10/2025)",
    "documentDates": "HEM-SOP 032-VERS 003, effective 24/07/2025, review 24/07/2027",
    "notes": "Master list not updated. History dates version 003 as 24/09/2025, the header as 24/07/2025, and the version number is unchanged from the master list's 2024 entry."
  },
  {
    "no": "39",
    "section": "Parasitology",
    "code": "RliDHL-PAR-SOP 008-VERS 003",
    "title": "Stool Analysis for Parasites and/or their Eggs",
    "effective": "2024-02-10",
    "review": "2026-01-10",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 4. SOP Stool Analysis 2026.docx (13/03/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": "Same code (008) as Malaria Giemsa."
  },
  {
    "no": "40",
    "section": "Parasitology",
    "code": "RliDHL-PAR-SOP 002-VERS 003",
    "title": "Collection and Transportation of Stool Specimen",
    "effective": "2024-02-15",
    "review": "2026-01-15",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 3. SOP Collection and transportation of stool specimen 2026 .docx (13/03/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": ""
  },
  {
    "no": "41",
    "section": "Parasitology",
    "code": "RliDHL-PAR-SOP 008-VERS 003",
    "title": "Malaria Diagnosis using Giemsa Staining Technique",
    "effective": "2024-02-17",
    "review": "2026-01-17",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 8. SOP Malaria Diagnosis using Giemsa 2026.docx (18/03/2026) and 11.  SOP Malaria Diagnosis using Giemsa Staining Technique.docx (28/04/2026)",
    "documentDates": "Not opened; search index shows a 2028 date in both",
    "notes": "Two 2026 files for the same procedure. Confirm which is current. Same code (008) as Stool Analysis."
  },
  {
    "no": "42",
    "section": "Haematology",
    "code": "RliDHL-HEM-SOP 008-VERS 003",
    "title": "Vein Blood Collection and Preparation of Hematology Sample",
    "effective": "2024-02-10",
    "review": "2026-02-10",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 22. SOP Venous Blood Collection.docx (03/05/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": "Confirm the 2026 SOP replaces this one. Same code (008) as Coombs Control Cells."
  },
  {
    "no": "43",
    "section": "Bacteriology",
    "code": "RliDHL-BAC-SOP 004-VERS 004",
    "title": "Gram Staining Procedure",
    "effective": "2024-03-15",
    "review": "2026-02-15",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 5. SOP Gram_Staining_Procedure.docx (16/03/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": "A second file in the same folder is named 'RliDHL-PARA-SOP-002-VERS-004 gram_staining.docx'. Confirm which is current."
  },
  {
    "no": "44",
    "section": "Clinical chemistry",
    "code": "RliDHL-BIO-SOP 003-VERS 003",
    "title": "Urea Test using Spectrophotometer (Cobas C 111)",
    "effective": "2024-03-18",
    "review": "2026-02-18",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 23. SOP Urea Cobas c111.docx (04/06/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": ""
  },
  {
    "no": "45",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 004-VERS 004",
    "title": "Hepatitis B Virus (HBV) Surface Antigen Rapid Testing",
    "effective": "2024-03-20",
    "review": "2026-02-20",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 16. SOP Hepatitis B Surface (HBsAg) Antigen Rapid Testing.docx (30/04/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": "Same code (004) as Alere HIV Combo."
  },
  {
    "no": "46",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 007-VERS 003",
    "title": "Rheumatoid Factor (RF) Test",
    "effective": "2024-03-21",
    "review": "2026-02-21",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 13. SOP Rhematoid Factor (RF) Rapid Testing.docx (29/04/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": ""
  },
  {
    "no": "47",
    "section": "Clinical chemistry",
    "code": "RliDHL-BIO-SOP 006-VERS 003",
    "title": "Creatinine Testing using Spectrophotometer (Cobas C 111)",
    "effective": "2024-03-22",
    "review": "2026-02-22",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 21. SOP Creatinine Cobas c111.docx (03/05/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": ""
  },
  {
    "no": "48",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 018-VERS 004",
    "title": "Determination of C-Reactive Protein (CRP) in Blood",
    "effective": "2024-04-28",
    "review": "2026-03-02",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 7. SOP CRP Vers 005.docx (16/03/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": ""
  },
  {
    "no": "49",
    "section": "Crosscutting",
    "code": "RliDHL-ADM-SOP 020- VERS 004",
    "title": "Pre-Examination Procedure",
    "effective": "2024-04-20",
    "review": "2026-03-20",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 20. SOP Pre-Examination Process II.docx (03/05/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": ""
  },
  {
    "no": "50",
    "section": "Crosscutting",
    "code": "RliDHL-ADM-SOP 001- VERS 004",
    "title": "Document and Record Control",
    "effective": "2024-03-21",
    "review": "2026-03-21",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 19. SOP Document and record control.docx (03/05/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": "Same code (001) as Laboratory Temperature Control on the master list."
  },
  {
    "no": "51",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 020-VERS 004",
    "title": "Determination of Anti-Streptolysin-O (ASLO)",
    "effective": "2024-04-28",
    "review": "2026-03-28",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 9. SOP ASLO_SOP_VERS_005.docx (19/03/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": ""
  },
  {
    "no": "52",
    "section": "Bacteriology",
    "code": "RliDHL-BAC-SOP 029-VERS 004",
    "title": "Vaginal Swab Wet Mount Examination",
    "effective": "2024-04-29",
    "review": "2026-03-29",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 2. SOP Vaginal Swab Wet Mount S2026.docx (12/03/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": ""
  },
  {
    "no": "53",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 008-VERS 002",
    "title": "HIV Rapid Testing using Determine HIV 1/2 Kit",
    "effective": "2024-04-29",
    "review": "2026-03-29",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 12. SOP HIV Determine.docx (29/04/2026)",
    "documentDates": "SER-SOP-008-VERS-003, effective 29/04/2026, next review 29/04/2028",
    "notes": "Opened and read in full."
  },
  {
    "no": "54",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 010-VERS 003",
    "title": "Cryptococcal Antigen (CrAg) Lateral Flow Assay",
    "effective": "2024-04-06",
    "review": "2026-04-06",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 18. SOP Cryptococcal Antigen (CrAg) testing.docx (30/04/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": ""
  },
  {
    "no": "55",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 013-VERS 003",
    "title": "Helicobacter pylori (H. pylori) Antigen Rapid Testing",
    "effective": "2024-04-06",
    "review": "2026-04-06",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 14. SOP Hpylori Stool Antigen_SOP.docx (02/05/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": ""
  },
  {
    "no": "56",
    "section": "Serology",
    "code": "RliDHL-SER-SOP 030-VERS 004",
    "title": "Pregnancy Testing using Urine Sample",
    "effective": "2024-05-06",
    "review": "2026-04-06",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 15. SOP Pregnancy Test.docx (29/04/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": "Same code (030) as Use and Maintenance of Electric Centrifuge."
  },
  {
    "no": "57",
    "section": "Crosscutting",
    "code": "RliDHL-ADM-SOP 001- VERS 004",
    "title": "Laboratory Temperature Control",
    "effective": "2025-04-06",
    "review": "2027-04-06",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2024-2025 / 2. SOPs and Guidelines / Crosscutting / 1. SOP Laboratory  temperature control.docx (03/05/2026)",
    "documentDates": "RliDHL-ADM-SOP-003-VERS-004 (header also says 'Version: 005'), effective 29/04/2026, next review 29/04/2028",
    "notes": "Code changed from 001 to 003 and the version label is inconsistent (004 and 005). The 2025 PDF header says 6 April 2024 / 6 April 2026 while its own history says 06/04/2025."
  },
  {
    "no": "58",
    "section": "Parasitology",
    "code": "RliDHL-PAR-SOP 001-VERS 003",
    "title": "Urine Testing for Parasites",
    "effective": "2025-04-06",
    "review": "2027-04-26",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 6. SOP Urine_Testing_for_Parasites.docx (16/03/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": "The two master-list dates do not match each other (06/04 and 26/04)."
  },
  {
    "no": "59",
    "section": "Not on master list",
    "code": "RliDHL-ADM-SOP-008-VERS-005 (in document)",
    "title": "Use and Maintenance of Biomedical Equipment",
    "effective": "",
    "review": "",
    "status": "Revised 2026",
    "due": "No",
    "latest": "2025-2026 / 17. Use and Maintenance of Biomedical Equipment.docx (30/04/2026)",
    "documentDates": "Effective 30/04/2026, next review 30/04/2028",
    "notes": "Add to the master list and state which equipment SOPs it replaces (microscope, centrifuge, Cobas c111)."
  },
  {
    "no": "60",
    "section": "Crosscutting",
    "code": "RliDHL-ADM-SOP 002 - VERS 002",
    "title": "Documentation of Examination Procedure",
    "effective": "2025-04-12",
    "review": "2027-04-12",
    "status": "Not due",
    "due": "No",
    "latest": "2024-2025 / 2. SOPs and Guidelines / Crosscutting / 2. DOCUMENTATION OF EXAMINATION PROCEDURES 2025.docx",
    "documentDates": "ADM-SOP 002-VERS 002, effective 12/04/2025, review 12/04/2027",
    "notes": "Due 12 days after the cut-off."
  },
  {
    "no": "61",
    "section": "Manuals",
    "code": "RliDHL-ADM-MAN 002-VERS 006",
    "title": "Laboratory Safety Manual",
    "effective": "2025-04-13",
    "review": "2027-04-13",
    "status": "Not due",
    "due": "No",
    "latest": "2024-2025 / 1. Manual / 2.SAFETY MANUAL_FINAL 2024-2025.pdf",
    "documentDates": "PDF: ADM-MAN 002-VERS 005, effective 13/04/2025, review 13/04/2027",
    "notes": "Due 13 days after the cut-off. Version differs: master list 006, document 005."
  },
  {
    "no": "62",
    "section": "Guidelines",
    "code": "RliDHL-ADM-GUID 002- VERS 004",
    "title": "Laboratory Critical Results",
    "effective": "2025-04-22",
    "review": "2027-04-22",
    "status": "Not due",
    "due": "No",
    "latest": "General - Lab / Lab Tests -  Critical Results.pdf (28/04/2025), not opened",
    "documentDates": "",
    "notes": "Due three weeks after the cut-off."
  },
  {
    "no": "63",
    "section": "Guidelines",
    "code": "RliDHL-ADM-GUID 001- VERS 004",
    "title": "Laboratory Scope of Test",
    "effective": "2025-04-22",
    "review": "2027-04-22",
    "status": "Not due",
    "due": "No",
    "latest": "Not located",
    "documentDates": "",
    "notes": "Due three weeks after the cut-off."
  },
  {
    "no": "64",
    "section": "Guidelines",
    "code": "RliDHL-ADM-GUID 003- VERS 004",
    "title": "Normal Ranges for Laboratory Tests",
    "effective": "2025-04-22",
    "review": "2027-04-22",
    "status": "Not due",
    "due": "No",
    "latest": "Not located",
    "documentDates": "",
    "notes": "Due three weeks after the cut-off."
  },
  {
    "no": "65",
    "section": "Mycobacteriology",
    "code": "RliDHL-MYC-SOP 001-VERS 004",
    "title": "Sputum Sample Processing using GeneXpert Machine",
    "effective": "2025-04-23",
    "review": "2027-04-23",
    "status": "Not due",
    "due": "No",
    "latest": "2024-2025 / 2. SOPs and Guidelines / Crosscutting / pdf 2025 / 4. SOP Sample processing using GeneXpert.pdf",
    "documentDates": "MYC-SOP 001-VERS 004, effective 23/04/2025, review 23/04/2027",
    "notes": "Due three weeks after the cut-off. Only the PDF was found, no Word file."
  },
  {
    "no": "66",
    "section": "Molecular biology",
    "code": "RliDHL-MOL-SOP 001-VERS 001",
    "title": "Use and Preventive Maintenance of GeneXpert",
    "effective": "2025-04-27",
    "review": "2027-05-27",
    "status": "Not due",
    "due": "No",
    "latest": "2025 file not located. Older: 1. SOPs / Mycobacteriology SOP / Preventive mantenance of GeneXpert.doc (2016)",
    "documentDates": "",
    "notes": "The HIV-1 Qualitative SOP also carries the number MOL-SOP 001."
  },
  {
    "no": "67",
    "section": "Clinical chemistry",
    "code": "RliDHL-BIO-SOP 002-VERS 001",
    "title": "Calcium Testing using Cobas C111",
    "effective": "2025-07-24",
    "review": "2027-07-24",
    "status": "Not due",
    "due": "No",
    "latest": "2024-2025 / 5. SOP - Calcium Vers01.docx (24/07/2025); Crosscutting / 6. SOP - Calcium testing using Cobas C111 Vers04.docx (14/05/2025)",
    "documentDates": "Not opened",
    "notes": "Two files with different version labels (Vers01 and Vers04)."
  },
  {
    "no": "68",
    "section": "Mycobacteriology",
    "code": "RliDHL-MYC-SOP 003-VERS 001",
    "title": "Sputum Pooling for TB Diagnosis using GeneXpert MTB/RIF ULTRA",
    "effective": "2026-02-18",
    "review": "2028-02-18",
    "status": "Not due",
    "due": "No",
    "latest": "2025-2026 / 1. SOP TB Pooling 2026.docx (01/04/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": ""
  },
  {
    "no": "69",
    "section": "Not on master list",
    "code": "Not opened",
    "title": "TB Testing in Stool using Xpert Ultra",
    "effective": "",
    "review": "",
    "status": "Not due",
    "due": "No",
    "latest": "2025-2026 / 10.  SOP TB testing in Stool using Xpert Ultra.docx and .pdf (27/04/2026)",
    "documentDates": "Not opened; search index shows a 2028 date",
    "notes": "New in 2026. Add to the master list."
  },
  {
    "no": "70",
    "section": "Not on master list",
    "code": "RliDHL-TB-SOP 002-Vers-001 (in document)",
    "title": "TB-LAM in Urine using the Determine TB LAM Ag Test",
    "effective": "",
    "review": "",
    "status": "Not due",
    "due": "No",
    "latest": "2024-2025 / 2. SOPs and Guidelines / Crosscutting / 4. SOP - TB LAM Vers01.docx and .pdf (13/08/2025)",
    "documentDates": "Effective 13/08/2025, review 12/08/2027",
    "notes": "Add to the master list. The code prefix 'TB' is not used elsewhere; the other TB SOPs use MYC."
  }
];
// A pinned snapshot prevents a later repository edit inheriting an older approval.
const sourceRevision='c98700c504c5185d9c621a5f57411a91d15bb1ac';
function approvalFor(code,revision){
  return (S.db().sopApprovalEvents||[]).filter(e=>e.code===code && e.sourceRevision===revision)
    .sort((a,b)=>String(b.at).localeCompare(String(a.at)) || String(b.id).localeCompare(String(a.id)))[0]||null;
}
const sectionNames={ADM:'Crosscutting / administration',BAC:'Bacteriology',BIO:'Biochemistry',HEM:'Haematology',IMM:'Immunology',MYC:'Mycobacteriology',PAR:'Parasitology',SER:'Serology',STC:'Stock',MOL:'Molecular'};
function sopSection(code){
  const m=String(code||'').toUpperCase().match(/(?:^|[- ])(ADM|BAC|BIO|HEM|IMM|MYC|PAR|SER|STC|MOL)(?:[- ])/);
  return m?sectionNames[m[1]]:'Other / section not recorded';
}
function reviewBand(review){
  const value=String(review||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'unknown';
  const date=new Date(value+'T00:00:00Z');
  if(isNaN(date.getTime())||date.toISOString().slice(0,10)!==value) return 'unknown';
  const days=Math.round((date-new Date(U.todayISO()+'T00:00:00Z'))/86400000);
  return days<0?'overdue':days<=30?'0-30':days<=90?'31-90':days<=180?'91-180':days<=360?'181-360':'beyond';
}
function sopAnalysis(){
  const manual=registeredSops();
  const manualCodes=new Set(manual.map(s=>String(s.code||'').toLowerCase()));
  const docs=manual.concat(sourceSops.filter(x=>!manualCodes.has(x[0].toLowerCase())).map(x=>({code:x[0],review:''})));
  const bands=[['overdue','Overdue'],['0-30','0–30 days'],['31-90','31–90 days'],['91-180','91–180 days'],['181-360','181–360 days'],['beyond','Beyond 360 days'],['unknown','Unknown review date']];
  const sections={}; docs.forEach(s=>{const section=sopSection(s.code); sections[section]=(sections[section]||0)+1;});
  return '<div class="card pad" style="margin-bottom:16px"><h2>Review-date analysis</h2><p class="small">'+docs.length+' listed documents in this view; not yet a complete inventory. Counts use recorded next-review dates, not assumed expiry dates. Source documents without verified dates are unknown.</p><div class="row wrap gap-sm">'+bands.map(([key,label])=>'<span class="pill slate" data-review-band="'+key+'">'+U.esc(label)+': '+docs.filter(s=>reviewBand(s.review)===key).length+'</span>').join('')+'</div><p class="small">By section: '+Object.keys(sections).sort().map(k=>U.esc(k)+' '+sections[k]).join(' · ')+'</p></div>';
}
function registerCatalog(){
  const bands=[['overdue','Overdue'],['0-30','0–30 days'],['31-90','31–90 days'],['91-180','91–180 days'],['181-360','181–360 days'],['beyond','Beyond 360 days'],['unknown','Unknown']];
  const sections=[...new Set(reviewRegister.map(x=>x.section))].sort();
  const summary=bands.map(([key,label])=>'<span class="pill slate">'+U.esc(label)+': '+reviewRegister.filter(x=>reviewBand(x.review)===key).length+'</span>').join('');
  return '<div class="card pad" style="margin-bottom:16px"><h2>Review register · 70 rows</h2><p class="small">Snapshot of the <a href="https://drive.google.com/file/d/1P8CmmhIm8FvXO2wmyPCk61KBY_EkucHT/view" target="_blank" rel="noopener noreferrer">Register sheet</a>, prepared 13 November 2026 for the 31 March 2027 cutoff. Dates below are master-list dates as recorded in that sheet, not confirmed current dates. The sheet may contain conflicts or later versions; retain separate rows until corrected. The dated status is historical, not a live approval status.</p><div class="row wrap gap-sm">'+summary+'</div><p class="small">Bands are relative to today and use the register’s master-list date; missing dates are unknown. These 70 rows are counted separately from the source-document and manual registers below to avoid implying that versions have been reconciled.</p>'+sections.map(section=>{
    const rows=reviewRegister.filter(x=>x.section===section);
    return '<h3>'+U.esc(section)+' · '+rows.length+'</h3><div class="dt-scroll"><table class="dt"><thead><tr><th>Document / master-list code</th><th>Master-list review date</th><th>Register status and notes</th><th>Action</th></tr></thead><tbody>'+rows.map(x=>{
      const key='register:'+x.no;
      const comments=issueActions(key).map(a=>'<div class="xs">'+U.esc(a.comment)+' · '+U.esc(a.by)+' · '+U.esc(U.fmtDate(a.at))+'</div>').join('');
      return '<tr data-register-row="'+U.esc(x.no)+'"><td>'+U.esc(x.title)+'<div class="xs faint">#'+U.esc(x.no)+' · '+U.esc(x.code)+'</div></td><td>'+U.esc(x.review || 'Unknown')+'</td><td>'+U.esc(x.status)+'<details><summary>Source details</summary><p>Due by 31 March 2027: '+U.esc(x.due || 'Not recorded')+'</p><p>Latest found: '+U.esc(x.latest || 'Not recorded')+'</p><p>Document dates: '+U.esc(x.documentDates || 'Not recorded')+'</p><p>Notes: '+U.esc(x.notes || 'None recorded')+'</p></details></td><td>'+(LS.auth.can('edit')?'<button class="btn xs" data-register-action="'+U.esc(key)+'">Record action</button>':'')+comments+'</td></tr>';
    }).join('')+'</tbody></table></div>';
  }).join('')+'</div>';
}
function sourceCatalog(){
  return '<div class="card pad" style="margin-bottom:16px"><h2>SOP source documents</h2><p class="small">Approval, effective dates and review dates are not verified here. Waiting for approval means no DG signature has been recorded in this register. Confirm the controlled version before use. A tick records your confirmation; it is not a digital signature. Drive links can change and require permission; the app cannot detect changes to them. Recheck the document and correct the tick if it changes.</p><div class="dt-scroll"><table class="dt"><thead><tr><th>Section</th><th>Document</th><th>Approval</th><th>DG signed</th></tr></thead><tbody>'+sourceSops.slice().sort((a,b)=>sopSection(a[0]).localeCompare(sopSection(b[0])) || a[0].localeCompare(b[0])).map(([code,title,driveId,checksum])=>{
    const path=encodeURIComponent(code+' - '+title+'.pdf');
    const revision=driveId?'drive-md5:'+checksum:sourceRevision;
    const url=driveId?'https://drive.google.com/file/d/'+driveId+'/view':'https://github.com/Ssamahan/SOPs/blob/'+sourceRevision+'/sop/'+path;
    const event=approvalFor(code,revision), approved=!!(event && event.approved);
    const detail=event?' · recorded by '+U.esc(event.by)+' on '+U.esc(U.fmtDate(event.at)):'';
    return '<tr data-source-code="'+U.esc(code)+'"><td>'+U.esc(sopSection(code))+'</td><td><a href="'+U.esc(url)+'" target="_blank" rel="noopener noreferrer">'+U.esc(code)+' · '+U.esc(title)+'</a>'+(driveId?' <span class="xs faint">Drive · may change</span>':'')+sourceIssueMarkup(code)+'</td><td><span class="pill '+(approved?'teal':'amber')+'">'+(approved?'Approved':'Waiting for approval')+'</span><div class="xs faint">'+detail+'</div></td><td><label><input type="checkbox" data-approve-source="'+U.esc(code)+'" '+(approved?'checked ':'')+(LS.auth.can('edit')?'':'disabled ')+'aria-label="DG signed '+U.esc(code)+'"> Approved</label></td></tr>';
  }).join('')+'</tbody></table></div></div>';
}
function confirmSourceApproval(code,approved){
  if(!LS.auth.guard('edit')){ paint(); return; }
  const doc=sourceSops.find(item=>item[0]===code);
  if(!doc){ paint(); return; }
  const revision=doc[2]?'drive-md5:'+doc[3]:sourceRevision;
  UI.modal({title:approved?'Record DG approval':'Correct approval status',
    sub:approved?'Only confirm after the DG has signed this exact document.':'This records a correction; earlier entries remain in the history.',
    body:'<p class="small">'+U.esc(code)+'</p><p class="small">'+(approved?'I confirm the Director General signed this version. This tick does not sign or change the source document.':'Return this version to waiting for approval?')+'</p>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-confirm-approval>'+(approved?'Confirm approval':'Return to waiting')+'</button>',
    onMount:(el,close)=>{el.querySelector('[data-confirm-approval]').onclick=()=>{
      if(!LS.auth.guard('edit')) return;
      const previous=approvalFor(code,revision);
      const at=new Date(Math.max(Date.now(),previous?Date.parse(previous.at)+1:0)).toISOString();
      S.commit(d=>{(d.sopApprovalEvents=d.sopApprovalEvents||[]).push({id:U.uid('sa'),code,sourceRevision:revision,approved,at,by:LS.auth.user.name});},
        {action:approved?'quality.sop.approval':'quality.sop.approval.correct',entity:'sopApprovalEvents',entityId:code,detail:approved?'DG approval recorded':'Approval status corrected to waiting'});
      close();paint();UI.toast('Approval status recorded',{type:'ok'});
    };}
  });
}

function metrics(){
  const st=S.sampleStats();
  const db=S.db();
  return {
    rejection:st.rejectionRate, repeat:st.repeatRate, tat:st.tatCompliance, tatWindow:st.tatWindow,
    eqa:(function(){ const r=S.eqaSeries('__all'); return r.length?Math.round(U.avg(r.map(x=>x.score))*10)/10:null; })(),
    openIncidents:S.realIncidents().filter(i=>i.status!=='Closed').length,
    overdueIncidents:S.realIncidents().filter(i=>i.status!=='Closed'&&i.due<U.todayISO()).length,
    sopOverdue:registeredSops().filter(s=>s.review && s.review<U.todayISO()).length,
    ackPct:Math.round(registeredSops().length ? registeredSops().filter(s=>s.acknowledged).length/registeredSops().length*100 : 0)
  };
}
function kpis(){
  const m=metrics();
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'TAT compliance',value:m.tat==null?0:m.tat,dec:1,unit:'%',icon:'timer',formatted:'0.0',
      note:m.tat==null?'No result on the register yet':m.tatWindow+'-day window · target per test',
      spark:C.spark(m.tat==null?[0,0,0,0,0,0,0,0]:[m.tat,m.tat,m.tat,m.tat,m.tat,m.tat,m.tat,m.tat],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Rejection rate',value:m.rejection==null?0:m.rejection,dec:1,unit:'%',icon:'circle-x',formatted:'0.0',
      note:m.rejection==null?'No rejection recorded on the register':'Target ≤ 2.0%',
      spark:C.spark(m.rejection==null?[0,0,0,0,0,0,0,0]:[m.rejection,m.rejection,m.rejection,m.rejection,m.rejection,m.rejection,m.rejection,m.rejection],{color:'var(--amber)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'EQA composite',value:m.eqa==null?0:m.eqa,dec:1,unit:'%',icon:'target',formatted:'0.0',
      note:m.eqa==null?'No PT round scored yet':'Mean across every PT round',
      spark:C.spark(m.eqa==null?[0,0,0,0,0,0,0,0]:[m.eqa,m.eqa,m.eqa,m.eqa,m.eqa,m.eqa,m.eqa,m.eqa],{color:'var(--pos)'})})+'</div></div>';
}
function overview(){
  const m=metrics(); const db=S.db();
  return '<div class="grid-12">'
   +'<div class="c12">'+UI.card({title:'Quality KPI trendlines',sub:'Referral TAT compliance and PT scores · 12 months',icon:'chart-line',cls:'gold',body:'<div id="qTrend"></div><div class="legend" style="margin-top:8px"><span class="lg"><span class="sw" style="background:var(--pos)"></span>TAT compliance %</span><span class="lg"><span class="sw" style="background:var(--gold)"></span>EQA composite %</span><span class="lg" style="margin-left:auto;color:var(--text-faint)">Blank months mean the register holds no result for that month</span></div>'})+'</div>'
   +'<div class="c3">'+UI.card({title:'Continuous improvement',sub:'Computed from the referral register',icon:'trending-up',body:
      '<div class="scorecard" style="padding:0"><div class="meta"><div class="eyebrow">TAT compliance</div><div class="serif" style="font-size:2.2rem;color:var(--text-strong);letter-spacing:-.03em">'+(m.tat==null?'—':m.tat)+'%</div><div class="xs faint">'+(m.tat==null?'No result on the register yet':m.tatWindow+'-day window')+'</div></div>'+C.ring(m.tat==null?0:m.tat,{size:76,stroke:6})+'</div>'
      +'<div class="thread" style="margin:12px 0"></div>'
      +[['Repeat rate',m.repeat==null?'no record':m.repeat+'%','teal'],['Rejection rate',m.rejection==null?'no record':m.rejection+'%','amber'],['Referred samples',S.referredSamples().length+'','slate']].map(([k,v,t])=>'<div class="row between" style="padding:6px 0"><span class="small">'+k+'</span><span class="pill '+t+' mono">'+v+'</span></div>').join('')})+'</div>'
   +'<div class="c4">'+UI.card({title:'Non-conformances',sub:'Severity · owner · resolution SLA',icon:'alert-triangle',
      tools:'<a class="btn xs" href="#/quality?tab=incidents">All '+S.realIncidents().length+'</a>',body:(function(){
        const open=S.realIncidents().filter(i=>i.status!=='Closed').sort((a,b)=>String(a.due).localeCompare(String(b.due))).slice(0,5);
        return open.length?open.map(i=>{ const late=i.due<U.todayISO();
          return '<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.8px">'+U.esc(i.ref)+' · '+U.esc(i.title)+'</div><div class="lr-sub">'+U.esc(i.owner)+' · due '+U.fmtDate(i.due)+'</div></div><span class="pill '+(i.severity==='Critical'?'rose':i.severity==='Major'?'amber':'slate')+'">'+U.esc(i.severity)+(late?' · late':'')+'</span></div>'; }).join(''):'<p class="xs faint">No open non-conformances.</p>';
      })()})+'</div>'
   +'<div class="c12">'+UI.card({title:'Document control',sub:'SOP register · versions, review dates and acknowledgements',icon:'file-text',
      tools:'<a class="btn xs" href="#/quality?tab=sops">SOP register</a>',body:(function(){
        return '<div class="dt-scroll" style="max-height:none"><table class="dt"><thead><tr><th>Code</th><th>Title</th><th>Section</th><th>Version</th><th>Effective</th><th>Next review</th><th>Owner</th><th>Status</th></tr></thead><tbody>'
        +registeredSops().slice(0,6).map(s=>{ const overdue=!!s.review && s.review<U.todayISO();
          return '<tr><td class="mono small">'+U.esc(s.code)+'</td><td class="small">'+U.esc(s.title)+'</td><td class="small">'+U.esc(sopSection(s.code))+'</td><td class="mono xs">'+U.esc(s.version)+'</td><td class="num">'+U.fmtDate(s.effective)+'</td><td class="num">'+U.fmtDate(s.review)+'</td><td class="small">'+U.esc(s.owner)+'</td><td>'+(overdue?'<span class="pill rose">review due</span>':s.acknowledged?'<span class="pill teal">acknowledged</span>':'<span class="pill amber">pending</span>')+'</td></tr>'; }).join('')
        +'</tbody></table></div>';
      })()})+'</div></div>';
}
function sopsView(){
  return registerCatalog()+sopAnalysis()+sourceCatalog()+'<div class="grid-12"><div class="c12"><div class="card table-card"><div class="toolbar"><div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="sopSearch" placeholder="Search SOP code, title, owner…"></div><span class="grow"></span><button class="btn sm" data-add-sop>'+UI.ic('plus',13)+'Register SOP</button></div>'
   +'<div class="dt-scroll"><table class="dt" id="sopTable"><thead><tr><th>Code</th><th>Title</th><th>Section</th><th>Version</th><th>Effective</th><th>Next review</th><th>Owner</th><th>Acknowledgement</th><th></th></tr></thead><tbody>'
   +registeredSops().map(s=>{ const overdue=!!s.review && s.review<U.todayISO();
      return '<tr data-sop="'+s.id+'"><td class="mono small">'+U.esc(s.code)+'</td><td class="small strong">'+U.esc(s.title)+'</td><td class="small">'+U.esc(sopSection(s.code))+'</td><td class="mono xs">'+U.esc(s.version)+'</td><td class="num">'+U.fmtDate(s.effective)+'</td><td class="num" style="color:'+(overdue?'var(--crit)':'')+'">'+U.fmtDate(s.review)+'</td><td class="small">'+U.esc(s.owner)+'</td>'
      +'<td>'+(s.acknowledged?'<span class="pill teal">'+UI.ic('check',10)+'acknowledged</span>':'<span class="pill amber">pending</span>')+'</td><td><button class="icon-btn" style="width:26px;height:26px" data-open="'+s.id+'">'+UI.ic('chevron-right',14)+'</button></td></tr>'; }).join('')
   +'</tbody></table></div><div class="card-foot"><span>'+registeredSops().filter(s=>s.review && s.review<U.todayISO()).length+' documents past review date</span><span class="mono">'+registeredSops().length+' registered documents</span></div></div></div></div>';
}
function incidentsView(){
  const db=S.db();
  return '<div class="grid-12"><div class="c12"><div class="card table-card"><div class="toolbar"><div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="incSearch" placeholder="Search non-conformance, owner…"></div><span class="grow"></span><button class="btn sm" data-add-inc>'+UI.ic('plus',13)+'Log incident</button></div>'
   +'<div class="dt-scroll"><table class="dt" id="incTable"><thead><tr><th>Ref</th><th>Finding</th><th>Severity</th><th>Owner</th><th>Opened</th><th>Due</th><th>Status</th></tr></thead><tbody>'
   +S.realIncidents().map(i=>{ const late=i.due<U.todayISO()&&i.status!=='Closed';
      return '<tr data-inc="'+i.id+'"><td class="mono small">'+U.esc(i.ref)+'</td><td><div class="primary-cell"><b>'+U.esc(i.title)+'</b><small>'+U.esc(i.rootCause||'')+'</small></div></td>'
      +'<td><span class="pill '+(i.severity==='Critical'?'rose':i.severity==='Major'?'amber':'slate')+'">'+U.esc(i.severity)+'</span></td>'
      +'<td class="small">'+U.esc(i.owner)+'</td><td class="num">'+U.fmtDate(i.opened)+'</td><td class="num" style="color:'+(late?'var(--crit)':'')+'">'+U.fmtDate(i.due)+(late?' · late':'')+'</td>'
      +'<td><span class="pill '+(i.status==='Closed'?'teal':i.status==='Open'?'rose':'amber')+'">'+U.esc(i.status)+'</span></td></tr>'; }).join('')
   +'</tbody></table></div><div class="card-foot"><span>Resolution SLA: Critical 48h · Major 7d · Minor 30d</span><span class="mono">'+S.realIncidents().filter(i=>i.status!=='Closed').length+' open</span></div></div></div></div>';
}
function logIncident(){
  if(!LS.auth.guard('edit')) return;
  UI.modal({title:'Log non-conformance',sub:'Creates an audited quality record with an SLA clock.',width:'min(620px,100%)',
    body:'<div class="form-grid"><div class="field span2"><label>Finding</label><input class="input" id="inTitle" placeholder="e.g. Fridge excursion during inventory"></div>'
     +'<div class="field"><label>Severity</label><select class="select" id="inSev"><option>Minor</option><option>Major</option><option>Critical</option></select></div>'
     +'<div class="field"><label>Owner</label><select class="select" id="inOwner">'+S.activeStaff().map(s=>'<option>'+U.esc(s.name)+'</option>').join('')+'</select></div>'
     +'<div class="field span2"><label>Evidence reference (no patient identifiers)</label><input class="input" id="inEvidence" placeholder="e.g. maintenance log and date"></div>'
     +'<div class="field span2"><label>Root cause</label><textarea class="textarea" id="inRoot"></textarea></div>'
     +'<div class="field span2"><label>Corrective action</label><textarea class="textarea" id="inCapa"></textarea></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Open non-conformance</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const title=el.querySelector('#inTitle').value.trim(), evidence=el.querySelector('#inEvidence').value.trim();
        if(!title || !evidence) return UI.toast('Enter the finding and an evidence reference',{type:'warn'});
        const sev=el.querySelector('#inSev').value; const sla=sev==='Critical'?2:sev==='Major'?7:30;
        S.commit(d=>{ d.incidents.unshift({id:U.uid('nc'),ref:'NC-2026-'+String(46+d.incidents.length).padStart(3,'0'),title,evidence,severity:sev,owner:el.querySelector('#inOwner').value,opened:U.todayISO(),due:U.addDays(U.todayISO(),sla),status:'Open',rootCause:el.querySelector('#inRoot').value,capa:el.querySelector('#inCapa').value}); },
          {action:'quality.incident',entity:'incidents',detail:sev+' non-conformance logged'});
        close(); LS.shell.refresh(); UI.toast('Non-conformance logged · SLA clock started',{type:'ok'});
      };
    }});
}
function sopEditor(id){
  if(!LS.auth.guard('edit')) return;
  const existing=id?S.db().sops.find(x=>x.id===id):null;
  if(id&&!existing) return;
  const doc=existing||{};
  const fields=[['Code','code','text'],['Title','title','text'],['Version','version','text'],['Effective date','effective','date'],['Next review','review','date'],['Owner','owner','text']];
  UI.modal({title:existing?'Edit SOP':'Register SOP',sub:'Review and verify all template details before use.',width:'min(620px,100%)',
    body:'<div class="form-grid">'+fields.map(([label,key,type])=>'<div class="field"><label>'+U.esc(label)+'</label><input class="input" type="'+type+'" data-sop-field="'+key+'" value="'+U.esc(doc[key]||'')+'"></div>').join('')+'<div class="field span2"><label>SOP text</label><textarea class="textarea" data-sop-field="content" rows="12">'+U.esc(doc.content||'')+'</textarea></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save-sop>Save SOP</button>',
    onMount:(el,close)=>{el.querySelector('[data-save-sop]').onclick=()=>{
      const record={};el.querySelectorAll('[data-sop-field]').forEach(input=>{record[input.dataset.sopField]=input.value.trim();});
      if(!record.code||!record.title||!record.review) return UI.toast('Enter a code, title and next review date',{type:'warn'});
      if(S.db().sops.some(x=>x.id!==id&&String(x.code).toLowerCase()===record.code.toLowerCase())) return UI.toast('This SOP code already exists',{type:'warn'});
      S.commit(d=>{if(existing){const x=d.sops.find(y=>y.id===id);if(x){x.history=(x.history||[]).concat([{code:x.code,title:x.title,version:x.version,effective:x.effective,review:x.review,owner:x.owner,content:x.content||'',at:U.nowISO(),by:LS.auth.user.name}]);Object.assign(x,record);}}else d.sops.push(Object.assign({id:U.uid('sop'),acknowledged:false,history:[]},record));},{action:existing?'quality.sop.edit':'quality.sop.add',entity:'sops',entityId:id||'',detail:'SOP '+record.code});
      close();paint();UI.toast('SOP saved',{type:'ok'});
    };}
  });
}
function sopDrawer(id){
  const s=S.db().sops.find(x=>x.id===id); if(!s) return;
  UI.drawer({title:s.title,eyebrow:'SOP register',sub:s.code+' · '+s.version,
    body:'<div class="split-2">'+[['Effective',U.fmtDate(s.effective)],['Next review',U.fmtDate(s.review)],['Owner',s.owner]].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11.5px">'+U.esc(v||'—')+'</span></div>').join('')+'</div><div class="section-head"><h2>SOP text</h2></div><p style="white-space:pre-wrap">'+U.esc(s.content||'No SOP text has been entered. Verify template details before use.')+'</p><div class="hint">'+(s.history||[]).length+' saved prior edit(s). No approval is inferred.</div>',
    foot:'<button class="btn" data-close>Close</button><button class="btn primary" data-edit-sop>Edit SOP</button>',
    onMount:(panel,close)=>{panel.querySelector('[data-edit-sop]').onclick=()=>{close();sopEditor(id);};}
  });
}
function paint(){
  const host=rootEl.querySelector('#qBody'); if(!host) return;
  host.innerHTML=tab==='overview'?overview():tab==='sops'?sopsView():incidentsView();
  U.$$('[data-q-tab]',rootEl).forEach(b=>b.classList.toggle('on',b.dataset.qTab===tab));
  wireBody();
}
function wireBody(){
  const r=rootEl;
  r.querySelectorAll('[data-q-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.qTab; paint(); });
  if(tab==='overview'){
    /* Both lines come from the register: referral TAT month by month, and the EQA
       scores in the order they were reported. Nothing is smoothed or invented. */
    const tatSeries=S.referralTATSeries(null,12);
    const eqaRows=S.eqaSeries('__all');
    const months=tatSeries.map(x=>x.label);
    C.line(r.querySelector('#qTrend'),{id:'qTrend',height:250,min:0,max:100,zeroBase:true,series:[
      {name:'TAT compliance',color:'var(--pos)',values:tatSeries.map(x=>x.compliance)},
      {name:'PT score',color:'var(--gold)',values:tatSeries.map((x,i)=>{ const r=eqaRows[i]; return r?r.score:null; })}
    ],labels:months,yFmt:v=>Math.round(v)+'%',tipFmt:v=>v+'%'});
  }
  if(tab==='sops'){
    r.querySelectorAll('[data-register-action]').forEach(button=>button.onclick=()=>recordSourceAction(button.dataset.registerAction));
    r.querySelectorAll('[data-source-action]').forEach(button=>button.onclick=()=>recordSourceAction(button.dataset.sourceAction));
    r.querySelectorAll('[data-approve-source]').forEach(input=>input.onchange=()=>{ const approved=input.checked; input.checked=!approved; confirmSourceApproval(input.dataset.approveSource,approved); });
    r.querySelectorAll('[data-sop]').forEach(tr=>tr.onclick=()=>sopDrawer(tr.dataset.sop));
    r.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); sopDrawer(b.dataset.open); });
    const s=r.querySelector('#sopSearch'); if(s) s.addEventListener('input',()=>{ const q=s.value.toLowerCase(); U.$$('#sopTable tbody tr',r).forEach(tr=>tr.style.display=tr.textContent.toLowerCase().indexOf(q)>=0?'':'none'); });
  }
  if(tab==='incidents'){
    r.querySelectorAll('[data-inc]').forEach(tr=>tr.onclick=()=>{ const i=S.db().incidents.find(x=>x.id===tr.dataset.inc);
      UI.drawer({title:i.ref,eyebrow:'Non-conformance',sub:i.title,body:'<div class="row wrap gap-sm" style="margin-bottom:14px"><span class="pill '+(i.severity==='Critical'?'rose':i.severity==='Major'?'amber':'slate')+'">'+U.esc(i.severity)+'</span><span class="pill '+(i.status==='Closed'?'teal':'amber')+'">'+U.esc(i.status)+'</span><span class="pill slate">Owner · '+U.esc(i.owner)+'</span></div>'
        +'<div class="card pad" style="background:var(--surface-inset);margin-bottom:12px"><div class="eyebrow">Evidence reference</div><p class="small">'+U.esc(i.evidence||'Not recorded')+'</p></div>'
        +'<div class="card pad" style="background:var(--surface-inset);margin-bottom:12px"><div class="eyebrow">Root cause</div><p class="small" style="margin-top:4px">'+U.esc(i.rootCause||'—')+'</p></div>'
        +'<div class="card pad" style="background:var(--surface-inset)"><div class="eyebrow">Corrective / preventive action</div><p class="small" style="margin-top:4px">'+U.esc(i.capa||'—')+'</p></div>'
        +'<div class="hint" style="margin-top:12px">Opened '+U.fmtDate(i.opened)+' · SLA due '+U.fmtDate(i.due)+'</div>',
        foot:'<button class="btn" data-close>Close</button>'+(i.status!=='Closed'?'<button class="btn primary" data-close-inc>'+UI.ic('check',15)+'Close with evidence</button>':''),
        onMount:(panel,close)=>{ const b=panel.querySelector('[data-close-inc]'); if(b) b.onclick=()=>{ S.commit(d=>{ const x=d.incidents.find(y=>y.id===i.id); if(x){ x.status='Closed'; x.closedBy=LS.auth.user.name; x.closedAt=U.nowISO(); } },{action:'quality.incident.close',entity:'incidents',entityId:i.id,detail:i.ref+' closed with evidence'}); close(); LS.shell.refresh(); UI.toast('Non-conformance closed',{type:'ok'}); }; }});
    });
  }
  r.querySelectorAll('[data-add-inc]').forEach(b=>b.onclick=logIncident);
  r.querySelectorAll('[data-add-sop]').forEach(b=>b.onclick=()=>sopEditor());
}
M.render=function(root,params){
  rootEl=root; tab=['overview','sops','incidents'].includes(params.tab)?params.tab:'overview';
  root.innerHTML='<div class="page-head"><div><h1>Quality &amp; compliance</h1><div class="sub">SOP register and non-conformances.</div></div>'
   +'<div class="actions"><button class="btn" data-add-inc>'+UI.ic('plus',15)+' Log incident</button><a class="btn primary" href="#/eqa">'+UI.ic('target',15)+' EQA scorecard</a></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px">'+[['overview','Overview'],['sops','SOP register'],['incidents','Non-conformances']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-q-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="qBody"></div>';
  paint();
};
})();
