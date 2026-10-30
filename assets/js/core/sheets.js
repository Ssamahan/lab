/* ============================================================================
   LAB SYSTEMS · SHEETS — official document renderer + PNG / PDF / XLSX export
   One layout engine, four outputs: on-screen sheet, printed page, PNG, PDF and
   XLSX. Everything is drawn locally — no CDN, no server, works offline.
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU;
const SH={}; window.LS=window.LS||{}; LS.sheets=SH;

/* ——— Palette & type (matches the printed register sheets) ——————————— */
const C={
  navy:'#0B1C3D', band:'#101E3C', gold:'#B8860B', goldLine:'#C9A84C',
  cream:'#FDF3D7', creamBand:'#FBF2DE', white:'#FFFFFF',
  pale:'#E8EEFB', paleInk:'#2B5AC8', navyInk:'#FFFFFF', dn:'#C2D4EF',
  alInk:'#9A6F17', offInk:'#A8B0BE', ink:'#1B2433', muted:'#5B6474', faint:'#9AA3B2',
  /* one cell colour for a day at rest, whichever code names it */
  OFF_BG:'#FCFCFE',
  line:'#E4E8F0', nightBand:'#12203C'
};
SH.colors=C;
const FONT={ body:'Helvetica, Arial, sans-serif', serif:'Georgia, Times New Roman, serif', mono:'DejaVu Sans Mono, Menlo, Consolas, monospace' };
const CODE={
  D:   {bg:C.pale,      fg:C.paleInk, label:'D',   key:'D — Day 08:00–17:00'},
  N:   {bg:C.navy,      fg:'#FFFFFF', label:'N',   key:'N — Night 17:00–08:00 next day'},
  DN:  {bg:C.dn,        fg:'#101828', label:'DN',  key:'DN — Day+Night'},
  OFF: {bg:C.OFF_BG,    fg:C.offInk,  label:'OFF', key:'OFF — At home (not on shift)'},
  AL:  {bg:C.cream,     fg:C.alInk,   label:'AL',  key:'AL — Annual leave (authorised)'},
  CL:  {bg:C.cream,     fg:C.alInk,   label:'CL',  key:'CL — Authorized leave'},
  ML:  {bg:C.cream,     fg:C.alInk,   label:'ML',  key:'ML — Maternity leave'},
  SL:  {bg:C.cream,     fg:C.alInk,   label:'SL',  key:'SL — Sick leave'},
  TR:  {bg:'#EAF3EC',   fg:'#2F7A4F', label:'TR',  key:'TR — Training'},
  W:   {bg:C.cream,     fg:C.alInk,   label:'W',   key:'W — Wedding day'},
  ABS: {bg:'#FBECEE',   fg:'#B03A48', label:'ABS', key:'ABS — Unexcused absence (recorded)'},
  /* The two codes the department's own paper plans have always used. */
  RBW: {bg:'#F4F1E6',   fg:'#7A6428', label:'RBW', key:'RBW — Off duty (rest before work)'},
  /* A day that was due as rest and was worked instead. The manager enters it by
     hand: it is not a leave, not an absence, and it does not pay anybody's debt —
     it names the day the department owes back. It reads in the same grey as OFF,
     because on the sheet the two are the same kind of day: a day at rest. Only the
     letter tells them apart. */
  UO:  {bg:C.OFF_BG,    fg:C.offInk,  label:'UO',  key:'UO — Unattended off'},
  AA:  {bg:'#F3E9F6',   fg:'#6B3C7A', label:'AA',  key:'AA — Authorised absence'},
  H:   {bg:'#FBECEE',   fg:'#B03A48', label:'H',   key:'H — Public holiday'},
  /* Not an absence and not a rest day: the days before somebody was employed. On the
     sheet they are hatched rather than lettered, so a blank cell keeps its meaning. */
  BE:  {bg:'#FFFFFF',   fg:'#A8B0BE', label:'',    key:'Hatched — before employment', hatch:true}
};
SH.codes=Object.keys(CODE);
/* printed register order: shifts, rest, leave, then the rest */
SH.keyOrder=['D','N','DN','OFF','UO','RBW','AL','ML','SL','CL','AA','TR','W','ABS','H'].filter(c=>CODE[c]);
SH.keyOrder=SH.keyOrder.concat(SH.codes.filter(c=>SH.keyOrder.indexOf(c)<0));
const styleOf=c=>CODE[c]||null;
SH.styleOf=styleOf;

/* ——— Small SVG helpers ————————————————————————————— */
const esc=s=>U.esc(String(s==null?'':s));
/* Font-size that keeps a string inside a box. Advance is approximated at 0.58 em
   (bold sans, which is the widest we set) so a substituted font never spills. */
function fitSize(str,maxWidth,preferred,min){
  const len=String(str||'').length||1;
  const byWidth=maxWidth/(len*0.58);
  return Math.max(min||10,Math.min(preferred,byWidth));
}
/* Break a line at its spaces so a long post can sit at the key size instead of
   being shrunk below it. Anything that still will not fit after `maxLines` is
   shrunk by the caller's own check. */
function wrapLines(str,w,size,maxLines){
  /* an entry that carries two parts — the post, then the acting for somebody — is
     broken between the parts before it is broken inside one of them */
  const segs=String(str||'').split(/\s+·\s+/).filter(Boolean);
  if(segs.length>1){
    const out=[];
    segs.forEach(sg=>wrapLines(sg,w,size,1).forEach(l=>out.push(l)));
    return out;
  }
  const words=String(str||'').trim().split(/\s+/).filter(Boolean);
  const out=[]; let cur='';
  const tooWide=s=>s.length*size*0.58>w;
  words.forEach(word=>{
    const trial=cur?cur+' '+word:word;
    if(cur && tooWide(trial)){ out.push(cur); cur=word; }
    else cur=trial;
  });
  if(cur) out.push(cur);
  const cap=maxLines||2;
  if(out.length>cap){
    const rest=out.slice(cap-1).join(' ');
    out.length=cap-1;
    out.push(rest);
  }
  return out;
}
const r2=n=>Math.round(n*100)/100;
function rect(x,y,w,h,fill,o){
  o=o||{};
  return '<rect x="'+r2(x)+'" y="'+r2(y)+'" width="'+r2(w)+'" height="'+r2(h)+'" fill="'+(fill||'none')+'"'
    +(o.rx?' rx="'+o.rx+'"':'')+(o.stroke?' stroke="'+o.stroke+'" stroke-width="'+(o.sw||1)+'"':'')
    +(o.dash?' stroke-dasharray="'+o.dash+'"':'')+(o.opacity!=null?' opacity="'+o.opacity+'"':'')+'/>';
}
function line(x1,y1,x2,y2,stroke,sw,dash){
  return '<line x1="'+r2(x1)+'" y1="'+r2(y1)+'" x2="'+r2(x2)+'" y2="'+r2(y2)+'" stroke="'+stroke+'" stroke-width="'+(sw||1)+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
}
function text(x,y,str,o){
  o=o||{};
  const size=o.size||14, weight=o.weight||400, anchor=o.anchor||'start';
  const fam=(o.family||FONT.body).replace(/"/g,'');
  return '<text x="'+r2(x)+'" y="'+r2(y)+'" font-family=\''+fam+'\' font-size="'+size+'" font-weight="'+weight+'"'
    +(anchor!=='start'?' text-anchor="'+anchor+'"':'')+(o.fill?' fill="'+o.fill+'"':' fill="'+C.ink+'"')
    +(o.ls?' letter-spacing="'+o.ls+'"':'')+(o.mono?' font-variant-numeric="tabular-nums"':'')+'>'+esc(str)+'</text>';
}
SH._h={rect,line,text,esc};

/* ——— Names ——————————————————————————————————————————————— */
/* Printed sheets were set at 21–27 px on a 3200 px page, which lands near 6 pt
   when printed: too small to read on a ward wall. Names now use the full cell
   width across two lines (first name above surname) and never fall below the
   size the printed register uses. */
function nameLines(name){
  /* Given name(s) on one line, family name underneath — the Rwandan order the
     register itself uses. Splitting at the first space printed “Jean” in bold with
     “Paul NSENGIYUMVA” under it, which is neither his given name nor his family
     name. */
  if(window.LSU&&window.LSU.nameParts){
    const p=window.LSU.nameParts(name);
    return {main:p.given||p.surname||'', sub:p.given?p.surname:''};
  }
  const parts=String(name||'').trim().split(/\s+/);
  if(parts.length<2) return {main:parts[0]||'', sub:''};
  return {main:parts.slice(0,-1).join(' '), sub:parts[parts.length-1]};
}
/* Bold sans capitals advance at roughly 0.70 em; 0.58 underestimates them and
   names then run into the next column, which is how the earlier sheets broke. */
const ADV=0.76;
const textW=(str,size)=>String(str==null?'':str).length*size*ADV;
/* A name drawn inside a box: one line when it genuinely fits at the preferred
   size, otherwise first name over surname. Never below `min`. */
function nameBlock(x,y,w,name,o){
  o=o||{};
  const pref=o.pref||32, min=o.min||21, fill=o.fill||'#12203C', weight=o.weight||600;
  const full=String(name||'');
  const n=nameLines(full);
  /* One line first: shrunk towards `min` before the name is ever broken, because a
     name printed on one line is what the register reads and the label column is
     only as wide as the longest name needs. Two lines remain for a name that will
     not fit even at `min`. */
  if(!n.sub || textW(full,min)<=w || textW(full,pref)<=w){
    const size=Math.max(min,Math.min(pref, w/Math.max(1,String(full).length*ADV)));
    return text(x,y,full,{size:size,weight:weight,fill:fill,anchor:o.anchor});
  }
  const mainSize=Math.max(min,Math.min(pref, w/Math.max(1,n.main.length*ADV)));
  const subSize=Math.max(Math.round(min*0.80),Math.min(pref*0.74, w/Math.max(1,n.sub.length*ADV)));
  const cy=y-(subSize*0.45);
  return text(x,cy,n.main,{size:mainSize,weight:weight,fill:fill,anchor:o.anchor})
    +text(x,cy+subSize+7,n.sub,{size:subSize,weight:500,fill:o.subFill||fill,anchor:o.anchor});
}
SH._h.nameBlock=nameBlock;

/* A name and a phone number on ONE line inside a box. The contact list used to set
   the number under the name, which pushed it to the smallest size the page allows
   and left it unreadable on a printed sheet. The number now sits beside the name at
   the same weight of legibility, and a name that genuinely runs long is set smaller
   rather than wrapped — the printed register never wraps a contact either. */
/* The name is set hard left inside its block and the number hard right, on the same
   run: the block then reads down as a column of names and a column of numbers, which
   is what makes a contact list easy to scan. The two are sized against the run
   together, so a long name and a long number can never run into each other — the
   number gives way first, then the name, rather than one printing over the other. */
function nameAndPhone(x,y,w,name,phone,o){
  o=o||{};
  const pref=o.pref||32;
  const num=String(phone||'—');
  const nameStr=String(name||'');
  const numMax=Math.max(18,Math.min(o.numPref||30, pref));
  const gapAt=nz=>Math.max(20,Math.round(nz*0.9));
  const layout=nz=>{
    const numW=textW(num,nz), gap=gapAt(nz);
    const avail=Math.max(60,w-numW-gap);
    const size=Math.min(pref, avail/Math.max(1,nameStr.length*ADV));
    /* a hair of tolerance: the layout is solved to the edge, and a float that comes
       back one thousandth of a pixel over must not send the block down a size */
    return {nz,numW,gap,size,nameW:textW(nameStr,size),fits:textW(nameStr,size)+gap+numW<=w+1};
  };
  let L=layout(numMax);
  /* the number gives way first, down to 18 px; only if it still will not sit beside
     the name does the name step below its preferred size */
  if(!L.fits) L=layout(Math.max(16,Math.min(numMax,(w-textW(nameStr,Math.min(pref,18))-gapAt(18))/Math.max(1,num.length*0.60))));
  if(!L.fits&&L.nameW>0){
    L.size=Math.max(10,(w-L.numW-L.gap)/Math.max(1,nameStr.length*ADV));
    L.nameW=textW(nameStr,L.size);
  }
  return text(x,y,nameStr,{size:r2(L.size),weight:600,fill:o.fill||'#12203C'})
    +(o.phoneRight===true
      ? text(x+w,y,num,{size:r2(Math.min(L.nz,numMax)),weight:600,anchor:'end',fill:'#12203C',mono:true})
      : text(x+L.nameW+L.gap,y,num,{size:r2(Math.min(L.nz,numMax)),weight:600,fill:'#12203C',mono:true}));
}
SH._h.nameAndPhone=nameAndPhone;

/* "Beatrice NGEZEKURE · week 1 — phlebotomy, then reception" */
function orientationLines(map, alloc){
  const seen={}, out=[];
  Object.keys(map||{}).forEach(iso=>{
    const day=map[iso]||{};
    Object.keys(day).forEach(name=>{
      if(seen[name]) return; seen[name]=1;
      const o=day[name]||{};
      const ben=((alloc[iso]||{}) && Object.keys(alloc[iso]).filter(b=>alloc[iso][b]===name))||[];
      out.push(name+' · week '+o.week+' — '+(ben.length?ben.join(', ').toLowerCase():'full staff rotation'));
    });
  });
  return out;
}
function overrideLines(map, alloc){
  alloc=alloc||{};
  const out=[];
  Object.keys(map||{}).forEach(iso=>{
    const day=map[iso]||{};
    Object.keys(day).forEach(bench=>{
      const o=day[bench]||{};
      const d=U.parseISO(iso);
      const when=U.DOWL[(d.getDay()+6)%7]+' '+d.getDate()+' '+U.MONTHS[d.getMonth()].slice(0,3);
      const who=((alloc[iso]||{})[bench])||o.who||o.name||'';
      out.push(bench+' · '+when+' — '+who+(o.by?' (by '+o.by+')':'')+(o.why?' · '+o.why:''));
    });
  });
  return out;
}
/* ——— Letterhead (crest · titles · logo) ——————————————————— */
function crestMark(x,y,size){
  // Stylised Rwandan seal — replaced automatically when Settings · crest is set.
  const s=size, cx=x+s/2, cy=y+s/2, R=s/2;
  let g='';
  g+='<circle cx="'+cx+'" cy="'+cy+'" r="'+R+'" fill="#FFFFFF" stroke="'+C.goldLine+'" stroke-width="'+(s*0.03)+'"/>';
  g+='<circle cx="'+cx+'" cy="'+cy+'" r="'+(R*0.82)+'" fill="none" stroke="#2E6B3E" stroke-width="'+(s*0.012)+'"/>';
  // sorghum stalks
  for(const side of [-1,1]){
    const bx=cx+side*R*0.42;
    g+='<path d="M'+bx+' '+(cy+R*0.55)+' q'+side*R*0.18+' '+(-R*0.5)+' 0 '+(-R*0.95)+'" fill="none" stroke="#3B7A46" stroke-width="'+(s*0.012)+'"/>';
    for(let i=1;i<=4;i++){
      const t=i/5, px=bx+side*R*0.18*t*0.8, py=cy+R*0.55-R*0.95*t;
      g+='<ellipse cx="'+px+'" cy="'+py+'" rx="'+(R*0.055)+'" ry="'+(R*0.11)+'" fill="#4C8B52" transform="rotate('+(side*22)+' '+px+' '+py+')"/>';
    }
  }
  // cog / sun
  g+='<circle cx="'+cx+'" cy="'+(cy-R*0.22)+'" r="'+(R*0.2)+'" fill="#D9A62E"/>';
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6, r1=R*0.26, r2b=R*0.33;
    g+=line(cx+Math.cos(a)*r1,cy-R*0.22+Math.sin(a)*r1,cx+Math.cos(a)*r2b,cy-R*0.22+Math.sin(a)*r2b,'#D9A62E',s*0.016);
  }
  // shield
  g+='<path d="M'+(cx-R*0.3)+' '+(cy+R*0.05)+' h'+(R*0.6)+' v'+(R*0.22)+' q'+(-R*0.3)+' '+(R*0.3)+' '+(-R*0.6)+' 0 z" fill="#1B4D8F"/>';
  // lab flask in the shield
  g+='<path d="M'+(cx-R*0.06)+' '+(cy+R*0.1)+' v'+(R*0.09)+' l'+(-R*0.09)+' '+(R*0.1)+' h'+(R*0.3)+' l'+(-R*0.09)+' '+(-R*0.1)+' v'+(-R*0.09)+'" fill="none" stroke="#FFFFFF" stroke-width="'+(s*0.012)+'"/>';
  return g;
}
function logoMark(x,y,size){
  // Ruli District Hospital triangle mark (settings.logo overrides).
  const s=size, w=s, h=s*0.92;
  let g='';
  g+='<path d="M'+(x+w/2)+' '+y+' L'+(x+w)+' '+(y+h)+' L'+x+' '+(y+h)+' Z" fill="#FFFFFF" stroke="'+C.goldLine+'" stroke-width="'+(s*0.03)+'"/>';
  g+='<path d="M'+(x+w/2)+' '+(y+h*0.16)+' L'+(x+w*0.9)+' '+(y+h*0.9)+' L'+(x+w*0.1)+' '+(y+h*0.9)+' Z" fill="none" stroke="#2E6B3E" stroke-width="'+(s*0.012)+'"/>';
  g+='<circle cx="'+(x+w/2)+'" cy="'+(y+h*0.52)+'" r="'+(s*0.1)+'" fill="#D9A62E"/>';
  g+='<path d="M'+(x+w*0.4)+' '+(y+h*0.78)+' h'+(w*0.2)+' M'+(x+w/2)+' '+(y+h*0.68)+' v'+(h*0.2)+'" stroke="#1B4D8F" stroke-width="'+(s*0.028)+'" stroke-linecap="round"/>';
  g+="<text x='"+(x+w/2)+"' y='"+(y+h*0.98)+"' font-family='"+FONT.serif+"' font-size='"+(s*0.085)+"' fill='#3B7A46' text-anchor='middle' font-style='italic'>Gura karani</text>";
  return g;
}
function letterhead(s,opts){
  opts=opts||{};
  const W=opts.width||3200, pad=opts.pad||96;
  const crest=opts.crest||s.crest, logo=opts.logo||s.logo;
  const cx0=pad+70, cy0=opts.top||26, cs=178;
  let g='';
  if(crest) g+='<image x="'+cx0+'" y="'+cy0+'" width="'+cs+'" height="'+cs+'" href="'+esc(crest)+'" preserveAspectRatio="xMidYMid meet"/>';
  else g+=crestMark(cx0,cy0,cs);
  g+=text(cx0+cs/2,cy0+cs+40,'Republic of Rwanda',{size:26,weight:600,anchor:'middle',fill:C.ink,family:FONT.serif});

  const lx=W-pad-70-cs*0.95, ly=cy0+10, ls=cs*0.95;
  if(logo) g+='<image x="'+lx+'" y="'+ly+'" width="'+ls+'" height="'+ls+'" href="'+esc(logo)+'" preserveAspectRatio="xMidYMid meet"/>';
  else g+=logoMark(lx,ly,ls);
  g+=text(lx+ls/2,cy0+cs+40,'Ruli District Hospital',{size:26,weight:600,anchor:'middle',fill:C.ink,family:FONT.serif});

  const mid=W/2;
  /* The ministry stands above the hospital on every Rwandan letterhead, and it
     stands above it here — on the working plan, the weekly roster and the XLSX. */
  g+=text(mid,cy0+52,'MINISTRY OF HEALTH',{size:26,weight:600,anchor:'middle',fill:'#3D4759',family:FONT.serif,ls:'3'});
  g+=text(mid,cy0+116,(s.hospital||'Ruli District Hospital').toUpperCase(),{size:52,weight:700,anchor:'middle',fill:'#12203C',family:FONT.serif,ls:'1'});
  g+=text(mid,cy0+152,s.dept||'Laboratory Department',{size:26,weight:600,anchor:'middle',fill:'#26303F'});
  if(s.email) g+=text(mid,cy0+182,s.email,{size:23,anchor:'middle',fill:'#3D4759'});
  if(s.phone) g+=text(mid,cy0+210,U.fmtPhone(s.phone),{size:23,anchor:'middle',fill:'#3D4759'});

  g+=rect(pad,opts.rule1||272,W-pad*2,6,C.goldLine);
  return g;
}

/* ——— Column model shared by screen, PNG/PDF and XLSX ————————— */
function monthCols(plan){
  const dates=plan.dates||[];
  return dates.map((iso,i)=>{
    const d=U.parseISO(iso);
    return {iso, i, dow:d.getDay(), day:d.getDate(), weekend:d.getDay()===0||d.getDay()===6,
      month:d.getMonth(), dividerBefore:i>0 && U.parseISO(dates[i-1]).getMonth()!==d.getMonth()};
  });
}
SH.monthCols=monthCols;
const DOWLTR=['S','M','T','W','T','F','S'];
SH.dowLetter=d=>DOWLTR[d];

/* ——— Monthly working-plan sheet ————————————————————— */
SH.monthlySVG=function(plan,opts){
  opts=opts||{};
  const s=LS.store.settings();
  /* A4 landscape is 297 × 210 mm. At 3200 px across, the true height of the page
     is 2262 px — the sheet was drawn on 1876 px, so a third of the paper was left
     white at the foot while the rows, the day letters and the codes were set small
     enough to fit the short page. The grid now uses the height the paper has. */
  const W=3200, H=Math.round(W*210/297), pad=96;
  /* rows are read in the department's roster order — the manager, the two who hold
     a post, the bench, and the weekend technologist last — the same order as the
     screen, so the sheet and the grid never disagree */
  const rows=(function(){
    const list=(plan.staff||[]).slice();
    const S=LS.store;
    if(!S||!S.rosterRank) return list;
    return list.sort((a,b)=>{
      const A=S.staffByName(a.name)||{}, B=S.staffByName(b.name)||{};
      return S.rosterRank(A)-S.rosterRank(B);
    });
  })();
  const cols=monthCols(plan);
  /* The names sit over 560 px and the day columns take everything else: the
     register was drawn with a 700 px label column, which left a band of white
     between the last letter of a name and the first of the month and squeezed the
     days that matter. 520 px still sets the longest name on the establishment on
     one line; the post beneath it is fitted to the column, so a long one shrinks
     rather than running into Monday. */
  const labelW=560, gridX=pad+labelW;
  const colW=(W-pad*2-labelW)/Math.max(1,cols.length);
  const gridTop=opts.gridTop||470, bandH=48, dateH=40;
  /* Everything under the grid — the keys, the contacts and the three signatures —
     is measured first, and the rows take what is left: so a month with eight rows
     gets tall, readable rows instead of a short grid and a page of white. */
  /* The staff rows are three fifths of their old height (126 -> 76) and so are the
     contacts (132 -> 79); the key blocks are a fifth taller than they were (54 -> 65).
     The page is compact on purpose. What height the three-fifths rows leave over is
     given to the key blocks first — that is the growth this asks for — and only then,
     a little, to the contact rows, so the sheet closes on the signature rule instead
     of on a band of white paper. */
  const KEY_ROWS=Math.ceil(SH.keyOrder.length/6);
  const CONTACT_H=79;                       /* the contact block, three fifths of 132 */
  /* ——— the keys and the contacts are spaced alike ———
     A block of the same height on the same pitch, with the same 13 px of air between
     the rows: the legend and the contact list read as two lists of one setting, and
     neither of them is spread down the page to fill it. */
  const KEY_H=CONTACT_H, PITCH=CONTACT_H+13;
  const KEY_PITCH=PITCH, CONTACT_PITCH=PITCH;
  const rowH=76;                            /* a staff row, three fifths of 126 */
  /* What the compact lists leave over is not spread between their rows: it is set as
     one section break under the grid and as the bottom margin of the sheet, so the
     page closes on the signature block and its own margin, not on a band of white. */
  const SIG_BLOCK=18+2+28+26+12+26+8;
  const GAP0=58;
  const bottomAt=g=>gridTop+bandH+dateH+rows.length*rowH+(GAP0+g)+30
    +KEY_ROWS*PITCH+22+34+(2*PITCH-13+CONTACT_H)+SIG_BLOCK;
  const slack=Math.max(0,Math.min(120,H-56-bottomAt(0)));
  const gridBottom=gridTop+bandH+dateH+rowH*rows.length;

  /* ——— one size for the names, one size for the letters ———
     The letters in the grid and the staff names beside them read as one setting, so
     the sheet is a table and not a poster: the code is no larger than the name it
     belongs to. The size is the largest that still sets the longest name of the
     establishment on one line in the label column and the longest code (OFF, RBW,
     ABS) inside a day column — 24 px on a full establishment, and it grows or
     shrinks with both columns.
     The post under a name is set at the size of the key text, not at a size of its
     own: the two sit on the same sheet and a reader takes them as the same voice. */
  const longestName=rows.reduce((a,r)=>String(r.name||'').length>String(a).length?String(r.name):a,'');
  const widestCode=SH.keyOrder.map(c=>CODE[c]&&CODE[c].label).filter(Boolean)
    .reduce((a,l)=>String(l).length>String(a).length?String(l):a,'');
  const nameFit=(labelW-56)/Math.max(1,longestName.length*ADV);
  const codeFit=(colW-16)/Math.max(1,widestCode.length*0.58);
  const cellSize=Math.max(18,Math.floor(Math.min(34,nameFit,codeFit)));
  const roleSizeAll=22;                 /* the key text size, to the pixel */
  let g='';
  g+='<rect width="'+W+'" height="'+H+'" fill="#FFFFFF"/>';
  g+=letterhead(s,{width:W,pad:pad,top:18,rule1:288});

  const title=(plan.meta&&plan.meta.period)?('Working Plan — '+plan.meta.period):(plan.label||'Working Plan');
  g+=text(W/2,368,title,{size:44,weight:700,anchor:'middle',fill:'#12203C'});
  const metaBits=[];
  if(plan.meta&&plan.meta.date) metaBits.push('Date: '+plan.meta.date);
  if(plan.meta&&plan.meta.fy) metaBits.push('FY: '+plan.meta.fy);
  if(plan.meta&&plan.meta.revised) metaBits.push('Revised');
  /* A draft is never printed as if it were signed. */
  const draft=!!(plan.meta&&(plan.meta.draft||plan.meta.generated))&&!(plan.meta&&plan.meta.official);
  if(draft) metaBits.push('DRAFT — for review, not yet published');
  g+=text(W/2,412,metaBits.join('      '),{size:25,anchor:'middle',fill:draft?C.gold:'#3D4759'});
  g+=rect(pad,424,W-pad*2,2,C.goldLine);

  /* header bands */
  g+=rect(pad,gridTop,labelW,bandH,C.band);
  g+=text(pad+24,gridTop+bandH/2+11,'STAFF',{size:31,weight:700,fill:'#FFFFFF',ls:'1'});
  g+=rect(pad,gridTop+bandH,labelW,dateH,'#FFFFFF');
  g+=text(pad+24,gridTop+bandH+dateH/2+10,'Name',{size:28,weight:600,fill:'#3D4759'});
  g+=rect(pad,gridTop,labelW,bandH+dateH,'none',{stroke:'#DFE4EC',sw:1});
  cols.forEach((c,i)=>{
    const x=gridX+i*colW;
    const fill=c.weekend?'#F6EAD0':'#FFFFFF';
    g+=rect(x,gridTop,colW,bandH,fill);
    g+=rect(x,gridTop+bandH,colW,dateH,c.weekend?'#FBF1DA':'#F4F6FA');
    g+=rect(x,gridTop,colW,bandH+dateH,'none',{stroke:'#DFE4EC',sw:1});
    g+=text(x+colW/2,gridTop+bandH/2+10,SH.dowLetter(c.dow),{size:cellSize+2,weight:700,anchor:'middle',fill:c.weekend?C.alInk:'#12203C'});
    g+=text(x+colW/2,gridTop+bandH+dateH/2+9,String(c.day),{size:cellSize,weight:700,anchor:'middle',fill:c.weekend?C.alInk:'#12203C',mono:true});
  });


  /* body */
  rows.forEach((r,ri)=>{
    const y=gridTop+bandH+dateH+ri*rowH;
    g+=rect(pad,y,labelW,rowH,ri%2?'#FAFBFD':'#FFFFFF');
    /* Every paper plan this department has kept names the post under the name, and
       the sheet follows the record. */
    const st_=LS.store.staffByName?LS.store.staffByName(r.name):null;
    const role=st_?String(st_.role||''):'';
    /* who answers for the weekly request for lab commodities from the main
       pharmacy — the manager, or the person acting for him while he is away */
    const req=LS.store.requisitionOfficer?LS.store.requisitionOfficer(String((plan.dates||[''])[0]).slice(0,7)):null;
    const reqLine=req&&req.name===r.name?(' · service requisition'+(req.acting?' (acting)':'')):'';
    /* The name is set WHOLE on one line, and the post sits on the line beneath it.
       Wrapping the name to two lines is what used to push the longest names into
       their own post: the label column is 560 px and every name on the establishment
       fits across it at the size below, so it is never broken. The post under it is
       a step smaller and in muted ink, so the name always reads first. */
    const roleText=(role+reqLine).replace(/^ · /,'');
    /* The post sits under the name at the size of the key text, and the pair is
       fitted to the row they have: a row of 76 px carries a name and its post, and a
       post long enough to need a third line steps down — first the post, then the
       name — until the block stands inside its row instead of printing over the row
       beneath it. */
    let nameSize=cellSize, roleSize=roleSizeAll;
    const layoutRow=()=>{
      const lines=roleText?wrapLines(roleText,labelW-56,roleSize,3):[];
      const h=Math.round(nameSize*1.12+(lines.length?6+lines.length*roleSize*1.22:0));
      return {lines,h};
    };
    let L=layoutRow();
    while(L.h>rowH-8 && roleSize>15){ roleSize-=1; L=layoutRow(); }
    while(L.h>rowH-6 && nameSize>18){ nameSize-=1; L=layoutRow(); }
    const blockTop=y+Math.max(3,Math.round((rowH-L.h)/2));
    const nameBase=blockTop+Math.round(nameSize*0.84);
    g+=nameBlock(pad+24,nameBase,labelW-56,r.name,{pref:nameSize,min:Math.min(18,nameSize)});
    L.lines.forEach((ln,li)=>{
      g+=text(pad+24,Math.round(nameBase+5+roleSize*0.98+li*roleSize*1.22),ln,
        {size:r2(roleSize),weight:500,fill:'#5B6474'});
    });
    const codes=r.codes||[];
    cols.forEach((c,i)=>{
      let code=(codes[i]||'').trim();
      let st=styleOf(code);
      // Approved leave is printed over the stored plan; the plan itself is never
      // rewritten by an approval.
      const LEAVE_CODES=['AL','SL','CL','ML','TR','W','ABS','H'];
      if(!st || LEAVE_CODES.indexOf(code)<0){
        const lv=LS.store.approvedLeaveCodeFor && LS.store.approvedLeaveCodeFor(r.name,c.iso);
        if(lv){ code=lv; st=styleOf(lv); }
      }
      const x=gridX+i*colW;
      const bg=st?st.bg:(c.weekend?C.creamBand:'#FFFFFF');
      g+=rect(x,y,colW,rowH,bg);
      /* a hatched cell carries no letter at all — the diagonal rules are the code,
         and a blank cell keeps its own meaning (at home) */
      if(st && st.hatch){
        const step=Math.max(8,Math.round(colW/6));
        for(let dx=-rowH; dx<colW+rowH; dx+=step){
          const x1=Math.max(x,x+dx), y1=y+rowH-Math.max(0,-dx);
          const x2=Math.min(x+colW,x+dx+rowH), y2=y+rowH-(x2-(x+dx));
          if(x2<=x1) continue;
          g+=line(x1,y1,x2,y2,'#D5DAE3',1.4);
        }
        g+=rect(x+1.5,y+1.5,colW-3,rowH-3,'none',{stroke:'#B9C0CC',sw:1.5,dash:'7 5'});
      }
      g+=rect(x,y,colW,rowH,'none',{stroke:C.line,sw:1});
      if(st && code && !st.hatch){
        /* The letter is set at the size of the staff names, so the grid and the names
           read as one table. It is never wider than its own day column, which the
           size above already guarantees; the guard stays for an unusually long code
           somebody adds later. */
        const cSize=Math.min(cellSize,fitSize(st.label,colW-16,cellSize,14));
        g+=text(x+colW/2,y+rowH/2+Math.round(cSize*0.35),st.label,{size:r2(cSize),weight:700,anchor:'middle',fill:st.fg});
      }
    });
    g+=rect(pad,y,labelW,rowH,'none',{stroke:C.line,sw:1});
  });

  /* month dividers */
  cols.forEach(c=>{ if(c.dividerBefore){
    const x=gridX+c.i*colW;
    g+=line(x,gridTop,x,gridBottom,'#8A6D1F',3,'10 8');
  }});

  g+=rect(pad,gridTop,labelW,gridBottom-gridTop,'none',{stroke:'#C9CFDA',sw:1});
  g+=rect(gridX,gridTop,colW*cols.length,gridBottom-gridTop,'none',{stroke:'#C9CFDA',sw:1});
  g+=rect(pad,gridBottom+18,W-pad*2,4,C.goldLine);

  /* The keys follow the grid directly. The sheet used to open with a band of
     rostering notes — who may not work nights, who rests at the weekend — which
     repeated what the rows already say and pushed the keys and the contacts down
     the page. The register a manager signs prints the roster and its keys, not a
     second telling of the rules. */
  let y=gridBottom+58+slack;
  g+=text(pad,y,'Keys:',{size:26,weight:700,fill:'#12203C'});
  y+=30;
  const keys=SH.keyOrder.map(c=>CODE[c].key);
  const keyCols=6, keyW=(W-pad*2)/keyCols, keyH=KEY_H;
  keys.forEach((k,i)=>{
    const col=i%keyCols, row=Math.floor(i/keyCols);
    const x=pad+col*keyW, yy=y+row*KEY_PITCH;
    g+=rect(x,yy,keyW-14,keyH,'#F7F9FD',{rx:6,stroke:'#E3E8F1',sw:1});
    const code=k.split(' ')[0];
    const st=styleOf(code)||{bg:'#EEF1F7',fg:C.ink};
    /* the chip and the lettering grow with the block, so a taller key is a key that
       reads, not the same small print sitting in a bigger box. One size for every key,
       as before — only the size itself has moved up a fifth. */
    /* one size for every key: the largest that sets the longest key line inside the
       block, so the taller block shows one setting and never a row of mixed sizes */
    const chip=28, keyTextSize=22;
    g+=rect(x+12,yy+(keyH-chip)/2,chip,chip,st.bg,{rx:4,stroke:'#DCE2EC',sw:1});
    g+=text(x+12+chip+12,yy+keyH/2+Math.round(keyTextSize*0.35),k,
      {size:r2(Math.min(keyTextSize,fitSize(k,keyW-chip-46,keyTextSize,15))),fill:'#26303F'});
  });
  y+=Math.ceil(keys.length/keyCols)*KEY_PITCH+22;

  /* staff contacts */
  g+=text(pad,y,'Staff contacts:',{size:26,weight:700,fill:'#12203C'});
  y+=34;                                  /* the list follows its own heading closely */
  /* contact cards: name + number, two columns, gold left bar — measured off the
     printed register (66 px tall, 76 px pitch, 12 px inside padding) */
  /* card height fills the run down to the signature block (max 92 px) so the page
     never opens a white gap between contacts and signatures */
  /* Cards are spread down to the signature block, as on the printed register:
     pitch fills the run, the card itself stays compact and legible. */
  /* The signature block follows the last row of contacts rather than sitting at the
     foot of the page: the sheet closes on the thing it signs instead of on a band of
     white paper, and the block is never further from the list than it needs to be. */
  /* the contacts must stop above the signature rule, whatever the key block above
     them costs — so the number of columns follows the space that is actually left,
     and a card never shrinks below the size a phone number stays readable at */
  /* ——— contacts: two rows ———
     Two rows, however many names there are: four blocks to a row on an establishment
     of eight, and the row count never grows. A block keeps its name hard left and its
     number hard right, so a row of four blocks still reads as four columns of numbers
     standing on one line each, not as a ragged line of text. The block is made tall
     enough to fill the space between the keys and the signature rule, because white
     paper between a list and the signatures is paper wasted. */
  const contactRows=Math.min(2,Math.max(1,rows.length));
  const contactCols=Math.max(1,Math.ceil(rows.length/contactRows));
  /* the block takes the run down to the signature rule: the rows are spread evenly
     over what is left, so a compact card never leaves a white band under the list */
  const contactPitch=CONTACT_PITCH;
  const contactH=CONTACT_H;
  const contactStart=y;
  /* One size for every contact name and one for every number — a register sets a
     column at one size, and a row of four blocks whose names are four sizes reads as
     an accident. The name size is the largest that sets the longest name of the
     establishment beside its number in the narrowest block, and the number gives way
     first if a block is tight. */
  const phoneOf=r=>U.fmtPhone((LS.store.staffByName(r.name)||{}).phone);
  const colWid=(W-pad*2)/contactCols;
  const cardW=(W-pad*2)/contactCols-20;
  const runW=cardW-20*2;
  const numWidest=rows.reduce((a,r)=>Math.max(a,textW(phoneOf(r)||'—',1)),0);
  const nameLongest=rows.reduce((a,r)=>Math.max(a,String(r.name||'').length),1);
  /* The number never goes below 24 px — it is what the contact list is for — and the
     name takes what the rest of the run gives it. The two are solved together for the
     longest name of the establishment, so every block is set at the same pair of
     sizes and no block is left tight. */
  const numLen=rows.reduce((a,r)=>Math.max(a,String(phoneOf(r)||'—').length),1);
  /* Name and number are set at ONE size: a short name would otherwise float beside a
     number set larger than itself, and a column of them reads as uneven typesetting.
     The size is the largest at which the longest name of the establishment still sits
     beside the longest number inside a block. */
  const pairSize=()=>{
    let s0=Math.min(38,contactH*0.42,30);
    while(s0>16){
      const gap=Math.max(20,Math.round(s0*0.9));
      if((nameLongest+numLen)*s0*ADV+gap<=runW) return s0;
      s0-=0.5;
    }
    return 16;
  };
  const contactNameSize=Math.max(16,Math.round(pairSize()*10)/10);
  const contactPhoneSize=contactNameSize;
  /* one inset for both edges, so the numbers of every column sit on the same
     vertical lines, right through the block */
  const cardInset=20;
  rows.forEach((r,i)=>{
    const col=i%contactCols, row=Math.floor(i/contactCols);
    const x=pad+col*colWid, yy=contactStart+row*contactPitch+(contactPitch-contactH)/2;
    const st=LS.store.staffByName(r.name)||{};
    const cardX=x+4, cardW=colWid-20;              /* the gold bar is 4 px, then the block */
    g+=rect(x,yy,4,contactH,C.goldLine);
    g+=rect(cardX,yy,cardW,contactH,'#F7F9FD',{stroke:'#E3E8F1',sw:1});
    /* the text run stops an inset short of the block's right edge: the name starts
       at the left inset, the number ends at the right one */
    const textX=cardX+cardInset, textW_=cardW-cardInset*2;
    g+=nameAndPhone(textX,yy+contactH/2+Math.round(contactNameSize*0.36),textW_,r.name,U.fmtPhone(st.phone),
      {pref:contactNameSize,min:contactNameSize,numPref:contactPhoneSize,phoneRight:true});
  });
  const contactEnd=contactStart+contactRows*contactPitch-13+CONTACT_H;
  y=contactEnd;

  /* signatures — set just under the contacts they follow */
  const sigTop=contactEnd+18;
  g+=rect(pad,sigTop,W-pad*2,2,'#EDE3C7');
  const sigs=[
    ['Prepared by:',s.prepared||'',s.preparedRole||'Laboratory Manager'],
    ['Verified by:',s.verified||'',s.verifiedRole||'Clinical Director'],
    ['Approved by:',s.approved||'',s.approvedRole||'Human Resources Officer']
  ];
  /* The three signatures are set at the size of the names in the staff contacts
     above them, not at a footnote size: the block is what makes the sheet a
     document, and it was printed smaller than the register it signs. The three
     lines are fitted to the column so a long name or post can never run into the
     next signature. */
  const sigW=(W-pad*2)/3-40;
  const sigSize=Math.max(24,contactNameSize);
  sigs.forEach(([label,name,role],i)=>{
    const x=pad+i*((W-pad*2)/3);
    /* one size for the whole block, the size of the names above it */
    const labelSize=fitSize(label,sigW,sigSize,22);
    const nameSize=fitSize(name,sigW,sigSize,22);
    const roleSize=fitSize(role,sigW,sigSize,22);
    /* at the contacts' size the three lines need the leading to go with it: a
       34 px name sits on 39, and the role under it on 36 more */
    const lead=Math.round(sigSize*1.14), roleLead=Math.round(sigSize*1.12);
    const base=sigTop+28;
    g+=text(x,base,label,{size:r2(labelSize),weight:600,fill:'#12203C'});
    g+=text(x,base+lead,name,{size:r2(nameSize),weight:700,fill:'#12203C'});
    g+=text(x,base+lead+roleLead,role,{size:r2(roleSize),fill:'#5B6474'});
  });

  return svgDoc(W,H,g);
};

/* ——— Weekly unit roster sheet ————————————————————— */
SH.weeklySVG=function(data,opts){
  opts=opts||{};
  const s=LS.store.settings();
  const W=3200, pad=96;
  const services=data.services||[];
  const dates=data.dates||[];
  const alloc=data.alloc||{};
  const night=data.night||{};
  /* The weekly sheet reads the working plan as well as the allocation: the day duty
     named by the plan sits in its own row, and a Saturday, a Sunday or a public
     holiday prints as the one duty it is rather than as seven empty benches. */
  const dayDuty=data.dayDuty||{};
  const weekend=data.weekend||{};
  const labelW=560, gridX=pad+labelW;
  const colW=(W-pad*2-labelW)/Math.max(1,dates.length);
  const headH=48, dateH=36, rowH=92, dayH=80, nightH=80;
  const top=446;
  /* A recorded override is part of the record, so the signed sheet prints it. */
  const overrides=overrideLines(data.overrides||{}, alloc);
  const orient=orientationLines(data.orientation||{}, alloc);
  const noteH=(overrides.length?overrides.length*29+60:0)+(orient.length?orient.length*29+58:0);
  const H=top+headH+dateH+rowH*services.length+dayH+nightH+noteH+150;

  let g='';
  g+='<rect width="'+W+'" height="'+H+'" fill="#FFFFFF"/>';
  g+=letterhead(s,{width:W,pad:pad,top:14,rule1:272});

  const title='Weekly Unit Roster — Week of '+U.fmtDateShort(data.weekStart)+' '+U.parseISO(data.weekStart).getFullYear();
  g+=text(W/2,372,title,{size:42,weight:700,anchor:'middle',fill:'#12203C'});
  g+=rect(pad,398,W-pad*2,2,C.goldLine);
  g+=rect(pad,408,W-pad*2,6,C.goldLine);

  /* header: navy label block + two light rows of day then date, weekends in cream */
  g+=rect(pad,top,labelW,headH,C.band);
  g+=text(pad+24,top+headH/2+10,'Unit / Day',{size:28,weight:700,fill:'#FFFFFF'});
  g+=rect(pad,top+headH,labelW,dateH,'#FFFFFF');
  g+=text(pad+24,top+headH+dateH/2+9,'Date',{size:27,weight:700,fill:'#12203C'});
  g+=rect(pad,top+headH,labelW,dateH,'none',{stroke:C.line,sw:1});
  g+=rect(pad,top,labelW,headH+dateH,'none',{stroke:C.line,sw:1});
  const isWeekend=iso=>!!weekend[iso]||U.dow(iso)>=5;
  dates.forEach((iso,i)=>{
    const we=isWeekend(iso);
    const x=gridX+i*colW;
    g+=rect(x,top,colW,headH,we?C.creamBand:'#FFFFFF');
    g+=rect(x,top+headH,colW,dateH,we?'#F7E9C9':'#F4F6FA');
    g+=rect(x,top,colW,headH+dateH,'none',{stroke:C.line,sw:1});
    g+=text(x+colW/2,top+headH/2+10,U.DOWL[U.dow(iso)],{size:28,weight:700,anchor:'middle',fill:we?C.alInk:'#12203C'});
    g+=text(x+colW/2,top+headH+dateH/2+9,String(U.parseISO(iso).getDate()),{size:26,weight:600,anchor:'middle',fill:we?C.alInk:'#12203C',mono:true});
  });

  services.forEach((sv,ri)=>{
    const y=top+headH+dateH+ri*rowH;
    g+=rect(pad,y,labelW,rowH,'#FFFFFF');
    g+=text(pad+24,y+rowH/2+10,sv.name,{size:fitSize(sv.name,labelW-44,30,20),weight:600,fill:'#12203C'});
    dates.forEach((iso,i)=>{
      const we=isWeekend(iso);
      const x=gridX+i*colW;
      g+=rect(x,y,colW,rowH,we?C.creamBand:'#FFFFFF');
      g+=rect(x,y,colW,rowH,'none',{stroke:C.line,sw:1});
      const who=we?'':((alloc[iso]&&alloc[iso][sv.name])||'');
        if(who){
        const ov=(data.overrides&&data.overrides[iso]&&data.overrides[iso][sv.name]);
        g+=nameBlock(x+colW/2,y+rowH/2-(ov?9:0), colW-20, who, {pref:34,min:19,anchor:'middle'});
        if(ov) g+=text(x+colW/2,y+rowH/2+26,'OVERRIDE',{size:15,weight:700,anchor:'middle',fill:C.alInk||'#8A2B33'});
        const orow=(data.orientation&&data.orientation[iso])||{};
        const o=orow[who||(alloc[iso]||{})[sv.name]];
        if(o) g+=text(x+colW/2,y+rowH/2+26,'WEEK '+o.week,{size:14,weight:700,anchor:'middle',fill:'#1F3F7A'});
      }
    });
    g+=rect(pad,y,labelW,rowH,'none',{stroke:C.line,sw:1});
  });

  /* ——— the day duty, from the working plan ——— */
  const dy=top+headH+dateH+services.length*rowH;
  g+=rect(pad,dy,labelW,dayH,'#FFFFFF');
  g+=text(pad+24,dy+dayH/2-2,'Day duty',{size:28,weight:700,fill:'#12203C'});
  g+=text(pad+24,dy+dayH/2+24,'08:00–17:00 · from the plan',{size:17,fill:'#5B6474'});
  dates.forEach((iso,i)=>{
    const x=gridX+i*colW, we=isWeekend(iso);
    g+=rect(x,dy,colW,dayH,we?C.creamBand:'#FFFFFF');
    g+=rect(x,dy,colW,dayH,'none',{stroke:C.line,sw:1});
    const names=dayDuty[iso]||[];
    const tag=weekend[iso]||'';
    if(we&&tag) g+=text(x+colW/2,dy+22,String(tag).toUpperCase().slice(0,16),{size:13,weight:700,anchor:'middle',fill:C.alInk});
    /* the weekend names the duty itself; a weekday already has the names in the grid */
    if(we&&names.length){
      const txt=names.length>2?names.length+' on duty':names.join(' · ');
      g+=nameBlock(x+colW/2,dy+dayH/2+16,colW-18,txt,{pref:24,min:14,anchor:'middle'});
    } else if(!we&&names.length){
      g+=text(x+colW/2,dy+dayH/2+8,names.length+' on duty',{size:20,anchor:'middle',fill:'#5B6474'});
    } else {
      g+=text(x+colW/2,dy+dayH/2+8,'—',{size:22,anchor:'middle',fill:'#98A2B3'});
    }
  });
  g+=rect(pad,dy,labelW,dayH,'none',{stroke:C.line,sw:1});
  g+=rect(pad,dy,W-pad*2,2,C.goldLine);

  const ny=dy+dayH;
  g+=rect(pad,ny,labelW,nightH,C.nightBand);
  g+=text(pad+24,ny+nightH/2+10,'Night Shift',{size:28,weight:700,fill:'#E9D9A7'});
  dates.forEach((iso,i)=>{
    const x=gridX+i*colW;
    g+=rect(x,ny,colW,nightH,C.nightBand);
    g+=rect(x,ny,colW,nightH,'none',{stroke:'#2A3A5C',sw:1});
    const who=night[iso]||'';
    if(who) g+=nameBlock(x+colW/2,ny+nightH/2, colW-20, who, {pref:34,min:19,anchor:'middle',fill:'#FFFFFF',subFill:'#C9D4E8'});
  });
  g+=rect(pad,ny+nightH,W-pad*2,3,C.goldLine);

  let noteY=ny+nightH+44;
  if(overrides.length){
    g+=text(pad,noteY,'Recorded overrides — bench rule lifted for one cell',{size:19,weight:700,fill:'#8A2B33'});
    noteY+=26;
    overrides.forEach((ln,i)=>{ g+=text(pad,noteY+i*29,ln,{size:19,fill:'#3D4759'}); });
    noteY+=overrides.length*29+22;
  }
  if(orient.length){
    g+=text(pad,noteY,'Orientation — new staff on the thirty-day rotation',{size:19,weight:700,fill:'#1F3F7A'});
    noteY+=26;
    orient.forEach((ln,i)=>{ g+=text(pad,noteY+i*29,ln,{size:19,fill:'#3D4759'}); });
  }

  g+=text(W/2,H-60,'Week of '+U.fmtDateShort(data.weekStart)+' · Day shift 08:00–17:00 · Night shift 17:00–08:00 the next day · plan: '+(data.planLabel||'working plan')+' · Generated '+U.todayISO(),{size:23,anchor:'middle',fill:'#3D4759'});
  return svgDoc(W,H,g);
};

function svgDoc(W,H,body){
  return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'
    +'<rect width="'+W+'" height="'+H+'" fill="#FFFFFF"/>'+body+'</svg>';
}

/* ——— Raster + PDF + XLSX ————————————————————————— */
/* Largest canvas we will ask for: 16.7 Mpx is the iOS-Safari ceiling, and 8192
   the max side most GPUs accept. Everything stays under both. */
const MAX_AREA=15000000, MAX_SIDE=8192;
SH.rasterPlan=function(svg,scale){
  let w=2000,h=1173;
  const vb=/viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)||/width="([\d.]+)" height="([\d.]+)"/.exec(svg);
  if(vb){ w=+vb[1]||w; h=+vb[2]||h; }
  let sc=Math.max(0.5,scale||1);
  const fit=Math.min(Math.sqrt(MAX_AREA/(w*h)),MAX_SIDE/Math.max(w,h));
  sc=Math.min(sc,fit);
  return {w:Math.max(1,Math.round(w*sc)),h:Math.max(1,Math.round(h*sc)),scale:sc};
};
SH.svgToCanvas=function(svg,scale){
  return new Promise((resolve,reject)=>{
    const plan=SH.rasterPlan(svg,scale);
    const img=new Image();
    const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    let done=false;
    const fail=()=>{ if(done) return; done=true; reject(new Error('Could not rasterise the sheet — try PDF or XLSX instead')); };
    img.onload=()=>{
      if(done) return; done=true;
      try{
        const cv=document.createElement('canvas');
        cv.width=plan.w; cv.height=plan.h;
        const ctx=cv.getContext('2d');
        ctx.fillStyle='#FFFFFF'; ctx.fillRect(0,0,cv.width,cv.height);
        ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
        ctx.drawImage(img,0,0,cv.width,cv.height);
        resolve(cv);
      }catch(e){ reject(e); }
    };
    img.onerror=fail;
    setTimeout(fail,25000);                            // never leave the button spinning
    img.src=url;                                       // intrinsic size comes from the SVG's own width/height
  });
};
SH.toPNG=async function(svg,scale){
  const cv=await SH.svgToCanvas(svg,scale||2);
  return new Promise(res=>cv.toBlob(b=>res(b),'image/png'));
};
SH.toPDF=async function(svg,opts){
  opts=opts||{};
  const cv=await SH.svgToCanvas(svg,opts.scale||3);   // ~433 dpi on A4 landscape, capped for mobile
  const jpeg=cv.toDataURL('image/jpeg',0.96).split(',')[1];
  const bin=atob(jpeg);
  const img=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) img[i]=bin.charCodeAt(i);
  const pageW=842, pageH=595;                        // A4 landscape, points
  const margin=opts.margin==null?18:opts.margin;
  const availW=pageW-margin*2, availH=pageH-margin*2;
  const ratio=Math.min(availW/cv.width, availH/cv.height);
  const w=cv.width*ratio, h=cv.height*ratio;
  const x=(pageW-w)/2, y=(pageH-h)/2;

  const parts=[];
  const push=s=>parts.push(s);
  push('%PDF-1.4\n');
  const offsets=[];
  const obj=(body)=>{ offsets.push(parts.join('').length); push(body); };
  // 1 catalog, 2 pages, 3 page, 4 contents, 5 image
  const content='q '+w.toFixed(2)+' 0 0 '+h.toFixed(2)+' '+x.toFixed(2)+' '+y.toFixed(2)+' cm /Im0 Do Q';
  obj('1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n');
  obj('2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n');
  obj('3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 '+pageW+' '+pageH+']/Resources<</XObject<</Im0 5 0 R>>/ProcSet[/PDF/ImageC]>>/Contents 4 0 R>>endobj\n');
  obj('4 0 obj<</Length '+content.length+'>>stream\n'+content+'\nendstream endobj\n');
  offsets.push(parts.join('').length);
  push('5 0 obj<</Type/XObject/Subtype/Image/Width '+cv.width+'/Height '+cv.height+'/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length '+img.length+'>>stream\n');
  const head=parts.join('');
  const tail='\nendstream endobj\n';
  const xrefPos=head.length+img.length+tail.length;
  let xref='xref\n0 6\n0000000000 65535 f \n';
  offsets.forEach(o=>{ xref+=String(o).padStart(10,'0')+' 00000 n \n'; });
  const trailer='trailer<</Size 6/Root 1 0 R>>\nstartxref\n'+xrefPos+'\n%%EOF';
  const bytesHead=new TextEncoder().encode(head + tail.slice(0,0));
  // assemble: head(as latin1) + image bytes + tail + xref + trailer
  const enc=s=>{ const a=new Uint8Array(s.length); for(let i=0;i<s.length;i++) a[i]=s.charCodeAt(i)&0xff; return a; };
  const chunks=[enc(head),img,enc(tail+xref+trailer)];
  return new Blob(chunks,{type:'application/pdf'});
};

/* Minimal ZIP writer (STORE) — enough for a valid .xlsx */
const CRC_TABLE=(()=>{ const t=new Uint32Array(256);
  for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0; }
  return t; })();
function crc32(bytes){ let c=0xFFFFFFFF; for(let i=0;i<bytes.length;i++) c=CRC_TABLE[(c^bytes[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function zip(files){
  const enc=new TextEncoder();
  const local=[], central=[]; let offset=0;
  files.forEach(f=>{
    const nameBytes=enc.encode(f.name), data=f.data instanceof Uint8Array?f.data:enc.encode(f.data);
    const crc=crc32(data);
    const lh=new Uint8Array(30+nameBytes.length);
    const dv=new DataView(lh.buffer);
    dv.setUint32(0,0x04034b50,true); dv.setUint16(4,20,true); dv.setUint16(6,0x0800,true);
    dv.setUint16(8,0,true); dv.setUint16(10,0,true); dv.setUint16(12,0x21,true);
    dv.setUint32(14,crc,true); dv.setUint32(18,data.length,true); dv.setUint32(22,data.length,true);
    dv.setUint16(26,nameBytes.length,true); dv.setUint16(28,0,true);
    lh.set(nameBytes,30);
    local.push(lh,data);
    const ch=new Uint8Array(46+nameBytes.length); const cv=new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true);
    cv.setUint16(8,0x0800,true); cv.setUint16(10,0,true); cv.setUint16(12,0,true); cv.setUint16(14,0x21,true);
    cv.setUint32(16,crc,true); cv.setUint32(20,data.length,true); cv.setUint32(24,data.length,true);
    cv.setUint16(28,nameBytes.length,true); cv.setUint16(30,0,true); cv.setUint16(32,0,true);
    cv.setUint16(34,0,true); cv.setUint16(36,0,true); cv.setUint32(38,0,true); cv.setUint32(42,offset,true);
    ch.set(nameBytes,46);
    central.push(ch);
    offset+=lh.length+data.length;
  });
  const centralSize=central.reduce((a,b)=>a+b.length,0);
  const eocd=new Uint8Array(22); const ev=new DataView(eocd.buffer);
  ev.setUint32(0,0x06054b50,true); ev.setUint16(8,files.length,true); ev.setUint16(10,files.length,true);
  ev.setUint32(12,centralSize,true); ev.setUint32(16,offset,true);
  return new Blob(local.concat(central,[eocd]),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
SH.zip=zip;

/* ——— XLSX builders ————————————————————————— */
const STYLES='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
+'<numFmts count="0"/>'
+'<fonts count="6">'
+'<font><sz val="10"/><name val="Calibri"/><color rgb="FF1B2433"/></font>'
+'<font><b/><sz val="18"/><name val="Georgia"/><color rgb="FF12203C"/></font>'
+'<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>'
+'<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF12203C"/></font>'
+'<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF12203C"/></font>'
+'<font><i/><sz val="8"/><name val="Calibri"/><color rgb="FF6B7280"/></font>'
+'</fonts>'
+'<fills count="9">'
+'<fill><patternFill patternType="none"/></fill>'
+'<fill><patternFill patternType="gray125"/></fill>'
+'<fill><patternFill patternType="solid"><fgColor rgb="FF0B1C3D"/><bgColor indexed="64"/></patternFill></fill>'
+'<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEFB"/><bgColor indexed="64"/></patternFill></fill>'
+'<fill><patternFill patternType="solid"><fgColor rgb="FFFDF3D7"/><bgColor indexed="64"/></patternFill></fill>'
+'<fill><patternFill patternType="solid"><fgColor rgb="FFFBFCFE"/><bgColor indexed="64"/></patternFill></fill>'
+'<fill><patternFill patternType="solid"><fgColor rgb="FFC2D4EF"/><bgColor indexed="64"/></patternFill></fill>'
+'<fill><patternFill patternType="solid"><fgColor rgb="FFF2E4BF"/><bgColor indexed="64"/></patternFill></fill>'
+'<fill><patternFill patternType="solid"><fgColor rgb="FFF7F9FD"/><bgColor indexed="64"/></patternFill></fill>'
+'</fills>'
+'<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>'
+'<border><left style="thin"><color rgb="FFE4E8F0"/></left><right style="thin"><color rgb="FFE4E8F0"/></right><top style="thin"><color rgb="FFE4E8F0"/></top><bottom style="thin"><color rgb="FFE4E8F0"/></bottom><diagonal/></border>'
+'<border><left style="thin"><color rgb="FFC9CFDA"/></left><right style="thin"><color rgb="FFC9CFDA"/></right><top style="thin"><color rgb="FFC9CFDA"/></top><bottom style="thin"><color rgb="FFC9CFDA"/></bottom><diagonal/></border>'
+'</borders>'
+'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
+'<cellXfs count="14">'
+'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'                                            // 0 plain
+'<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' // 1 title
+'<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' // 2 band header
+'<xf numFmtId="0" fontId="3" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' // 3 label cell
+'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' // 4 plain centred
+'<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' // 5 D
+'<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' // 6 N
+'<xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' // 7 DN
+'<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' // 8 OFF
+'<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' // 9 AL/leave
+'<xf numFmtId="0" fontId="3" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' // 10 weekend header
+'<xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' // 11 weekend empty
+'<xf numFmtId="0" fontId="3" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' // 12 contact
+'<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>' // 13 footnote
+'</cellXfs>'
+'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
+'</styleSheet>';
const STYLE_INDEX={D:5,N:6,DN:7,OFF:8,AL:9,CL:9,ML:9,SL:9,W:9,TR:3,ABS:9,H:9};
function colName(n){ let s=''; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; }
function xmlEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function sheetXML(rows,opts){
  opts=opts||{};
  let x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
   +'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
   +'<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
   +'<sheetViews><sheetView workbookViewId="0"'+(opts.freeze?'><pane ySplit="'+opts.freeze+'" topLeftCell="A'+(opts.freeze+1)+'" activePane="bottomLeft" state="frozen"/></sheetView>':'/>')+'</sheetViews>'
   +'<sheetFormatPr defaultRowHeight="16"/>'
   +'<cols>'+(opts.cols||[]).map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols>'
   +'<sheetData>';
  rows.forEach((row,ri)=>{
    const r=ri+1;
    const attrs=(row.h?' ht="'+row.h+'" customHeight="1"':'');
    x+='<row r="'+r+'"'+attrs+'>';
    (row.cells||[]).forEach(cell=>{
      if(cell===null||cell===undefined) return;
      const ref=colName(cell.c+1)+r;
      const st=cell.s||0;
      const v=cell.v===undefined||cell.v===null?'':String(cell.v);
      if(v==='') x+='<c r="'+ref+'" s="'+st+'"/>';
      else if(typeof cell.v==='number') x+='<c r="'+ref+'" s="'+st+'"><v>'+cell.v+'</v></c>';
      else x+='<c r="'+ref+'" s="'+st+'" t="inlineStr"><is><t xml:space="preserve">'+xmlEsc(v)+'</t></is></c>';
    });
    x+='</row>';
  });
  x+='</sheetData>';
  (opts.merges||[]).length && (x+='<mergeCells count="'+opts.merges.length+'">'+opts.merges.map(m=>'<mergeCell ref="'+m+'"/>').join('')+'</mergeCells>');
  x+='<printOptions horizontalCentered="1"/>'
   +'<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>'
   +'<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1"/>'
   +'</worksheet>';
  return x;
}
function workbookFile(sheetName,sheetXml,styles){
  const enc=new TextEncoder();
  const files=[
    {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      +'<Default Extension="xml" ContentType="application/xml"/>'
      +'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      +'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      +'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      +'</Types>'},
    {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      +'</Relationships>'},
    {name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      +'<sheets><sheet name="'+xmlEsc(sheetName)+'" sheetId="1" r:id="rId1"/></sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      +'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      +'</Relationships>'},
    {name:'xl/styles.xml',data:styles},
    {name:'xl/worksheets/sheet1.xml',data:sheetXml}
  ];
  return zip(files);
}
SH.xlsx=workbookFile;

SH.monthlyXLSX=function(plan){
  const s=LS.store.settings();
  const cols=monthCols(plan);
  const rows=plan.staff||[];
  const nCols=cols.length+1;
  const out=[];
  out.push({cells:[{c:0,v:'MINISTRY OF HEALTH',s:13}]});
  out.push({h:26,cells:[{c:0,v:s.hospital||'Ruli District Hospital',s:1}]});
  out.push({cells:[{c:0,v:(s.dept||'Laboratory Department')+' · Republic of Rwanda',s:13}]});
  out.push({cells:[{c:0,v:((s.email||'')+(s.phone?' · '+U.fmtPhone(s.phone):'')),s:13}]});
  out.push({cells:[]});
  out.push({h:22,cells:[{c:0,v:'Working Plan — '+((plan.meta&&plan.meta.period)||plan.label||''),s:1}]});
  out.push({cells:[{c:0,v:'Date: '+((plan.meta&&plan.meta.date)||'')+'    FY: '+((plan.meta&&plan.meta.fy)||''),s:13}]});
  out.push({cells:[]});
  // weekday band
  const band=[{c:0,v:'STAFF',s:2}];
  cols.forEach(col=>band.push({c:col.i+1,v:SH.dowLetter(col.dow),s:col.weekend?10:2}));
  out.push({h:20,cells:band});
  const dateRow=[{c:0,v:'Name',s:3}];
  cols.forEach(col=>dateRow.push({c:col.i+1,v:col.day,s:col.weekend?10:4}));
  out.push({h:18,cells:dateRow});
  rows.forEach(r=>{
    const cells=[{c:0,v:r.name,s:3}];
    cols.forEach(col=>{
      const code=((r.codes||[])[col.i]||'').trim();
      const st=code?STYLE_INDEX[code]:undefined;
      cells.push({c:col.i+1,v:code,s:st!==undefined?st:(col.weekend?11:4)});
    });
    out.push({h:20,cells});
  });
  out.push({cells:[]});
  out.push({cells:[{c:0,v:'Keys',s:1}]});
  SH.keyOrder.forEach((c,i)=>{
    const row=Math.floor(i/4), col=i%4;
    if(!out[out.length-1+0]) {}
    const idx=out.length;
    if(col===0) out.push({cells:[]});
    const target=out[out.length-1];
    target.cells[col]={c:col,v:CODE[c].key,s:0};
  });
  out.push({cells:[]});
  out.push({cells:[{c:0,v:'Staff contacts',s:1}]});
  rows.forEach((r,i)=>{
    const st=LS.store.staffByName(r.name)||{};
    const col=i%2, row=Math.floor(i/2);
    if(col===0) out.push({cells:[]});
    const target=out[out.length-1];
    target.cells[col]={c:col,v:r.name+'  ·  '+(U.fmtPhone(st.phone)||'—'),s:12};
  });
  out.push({cells:[]});
  out.push({cells:[{c:0,v:'Prepared by: '+(s.prepared||''),s:3},{c:2,v:'Verified by: '+(s.verified||''),s:3},{c:4,v:'Approved by: '+(s.approved||''),s:3}]});
  out.push({cells:[{c:0,v:(s.preparedRole||'')+' · '+(s.verifiedRole||'')+' · '+(s.approvedRole||''),s:13}]});
  const widths=[30].concat(cols.map(()=>3.6));
  const sheet=sheetXML(out,{cols:widths,freeze:9,merges:['A1:'+colName(nCols)+'1','A2:'+colName(nCols)+'2','A3:'+colName(nCols)+'3','A4:'+colName(nCols)+'4','A6:'+colName(nCols)+'6','A7:'+colName(nCols)+'7']});
  return workbookFile('Working Plan',sheet,STYLES);
};

SH.weeklyXLSX=function(data){
  const s=LS.store.settings();
  const cols=data.dates||[], services=data.services||[], alloc=data.alloc||{}, night=data.night||{};
  const nCols=cols.length+1;
  const out=[];
  out.push({h:26,cells:[{c:0,v:s.hospital||'Ruli District Hospital',s:1}]});
  out.push({cells:[{c:0,v:(s.dept||'Laboratory Department')+' · Republic of Rwanda',s:13}]});
  out.push({cells:[]});
  out.push({h:22,cells:[{c:0,v:'Weekly Unit Roster — Week of '+U.fmtDateShort(data.weekStart)+' '+U.parseISO(data.weekStart).getFullYear(),s:1}]});
  out.push({cells:[]});
  const head=[{c:0,v:'Unit / Day',s:2}];
  cols.forEach(iso=>{ const d=U.parseISO(iso), we=d.getDay()===0||d.getDay()===6;
    head.push({c:head.length,v:U.DOWL[(d.getDay()+6)%7],s:we?10:2}); });
  out.push({h:20,cells:head});
  const dateRow=[{c:0,v:'Date',s:3}];
  cols.forEach(iso=>{ const d=U.parseISO(iso), we=d.getDay()===0||d.getDay()===6;
    dateRow.push({c:dateRow.length,v:d.getDate(),s:we?10:4}); });
  out.push({h:18,cells:dateRow});
  services.forEach(sv=>{
    const cells=[{c:0,v:sv.name,s:3}];
    cols.forEach(iso=>{ const we=U.parseISO(iso).getDay()%6===0;
      cells.push({c:cells.length,v:(alloc[iso]&&alloc[iso][sv.name])||'',s:we?11:4}); });
    out.push({h:20,cells});
  });
  const ovLines=[];
  Object.keys(data.overrides||{}).forEach(iso=>{
    const day=data.overrides[iso]||{};
    Object.keys(day).forEach(bench=>{ ovLines.push(U.fmtDate(iso)+' · '+bench+' · OVERRIDE by '+((day[bench]||{}).by||'manager')); });
  });
  if(ovLines.length){ out.push({h:18,cells:[{c:0,v:'Overrides',s:3},{c:1,v:ovLines.join('  ·  '),s:4}]}); }
  const nrow=[{c:0,v:'Night Shift',s:2}];
  cols.forEach(iso=>nrow.push({c:nrow.length,v:night[iso]||'',s:6}));
  out.push({h:20,cells:nrow});
  out.push({cells:[]});
  out.push({cells:[{c:0,v:'Week of '+U.fmtDateShort(data.weekStart)+' · Generated '+U.todayISO()+' · Ruli District Hospital Laboratory',s:13}]});
  const sheet=sheetXML(out,{cols:[26].concat(cols.map(()=>3.6)),freeze:2,
    merges:['A1:'+colName(nCols)+'1','A2:'+colName(nCols)+'2','A4:'+colName(nCols)+'4']});
  return workbookFile('Weekly Roster',sheet,STYLES);
};

/* ——— Print (vector, crisp at any size) ————————————————— */
SH.printSVG=function(svg,opts){
  opts=opts||{};
  const landscape=opts.landscape!==false;
  const html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+esc(opts.title||'Sheet')+'</title>'
   +'<style>@page{size:A4 '+(landscape?'landscape':'portrait')+';margin:6mm}'
   +'html,body{margin:0;padding:0;background:#fff}svg{width:100%;height:auto;display:block}'
   +'</style></head><body>'+svg+'</body></html>';
  U.print(html);
};

/* ——— Format menu ————————————————————————— */
SH.offer=function(o){
  // o: {title, svg, xlsx, filename}
  const U2=LS.ui;
  const opts=[['pdf','PDF · A4 landscape','vector-faithful raster at 300 dpi', 'file-text'],
              ['png','PNG · 2× retina','crisp image for WhatsApp / email', 'image'],
              ['xlsx','Excel · .xlsx','editable grid, colours and print setup', 'table-2'],
              ['print','Print / Save as PDF','vector print dialog', 'printer']];
  U2.modal({title:'Export — '+o.title,sub:'One file per sheet, laid out exactly like the printed register.',width:'min(560px,100%)',
    body:'<div style="display:flex;flex-direction:column;gap:8px">'+opts.map(([k,t,s,ic])=>
        '<button class="choice" data-fmt="'+k+'"><span class="kpi-ic" style="width:30px;height:30px">'+U2.ic(ic,15)+'</span>'
        +'<span class="grow" style="text-align:left;margin-left:10px"><span class="ct">'+t+'</span><span class="cs" style="display:block">'+s+'</span></span>'
        +U2.ic('arrow-right',14)+'</button>').join('')
      +'</div><div class="hint" style="margin-top:10px">Everything is generated on this device — nothing leaves the laboratory network.</div>',
    foot:'<button class="btn" data-close>Cancel</button>',
    onMount:(el,close)=>{
      el.querySelectorAll('[data-fmt]').forEach(b=>b.onclick=async()=>{
        const fmt=b.dataset.fmt;
        close();
        try{
          if(fmt==='print'){ SH.printSVG(o.svg,{title:o.title}); return; }
          LS.ui.toast('Preparing '+fmt.toUpperCase()+'…',{type:'info',duration:1600});
          let blob, name;
          if(fmt==='png'){ blob=await SH.toPNG(o.svg,2); name=o.filename+'.png'; }
          else if(fmt==='pdf'){ blob=await SH.toPDF(o.svg,{scale:3}); name=o.filename+'.pdf'; }
          else { blob=o.xlsx; name=o.filename+'.xlsx'; }
          U.download(name,blob);
          LS.ui.toast(name+' saved',{type:'ok'});
          if(LS.store&&LS.store.audit){ LS.store.audit({action:'export.'+fmt,entity:'sheets',entityId:name,detail:o.title+' exported as '+fmt.toUpperCase()}); LS.store.save(); }
        }catch(err){ LS.ui.toast('Export failed · '+(err&&err.message||err),{type:'err',duration:7000}); }
      });
    }});
};
})();
