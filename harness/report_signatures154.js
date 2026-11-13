const {boot,ok,done}=require('./env');
(async()=>{
 const {w}=await boot('#/dash');w.TextEncoder=TextEncoder;w.LS.sync.stopLive();await w.LS.shell.ensureCore('sheets');
 const S=w.LS.store,SH=w.LS.sheets;const rep=S.reportSummary('2026-10');
 const before=JSON.stringify(S.db().reporting);const pages=SH.reportSheets(rep);const all=pages.join(''),last=pages[pages.length-1];
 ok(last.includes('Prepared by')&&last.includes('Kelvin SAMAHANI')&&last.includes('Laboratory Manager'),'export names Kelvin as preparer');
 ok(last.includes('Validated by')&&last.includes('Francois NTAMUGABUMWE')&&last.includes('Data Manager'),'export names Francois as validator');
 ok(!last.includes('Clinical Director')&&!last.includes('Human Resources Officer')&&!last.includes('Approved by'),'monthly export excludes unrelated roster signatories');
 ok(all.includes('10,855'),'report figures remain in the output');
 const blob=SH.reportXLSX(rep);const buf=await new Promise((resolve,reject)=>{const reader=new w.FileReader();reader.onload=()=>resolve(Buffer.from(reader.result));reader.onerror=reject;reader.readAsArrayBuffer(blob);});
 const data=buf.toString('utf8');
 ok(data.includes('Validated by')&&data.includes('Francois NTAMUGABUMWE')&&data.includes('Data Manager')&&data.includes('Kelvin SAMAHANI'),'Excel export contains preparer and validator');
 ok(JSON.stringify(S.db().reporting)===before,'export does not alter stored report');
 done('report_signatures154');
})().catch(e=>{console.error(e);process.exit(1)});
