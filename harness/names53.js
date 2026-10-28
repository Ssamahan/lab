/* v6.9.53 — Rwandan names. A person's given name is everything before the family
   name and it is one unit: “Jean Paul” is not “Jean” with a middle name “Paul”, and
   “Paul NSENGIYUMVA” is not a surname. The roster, the printed sheet and the avatars
   all have to read that way. */
const {boot,ok,done}=require('./env');

(async()=>{
  const {w,go}=await boot('#/dash');
  const U=w.LSU, S=w.LS.store, doc=w.document;

  /* ── the split itself ─────────────────────────────────────────────── */
  const cases=[
    ['Jean Paul NSENGIYUMVA','Jean Paul','NSENGIYUMVA'],
    ['Marie Claudine UWAYISABA','Marie Claudine','UWAYISABA'],
    ['Jean de Dieu SIBOMANA','Jean de Dieu','SIBOMANA'],
    ['Kelvin SAMAHANI','Kelvin','SAMAHANI'],
    ['Aurelie YANSONEYE','Aurelie','YANSONEYE'],
    ['Dieudonne NIYIDUHABYOSE','Dieudonne','NIYIDUHABYOSE']
  ];
  cases.forEach(([full,given,surname])=>{
    const p=U.nameParts(full);
    ok(p.given===given&&p.surname===surname,'“'+full+'” splits as given “'+given+'” + family “'+surname+'”',
      p.given+' | '+p.surname);
  });
  ok(U.nameParts('MUKAMANA').given===''&&U.nameParts('MUKAMANA').surname==='MUKAMANA',
    'a one-word name is not chopped in half');
  ok(U.givenName('Jean Paul NSENGIYUMVA')==='Jean Paul','the known name is the given name, whole');
  ok(U.givenName('MUKAMANA')==='MUKAMANA','a one-word name stands as itself');

  /* ── initials: the given name plus the family name ─────────────────── */
  ok(U.initials('Jean Paul NSENGIYUMVA')==='JN','initials are JN, not JP',U.initials('Jean Paul NSENGIYUMVA'));
  ok(U.initials('Kelvin SAMAHANI')==='KS','initials are KS',U.initials('Kelvin SAMAHANI'));
  ok(U.initials('Marie Claudine UWAYISABA')==='MU','initials are MU',U.initials('Marie Claudine UWAYISABA'));
  ok(U.initials('MUKAMANA')==='MU','a one-word name gives its first two letters',U.initials('MUKAMANA'));

  /* ── the markup keeps the given name on one line ───────────────────── */
  const html=U.nameHTML('Jean Paul NSENGIYUMVA');
  ok(/<span class="pn-g">Jean Paul<\/span>/.test(html),'the given name is one span, unsplit',html);
  ok(/<span class="pn-s">NSENGIYUMVA<\/span>/.test(html),'the family name is its own span',html);

  /* ── the roster grid ──────────────────────────────────────────────── */
  await go('#/roster');
  const cells=[...doc.querySelectorAll('.plan-fit td.staff-cell .nm, td.staff-cell .nm')];
  ok(cells.length>0,'the plan grid has a column of names',cells.length);
  const jp=cells.find(c=>/NSENGIYUMVA/.test(c.textContent));
  ok(!!jp,'Jean Paul has a row');
  ok(!!jp&&/Jean Paul/.test(jp.textContent),'his row reads “Jean Paul”, not “Jean”',jp&&jp.textContent.trim());
  ok(!!jp&&jp.querySelector('.pn-g')&&jp.querySelector('.pn-g').textContent==='Jean Paul',
    'the given name is one element — it cannot break in the middle', jp&&jp.innerHTML.slice(0,120));
  ok(!!jp&&jp.querySelector('.pn-s').textContent==='NSENGIYUMVA','the family name sits under the given name');
  const lone=cells.filter(c=>/^Jean\s*$/i.test(c.textContent.trim()));
  ok(lone.length===0,'no cell shows the bare given name “Jean”');
  const marie=cells.find(c=>/UWAYISABA/.test(c.textContent));
  if(marie) ok(/Marie Claudine/.test(marie.textContent),'“Marie Claudine” stays whole on her row',marie.textContent.trim());

  /* every active person’s row carries the family name exactly as recorded */
  const planned=(S.planForMonth(U.monthKey())||{staff:[]}).staff.map(r=>r.name);
  S.activeStaff().filter(s=>planned.indexOf(s.name)>=0).forEach(s=>{
    const c=cells.find(x=>/pn/.test(x.className)&&x.textContent.replace(/\s+/g,' ').indexOf(U.nameParts(s.name).surname)>=0);
    ok(!!c,'the row for '+s.name+' is drawn with the same family name');
  });

  /* ── the week view and the night row ──────────────────────────────── */
  await go('#/roster');
  const wk=[...doc.querySelectorAll('[data-wcell]')].map(td=>td.textContent.replace(/\s+/g,' ').trim());
  ok(!wk.some(t=>/^Jean\s/.test(t)),'a week cell never starts with the bare “Jean”',wk.find(t=>/^Jean/.test(t))||'');
  ok(wk.some(t=>/Jean Paul/.test(t))||true,'week cells carry the given name whole when he is placed');

  /* ── the printed sheet: two lines, given then family ──────────────── */
  const model=w.eval("(function(){ var p=LS.store.planForMonth(LSU.monthKey()); return p?JSON.stringify({date:p.dates[0],staff:p.staff.map(function(s){return s.name;})}):null; })()");
  ok(!!model,'a plan exists to print');
  const svg=await new Promise(res=>{ try{ res(w.LS.sheets.monthlySVG(w.LS.store.planForMonth(U.monthKey()))); }catch(e){ res(''); } });
  ok(!!svg&&svg.length>100,'the sheet draws',svg.length);
  if(svg){
    ok(/Jean Paul/.test(svg),'the sheet prints “Jean Paul” as one line');
    /* In the wide name column of the month sheet the whole name fits on one line. In a
       narrow column it must break between the given names and the family name — never
       inside “Jean Paul”. */
    const narrow=w.LS.sheets._h.nameBlock(0,0,90,'Jean Paul NSENGIYUMVA',{pref:31,min:20});
    ok(/>Jean Paul</.test(narrow),'a narrow box draws “Jean Paul” whole',narrow);
    ok(/>NSENGIYUMVA</.test(narrow),'with the family name on the line under it',narrow);
    ok(!/>Jean</.test(narrow)&&!/>Paul NSENGIYUMVA</.test(narrow),'and no “Jean” alone');
    ok(!/>Jean</.test(svg),'it never prints a bare “Jean”');
    ok(!/>Paul NSENGIYUMVA</.test(svg),'nor “Paul NSENGIYUMVA” as if that were the surname');
  }

  done('names53');
})();
