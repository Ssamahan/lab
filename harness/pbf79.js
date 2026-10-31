/* v6.9.80 — nothing invented on the PBF screen, nothing leaked on the public page.
   1. A health centre carries a mark only from a visit an assessor recorded. The old
      seed wrote a random scorecard for all eight centres, so Rushashi and Muyongwe —
      never visited — showed a plausible index.
   2. The public page states the size of the network: eight health centres, not nine
      (Ruli DH is the hospital that receives, not a centre in the network).
   3. The public page and the visitor strip do not name the modules a visitor cannot
      open — Training Revenue, Settings, Data & sync. */
const {boot,ok,done}=require('./env');
(async()=>{
  const {w,errors}=await boot('#/pbf');
  const S=w.LS.store, doc=w.document;

  /* ——— 1. no invented marks ——— */
  const db=S.db();
  ok(!(db.pbf||[]).length,'no generated PBF scorecard is kept in the register ('+(db.pbf||[]).length+')');
  const page=doc.getElementById('page');
  const txt=(page.textContent||'').replace(/\s+/g,' ');
  ['Rushashi','Muyongwe'].forEach(n=>{
    const i=txt.indexOf(n);
    ok(i>=0,n+' is listed');
    const after=txt.slice(i,i+90);
    ok(/Not yet visited|no supervision recorded/i.test(after),n+' reads "not yet visited", not a score ('+after.slice(0,60)+')');
  });
  /* a centre with no visit carries no index at all */
  const noVisit=['Rushashi HC','Muyongwe HC','Nyange HC'];
  noVisit.forEach(n=>{
    ok(!new RegExp(n+'[^%]{0,80}\\d{2}%').test(txt),n+' carries no percentage');
  });

  /* a device that already holds the invented rows: they are purged on the next boot */
  const invented={id:'pbf4',name:'Rushashi HC',district:'Gakenke',quarter:'Q1',fy:'2026/2027',
    scores:{quality:70,tat:80,stock:75,data:78,hr:80,infra:77},total:78,prior:76,status:'draft',
    assessor:'District PBF team',submitted:'2026-10-06',note:''};
  const payload=JSON.parse(S.exportJSON());
  payload.pbf=[invented,Object.assign({},invented,{id:'pbf5',name:'Muyongwe HC',total:75})];
  const {boot:boot2}=require('./env');
  const again=await boot2('#/pbf',{seed:win=>{
    try{ win.localStorage.setItem('labSystems.v1',JSON.stringify(payload)); }catch(e){}
  }});
  const kept=again.w.LS.store.db().pbf||[];
  ok(!kept.length,'a stored generated scorecard is dropped at load ('+kept.length+' kept)');
  const t2=(again.w.document.getElementById('page').textContent||'').replace(/\s+/g,' ');
  ok(!/Rushashi HC[^%]{0,80}\d{2}%/.test(t2),'and Rushashi still shows no index');

  /* the four visits the district confirmed stay as visits, with their marks still to
     be entered — they are evidence, and they are not turned into a score */
  const confirmed=(S.db().pbfVisits||[]).map(v=>v.hcName);
  ['Coko HC','Minazi HC','Rwankuba HC','Muhondo HC'].forEach(n=>ok(confirmed.indexOf(n)>=0,n+' keeps its confirmed visit'));
  ok(!confirmed.some(n=>/Rushashi|Muyongwe/.test(n)),'Rushashi and Muyongwe carry no visit at all');
  const coko=txt.slice(txt.indexOf('Coko HC'),txt.indexOf('Coko HC')+90);
  ok(/Visited · marks pending/i.test(coko),'a confirmed visit reads "marks pending", never a score ('+coko.slice(0,50)+')');

  /* ——— 2. eight health centres, Ruli DH is not one of them ——— */
  const L=w.LS.landing;
  ok(!!L,'the public overview is mounted');
  L.show();
  const count=doc.querySelector('[data-land-centres]');
  ok(!!count,'the public page states the size of the network');
  ok(count.textContent==='8','it counts eight health centres, not nine ('+count.textContent+')');
  const chips=[...doc.querySelectorAll('#landCentres .land-chip')].map(c=>c.textContent.trim());
  ok(chips.length===8,'and lists eight chips ('+chips.length+')');
  ok(!chips.some(c=>/^Ruli DH$/i.test(c)),'Ruli DH is not listed as a health centre');
  ok(chips.some(c=>/Rushashi/.test(c))&&chips.some(c=>/Muyongwe/.test(c)),'both centres are still in the network list');

  /* ——— 3. nothing beyond the visitor's limits is named ——— */
  const land=doc.getElementById('landing');
  const publicText=(land.textContent||'').replace(/\s+/g,' ');
  ok(!/training revenue/i.test(publicText),'the public page does not mention Training Revenue');
  ok(!/\bsettings\b/i.test(publicText),'nor Settings');
  ok(!/data\s*&\s*sync/i.test(publicText),'nor Data & sync');
  ok(!/except/i.test(publicText),'and does not enumerate what a visitor is denied');

  /* the visitor strip, once the console is opened read-only */
  w.LS.auth.enterAsVisitor();
  w.LS.shell.afterAuth();
  const bar=doc.getElementById('visitorBar');
  ok(!!bar,'the visitor strip exists');
  const barText=(bar.textContent||'').replace(/\s+/g,' ');
  ok(!/training revenue/i.test(barText),'the visitor strip does not name Training Revenue');
  ok(!/\bsettings\b/i.test(barText),'nor Settings');
  ok(!/except/i.test(barText),'nor lists what is withheld ('+barText.slice(0,90)+')');

  ok(errors.length===0,'no console errors during the run');
  done('pbf79');
})();
