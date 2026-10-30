/* v6.9.78 — the working plan prints on ONE page.
   The sheet was printed at `width:100%; height:auto`; its aspect ratio is a shade wider
   than A4 landscape's printable box, so a sheet sized to the width ran a few millimetres
   past the foot of the page and every print produced a second, empty page. */
const {boot,ok,done}=require('./env');
(async()=>{
  const {w,errors}=await boot('#/roster');
  const S=w.LS.store, SH=w.LS.sheets, U=w.LSU;
  const svg=SH.monthlySVG(S.buildPlan('2026-11'));
  let captured=null;
  const realPrint=U.print;
  U.print=html=>{ captured=html; return true; };
  SH.printSVG(svg,{title:'Working plan — November 2026'});
  ok(!!captured,'the print document is produced');
  const html=captured||'';
  const page=/@page\{size:A4 (landscape|portrait);margin:([\d.]+)mm\}/.exec(html);
  ok(!!page,'the page is declared A4 '+(page&&page[1]));
  ok(page&&page[1]==='landscape','the working plan prints landscape');
  const pm=page?+page[2]:6;
  const availW=page&&page[1]==='landscape'?297-pm*2:210-pm*2;
  const availH=page&&page[1]==='landscape'?210-pm*2:297-pm*2;
  /* the sheet is given an explicit size in millimetres, not the width of the page */
  const dim=/svg\{[^}]*width:([\d.]+)mm;height:([\d.]+)mm/.exec(html);
  ok(!!dim,'the sheet is sized in millimetres');
  const sw=dim?+dim[1]:0, sh=dim?+dim[2]:0;
  ok(sw>0&&sh>0,'a positive size ('+sw+' × '+sh+' mm)');
  ok(sh<=availH,'the height fits inside the printable box ('+sh.toFixed(2)+' ≤ '+availH+' mm)');
  ok(sw<=availW,'and so does the width ('+sw.toFixed(2)+' ≤ '+availW+' mm)');
  ok(pm===4,'the page margin is two thirds of the 6 mm it was ('+pm+' mm)');
  ok(availW-sw<12,'the side bands are slim on both sides — the sheet is centred ('+((availW-sw)/2).toFixed(2)+' mm each)');
  ok(availH-sh>0.1,'with a hairline to spare, so no rounding spills onto page two ('+(availH-sh).toFixed(2)+' mm)');
  /* the aspect ratio of the sheet is kept: the plan is never stretched */
  const vb=/viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  const ar=(+vb[1])/(+vb[2]), printed=sw/sh;
  ok(Math.abs(printed-ar)/ar<0.002,'the sheet keeps its aspect ratio ('+printed.toFixed(4)+' vs '+ar.toFixed(4)+')');
  /* and it is not shrunk to a stamp to achieve it */
  ok(sw>availW*0.9,'the sheet still fills the page ('+Math.round(sw/availW*100)+'% of the printable width)');

  /* the weekly roster prints through the same helper, and must print on one page too */
  captured=null;
  const wk=SH.weeklySVG(S.weekRosterData?S.weekRosterData():{services:[],dates:[],alloc:{},night:{}});
  SH.printSVG(wk,{title:'Weekly unit roster'});
  const wdim=captured?/svg\{[^}]*width:([\d.]+)mm;height:([\d.]+)mm/.exec(captured):null;
  ok(!!wdim,'the weekly roster is sized in millimetres too');
  ok(wdim&&+wdim[2]<=availH,'and fits the height of the page ('+(wdim?+wdim[2]:0)+' ≤ '+availH+' mm)');
  ok(errors.length===0,'no console errors during the run');
  U.print=realPrint;
  done('print78');
})();
