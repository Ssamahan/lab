/* Synthetic fixtures: no real patient or workbook data. */
const {boot,ok,done}=require('./env');
(async()=>{
 const {w,go}=await boot('#/dash'), S=w.LS.store; w.LS.sync.stopLive(); S.clearPending();
 const source={
  '2025-01':{month:'2025-01',meta:{},values:{x67:{total:120},x64:{total:60},m1:{pos:2,neg:86,a0:51,a1:37},s31:{pos:6,a0:1,a1:2,a2:3}},blood:{'O+':{req:8,recv:7,used:6,returned:1,expired:0}},sourceReview:[{kind:'malaria-negative-meaning',label:'Blood Smears Plasmodium',lineId:'m1',pos:2,neg:86,under5:51,over5:37},{kind:'total-mismatch',label:'Other',lineId:'oNa',pos:1,neg:4,sourceTotal:9,calculated:5}]},
  '2026-01':{month:'2026-01',meta:{},values:{x67:{total:150},x64:{total:70},m1:{pos:1,a0:4,a1:5}},blood:{'O+':{req:0,used:0},'A-':{req:4,used:3,returned:0}},sourceReview:[]},
  '2026-02':{month:'2026-02',meta:{},values:{x67:{total:0}},blood:{},sourceReview:[]}
 };
 const unchanged=JSON.stringify(source); ok(S.setReportSource(source),'source accepted');
 const m=S.reportMonth('2025-01');
 ok(m.sourceReview.length===1&&m.sourceReview[0].kind==='total-mismatch','only obsolete malaria warning is suppressed');
 ok(JSON.stringify(source)===unchanged,'the underlying source is not modified');
 const malaria=S.reportSummary('2025-01').lines.find(r=>r.id==='m1');
 const stool=S.reportSummary('2025-01').lines.find(r=>r.id==='s31');
 ok(malaria.total===88&&malaria.a0===51&&malaria.a1===37,'malaria age breakdown does not add tests');
 ok(stool.total===6&&stool.a0===1&&stool.a1===2&&stool.a2===3,'stool age breakdown does not add tests twice');
 const blood=S.reportBloodGroupSeries('O+'), row=blood.find(x=>x.key==='2025-01'), next=blood.find(x=>x.key==='2026-01'), absent=blood.find(x=>x.key==='2026-02');
 ok(row.req===8&&row.recv===7&&row.used===6&&row.returned===1&&row.expired===0,'blood group fields retain original distinct values');
 ok(next.req===0&&next.used===0&&next.returned===null&&absent.req===null,'blood group zero and missing values are distinct');
 ok(S.reportBloodGroupSeries('A-').find(x=>x.key==='2026-01').used===3,'another blood group is independent');
 const y25=S.reportTestYearSeries('x67','2025'), y26=S.reportTestYearSeries('x67','2026');
 ok(y25.length===12&&y25[0].total===120&&y25[1].total===null&&y26[0].total===150&&y26[1].total===0,'year comparison aligns months and leaves absent months blank');
 ok(S.reportTestYearSeries('m1','2026')[0].total===null,'an incomplete positive/negative pair is not misreported as a total');
 ok(!S.reportRankings(S.reportSummary('2025-01')).all.find(r=>r.id==='x67').label.startsWith('6.7'),'HMIS number is not part of examination name');
 w.LS.privateNames.connected=()=>true;await go('#/reports');w.document.querySelector('[data-tab="analysis"]').click();
 ok(!!w.document.querySelector('#repBloodGroup')&&!!w.document.querySelector('#repGroupTrend svg'),'blood type history and chart render');
 const bg=w.document.querySelector('#repBloodGroup');bg.value='A-';bg.dispatchEvent(new w.Event('change'));
 ok(w.document.querySelector('#repBloodGroup').value==='A-'&&w.document.querySelector('#repGroupTrend svg').getAttribute('aria-label').includes('A-'),'changing blood type updates chart');
 ok(w.document.querySelector('#repCompareA').value==='x67'&&w.document.querySelector('#repYearA').value==='2025'&&w.document.querySelector('#repYearB').value==='2026','glucose and available years preselect for comparison');
 w.document.querySelector('[data-add-comparison]').click();
 const third=w.document.querySelector('#repCompareC');third.value='oNa';third.dispatchEvent(new w.Event('change'));
 ok(w.document.querySelector('#repCompareC').value==='oNa'&&w.document.querySelector('#repCompareLegend').textContent.includes('Na+'),'three examinations can be compared');
 ok(w.document.querySelector('#repCompareTable').textContent.includes('120')&&w.document.querySelector('#repCompareTable').textContent.includes('150'),'year comparison presents underlying figures');
 ok(!/^6\.7\s/.test(w.document.querySelector('#repCompareA option[value="x67"]').textContent),'comparison options use names without HMIS numbers');
 w.document.querySelector('[data-add-comparison]').click();
 ok(!!w.document.querySelector('#repCompareD'),'additional examinations can be added beyond three');
 ok(S.pendingChanges()===0,'analysis never writes into the register');
 done('report_compare132');
})().catch(e=>{console.error(e);process.exit(1)});
