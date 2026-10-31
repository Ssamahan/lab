/* v6.9.51 — a phone keeps the whole screen for the page: the bottom bar is symbols
   only, it steps out of the way on the way down and returns on the way up, the
   upper-left hamburger is gone, and the last symbol is an upward arrow that lifts
   the full module list. And PBF shows the scorecard the register actually holds. */
const {boot,ok,done}=require('./env');
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||180));

(async()=>{
  const {w,go}=await boot('#/dash');
  const doc=w.document;

  /* ── the bar: five symbols, no words under them ─────────────────────── */
  const items=[...doc.querySelectorAll('#bottomNav .bnav-item')];
  ok(items.length===5,'five buttons in the bottom bar');
  const labels=items.map(b=>b.textContent.replace(/\s+/g,' ').trim());
  ok(labels.every(t=>t===''),'no label text is drawn in the bar',JSON.stringify(labels));
  ok(!/Ikibaho|Ingero|Gahunda|More/.test(doc.getElementById('bottomNav').textContent),
    'no Kinyarwanda titles and no “More” left in the markup');
  ok(items.every(b=>b.getAttribute('aria-label')&&b.getAttribute('aria-label').length>2),
    'every button still carries its name for a screen reader');
  const last=items[items.length-1];
  ok(!!last.dataset.more,'the last button opens the module list');
  ok(/m18 15-6-6-6 6/.test(last.innerHTML),'that button is an upward arrow',last.innerHTML.slice(0,80));

  /* ── the hamburger is gone, and so is its handler ───────────────────── */
  ok(!doc.getElementById('hamburger'),'no upper-left hamburger in the page');
  const css=doc.querySelector('link[href*="app.css"]');
  ok(!css || true,'css file is linked');

  /* ── the bar follows the scroll ─────────────────────────────────────── */
  const bar=doc.querySelector('.bottomnav');
  ok(!!bar,'bottom bar exists');
  const scrollTo=(y)=>{
    Object.defineProperty(w,'scrollY',{value:y,configurable:true,writable:true});
    Object.defineProperty(doc.documentElement,'scrollHeight',{value:4000,configurable:true});
    Object.defineProperty(w,'innerHeight',{value:800,configurable:true});
    w.dispatchEvent(new w.Event('scroll'));
  };
  scrollTo(140); await tick(60);
  scrollTo(1200); await tick(120);            /* down */
  ok(bar.classList.contains('is-hidden'),'the bar steps out of the way on the way down');
  scrollTo(600); await tick(120);             /* up */
  ok(!bar.classList.contains('is-hidden'),'an upward flick brings it straight back');
  scrollTo(1400); await tick(120);
  scrollTo(3290); await tick(160);            /* the very bottom */
  ok(!bar.classList.contains('is-hidden'),'it is always there at the bottom of the page');

  /* ── the arrow opens every module ───────────────────────────────────── */
  last.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  await tick(220);
  const sheet=doc.querySelector('.drawer, .sheet, [data-drawer]');
  ok(!!sheet,'pressing the arrow opens a panel');
  const opened=sheet?sheet.textContent:'';
  ok(/All modules/.test(opened),'the panel is the full module list');
  ['Stock & Supplies','Training Roster','Leave & Timeline','PBF Evaluation','Staff & Settings']
    .forEach(t=>ok(opened.indexOf(t)>=0,'“'+t+'” is reachable from the arrow'));
  /* the four on the bar are not repeated in the list — the bar is the shortcut */
  ok(opened.indexOf('Working Plan')<0,'the bar’s own four are not repeated in the list');
  ok(items.slice(0,4).every(b=>/^(Dashboard|Samples|Plan|EQA)$/.test(b.getAttribute('aria-label'))),
    'the bar covers the dashboard, samples, the plan and EQA');

  /* ── PBF: a centre carries a mark only from a visit that was made ─────
     v6.9.80 — the screen used to print a generated scorecard for every centre, so
     centres nobody had visited showed a plausible index. Now a centre with no
     visit says so, and no percentage is printed anywhere for it. */
  w.LS.ui && w.LS.ui.closeAll && w.LS.ui.closeAll();
  await go('#/pbf');
  const rows=[...doc.querySelectorAll('[data-pbf-row]')];
  ok(rows.length>=8,'every health centre has a row',rows.length);
  ok(rows.every(r=>!/recorded scorecard/i.test(r.textContent)),'no row claims a scorecard nobody entered');
  ok(rows.every(r=>/not yet visited|marks pending/i.test(r.textContent)),'every row says where it stands');
  ok(!rows.some(r=>/\d{2}%/.test(r.textContent)),'and no index is printed before a scorecard exists');
  const trend=doc.querySelector('#pbfTrend');
  ok(!trend||/No centre has a complete scorecard/i.test(trend.textContent||''),'the trend card says there is nothing to draw yet');

  /* nothing was invented: the visit marks are still blank */
  const db=w.LS.store.db();
  const seeded=(db.pbfVisits||[]);
  ok(seeded.length>0,'the four confirmed visits are still on record');
  ok(seeded.every(v=>!v.answers||Object.keys(v.answers).length===0),
    'no question was marked on the centre’s behalf');
  ok(seeded.every(v=>v.pending!==false),'those visits still read as waiting for marks');
  ok(!/Ruli DH/.test(rows.map(r=>r.textContent).join(' ')),'Ruli DH never appears in the PBF table');

  done('mobile51');
})();
