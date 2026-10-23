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
  line:'#E4E8F0', nightBand:'#12203C'
};
SH.colors=C;
const FONT={ body:'Helvetica, Arial, sans-serif', serif:'Georgia, Times New Roman, serif', mono:'DejaVu Sans Mono, Menlo, Consolas, monospace' };
const CODE={
  D:   {bg:C.pale,      fg:C.paleInk, label:'D',   key:'D — Day 08:00–17:00'},
  N:   {bg:C.navy,      fg:'#FFFFFF', label:'N',   key:'N — Night 17:00–08:00 next day'},
  DN:  {bg:C.dn,        fg:'#101828', label:'DN',  key:'DN — Day+Night'},
  OFF: {bg:'#FCFCFE',   fg:C.offInk,  label:'OFF', key:'OFF — At home (not on shift)'},
  AL:  {bg:C.cream,     fg:C.alInk,   label:'AL',  key:'AL — Annual leave (authorised)'},
  CL:  {bg:C.cream,     fg:C.alInk,   label:'CL',  key:'CL — Authorized leave'},
  ML:  {bg:C.cream,     fg:C.alInk,   label:'ML',  key:'ML — Maternity leave'},
  SL:  {bg:C.cream,     fg:C.alInk,   label:'SL',  key:'SL — Sick leave'},
  TR:  {bg:'#EAF3EC',   fg:'#2F7A4F', label:'TR',  key:'TR — Training'},
  W:   {bg:C.cream,     fg:C.alInk,   label:'W',   key:'W — Wedding day'},
  ABS: {bg:'#FBECEE',   fg:'#B03A48', label:'ABS', key:'ABS — Unexcused absence (recorded)'},
  H:   {bg:'#FBECEE',   fg:'#B03A48', label:'H',   key:'H — Public holiday'}
};
SH.codes=Object.keys(CODE);
/* printed register order: shifts, rest, leave, then the rest */
SH.keyOrder=['D','N','DN','OFF','AL','ML','SL','CL','TR','W','ABS','H'].filter(c=>CODE[c]);
SH.keyOrder=SH.keyOrder.concat(SH.codes.filter(c=>SH.keyOrder.indexOf(c)<0));
const styleOf=c=>CODE[c]||null;

/* ——— Small SVG helpers ————————————————————————————— */
const esc=s=>U.esc(String(s==null?'':s));
/* Font-size that keeps a string inside a box. Advance is approximated at 0.58 em
   (bold sans, which is the widest we set) so a substituted font never spills. */
function fitSize(str,maxWidth,preferred,min){
  const len=String(str||'').length||1;
  const byWidth=maxWidth/(len*0.58);
  return Math.max(min||10,Math.min(preferred,byWidth));
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

/* ——— Names and the staff exceptions that must be visible on the sheet ————— */
/* Printed sheets were set at 21–27 px on a 3200 px page, which lands near 6 pt
   when printed: too small to read on a ward wall. Names now use the full cell
   width across two lines (first name above surname) and never fall below the
   size the printed register uses. */
function nameLines(name){
  const parts=String(name||'').trim().split(/\s+/);
  if(parts.length<2) return {main:parts[0]||'', sub:''};
  return {main:parts[0], sub:parts.slice(1).join(' ')};
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
  if(!n.sub || textW(full,pref)<=w){
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

/* The rostering exceptions the department works to. They are printed on the
   sheet so nobody has to remember why a row looks the way it does. */
const EXCEPTION_RULES=[
  {test:n=>/no weekends\/holidays\/nights|no nights, weekends/i.test(n), text:'Laboratory Manager — no nights, weekends or public holidays'},
  {test:n=>/Reception mostly/i.test(n), text:'Reception first; Parasitology at most 2 days a month; never Phlebotomy or TB'},
  {test:n=>/Weekend-only/i.test(n), text:'Weekend-only — Saturday and Sunday, day plus night; rests Monday to Friday'},
  {test:n=>/3 consecutive nights/i.test(n), text:'Night lead — the only row that may run 3 consecutive nights, at least 3 sessions a month'}
];
function staffExceptions(names){
  const out=[], seen={};
  (names||[]).forEach(name=>{
    const st=(window.LS.store.staffByName&&window.LS.store.staffByName(name))||{};
    const note=String(st.note||'');
    const rule=EXCEPTION_RULES.find(r=>r.test(note));
    if(!rule) return;
    const key=rule.text; if(seen[key]) { seen[key]+=1; return; }
    seen[key]=1; out.push({name:name, text:rule.text});
  });
  return out;
}
SH.staffExceptions=staffExceptions;
/* "Serology · Mon 5 Oct — Beatrice NGEZEKURE (by Kelvin SAMAHANI)" */
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
/* The annotations, wrapped to the page width. Long exception text used to run
   off the sheet, so it is broken into lines that actually fit. */
function wrapText(str,width,size){
  const max=Math.max(20,Math.floor(width/(size*0.52)));
  const words=String(str).split(/\s+/); const lines=[]; let cur='';
  words.forEach(w=>{ if((cur+' '+w).trim().length>max){ if(cur) lines.push(cur); cur=w; } else cur=(cur?cur+' ':'')+w; });
  if(cur) lines.push(cur);
  return lines;
}
function exceptionLines(list,width,size){
  if(!list.length) return [];
  const joined=list.map(e=>e.name+' — '+e.text).join('   ·   ');
  return wrapText(joined,width,size||20);
}
function drawExceptions(x,y,width,list,o){
  o=o||{}; const size=o.size||21, pitch=o.pitch||30;
  const lines=exceptionLines(list,width,size);
  if(!lines.length) return '';
  let out=text(x,y,o.label||'Rostering exceptions:',{size:size+2,weight:700,fill:'#12203C'});
  lines.forEach((ln,i)=>{ out+=text(x,y+(i+1)*pitch,ln,{size:size,fill:'#5B6474'}); });
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
  g+=text(mid,cy0+82,(s.hospital||'Ruli District Hospital').toUpperCase(),{size:54,weight:700,anchor:'middle',fill:'#12203C',family:FONT.serif,ls:'1'});
  g+=text(mid,cy0+122,s.dept||'Laboratory Department',{size:28,weight:600,anchor:'middle',fill:'#26303F'});
  if(s.email) g+=text(mid,cy0+156,s.email,{size:23,anchor:'middle',fill:'#3D4759'});
  if(s.phone) g+=text(mid,cy0+186,s.phone,{size:23,anchor:'middle',fill:'#3D4759'});

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
  const W=3200, H=1876, pad=96;
  const rows=(plan.staff||[]);
  const cols=monthCols(plan);
  const labelW=560, gridX=pad+labelW;
  const colW=(W-pad*2-labelW)/Math.max(1,cols.length);
  const gridTop=opts.gridTop||454, bandH=42, dateH=32;
  const rowH=Math.max(54,Math.min(90,((opts.gridBottom||1040)-gridTop-bandH-dateH)/Math.max(1,rows.length)));
  const gridBottom=gridTop+bandH+dateH+rowH*rows.length;

  let g='';
  g+='<rect width="'+W+'" height="'+H+'" fill="#FFFFFF"/>';
  g+=letterhead(s,{width:W,pad:pad,top:18,rule1:288});

  const title=(plan.meta&&plan.meta.period)?('Working Plan — '+plan.meta.period):(plan.label||'Working Plan');
  g+=text(W/2,368,title,{size:44,weight:700,anchor:'middle',fill:'#12203C'});
  const metaBits=[];
  if(plan.meta&&plan.meta.date) metaBits.push('Date: '+plan.meta.date);
  if(plan.meta&&plan.meta.fy) metaBits.push('FY: '+plan.meta.fy);
  if(plan.meta&&plan.meta.revised) metaBits.push('Revised');
  g+=text(W/2,412,metaBits.join('      '),{size:25,anchor:'middle',fill:'#3D4759'});
  g+=rect(pad,424,W-pad*2,2,C.goldLine);

  /* header bands */
  g+=rect(pad,gridTop,labelW,bandH,C.band);
  g+=text(pad+24,gridTop+bandH/2+9,'STAFF',{size:27,weight:700,fill:'#FFFFFF',ls:'1'});
  g+=rect(pad,gridTop+bandH,labelW,dateH,'#FFFFFF');
  g+=text(pad+24,gridTop+bandH+dateH/2+9,'Name',{size:25,weight:600,fill:'#3D4759'});
  g+=rect(pad,gridTop,labelW,bandH+dateH,'none',{stroke:'#DFE4EC',sw:1});
  cols.forEach((c,i)=>{
    const x=gridX+i*colW;
    const fill=c.weekend?'#F6EAD0':'#FFFFFF';
    g+=rect(x,gridTop,colW,bandH,fill);
    g+=rect(x,gridTop+bandH,colW,dateH,c.weekend?'#FBF1DA':'#F4F6FA');
    g+=rect(x,gridTop,colW,bandH+dateH,'none',{stroke:'#DFE4EC',sw:1});
    g+=text(x+colW/2,gridTop+bandH/2+9,SH.dowLetter(c.dow),{size:27,weight:700,anchor:'middle',fill:c.weekend?C.alInk:'#12203C'});
    g+=text(x+colW/2,gridTop+bandH+dateH/2+9,String(c.day),{size:26,weight:700,anchor:'middle',fill:c.weekend?C.alInk:'#12203C',mono:true});
  });

  /* body */
  rows.forEach((r,ri)=>{
    const y=gridTop+bandH+dateH+ri*rowH;
    g+=rect(pad,y,labelW,rowH,ri%2?'#FAFBFD':'#FFFFFF');
    g+=nameBlock(pad+24,y+rowH/2+(rowH>=70?0:9),labelW-48,r.name,{pref:31,min:20});
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
      g+=rect(x,y,colW,rowH,'none',{stroke:C.line,sw:1});
      if(st && code){
        const cSize=code.length>2?23:32;
        g+=text(x+colW/2,y+rowH/2+(code.length>2?8:10),st.label,{size:cSize,weight:700,anchor:'middle',fill:st.fg});
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

  /* rostering exceptions — printed, not remembered */
  const exceptions=staffExceptions(rows.map(r=>r.name));
  let y=gridBottom+58;
  if(exceptions.length){
    const block=drawExceptions(pad,gridBottom+52,W-pad*2,exceptions,{size:21,pitch:29});
    g+=block;
    y+=exceptionLines(exceptions,W-pad*2,21).length*29+34;
  }
  g+=text(pad,y,'Keys:',{size:26,weight:700,fill:'#12203C'});
  y+=30;
  const keys=SH.keyOrder.map(c=>CODE[c].key);
  const keyCols=6, keyW=(W-pad*2)/keyCols, keyH=54;
  keys.forEach((k,i)=>{
    const col=i%keyCols, row=Math.floor(i/keyCols);
    const x=pad+col*keyW, yy=y+row*(keyH+8);
    g+=rect(x,yy,keyW-14,keyH,'#F7F9FD',{rx:6,stroke:'#E3E8F1',sw:1});
    const code=k.split(' ')[0];
    const st=styleOf(code)||{bg:'#EEF1F7',fg:C.ink};
    g+=rect(x+12,yy+15,26,26,st.bg,{rx:4,stroke:'#DCE2EC',sw:1});
    g+=text(x+50,yy+35,k,{size:22,fill:'#26303F'});
  });
  y+=Math.ceil(keys.length/keyCols)*(keyH+8)+22;

  /* staff contacts */
  g+=text(pad,y,'Staff contacts:',{size:26,weight:700,fill:'#12203C'});
  y+=28;
  /* contact cards: name + number, two columns, gold left bar — measured off the
     printed register (66 px tall, 76 px pitch, 12 px inside padding) */
  /* card height fills the run down to the signature block (max 92 px) so the page
     never opens a white gap between contacts and signatures */
  /* Cards are spread down to the signature block, as on the printed register:
     pitch fills the run, the card itself stays compact and legible. */
  const sigTop0=1612, contactCols=3, contactRows=Math.max(1,Math.ceil(rows.length/contactCols));
  /* the contacts must stop above the signature rule, whatever the key block above
     them costs — the pitch is derived from the space that is actually left */
  const contactPitch=Math.max(58,Math.min(84,(sigTop0-20-y)/contactRows));
  const contactH=Math.min(72,contactPitch-14);
  const contactNameSize=Math.max(18,Math.min(24,contactH*0.34));
  const contactPhoneSize=Math.max(16,Math.min(21,contactH*0.28));
  const colWid=(W-pad*2)/contactCols;
  rows.forEach((r,i)=>{
    const col=i%contactCols, row=Math.floor(i/contactCols);
    const x=pad+col*colWid, yy=y+row*contactPitch+(contactPitch-contactH)/2;
    const st=LS.store.staffByName(r.name)||{};
    g+=rect(x,yy,4,contactH,C.goldLine);
    g+=rect(x+4,yy,colWid-20,contactH,'#F7F9FD',{stroke:'#E3E8F1',sw:1});
    g+=nameBlock(x+22,yy+contactH*0.42,colWid-56,r.name,{pref:contactNameSize,min:17});
    g+=text(x+22,yy+contactH-11,st.phone||'—',{size:contactPhoneSize,fill:'#5B6474'});
  });
  y+=contactRows*contactPitch+10;

  /* signatures */
  const sigTop=1612;
  g+=rect(pad,sigTop,W-pad*2,2,'#EDE3C7');
  const sigs=[
    ['Prepared by:',s.prepared||'',s.preparedRole||'Laboratory Manager'],
    ['Verified by:',s.verified||'',s.verifiedRole||'Clinical Director'],
    ['Approved by:',s.approved||'',s.approvedRole||'Human Resources Officer']
  ];
  sigs.forEach(([label,name,role],i)=>{
    const x=pad+i*((W-pad*2)/3);
    g+=text(x,1656,label,{size:21,weight:600,fill:'#12203C'});
    g+=text(x,1688,name,{size:23,weight:700,fill:'#12203C'});
    g+=text(x,1718,role,{size:19,fill:'#5B6474'});
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
  const labelW=560, gridX=pad+labelW;
  const colW=(W-pad*2-labelW)/Math.max(1,dates.length);
  const headH=48, dateH=36, rowH=92, nightH=80;
  const top=446;
  const exceptions=staffExceptions([].concat(...dates.map(iso=>Object.values(alloc[iso]||{}))).concat(Object.values(night)));
  /* A recorded override is part of the record, so the signed sheet prints it. */
  const overrides=overrideLines(data.overrides||{}, alloc);
  const noteLines=exceptionLines(exceptions,W-pad*2,21).length;
  const noteH=(exceptions.length?noteLines*29+76:0)+(overrides.length?overrides.length*29+60:0);
  const H=top+headH+dateH+rowH*services.length+nightH+noteH+150;

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
  dates.forEach((iso,i)=>{
    const d=U.parseISO(iso), we=d.getDay()===0||d.getDay()===6;
    const x=gridX+i*colW;
    g+=rect(x,top,colW,headH,we?C.creamBand:'#FFFFFF');
    g+=rect(x,top+headH,colW,dateH,we?'#F7E9C9':'#F4F6FA');
    g+=rect(x,top,colW,headH+dateH,'none',{stroke:C.line,sw:1});
    g+=text(x+colW/2,top+headH/2+10,U.DOWL[(d.getDay()+6)%7],{size:28,weight:700,anchor:'middle',fill:we?C.alInk:'#12203C'});
    g+=text(x+colW/2,top+headH+dateH/2+9,String(d.getDate()),{size:26,weight:600,anchor:'middle',fill:we?C.alInk:'#12203C',mono:true});
  });

  services.forEach((sv,ri)=>{
    const y=top+headH+dateH+ri*rowH;
    g+=rect(pad,y,labelW,rowH,'#FFFFFF');
    g+=text(pad+24,y+rowH/2+10,sv.name,{size:fitSize(sv.name,labelW-44,30,20),weight:600,fill:'#12203C'});
    dates.forEach((iso,i)=>{
      const d=U.parseISO(iso), we=d.getDay()===0||d.getDay()===6;
      const x=gridX+i*colW;
      g+=rect(x,y,colW,rowH,we?C.creamBand:'#FFFFFF');
      g+=rect(x,y,colW,rowH,'none',{stroke:C.line,sw:1});
      const who=(alloc[iso]&&alloc[iso][sv.name])||'';
        if(who){
        const ov=(data.overrides&&data.overrides[iso]&&data.overrides[iso][sv.name]);
        g+=nameBlock(x+colW/2,y+rowH/2-(ov?9:0), colW-20, who, {pref:34,min:19,anchor:'middle'});
        if(ov) g+=text(x+colW/2,y+rowH/2+26,'OVERRIDE',{size:15,weight:700,anchor:'middle',fill:C.alInk||'#8A2B33'});
      }
    });
    g+=rect(pad,y,labelW,rowH,'none',{stroke:C.line,sw:1});
  });

  const ny=top+headH+dateH+services.length*rowH;
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
  if(exceptions.length){
    g+=drawExceptions(pad,noteY,W-pad*2,exceptions,{size:21,pitch:29});
    noteY+=exceptionLines(exceptions,W-pad*2,21).length*29+36;
  }
  if(overrides.length){
    g+=text(pad,noteY,'Recorded overrides — bench rule lifted for one cell',{size:19,weight:700,fill:'#8A2B33'});
    noteY+=26;
    overrides.forEach((ln,i)=>{ g+=text(pad,noteY+i*29,ln,{size:19,fill:'#3D4759'}); });
  }

  g+=text(W/2,H-60,'Week of '+U.fmtDateShort(data.weekStart)+' · Day shift 08:00–17:00 · Night shift 17:00–08:00 the next day · Generated '+U.todayISO(),{size:24,anchor:'middle',fill:'#3D4759'});
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
  out.push({h:26,cells:[{c:0,v:s.hospital||'Ruli District Hospital',s:1}]});
  out.push({cells:[{c:0,v:(s.dept||'Laboratory Department')+' · Republic of Rwanda',s:13}]});
  out.push({cells:[{c:0,v:((s.email||'')+(s.phone?' · '+s.phone:'')),s:13}]});
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
    target.cells[col]={c:col,v:r.name+' · '+(st.phone||'—'),s:12};
  });
  out.push({cells:[]});
  out.push({cells:[{c:0,v:'Prepared by: '+(s.prepared||''),s:3},{c:2,v:'Verified by: '+(s.verified||''),s:3},{c:4,v:'Approved by: '+(s.approved||''),s:3}]});
  out.push({cells:[{c:0,v:(s.preparedRole||'')+' · '+(s.verifiedRole||'')+' · '+(s.approvedRole||''),s:13}]});
  const widths=[30].concat(cols.map(()=>3.6));
  const sheet=sheetXML(out,{cols:widths,freeze:8,merges:['A1:'+colName(nCols)+'1','A2:'+colName(nCols)+'2','A3:'+colName(nCols)+'3','A5:'+colName(nCols)+'5','A6:'+colName(nCols)+'6']});
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
