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
  const keyBoxes=boxes.filter(b=>b.w>560&&b.w<640), cardBoxes=boxes.filter(b=>b.w>700);
  const uniq=a=>[...new Set(a)].sort((x,y)=>x-y);
  const keyY=uniq(keyBoxes.map(b=>b.y)), cardY=uniq(cardBoxes.map(b=>b.y));

  /* ——— the rows of the grid ——— */
  const codeRows=uniq(nodes.filter(n=>/^(D|N|DN)$/.test(n.t)).map(n=>n.y));
  ok(Math.abs((codeRows[1]-codeRows[0])-76)<1.5,'a staff row is three fifths of the old 126 ('+(codeRows[1]-codeRows[0]).toFixed(0)+')');
  ok(S.activeStaff().every(st=>nodes.some(n=>n.t===st.name&&n.y>codeRows[0]-40)),'a name for every member of staff');

  /* ——— the legend and the contacts: one block, one pitch ——— */
  ok(keyY.length===Math.ceil(16/5),'the legend is '+Math.ceil(16/5)+' rows, five blocks wide ('+keyY.length+')');
  ok(cardY.length===2,'the contacts are two rows ('+cardY.length+')');
  ok(keyBoxes.length&&cardBoxes.length,'both lists are drawn as blocks');
  const keyH=keyBoxes[0].h, cardH=cardBoxes[0].h;
  ok(keyH===cardH,'a key block is the height of a contact block ('+keyH+' vs '+cardH+')');
  /* three fifths of the block they were: 116 -> 70 */
  ok(Math.abs(keyH-70)<1.5,'a block is three fifths of the 116 it stood at ('+keyH+')');
  const keyPitch=keyY[1]-keyY[0], cardPitch=cardY[1]-cardY[0];
  ok(keyPitch===cardPitch,'the two lists stand on one pitch ('+keyPitch+' vs '+cardPitch+')');
  ok(keyPitch-keyH<12,'with only a few px of air between their rows ('+(keyPitch-keyH)+')');
  const keyText=[...new Set(nodes.filter(n=>n.y>keyY[0]-80&&/ — /.test(n.t)).map(n=>n.s))];
  ok(keyText.length===1,'the key text is one size for every key ('+keyText.join(', ')+')');
  /* ——— one voice: the legend, the contact list and the names in the grid ——— */
  const gridNames=S.activeStaff().map(st=>nodes.filter(n=>n.t===st.name&&n.y>500&&n.y<1200)[0]).filter(Boolean);
  ok(gridNames.length===S.activeStaff().length,'every staff name is set in the grid');
  const gridSize=gridNames[0].s;
  ok(keyText[0]===gridSize,'the keys are set at the size of the staff names ('+keyText[0]+' vs '+gridSize+')');
  const cardText=[...new Set(nodes.filter(n=>n.y>cardY[0]-10&&n.y<cardY[cardY.length-1]+70).map(n=>n.s))];
  ok(cardText.length===1&&cardText[0]===gridSize,'and so are the contact names and numbers ('+cardText.join(', ')+' vs '+gridSize+')');
  /* ——— the heading of the name column is plural ——— */
  ok(nodes.some(n=>n.t==='Names'),'the name column is headed "Names"');
  ok(!nodes.some(n=>n.t==='Name'),'and no longer "Name"');
  /* ——— the letterhead is not the small print ——— */
  const lh=nodes.filter(n=>/^Republic of Rwanda$|^Ruli District Hospital$/.test(n.t));
  ok(lh.length===2&&lh.every(n=>n.s>=30),'the letterhead lines are set larger ('+lh.map(n=>n.s).join(', ')+')');

  /* ——— the legend follows the grid ———
     the band of white that used to sit between the last row of the table and "Keys:"
     is gone: the heading comes right under the rule. */
  const RULE=18;
  const frames=[...svg.matchAll(/<rect x="96" y="470" width="560" height="([\d.]+)"/g)].map(m=>+m[1]);
  const gridBottom=470+frames[frames.length-1];
  const keysHead=nodes.filter(n=>/^Keys:$/.test(n.t))[0];
  const cntHead=nodes.filter(n=>/^Staff contacts:$/.test(n.t))[0];
  const keysClose=keysHead.y-RULE-gridBottom;
  ok(keysClose<60,'the keys follow the table ('+Math.round(keysClose)+' px from the rule to the heading)');
  const keyLead=keyY[0]-(keysHead.y+6);
  ok(keyLead<40,'and the first key row follows its own heading ('+Math.round(keyLead)+' px)');
  const lastKey=Math.max.apply(null,keyBoxes.map(b=>b.y+b.h));
  const firstCard=Math.min.apply(null,cardBoxes.map(b=>b.y));
  ok(cntHead.y-lastKey<60,'the contacts follow the keys the same way ('+Math.round(cntHead.y-lastKey)+' px)');
  ok(firstCard-(cntHead.y+6)<45,'and their heading leads into their blocks ('+Math.round(firstCard-(cntHead.y+6))+' px)');

  /* ——— the signatures follow the contacts, and the sheet closes on its margin ——— */
  const sig=nodes.filter(n=>/^Prepared by:$/.test(n.t))[0];
  const lastCard=Math.max.apply(null,cardBoxes.map(b=>b.y+b.h));
  ok(!!sig,'the signature block is drawn');
  ok(sig.y-lastCard>0&&sig.y-lastCard<90,'and stands just under the last row of contacts ('+Math.round(sig.y-lastCard)+' px, rule to cap)');
  ok(H-(sig.y+45)<520,'and the page closes on the margin it opens with ('+Math.round(H-sig.y-45)+' px below the last signature line)');
  ok(errors.length===0,'no console errors during the run');
  done('sheet72');
})();
