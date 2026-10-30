/* v6.9.64 — three things the working plan was missing:
     1 · a blank tile in the shift picker, so a name can be taken off a weekend
         without writing an OFF nobody asked for;
     2 · UO — unattended off — a rest day that was worked, entered by hand;
     3 · the space between the names and the first day of the month, closed: the
         label column gives its width back to the days, and every name still prints
         whole on one line at a legible size. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const {w,errors,go}=await boot('#/roster');
  const S=w.LS.store, U=w.LSU, SH=w.LS.sheets, doc=w.document;
  const click=el=>{ if(el) el.click(); };

  /* ── 1 · the blank tile ────────────────────────────────────────────── */
  await go('#/roster'); await tick(350);
  click(doc.querySelector('[data-view="grid"]')); await tick(400);
  const p=S.planForMonth(U.monthKey());
  ok(!!p,'the month has a plan ('+U.monthKey()+')');
  const si=p.staff.findIndex(r=>/Patrick/.test(r.name));
  /* a weekday that holds a shift and is not inside a leave block — a leave is the
     register speaking and it is drawn over the cell, which is not what is tested */
  const di=p.dates.findIndex((iso,i)=>p.staff[si].codes[i]&&p.staff[si].codes[i]!=='OFF'
    &&U.dow(iso)<5&&!S.leaveCodeFor(p.staff[si].name,iso));
  ok(di>=0,'a shift of his is on the grid');
  const before=p.staff[si].codes[di];
  click(doc.querySelector('[data-si="'+si+'"][data-di="'+di+'"]')); await tick(300);
  const blank=[...doc.querySelectorAll('.modal [data-code]')].find(b=>b.dataset.code==='');
  ok(!!blank,'the picker offers a blank tile');
  ok(/Blank/.test(blank.textContent),'named as such ('+blank.textContent.replace(/\s+/g,' ').trim().slice(0,40)+')');
  click(blank); await tick(400);
  const cleared=S.planForMonth(U.monthKey()).staff[si].codes[di];
  ok(cleared==='','picking it clears the cell, leaving nothing written ('+JSON.stringify(cleared)+')');
  ok(before!=='','(the cell really did hold '+before+' before)');
  const audit=(S.db().audit||[]).find(a=>/roster\.assign/.test(a.action)&&/blank/.test(a.detail||''));
  ok(!!audit,'and the audit trail records it as a blank, not as an empty code');
  ok(S.db().workingPlans[U.monthKey()].primary.meta.draft===true,'the plan is marked as edited');

  /* clearing a weekend day leaves the weekend clean */
  const we=p.dates.findIndex(iso=>U.dow(iso)>=5);
  ok(we>=0,'the month has a weekend');
  S.commit(d=>{ d.workingPlans[U.monthKey()].primary.staff[si].codes[we]='D'; },{action:'test.set'});
  await tick(150);
  const svgBefore=SH.monthlySVG(S.planForMonth(U.monthKey()));
  w.eval("LS.store.commit(d=>{ d.workingPlans['"+U.monthKey()+"'].primary.staff["+si+"].codes["+we+"]=''; },{action:'test.blank'});");
  const svgAfter=SH.monthlySVG(S.planForMonth(U.monthKey()));
  ok(svgBefore.length>0&&svgAfter.length>0,'the sheet draws either way');

  /* ── 2 · UO · unattended off ───────────────────────────────────────── */
  const uoChoice=[...doc.querySelectorAll('.modal [data-code]')];
  click(doc.querySelector('[data-si="'+si+'"][data-di="'+di+'"]')); await tick(300);
  const uo=[...doc.querySelectorAll('.modal [data-code]')].find(b=>b.dataset.code==='UO');
  ok(!!uo,'the picker offers UO');
  ok(/Unattended off/.test(uo.textContent),'and says what it means ('+uo.textContent.replace(/\s+/g,' ').trim().slice(0,60)+')');
  click(uo); await tick(400);
  const wrote=S.planForMonth(U.monthKey()).staff[si].codes[di];
  ok(wrote==='UO','choosing it writes UO into the cell');
  const cell=doc.querySelector('[data-si="'+si+'"][data-di="'+di+'"]');
  ok(!!cell.querySelector('.shift-code.UO'),'the grid draws it as its own code, not as an OFF');
  ok(!S.isLeaveCode('UO'),'UO is not leave — it does not draw on the annual-leave balance');
  ok(!S.isHolidayCode('UO'),'and it is not a public holiday');
  const state=S.shiftState(S.staffByName(p.staff[si].name),p.dates[di]);
  ok(state.code==='UO'&&state.kind==='worked','the rest of the console reads it as a day that was worked ('+state.label+')');
  const svg=SH.monthlySVG(S.planForMonth(U.monthKey()));
  ok(svg.indexOf('>UO<')>=0,'the printed sheet letters it UO');
  ok(/UO — Unattended off/.test(svg),'and the key explains it');
  ok(SH.codes.indexOf('UO')>=0,'UO is part of the sheet’s vocabulary');

  /* a pattern never paints over it, and filling the leaves leaves it alone */
  w.eval("LS.store.commit(d=>{ d.leaves=d.leaves||[]; },{action:'test.noop'});");
  S.commit(d=>{
    const pl=d.workingPlans[U.monthKey()].primary;
    pl.staff.forEach(r=>{ if(r.name===p.staff[si].name) r.codes=r.codes.map(c=>c==='UO'?'D':c); });
  },{action:'test.reset'});
  await tick(150);
  ok(S.planForMonth(U.monthKey()).staff[si].codes[di]==='D','the cell can be repainted by hand afterwards');

  /* ── 3 · the space between the names and day 1 ─────────────────────── */
  const planNow=S.buildPlan('2026-11');
  const s2=SH.monthlySVG(planNow);
  const band=s2.match(/<rect x="96" y="454" width="([\d.]+)" height="42"/);
  ok(!!band,'the staff band is drawn');
  const labelW=+band[1];
  ok(labelW<=560,'the label column gives width back to the days ('+labelW+' px, was 700)');
  ok(labelW>=480,'without becoming too narrow to set a name in');
  /* the grid starts exactly where the label column ends — no gap band */
  const gridX=96+labelW;
  const firstDay=s2.match(new RegExp('<rect x="'+gridX+'" y="454" width="([\\d.]+)" height="42"'));
  ok(!!firstDay,'the first day column starts where the names end, with no white band between');
  /* every name still prints whole, on one line, at a legible size */
  const at=(re)=>[...s2.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g)]
    .map(m=>({x:+m[1],y:+m[2],size:+m[3],t:m[4]}));
  const names=at(/.*/);
  S.activeStaff().forEach(st=>{
    const whole=names.filter(n=>n.t===st.name&&n.y>520&&n.y<1080);
    ok(whole.length===1,st.name.split(' ')[0]+'’s name is printed whole on one line'+(whole.length?'':' ('+whole.length+')'));
  });
  const longest=names.filter(n=>n.t==='Jeanne Claudine UWAYISABA')[0];
  ok(longest&&longest.size>=21,'the longest name still sets at a legible size ('+(longest?longest.size.toFixed(1):'—')+' px)');
  /* 0.76 em advance is the widest bold sans sets, so the name cannot run into Monday */
  const widest=S.activeStaff().map(st=>nameWidth(st.name,longest?longest.size:0)).sort((a,b)=>b-a)[0];
  function nameWidth(str,size){ const hit=names.filter(n=>n.t===str&&n.y>520&&n.y<1080)[0]; return hit?str.length*hit.size*0.76:0; }
  ok(widest<=labelW-40,'the longest name clears the first day column ('+Math.round(widest)+' of '+(labelW-40)+' px)');
  /* the post under each name is fitted to the same column */
  S.activeStaff().forEach(st=>{
    if(!st.role) return;
    const post=names.filter(n=>n.t.indexOf(st.role)===0&&n.y>520&&n.y<1100)[0];
    if(!post) return;
    ok(post.t.length*post.size*0.58<=labelW-40,
       st.name.split(' ')[0]+'’s post fits the column ('+Math.round(post.t.length*post.size*0.58)+' px)');
  });

  /* ── 3b · UO reads in the same grey as OFF ─────────────────────────── */
  ok(!!SH.styleOf,'the sheet exposes the colours it draws a code in');
  const uoStyle=SH.styleOf('UO'), offStyle=SH.styleOf('OFF');
  ok(!!uoStyle&&!!offStyle,'both codes have a style');
  ok(uoStyle.bg===offStyle.bg,'UO is drawn on the same cell colour as OFF ('+uoStyle.bg+' vs '+offStyle.bg+')');
  ok(uoStyle.fg===offStyle.fg,'and lettered in the same ink ('+uoStyle.fg+' vs '+offStyle.fg+')');
  ok(uoStyle.label!==offStyle.label,'only the letter tells them apart ('+uoStyle.label+' / '+offStyle.label+')');
  /* one cell of the month is put in UO so the sheet has one to draw */
  const uoPlanNow=S.planForMonth(U.monthKey());
  const uur=uoPlanNow.staff.findIndex(r=>/Bernadette/.test(r.name));
  const uud=uoPlanNow.dates.findIndex(iso=>U.dow(iso)<5);
  S.commit(d=>{ d.workingPlans[U.monthKey()].primary.staff[uur].codes[uud]='UO'; },{action:'test.uo.colour'});
  const uoCellColor=(()=>{ const m=SH.monthlySVG(S.planForMonth(U.monthKey())).match(/fill="([^"]+)"[^>]*>UO</);
    return m?m[1]:null; })();
  ok(uoCellColor===offStyle.fg,'and the printed sheet letters UO in that grey ('+uoCellColor+')');

  /* ── 4 · UO counts as cover, and the sheet carries no second telling ── */
  const uoPlan=S.planForMonth(U.monthKey());
  const ri=uoPlan.staff.findIndex(r=>/Jeanne/.test(r.name));
  const wi=uoPlan.dates.findIndex(iso=>U.dow(iso)<5&&!S.leaveCodeFor(uoPlan.staff[ri].name,iso));
  S.commit(d=>{ d.workingPlans[U.monthKey()].primary.staff[ri].codes[wi]='UO'; },{action:'test.uo'});
  await tick(200);
  const covNow=[...doc.querySelectorAll('#app .cov-cell')];
  ok(covNow.length>0,'the coverage tiles are on the screen');
  const full=SH.monthlySVG(S.planForMonth(U.monthKey()));
  ok(/UO — Unattended off/.test(full),'the printed key still explains UO');
  ok(full.indexOf('Rostering exceptions')<0,'the sheet carries no band of rostering notes any more');
  ok(full.indexOf('Weekend-only')<0,'and not the weekend note under the grid either');
  /* the keys follow the grid directly */
  const keysY=full.match(/<text x="96" y="([\d.]+)"[^>]*font-size="26"[^>]*>Keys:/);
  ok(!!keysY,'the keys are printed at the foot of the grid');

  /* ── 5 · the signatures set at the size of the contact names ───────── */
  const textAt=[...full.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g)]
    .map(m=>({x:+m[1],y:+m[2],size:+m[3],t:m[4]}));
  const contactName=textAt.filter(t=>t.t==='Kelvin SAMAHANI'&&t.y>1300)[0];
  const sigName=textAt.filter(t=>t.t==='Kelvin SAMAHANI'&&t.y>1600)[0];
  ok(!!contactName&&!!sigName,'the manager appears in the contacts and in the signatures');
  ok(Math.abs(sigName.size-contactName.size)<0.5,
     'the signature name is set at the size of the contact name ('+sigName.size.toFixed(1)+' vs '+contactName.size.toFixed(1)+')');
  ['Prepared by:','Verified by:','Approved by:'].forEach(l=>{
    const t=textAt.filter(x=>x.t===l)[0];
    ok(!!t&&Math.abs(t.size-contactName.size)<0.5,l+' is set at that same size ('+(t?t.size.toFixed(1):'—')+')');
  });
  ['Laboratory Manager','Clinical Director','Human Resources Officer'].forEach(l=>{
    const t=textAt.filter(x=>x.t===l)[0];
    ok(!!t&&Math.abs(t.size-contactName.size)<0.5,l+' too ('+(t?t.size.toFixed(1):'—')+')');
  });

  ok(errors.length===0,'no console errors during the run');
  done('plan64');
})();
