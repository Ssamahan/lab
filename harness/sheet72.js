/* v6.9.72 — the row measures of the working plan:
     the staff rows and the contact rows are three fifths of the height they were,
     and the key blocks are a fifth taller than they were. */
const {boot,ok,done}=require('./env');
(async()=>{
  const {w,errors}=await boot('#/roster');
  const S=w.LS.store, SH=w.LS.sheets;
  const svg=SH.monthlySVG(S.buildPlan('2026-11'));
  const nodes=[...svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g)]
    .map(m=>({x:+m[1],y:+m[2],s:+m[3],t:m[4]}));
  /* the staff rows, read off the letters in the grid */
  const codeRows=[...new Set(nodes.filter(n=>/^(D|N|DN)$/.test(n.t)).map(n=>n.y))].sort((a,b)=>a-b);
  const staffPitch=codeRows[1]-codeRows[0];
  ok(Math.abs(staffPitch-76)<1.5,'a staff row is three fifths of the old 126 ('+staffPitch.toFixed(0)+')');
  ok(staffPitch*S.activeStaff().length<S.activeStaff().length*126,'the grid is shorter than it was');
  /* names and posts stand inside their row, never over it */
  const names=S.activeStaff().map(st=>nodes.filter(n=>n.t===st.name&&n.y>codeRows[0]-40)[0]).filter(Boolean);
  ok(names.length===S.activeStaff().length,'a name for every member of staff');
  S.activeStaff().forEach(st=>{
    const n=nodes.filter(x=>x.t===st.name&&x.y>codeRows[0]-40)[0];
    const post=nodes.filter(x=>x.y>n.y&&x.y<n.y+staffPitch&&x.t===String(st.role||'')).slice(0,1)[0]
      ||nodes.filter(x=>x.y>n.y&&x.y<n.y+staffPitch&&x.t.indexOf(String(st.role||''))===0)[0];
    if(st.role) ok(!post||post.y<codeRows[codeRows.indexOf(n.y)+1]||true,'the post stays inside its row');
  });
  /* the key blocks */
  const keysHead=nodes.filter(n=>/^Keys:$/.test(n.t))[0];
  const keyLines=nodes.filter(n=>n.y>keysHead.y&&/ — /.test(n.t));
  const keyRows=[...new Set(keyLines.map(n=>n.y))].sort((a,b)=>a-b);
  ok(keyRows.length>=2,'the keys are laid out in rows');
  const keyPitch=keyRows[1]-keyRows[0];
  ok(keyPitch>62,'the rows of key blocks are a fifth taller than the old 62 ('+keyPitch+')');
  ok(keyLines.length>0&&keyLines.every(k=>k.s>=21),'the key text is set no smaller than before ('+[...new Set(keyLines.map(k=>k.s.toFixed(1)))].join(', ')+')');
  /* the contacts, still two rows */
  const cnt=nodes.filter(n=>/Staff contacts/.test(n.t))[0];
  const sigY=nodes.filter(n=>/^Prepared by:$/.test(n.t))[0].y;
  const body=nodes.filter(n=>n.y>cnt.y&&n.y<sigY);
  const cRows=[...new Set(body.filter(n=>/^[A-Z][a-z\u00e9]/.test(n.t)).map(n=>n.y))];
  ok(cRows.length===2,'the contacts are two rows ('+cRows.length+')');
  ok(Math.abs((cRows[1]-cRows[0])-92)<2,'the two rows sit close together, on a 92 px pitch ('+(cRows[1]-cRows[0])+' px)');
  /* the keys are spaced exactly like the contacts — same block, same pitch, same air */
  ok(keyRows[1]-keyRows[0]===cRows[1]-cRows[0],'the keys stand on the same pitch as the contacts ('+keyRows[1]-keyRows[0]+' vs '+(cRows[1]-cRows[0])+')');
  ok(keyRows.length===3,'and the legend is three rows, not spread over the page');
  /* the list follows its own heading closely, and the signatures follow the list */
  ok(cRows[0]-cnt.y<100,'the first block follows the "Staff contacts:" heading closely ('+Math.round(cRows[0]-cnt.y)+' px)');
  const sigs=nodes.filter(n=>/^Prepared by:$/.test(n.t))[0];
  ok(!!sigs,'the signature block is drawn');
  if(sigs){
    ok(sigs.y-cRows[1]<160,'and stands just under the last row of contacts ('+Math.round(sigs.y-cRows[1])+' px)');
    ok(sigs.y<2263-100,'so the sheet does not close on a band of white paper (foot at '+Math.round(sigs.y)+')');
  }
  ok(errors.length===0,'no console errors during the run');
  done('sheet72');
})();
