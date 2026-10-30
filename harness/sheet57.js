/* v6.9.57 — the sheet reads like the departmental letterhead:
   the ministry above the hospital, every name whole on one line with its post
   beneath it, the phone number beside the name instead of under it, and the posts
   written the way the department writes them (Lab Technician, Lab Technologist,
   Lab Quality Manager, Lab Safety Officer). */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const {w,errors,go}=await boot('#/roster');
  const S=w.LS.store, U=w.LSU, doc=w.document;
  const svg=w.LS.sheets.monthlySVG(S.planForMonth('2026-11'));
  const nodes=[...svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g)]
    .map(m=>({x:+m[1],y:+m[2],size:+m[3],t:m[4]}));
  const at=(re)=>nodes.filter(n=>re.test(n.t));
  /* the body of the grid runs from the header band down to the keys; the page is
     A4 landscape (3200 × 2262) so the rows are taller than they used to be and a
     fixed band would stop before the last of them */
  const keysNode=at(/^Keys:$/)[0];
  const bodyTop=520, bodyBottom=keysNode?keysNode.y-20:1600;
  const inBody=n=>n.y>bodyTop&&n.y<bodyBottom;

  /* ── 1 · the ministry stands above the hospital ─────────────────────── */
  const min=at(/^MINISTRY OF HEALTH$/)[0];
  const hosp=at(/^RULI DISTRICT HOSPITAL$/)[0];
  ok(!!min,'the sheet carries MINISTRY OF HEALTH');
  ok(!!hosp,'and the hospital name');
  ok(min && hosp && min.y<hosp.y,'the ministry sits above it ('+min.y+' < '+hosp.y+')');
  ok(min && min.x>1000 && min.x<2200,'and is centred on the head ('+min.x+')');
  const wk=w.LS.sheets.weeklySVG({weekStart:'2026-11-02'});
  ok(/MINISTRY OF HEALTH/.test(wk),'the weekly roster carries it too');
  ok(wk.indexOf('MINISTRY OF HEALTH')<wk.indexOf('RULI DISTRICT HOSPITAL'),'above the hospital there as well');

  /* ── 2 · every name whole, on one line ─────────────────────────────── */
  S.activeStaff().forEach(st=>{
    const hits=at(new RegExp('^'+st.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'));
    ok(hits.length>=1,st.name.split(' ')[0].split(' ')[0]+'’s name is printed whole');
  });
  ['NSENGIYUMVA','NIYIDUHABYOSE','MUHAWENIMANA','UWAYISABA','YANSONEYE','NGEZEKURE'].forEach(sur=>{
    ok(!at(new RegExp('^'+sur+'$')).length,'the family name '+sur+' is never printed on a line of its own');
  });
  /* the body rows: name on one line, the post on the next, never on top of it */
  S.activeStaff().forEach(st=>{
    const name=at(new RegExp('^'+st.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')).filter(inBody)[0];
    if(!name) return ok(false,st.name+' has a body row');
    const role=at(new RegExp('^'+String(st.role||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
      /* the post sits on the next line of a row that is now A4-tall, so the gap is
         measured against the row rather than against a fixed 40 px */
      .filter(n=>Math.abs(n.x-name.x)<2 && n.y>name.y && n.y-name.y<70).sort((a,b)=>a.y-b.y)[0];
    ok(!!role,st.name.split(' ')[0]+'’s post is printed with the row ('+(role?role.t:'—')+')');
    if(role) ok(role.y>name.y,st.name.split(' ')[0]+'’s post sits below the name, not over it ('+name.y.toFixed(0)+' → '+role.y.toFixed(0)+')');
    if(role) ok(role.size<name.size,'and a step smaller, so the name reads first ('+name.size+' vs '+role.size+')');
  });
  /* the longest name sets at a size a reader can take on the wall */
  const longest=at(/^Jeanne Claudine UWAYISABA$/).filter(inBody)[0];
  ok(longest&&longest.size>=21,'the longest name is not shrunk below legibility ('+(longest?longest.size:'—')+')');

  /* ── 3 · the phone sits beside the name, not under it ──────────────── */
  const contacts=at(/^Staff contacts:$/)[0];
  ok(!!contacts,'the sheet keeps its staff contact list');
  S.activeStaff().forEach(st=>{
    if(!st.phone) return;
    /* the letterhead carries the department's own number, which is the manager's;
       the contact card is the one under the "Staff contacts" heading */
    const phone=at(new RegExp('^'+U.fmtPhone(st.phone)+'$')).filter(n=>n.y>contacts.y)[0];
    ok(!!phone,'the number for '+st.name.split(' ')[0]+' is on the sheet');
    if(!phone) return;
    const name=nodes.filter(n=>n.y===phone.y&&n.x<phone.x).sort((a,b)=>b.x-a.x)[0];
    ok(!!name && name.t===st.name,'and on the same line as the name ('+(name?name.t:'—')+' · '+phone.t+')');
    ok(phone.size>=24,'at a size that reads ('+phone.size+'px)');
    ok(phone.x-name.x>200,'set apart from the name by a real gap');
  });

  /* ── 4 · the posts, written the way the department writes them ─────── */
  const roleOf=id=>(S.staffById(id)||{}).role;
  ok(roleOf('s3')==='Lab Technologist','Beatrice stays the Lab Technologist');
  ok(roleOf('s5')==='Lab Technician','Patrick is a Lab Technician');
  ok(roleOf('s10')==='Lab Technician','Bernadette is a Lab Technician');
  ok(roleOf('s11')==='Lab Technician','Jeanne Claudine is a Lab Technician');
  ok(roleOf('s6')==='Lab Quality Manager','Jean Paul is the Lab Quality Manager');
  ok(roleOf('s9')==='Lab Safety Officer','Dieudonné is the Lab Safety Officer');
  ok(roleOf('s1')==='Laboratory Manager','and the manager keeps his title');
  ok(!S.activeStaff().some(s=>/^Laboratory Technician$/.test(s.role)),'nobody is a “Laboratory Technician” any more');
  ok(S.activeStaff().filter(s=>/^Lab Technologist$/.test(s.role)).length===1,'exactly one Lab Technologist');
  ok(S.postOf(S.staffById('s6'))==='Lab Quality Manager','the post Jean holds is written the same way');
  ok(S.postOf(S.staffById('s9'))==='Lab Safety Officer','and the post Dieudonné holds');
  ok(S.dutyKeyOf(S.staffById('s6'))==='qualityManager','the duty key behind the post is untouched');
  ok(S.dutyKeyOf(S.staffById('s9'))==='safetyOfficer','and so is his');

  /* ── 5 · the screen says the same thing ───────────────────────────── */
  await go('#/roster'); await tick(320);
  doc.querySelector('[data-view="grid"]').click(); await tick(360);
  const cells=[...doc.querySelectorAll('#roBody td.staff-cell')].map(td=>td.textContent.replace(/\s+/g,' '));
  ok(cells.some(t=>/Lab Quality Manager/.test(t)),'the working plan prints Jean Paul’s post');
  ok(cells.some(t=>/Lab Safety Officer/.test(t)),'and Dieudonné’s');
  ok(cells.some(t=>/Lab Technologist/.test(t)),'and Beatrice’s');
  ok(cells.filter(t=>/Lab Technician/.test(t)).length>=2,'and the technicians’ ('+cells.filter(t=>/Lab Technician/.test(t)).length+')');

  /* ── 6 · the XLSX head carries the ministry above the hospital ─────── */
  w.TextEncoder=w.TextEncoder||require('util').TextEncoder;
  const xlsx=w.LS.sheets.monthlyXLSX(S.planForMonth('2026-11'));
  ok(!!xlsx,'the workbook is produced');
  const blob=await new Promise(res=>{ const fr=new w.FileReader(); fr.onload=()=>res(String(fr.result)); fr.readAsText(xlsx); });
  ok(/MINISTRY OF HEALTH/.test(blob),'the XLSX states the ministry');
  ok(blob.indexOf('MINISTRY OF HEALTH')<blob.indexOf('Ruli District Hospital'),'above the hospital');
  ok(/Prepared by/.test(blob),'and the workbook keeps its signature block');

  ok(errors.length===0,'no console errors during the run'+(errors.length?': '+errors.join(' | '):''));
  done('sheet57');
})().catch(e=>{ console.error(e); process.exit(1); });
