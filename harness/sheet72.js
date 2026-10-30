/* v6.9.72–75 — the measures and the spacing of the working plan:
     the staff rows and the contact blocks are three fifths of what they were, the key
     blocks are the height of a contact block, and every section under the grid is
     separated by ONE gap — the same air four times. */
const {boot,ok,done}=require('./env');
(async()=>{
  const {w,errors}=await boot('#/roster');
  const S=w.LS.store, SH=w.LS.sheets;
  const svg=SH.monthlySVG(S.buildPlan('2026-11'));
  const H=+svg.match(/height="(\d+)"/)[1];
  const nodes=[...svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g)]
    .map(m=>({x:+m[1],y:+m[2],s:+m[3],t:m[4]}));
  const boxes=[...svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)" fill="#F7F9FD"/g)]
    .map(m=>({x:+m[1],y:+m[2],w:+m[3],h:+m[4]}));
  const keyBoxes=boxes.filter(b=>b.w>450&&b.w<520), cardBoxes=boxes.filter(b=>b.w>700);
  const uniq=a=>[...new Set(a)].sort((x,y)=>x-y);
  const keyY=uniq(keyBoxes.map(b=>b.y)), cardY=uniq(cardBoxes.map(b=>b.y));

  /* ——— the rows of the grid ——— */
  const codeRows=uniq(nodes.filter(n=>/^(D|N|DN)$/.test(n.t)).map(n=>n.y));
  ok(Math.abs((codeRows[1]-codeRows[0])-76)<1.5,'a staff row is three fifths of the old 126 ('+(codeRows[1]-codeRows[0]).toFixed(0)+')');
  ok(S.activeStaff().every(st=>nodes.some(n=>n.t===st.name&&n.y>codeRows[0]-40)),'a name for every member of staff');

  /* ——— the legend and the contacts: one block, one pitch ——— */
  ok(keyY.length===3,'the legend is three rows ('+keyY.length+')');
  ok(cardY.length===2,'the contacts are two rows ('+cardY.length+')');
  ok(keyBoxes.length&&cardBoxes.length,'both lists are drawn as blocks');
  const keyH=keyBoxes[0].h, cardH=cardBoxes[0].h;
  ok(keyH===cardH,'a key block is the height of a contact block ('+keyH+' vs '+cardH+')');
  ok(keyH>=79,'and no shorter than the three-fifths block (79)');
  const keyPitch=keyY[1]-keyY[0], cardPitch=cardY[1]-cardY[0];
  ok(keyPitch===cardPitch,'the two lists stand on one pitch ('+keyPitch+' vs '+cardPitch+')');
  ok(keyPitch-keyH===13,'with the same 13 px of air between their rows ('+(keyPitch-keyH)+')');
  const keyText=[...new Set(nodes.filter(n=>n.y>keyY[0]-80&&/ — /.test(n.t)).map(n=>n.s))];
  ok(keyText.length===1,'the key text is one size for every key ('+keyText.join(', ')+')');

  /* ——— ONE gap, four times ———
     read on the paper: the rule under the grid, the headings by their cap height, and
     the blocks by their own edges. */
  const CAP=19, DESC=6, RULE=18;
  const frames=[...svg.matchAll(/<rect x="96" y="470" width="560" height="([\d.]+)"/g)].map(m=>+m[1]);
  const gridBottom=470+frames[frames.length-1];
  const rule=gridBottom+RULE;
  const keysHead=nodes.filter(n=>/^Keys:$/.test(n.t))[0];
  const cntHead=nodes.filter(n=>/^Staff contacts:$/.test(n.t))[0];
  const lastKey=Math.max.apply(null,keyBoxes.map(b=>b.y+b.h));
  const firstCard=Math.min.apply(null,cardBoxes.map(b=>b.y));
  const G=[keysHead.y-CAP-rule, keyY[0]-(keysHead.y+DESC),
    cntHead.y-CAP-lastKey, firstCard-(cntHead.y+DESC)];
  ok(Math.max.apply(null,G)-Math.min.apply(null,G)<=1,
    'one gap is used four times: grid→Keys, Keys→blocks, blocks→contacts, contacts→cards ('+G.map(Math.round).join(', ')+')');
  ok(G[0]<=72,'and it is a section gap, not a band of white ('+Math.round(G[0])+' px)');
  ok(G[1]===G[0]&&G[3]===G[0],'every heading sits the same distance over its blocks');

  /* ——— the signatures follow the contacts, and the sheet closes on its margin ——— */
  const sig=nodes.filter(n=>/^Prepared by:$/.test(n.t))[0];
  const lastCard=Math.max.apply(null,cardBoxes.map(b=>b.y+b.h));
  ok(!!sig,'the signature block is drawn');
  ok(sig.y-lastCard>0&&sig.y-lastCard<90,'and stands just under the last row of contacts ('+Math.round(sig.y-lastCard)+' px, rule to cap)');
  ok(H-(sig.y+45)<160,'so the sheet does not close on a band of white paper ('+Math.round(H-sig.y-45)+' px)');
  ok(errors.length===0,'no console errors during the run');
  done('sheet72');
})();
