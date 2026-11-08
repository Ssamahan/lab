/* Synthetic side-by-side HMIS blocks. No real workbook or clinical records. */
const {boot,ok,done}=require('./env');
(async()=>{
 const {w,go}=await boot('#/dash'); await go('#/reports');
 const R=w.LS.modules.reports.__read;
 const row=(cells)=>{let a=[];for(const [c,v] of Object.entries(cells))a[+c]=v;return a;};
 const rows=[row({10:'I. Laboratory',22:'4. Urine',35:'6. Blood',46:'VIII. Blood Supply'}),
  row({10:'1. Blood Smears Plasmodium',15:2,16:86,17:51,18:37}),
  row({10:'1.1 Blood Smears Plasmodium Falciparum',15:2,16:' ',17:0,18:2,24:'4.2 Albumin',27:41,28:78,35:'6.2 HIV final Result',39:0,40:0}),
  row({10:'2. Rapid Diagnostic Tests for Malaria',15:'NA',16:'NA',17:'NA',18:'NA',24:'4.1 Sugar',27:8,28:59,35:'6.6 Creatinine',41:938}),
  row({22:'5.1 Vaginal Swab'}), row({24:'5.1.a Fresh',27:6,28:19}), row({24:'5.1.b Gram',27:6,28:19}), row({24:'5.1.c of which Gram -',27:0}),
  row({22:'5.2 Urethral Swab'}), row({24:'5.1.a Fresh',27:1,28:0}), row({24:'5.1.b Gram',27:1,28:0}), row({24:'5.1.c of which Gram -',27:0}),
  row({22:'5.3 Urine'}), row({24:'5.1.a Fresh',27:17,28:351}), row({24:'5.1.b Gram',27:17,28:351}), row({24:'5.1.c of which Gram -',27:0}),
  row({24:'4.3 Pregnancy Test',27:7,28:19,35:'6.10 Pregnancy Test',39:0,40:0}),
  row({10:'3. Stool Samples Total',16:268}),
  row({12:'3.1 Ascaris',15:1,16:2,17:3}),
  row({35:'8. Other Lab Tests',40:'Positive',41:'Negative'}),
  row({35:'Na+',40:0,41:251,42:251}),
  row({35:'Measles/Rubella',40:0,41:1,42:1}),
  row({35:'Pregnancy Test',40:14,41:25,42:39}),
  row({35:'Synthetic mismatch',40:1,41:4,42:9}),
  row({35:'Leukocytes',40:2,41:5,42:7}),
  row({35:'BD',40:0,41:69,42:69}),
  row({35:'BT',40:0,41:55,42:55}),
  row({35:'TB Smears & GXP',40:9,41:76,42:85})];
 const m=R.matchSheet(rows);
 ok(m.values.m11 && m.values.m11.pos===2 && !('neg' in m.values.m11) && m.values.m11.a1===2,'preserve blank negative and column positions');
 ok(!m.values.r1,'NA does not borrow figures from a neighbouring block');
 ok(m.values.x66&&m.values.x66.total===938,'quantitative result stays in its own column');
 ok(m.values.s1&&m.values.s1.total===268,'stool total uses its actual column');
 ok(m.values.s31&&m.values.s31.pos===6&&m.values.s31.a0===1&&m.values.s31.a1===2&&m.values.s31.a2===3,'stool age columns retain values and calculate their total');
 ok(m.values.oNa&&m.values.oNa.pos===0&&m.values.oNa.neg===251,'Na+ comes from the other-tests block, not an NA cell');
 ok(m.values.xMeasles&&m.values.xMeasles.neg===1,'outbreak results use the other-tests columns');
 ok(m.values.oUrineLeukocytes&&m.values.oUrineLeukocytes.pos===2&&m.values.oUrineLeukocytes.neg===5,'leukocytes kept as urine biochemistry');
 ok(m.values.oDB&&m.values.oDB.neg===69&&m.values.oTB&&m.values.oTB.neg===55,'BD and BT use the confirmed bilirubin mappings');
 ok(m.values.oTBGXP&&m.values.oTBGXP.pos===9&&m.values.oTBGXP.neg===76&&!m.values.oTBSmear,'combined source goes to GXP without invented smear counts');
 ok(m.values.b51a.pos===6&&m.values.b51b.neg===19&&m.values.b51c.total===0&&m.values.b52a.pos===1&&m.values.b52b.pos===1&&m.values.b53a.neg===351&&m.values.b53b.neg===351&&m.values.b53c.total===0,'bacteriology repeated numbering follows each specimen heading');
 ok(m.values.u43.pos===7&&m.values.u43.neg===19&&m.values.x610.pos===0&&m.values.x610.neg===0,'urine and blood pregnancy lines stay distinct');
 ok(m.unmatched.some(x=>x.label==='Pregnancy Test'&&x.nums[0]===14&&x.nums[1]===25),'additional pregnancy row is retained separately, not silently added');
 ok(m.sourceWarnings.some(x=>x.label==='Synthetic mismatch'&&x.sourceTotal===9&&x.calculated===5),'a conflicting printed total is flagged');
 ok(!m.sourceWarnings.some(x=>x.kind==='malaria-negative-meaning')&&m.values.m1.a0===51&&m.values.m1.a1===37,'age groups and results are parallel without a malaria review warning');
 const S=w.LS.store, prev=JSON.stringify(S.reportMonth('2026-10'));
 ok(JSON.stringify(S.reportMonth('2026-10'))===prev,'review does not alter stored month');
 const original=JSON.stringify(S.reportMonth('2026-10'));
 const conflicts=S.reportImportConflicts('2026-10',{x64:{total:99999}},{});
 ok(conflicts.length===1 && S.reportImportMonth('2026-10',{x64:{total:99999}},{})===false,'conflicting import is refused before any write');
 ok(JSON.stringify(S.reportMonth('2026-10'))===original,'existing month stays byte-for-byte intact after refusal');
 S.reportStashUnmatched('2026-10',[{label:'Synthetic duplicate',nums:[2,99999],source:'district-other'}]);
 ok(S.reportPlaceRows('2026-10',[{label:'Synthetic duplicate',lineId:'x61',nums:[2,99999],source:'district-other'}])===0&&S.reportUnmatched('2026-10').length===1,'placing a conflicting row cannot overwrite existing data or discard the source');
 S.reportStashUnmatched('2030-01',[{label:'Unknown synthetic test',nums:[null,7],source:'district-other'}]);
 S.reportStashUnmatched('2030-01',[]);
 ok(S.reportUnmatched('2030-01').length===1,'empty later imports do not erase unresolved source rows');
 const rw={kind:'total-mismatch',label:'Synthetic test',lineId:'oNa',pos:1,neg:4,sourceTotal:9,calculated:5,sourceRow:42,formulas:{41:'=5-AO42'}};
 S.reportImportMonth('2030-04',{oNa:{pos:1,neg:4}},{sourceReview:[rw]});
 ok(S.reportMonth('2030-04').sourceReview[0].sourceTotal===9&&S.reportSummary('2030-04').lines.find(x=>x.id==='oNa').review.length===1,'source total and formula are retained with a review flag');
 await go('#/dash'); await go('#/reports');
 const monthSelect=w.document.querySelector('#repMonth'); monthSelect.value='2030-04'; monthSelect.dispatchEvent(new w.Event('change'));
 ok(w.document.querySelector('input[data-line="oNa"][data-field="neg"]')?.getAttribute('style')?.includes('#b42318')&&w.document.body.textContent.includes('Workbook: positive 1, negative-column 4, total 9'),'flagged source values are shown in red alongside original total');
 ok(S.reportMarkReviewed('2030-04',0)&&S.reportMonth('2030-04').sourceReview[0].sourceTotal===9&&!S.reportSummary('2030-04').lines.find(x=>x.id==='oNa').review.length,'explicit review clears the flag without discarding source figures');
 const id=S.reportAddLine({label:'Synthetic future examination',section:'other',mode:'pn'});
 S.reportImportMonth('2030-01',{[id]:{pos:0,neg:3}});
 ok(S.reportRemoveLine(id)===false,'recorded future test cannot be removed');
 ok(S.reportMonth('2030-01').values[id].neg===3 && S.reportLines().some(x=>x.id===id),'its definition and historical figures are preserved');
 const unused=S.reportAddLine({label:'Unused synthetic examination'});
 ok(S.reportRemoveLine(unused)===true,'unused custom examination can be removed');
 S.reportImportMonth('2030-02',{[id]:{pos:0,neg:0}});
 S.reportImportMonth('2030-03',{x64:{total:1}});
 const series=S.reportTestSeries(id); const jan=series.find(x=>x.key==='2030-01'),feb=series.find(x=>x.key==='2030-02'),mar=series.find(x=>x.key==='2030-03');
 ok(jan.total===3&&feb.total===0&&mar.total===null,'test trends distinguish missing values from recorded zero');
 w.document.querySelector('[data-tab="analysis"]').click();
 const button=w.document.querySelector('[data-test-trend="'+id+'"]');
 ok(!!button,'analysis has a clickable choice for a future test'); if(button) button.click();
 ok(w.document.querySelector('#repTrendSel').value===id,'clicking a test selects its all-time trend');
 ok(!!w.document.querySelector('[data-test-trend="s31"]'),'analysis offers the stool breakdown tests too');
 done('report_import131');
})().catch(e=>{console.error(e);process.exit(1)});
