/* v6.9.83 — request #56: the monthly reports module.
   The laboratory's HMIS return to the district: the form itself, filled in and
   computed; the analysis behind it (top requested, top positives, least requested,
   blood transfusion); and an export laid out like the paper sheet. The form grows
   with the laboratory — a test added to the menu appears on the return by itself. */
const {boot,ok,done}=require('./env');
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const srcRep=fs.readFileSync(path.join(root,'assets/js/modules/report.js'),'utf8');
const srcSh=fs.readFileSync(path.join(root,'assets/js/core/sheets.js'),'utf8');
const srcSt=fs.readFileSync(path.join(root,'assets/js/core/store.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/modules.css'),'utf8');

(async()=>{
  const {w,go,errors}=await boot('#/reports');
  const d=w.document, S=w.LS.store, U=w.LSU, SH=w.LS.sheets;
  const tick=n=>new Promise(r=>setTimeout(r,n||200));
  const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const page=d.querySelector('#app');
  ok(!errors.length,'the console boots without console errors',errors.join(' | '));

  /* ── 1 · the module is on the rail ──────────────────────────────────── */
  ok(!!w.LS.shell.ROUTES.reports,'Monthly Reports is a route of its own');
  ok(w.LS.shell.ROUTES.reports.group==='Operations','it sits with the laboratory work, not under admin',w.LS.shell.ROUTES.reports.group);
  await go('#/reports'); await tick(400);
  ok(/Monthly reports/i.test((page.querySelector('h1')||{}).textContent||''),'the page opens on its own heading');
  ok(d.querySelectorAll('.nav-item[data-tab="reports"]').length===1,'and it has an entry on the rail');

  /* ── 2 · the month on file, as the district received it ─────────────── */
  const sm=S.reportSummary('2026-10');
  ok(S.reportMonths()[0]==='2026-10','October 2026 is the month on file',S.reportMonths().join(', '));
  ok(sm.totals.tests===10855,'the total reconciles with the signed sheet — 10,855 tests',sm.totals.tests);
  ok(sm.sections.length===9,'all nine sections of the form are on the page ('+sm.sections.length+')');
  const sec=k=>sm.sections.find(x=>x.key===k);
  ok(sec('malaria').total===88,'malaria section totals 88',sec('malaria').total);
  ok(sec('stool').total===268,'stool reports the 268 samples analysed',sec('stool').total);
  ok(sec('urine').total===234,'urine totals 234',sec('urine').total);
  ok(sec('bacteriology').total===1204,'bacteriology totals 1,204',sec('bacteriology').total);
  ok(sec('blood').total===4719,'blood totals 4,719',sec('blood').total);
  ok(sec('other').total===4341,'other laboratory tests total 4,341',sec('other').total);
  ok(sec('outbreak').total===1,'and the outbreak samples are reported separately — 1',sec('outbreak').total);
  const m1=sm.lines.find(r=>r.id==='m1');
  ok(m1.pos===2&&m1.neg===86&&m1.a0===51&&m1.a1===37,'line 1 carries its positives, negatives and the age split');

  /* the of-which rows are printed, never counted twice */
  const falc=sm.lines.find(r=>r.id==='m11');
  ok(falc&&falc.line.breakdown===true,'the malaria species is a breakdown of line 1');
  const stoolRows=sec('stool').rows.filter(r=>r.line.breakdown);
  ok(stoolRows.length===11,'every stool species is a breakdown of the 268 samples ('+stoolRows.length+')');

  /* ── 3 · blood supply ──────────────────────────────────────────────── */
  const bt=sm.bloodTotals;
  ok(bt.open===6&&bt.recv===54&&bt.used===51&&bt.end===9,
     'the blood bank reconciles: 6 opening, 54 received, 51 used, 9 left',JSON.stringify(bt));
  ok(sm.blood['B+'].end===3&&sm.blood['O+'].end===4,'the two groups that moved carry their closing balance');
  ok(bt.end===bt.open+bt.recv-bt.used-bt.expired-bt.returned,'closing = opening + received − used − expired − returned');

  /* ── 4 · every total is computed, never typed twice ─────────────────── */
  const inp=page.querySelector('.rep-in[data-line="u41"][data-field="pos"]');
  ok(!!inp&&inp.tagName==='INPUT','a figure is typed into a cell of the form itself');
  ok(!!page.querySelector('[data-total="u41"]'),'the row has a computed total beside it');
  const before=page.querySelector('[data-total="u41"]').textContent;
  inp.value='21'; inp.dispatchEvent(new w.Event('change',{bubbles:true})); await tick(160);
  const after=page.querySelector('[data-total="u41"]').textContent;
  ok(before!==after,'changing a cell moves the row total at once ('+before+' → '+after+')');
  ok(S.reportMonth('2026-10').values.u41.pos===21,'and the figure is stored on the month');
  ok(page.querySelector('[data-sec-total="urine"]').textContent==='244','the section total follows it ('+page.querySelector('[data-sec-total="urine"]').textContent+')');
  const bInp=page.querySelector('.rep-in[data-blood-group="A-"][data-blood-field="recv"]');
  bInp.value='4'; bInp.dispatchEvent(new w.Event('change',{bubbles:true})); await tick(140);
  ok(S.reportMonth('2026-10').blood['A-'].recv===4,'a blood pack figure is stored the same way');
  ok(page.querySelector('[data-blood-end="A-"]').textContent==='4','and the closing balance is worked out, not typed');
  inp.value='11'; inp.dispatchEvent(new w.Event('change',{bubbles:true}));
  bInp.value='0'; bInp.dispatchEvent(new w.Event('change',{bubbles:true})); await tick(140);

  /* ── 5 · the analysis ──────────────────────────────────────────────── */
  const ranked=S.reportRankings(S.reportSummary('2026-10'));
  ok(ranked.requested[0].label.indexOf('Full Blood Count')>=0,'the most requested examination is the full blood count',ranked.requested[0].label);
  ok(ranked.requested[0].figure===1364,'with 1,364 tests',ranked.requested[0].figure);
  ok(ranked.requested.slice(0,10).length===10,'the ten read off the ranking are exactly ten');
  ok(ranked.requested.every((r,i,a)=>i===0||a[i-1].figure>=r.figure),'and they run from most to least requested');
  ok(ranked.least[0].figure<=2,'the least requested has almost nothing on it',ranked.least[0].label+' '+ranked.least[0].figure);
  ok(ranked.positives[0].label.indexOf('H. pylori')>=0,'the most positive qualitative test is H. pylori',ranked.positives[0].label);
  ok(ranked.positives[0].pos===69,'with 69 positives',ranked.positives[0].pos);
  ok(ranked.positives.every(r=>r.rate!=null),'every positive test carries its own positivity rate');
  ok(ranked.positives.find(r=>/Entamoeba/.test(r.label)).rate===21.6,
     'a stool species is measured against the 268 samples, not against itself',
     ranked.positives.find(r=>/Entamoeba/.test(r.label)).rate);
  ok(!ranked.positives.some(r=>/Full Blood Count|Creatinine/.test(r.label)),'a quantitative test is not scored as positive or negative');
  ['#repTop','#repPos','#repLeast','#repSections','#repBlood'].forEach(sel=>{
    const el=page.querySelector(sel);
    if(sel==='#repBlood') return;
    ok(el&&el.textContent.trim().length>10,'the chart '+sel+' is drawn with data in it',el?el.textContent.slice(0,40):'missing');
  });
  ok(/Top 10 requested/i.test(page.textContent),'the page names the top-ten analysis');
  ok(/Top positive tests/i.test(page.textContent),'the positive-test analysis is there');
  ok(/Least requested/i.test(page.textContent),'and the least-requested one');
  ok(/Blood transfusion/i.test(page.textContent),'with the blood-transfusion analysis');
  ok(/Transfusion rate/i.test(page.textContent),'including the share of what arrived that was transfused');

  /* ── 6 · the form grows with the laboratory ─────────────────────────── */
  const before2=S.reportLines().length;
  w.eval("LS.store.commit(d=>{ d.catalog.tests.push({id:'tNEW',name:'Blood cultures transferred',cat:'Bacteriology',code:'BCT',tat:7,active:true}); },{action:'test.add'});");
  const lines=S.reportLines();
  ok(lines.length>before2,'a test added to the menu adds a line to the return ('+before2+' → '+lines.length+')');
  const auto=lines.find(l=>l.label==='Blood cultures transferred');
  ok(auto&&auto.auto===true,'the new line is marked as coming from the menu');
  ok(auto.section==='other'||auto.section==='outbreak','and it lands in a sensible section',auto&&auto.section);
  ok(/S\.reportLines=function/.test(srcSt)&&/db\.catalog\.tests/.test(srcSt),'the lines are read from the catalogue, not hard-coded twice');
  await go('#/reports'); await tick(400);
  ok(/Blood cultures transferred/.test(page.textContent),'the new examination appears on the report without a code change');

  /* ── 7 · a line of its own, added by hand ───────────────────────────── */
  click(page.querySelector('[data-add-line]')); await tick(200);
  ok(!!d.querySelector('#rlLabel'),'the “add examination” form opens');
  d.querySelector('#rlLabel').value='Cryptococcal antigen (CSF)';
  d.querySelector('#rlSection').value='csf';
  d.querySelector('#rlMode').value='pn';
  click(d.querySelector('[data-save]')); await tick(320);
  const added=S.reportSummary('2026-10').sections.find(x=>x.key==='csf').rows.find(r=>/Cryptococcal antigen/.test(r.line.label));
  ok(!!added,'the line joins the form from this month on');
  ok(!!page.querySelector('[data-del-line]'),'and it can be taken off again');

  /* ── 8 · opening a month ───────────────────────────────────────────── */
  click(page.querySelector('[data-new-month]')); await tick(220);
  d.querySelector('#nmKey').value='2026-11';
  click(d.querySelector('[data-save]')); await tick(400);
  ok(S.reportMonths()[0]==='2026-11','a new month opens');
  ok(S.reportSummary('2026-11').totals.tests===0,'and it starts empty — no figure is copied from the month before');
  ok(S.reportSummary('2026-10').totals.tests>10000,'October is untouched by opening November');
  ok(!!page.querySelector('#repMonth'),'the month selector is on the page');
  page.querySelector('#repMonth').value='2026-10';
  page.querySelector('#repMonth').dispatchEvent(new w.Event('change',{bubbles:true})); await tick(300);
  ok(/10,855|10855/.test(page.textContent),'and switching back brings October\u2019s figures with it');

  /* ── 9 · the export, laid out like the paper return ─────────────────── */
  const rpt=S.reportSummary('2026-10');
  const svgs=SH.reportSheets(rpt);
  ok(svgs.length>=2,'the return exports as a paginated document ('+svgs.length+' pages)');
  ok(svgs.every(s=>/viewBox="0 0 2480 3508"/.test(s)),'every page is A4 portrait');
  ok(/District Hospital Monthly HMIS Report/.test(svgs[0]),'the sheet carries the report\u2019s own title');
  ok(/Identification and important communications/.test(svgs[0]),'and section II, identification');
  ok(/Blood supply/.test(svgs.join('')),'and section VIII, blood supply');
  ok(/B\+/.test(svgs.join('')),'with the group types');
  ok(/Present at the end/.test(svgs.join('')),'and the closing balances');
  ok(/10,855/.test(svgs.join('')),'the total printed on the sheet is the total on the screen');
  ok(/Positives/.test(svgs.join(''))&&/Negatives/.test(svgs.join('')),'positives and negatives are headed as on the form');
  ok(/5 yrs/.test(svgs.join(''))&&/0–4 yrs|0-4 yrs/.test(svgs.join('')),'the age split is on the sheet where the form asks for it');
  ok(svgs[svgs.length-1].indexOf('Prepared by')>0,'the last page carries the signatures');
  ok(/Page 1 of \d/.test(svgs[0]),'the pages are numbered');
  /* the sheet grows with the data instead of overflowing */
  w.eval("LS.store.commit(x=>{ for(let i=0;i<70;i++) x.reporting.lines.push({id:'extra'+i,no:'',label:'Added examination number '+i,section:'other',mode:'pn',indent:1,custom:true}); },{action:'test.lines'});");
  const grown=SH.reportSheets(S.reportSummary('2026-10'));
  ok(grown.length>svgs.length,'seventy more examinations make more pages, not a broken sheet ('+svgs.length+' → '+grown.length+')');
  ok(grown.every(s=>/viewBox="0 0 2480 3508"/.test(s)),'and every one of them is still an A4 page');
  ok(/Added examination number 69/.test(grown.join('')),'the last added line is on the sheet');
  /* no row is printed twice, and none is dropped when the pages are added */
  const allGrown=grown.join('');
  const counts={};
  (allGrown.match(/Added examination number \d+/g)||[]).forEach(m=>{ counts[m]=(counts[m]||0)+1; });
  ok(Object.keys(counts).length===70,'every added examination is printed ('+Object.keys(counts).length+')');
  ok(Object.keys(counts).every(k=>counts[k]===1),'and none of them twice');
  ok(grown[grown.length-1].indexOf('Prepared by')>0,'the signatures stay on the final page');

  /* the XLSX is the same data in cells */
  ok(typeof SH.reportXLSX==='function','the return exports to Excel as well');
  ok(/SH\.reportPrint=function/.test(srcSh)&&/SH\.toPDFPages=async function/.test(srcSh),
     'print and a multi-page PDF are both offered');
  ok(/SH\.offerReport=function/.test(srcSh)&&/rep-exp-preview/.test(srcSh),
     'the export dialogue previews the first page before choosing a format');
  ok(/audit\(\{action:'export\.report/.test(srcSh),'an export is written to the audit trail');

  /* ── 10 · it can be found, and it says who may sign in ─────────────── */
  await go('#/dash'); await tick(320);
  ok(!!page.querySelector('[data-hero-report]'),'the Command Center carries a Monthly report button');
  ok(w.LS.shell.version()==='6.9.86','the shell knows the build it is running',w.LS.shell.version());
  ok(/watchVersion/.test(fs.readFileSync(path.join(root,'assets/js/core/boot.js'),'utf8')),
     'and a tab left open is told when a newer build is live');
  ok(/'reports'/.test(fs.readFileSync(path.join(root,'sw.js'),'utf8').split('const MODULES')[1].split(']')[0]),
     'the module is precached, so the return opens offline too');

  /* the registry must not invent an access role for a person who has no account */
  await go('#/staff'); await tick(400);
  const cards=[...page.querySelectorAll('[data-person]')];
  ok(cards.length>=8,'the staff registry lists the department ('+cards.length+')');
  const withJob=(re)=>{ const c=cards.find(x=>re.test(x.querySelector('.card-sub').textContent)); return c||null; };
  const patrick=withJob(/Lab Technician/);
  ok(patrick&&patrick.querySelector('.card-sub').textContent==='Lab Technician','the job title is the job title');
  ok(patrick&&/no account/.test(patrick.textContent),'and a person with no login says so, instead of being given a role');
  ok(cards.filter(c=>/Technologist<\/span>/.test(c.innerHTML)).length===1,
     'only the one person who really holds a Technologist account is badged that way',
     cards.filter(c=>/Technologist<\/span>/.test(c.innerHTML)).map(c=>c.querySelector('.card-title').textContent).join(', '));
  const kelvin=cards.find(c=>/Kelvin/.test(c.querySelector('.card-title').textContent));
  ok(/Admin/.test(kelvin.textContent),'the admin account is still badged Admin');
  ok(/accessBadge/.test(fs.readFileSync(path.join(root,'assets/js/modules/staff.js'),'utf8')),
     'the badge is drawn from the account, never from the job title');

  /* ── 11 · the house look ───────────────────────────────────────────── */
  ok(/\.rep-sec-head\{/.test(css)&&/\.rep-table\{/.test(css),'the form has its own print-like styling on screen');
  ok(/\.rep-in:focus\{/.test(css),'a cell shows the gold focus ring of the rest of the console');
  ok(/@media \(max-width:900px\)[\s\S]*\.rep-in\{width:46px\}/.test(css),'and it stays usable on a phone');
  ok(/letterhead\(s,\{width:W/.test(srcSh),'the export uses the department letterhead, as every other sheet does');
  ok(!errors.length,'still no console errors',errors.join(' | '));
  done('report83');
})().catch(e=>{ console.log('  ✗ harness threw: '+e.message+'\n'+e.stack); process.exit(1); });
