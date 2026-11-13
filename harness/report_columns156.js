const {boot,ok,done}=require('./env');
(async()=>{
 const {w}=await boot('#/dash');w.LS.sync.stopLive();await w.LS.shell.ensureCore('sheets');
 const S=w.LS.store, SH=w.LS.sheets;const report=S.reportSummary('2026-10');
 const svgs=SH.reportSheets(report), parser=new w.DOMParser();
 const docs=svgs.map(x=>parser.parseFromString(x,'image/svg+xml'));
 const labels=docs.flatMap(doc=>Array.from(doc.querySelectorAll('text')));
 const find=t=>labels.find(x=>x.textContent===t);
 ok(svgs.length>0&&svgs.length<=3,'ordinary report uses a compact number of pages',svgs.length);
 ok(!!find('Francois Xavier NTAMUGABUMWE')&&!!find('Data Manager'),'validator full name and role appear');
 const firstRow=report.sections.find(s=>s.rows.length>2).rows;
 const a=find(firstRow[0].line.label), b=find(firstRow[firstRow.length-1].line.label);
 ok(!!a&&!!b&&Math.abs(Number(a.getAttribute('x'))-Number(b.getAttribute('x')))>500,'examination rows occupy both columns');
 ok(docs.some(doc=>Array.from(doc.querySelectorAll('rect')).some(x=>Number(x.getAttribute('x'))===118&&Number(x.getAttribute('width'))===2244)),'section headings span the full report width');
 ok(!!find('VIII.  Blood supply')&&!!find('Present at the end'),'blood supply remains a full-width table');
 const all=svgs.join('');let missing=[];for(const sec of report.sections)for(const row of sec.rows)if(row.line.label&&!all.includes(row.line.label.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')))missing.push(row.line.label);
 ok(missing.length===0,'all examination labels are present',missing.join(', '));
 ok(svgs.every(s=>!s.includes('undefined')),'page content has valid rendering values');done('report_columns156');
})().catch(e=>{console.error(e);process.exit(1)});
