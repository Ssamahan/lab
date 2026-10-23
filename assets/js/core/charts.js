/* ============================================================================
   LAB SYSTEMS · CHARTS — hand-built SVG, no dependencies, animated + accessible
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU; const C={}; window.LS=window.LS||{}; LS.charts=C;
const NS='http://www.w3.org/2000/svg';

/* ——— helpers ————————————————————————————— */
function smoothPath(pts){
  if(!pts.length) return '';
  if(pts.length===1) return 'M'+pts[0][0]+' '+pts[0][1];
  let d='M'+pts[0][0].toFixed(2)+' '+pts[0][1].toFixed(2);
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||p2;
    const t=0.18;
    const c1x=p1[0]+(p2[0]-p0[0])*t, c1y=p1[1]+(p2[1]-p0[1])*t;
    const c2x=p2[0]-(p3[0]-p1[0])*t, c2y=p2[1]-(p3[1]-p1[1])*t;
    d+=' C'+c1x.toFixed(2)+' '+c1y.toFixed(2)+','+c2x.toFixed(2)+' '+c2y.toFixed(2)+','+p2[0].toFixed(2)+' '+p2[1].toFixed(2);
  }
  return d;
}
function niceMax(v){ if(v<=5) return 5; const p=Math.pow(10,Math.floor(Math.log10(v))); return Math.ceil(v/p*2)/2*p; }
function gradId(seed){ return 'g'+Math.abs(U.hash(String(seed))).toString(36); }

/* ——— Sparkline ——————————————————————————— */
C.spark=(values,opts)=>{
  opts=opts||{};
  const W=100,H=32,pad=3; const v=values&&values.length?values:[0,0,0];
  const min=Math.min.apply(null,v), max=Math.max.apply(null,v), rng=(max-min)||1;
  const pts=v.map((val,i)=>[pad+i*((W-pad*2)/(v.length-1||1)), H-pad-((val-min)/rng)*(H-pad*2)]);
  const d=smoothPath(pts); const gid=gradId(opts.seed||d+min);
  const color=opts.color||'var(--gold)';
  return '<svg class="spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true">'
   +'<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity=".28"/><stop offset="100%" stop-color="'+color+'" stop-opacity="0"/></linearGradient></defs>'
   +'<path d="'+d+' L'+(W-pad)+' '+H+' L'+pad+' '+H+' Z" fill="url(#'+gid+')"/>'
   +'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.4" stroke-linecap="round" pathLength="1" class="draw-in" style="animation-duration:1.6s"/>'
   +'<circle cx="'+pts[pts.length-1][0].toFixed(1)+'" cy="'+pts[pts.length-1][1].toFixed(1)+'" r="1.8" fill="'+color+'"/>'
   +'</svg>';
};

/* ——— Line / area chart with crosshair ————— */
C.line=function(el,cfg){
  if(!el) return;
  const series=cfg.series||[]; const labels=cfg.labels||[];
  const n=Math.max.apply(null,series.map(s=>s.values.length).concat([labels.length]));
  if(!n){ el.innerHTML='<div class="chart-empty">No data in this window</div>'; return; }
  const W=760, H=cfg.height||236, pad={l:cfg.padLeft||44,r:16,t:16,b:30};
  let all=[]; series.forEach(s=>s.values.forEach(v=>{ if(v!=null&&!isNaN(v)) all.push(v); }));
  const tgt=cfg.target==null?null:(typeof cfg.target==='number'?{value:cfg.target}:cfg.target);
  if(tgt&&tgt.value!=null) all.push(tgt.value);
  let min=cfg.min!=null?cfg.min:Math.min.apply(null,all.concat([0]));
  let max=cfg.max!=null?cfg.max:niceMax(Math.max.apply(null,all));
  if(max===min) max=min+1;
  if(cfg.min==null && cfg.zeroBase!==false) min=Math.min(0,min);
  const X=i=>pad.l+(i*(W-pad.l-pad.r)/(Math.max(1,n-1)));
  const Y=v=>pad.t+(max-v)/(max-min)*(H-pad.t-pad.b);
  const ticks=cfg.yTicks||4; let grid='';
  for(let i=0;i<=ticks;i++){ const val=min+(max-min)*i/ticks, y=Y(val);
    grid+='<line class="grid" x1="'+pad.l+'" x2="'+(W-pad.r)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'"/>';
    grid+='<text x="'+(pad.l-8)+'" y="'+(y+3).toFixed(1)+'" text-anchor="end">'+U.esc(cfg.yFmt?cfg.yFmt(val):U.fmtNum(Math.round(val)))+'</text>';
  }
  /* The first and last labels are anchored inside the plot instead of centred on
     the tick, so the first quarter never sits on top of the axis "0" and the last
     never runs off the right edge. */
  let xlab='';
  const step=Math.ceil(n/7);
  labels.forEach((lb,i)=>{
    if(!(i%step===0 || i===n-1)) return;
    const anchor=i===0?'start':(i===n-1?'end':'middle');
    let x=X(i); if(i===0) x+=2; if(i===n-1) x-=2;
    xlab+='<text x="'+x.toFixed(1)+'" y="'+(H-8)+'" text-anchor="'+anchor+'">'+U.esc(lb)+'</text>';
  });
  let defs='', paths='', dots='';
  series.forEach((s,si)=>{
    const gid=gradId((cfg.id||'ln')+s.name+si);
    if(s.area!==false) defs+='<linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+s.color+'" stop-opacity=".22"/><stop offset="92%" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient>';
    /* A missing value is a gap, never a zero. Running the line through the floor
       would claim a score that was never recorded — so each run of real points is
       drawn as its own segment and the gap is simply left blank. */
    const segs=[]; let run=[];
    s.values.forEach((v,i)=>{
      if(v==null||isNaN(v)){ if(run.length) segs.push(run); run=[]; return; }
      run.push([X(i),Y(v)]);
    });
    if(run.length) segs.push(run);
    if(!segs.length) return;
    segs.forEach((pts,pi)=>{
      if(pts.length===1){
        paths+='<circle cx="'+pts[0][0].toFixed(1)+'" cy="'+pts[0][1].toFixed(1)+'" r="3.4" fill="'+s.color+'" opacity=".9"/>';
        return;
      }
      const d=smoothPath(pts);
      if(s.area!==false && segs.length===1) paths+='<path d="'+d+' L'+pts[pts.length-1][0].toFixed(1)+' '+(H-pad.b)+' L'+pts[0][0].toFixed(1)+' '+(H-pad.b)+' Z" fill="url(#'+gid+')" class="area"/>';
      if(s.dashed) paths+='<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="1.4" stroke-dasharray="4 4" opacity=".7"/>';
      else paths+='<path class="path-line" d="'+d+'" stroke="'+s.color+'" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1;animation:drawIn '+(cfg.drawMs||1500)+'ms var(--ease) forwards'+(pi?'':'')+'"/>';
    });
  });
  let targetLine='';
  if(tgt&&tgt.value!=null){
    targetLine='<line x1="'+pad.l+'" x2="'+(W-pad.r)+'" y1="'+Y(tgt.value).toFixed(1)+'" y2="'+Y(tgt.value).toFixed(1)+'" style="stroke:var(--pos);stroke-width:1;stroke-dasharray:5 4;opacity:.65"/>'
      +'<text x="'+(W-pad.r)+'" y="'+(Y(tgt.value)-5).toFixed(1)+'" text-anchor="end" style="fill:var(--pos);font-size:9px">'+U.esc(tgt.label||'target')+'</text>';
  }
  let bandEls='';
  (cfg.bands||[]).forEach(b=>{ const y1=Y(Math.max(b.from,b.to)), y2=Y(Math.min(b.from,b.to));
    bandEls+='<rect x="'+pad.l+'" y="'+y1.toFixed(1)+'" width="'+(W-pad.l-pad.r)+'" height="'+Math.max(1,y2-y1).toFixed(1)+'" fill="'+(b.color||'rgba(201,168,76,.06)')+'"/>';
  });
  const svg='<svg class="chart-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="'+(cfg.aria||'chart')+'">'
    +'<defs>'+defs+'</defs>'+bandEls+grid+targetLine+paths+xlab
    +'<line class="crosshair" id="'+(cfg.id||'ch')+'-cross" x1="0" x2="0" y1="'+pad.t+'" y2="'+(H-pad.b)+'" style="opacity:0"/>'
    +'<g id="'+(cfg.id||'ch')+'-dots"></g>'
    +'<rect x="'+pad.l+'" y="'+pad.t+'" width="'+(W-pad.l-pad.r)+'" height="'+(H-pad.t-pad.b)+'" fill="transparent" id="'+(cfg.id||'ch')+'-hit" style="cursor:crosshair"/>'
    +'</svg><div class="chart-tip" id="'+(cfg.id||'ch')+'-tip"></div>';
  el.innerHTML='<div class="chart-wrap">'+svg+'</div>';
  const hit=el.querySelector('#'+(cfg.id||'ch')+'-hit'), cross=el.querySelector('#'+(cfg.id||'ch')+'-cross'),
        tip=el.querySelector('#'+(cfg.id||'ch')+'-tip'), dotg=el.querySelector('#'+(cfg.id||'ch')+'-dots');
  let active=-1;
  const hide=()=>{ cross.style.opacity=0; tip.classList.remove('on'); dotg.innerHTML=''; active=-1; };
  const show=(i)=>{
    if(i<0||i>=n) return;
    active=i; const x=X(i); cross.setAttribute('x1',x); cross.setAttribute('x2',x); cross.style.opacity=.7;
    let rows='';
    dotg.innerHTML=series.map(s=>{ const v=s.values[i]; if(v==null) return '';
      return '<circle cx="'+x.toFixed(1)+'" cy="'+Y(v).toFixed(1)+'" r="3.2" fill="'+s.color+'" class="dot-mark"/>'; }).join('');
    rows=series.map(s=>{ const v=s.values[i]; if(v==null) return '';
      return '<div class="tr"><span class="k"><span class="sw" style="background:'+s.color+'"></span>'+U.esc(s.name)+'</span><span class="v">'+(cfg.tipFmt?cfg.tipFmt(v,s):U.fmtNum(v))+'</span></div>'; }).join('');
    const extra=cfg.extraTip?cfg.extraTip(i):'';
    tip.innerHTML='<div class="tt">'+U.esc(labels[i]||'')+'</div>'+rows+extra;
    tip.style.left=(x/W*100)+'%'; tip.style.top=(Y(series[0]?series[0].values[i]:min)/H*100)+'%';
    tip.classList.add('on');
  };
  const move=e=>{
    const r=hit.getBoundingClientRect(); const px=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
    const vx=px/r.width*W; const i=U.clamp(Math.round((vx-pad.l)/((W-pad.l-pad.r)/Math.max(1,n-1))),0,n-1);
    if(i!==active) show(i);
  };
  hit.addEventListener('mousemove',move); hit.addEventListener('touchmove',move,{passive:true});
  hit.addEventListener('mouseleave',hide); hit.addEventListener('touchend',hide);
  if(cfg.defaultIndex!=null) show(cfg.defaultIndex);
};

/* ——— Ranked horizontal bars with target markers ——— */
/* Horizontal bars are HTML, not SVG, so the export path asks for this static
   rendering of the same numbers when someone wants a picture of it. */
C.barSVG=function(items,opts){
  opts=opts||{};
  /* Drawn for paper, not for the dark console: ink labels, a pale track and the
     same tone colours the screen uses, on a white sheet. */
  const W=760, rowH=34, pad={l:210,r:104,t:opts.title?44:18,b:20};
  const H=pad.t+pad.b+items.length*rowH;
  const max=Math.max.apply(null,items.map(i=>i.value).concat([1]));
  const toneColor={gold:'#C9A84C',teal:'#3FB3A6',rose:'#E26D6D',amber:'#D9A13B',blue:'#7595C8',g1:'#3FA57E',g2:'#17A97B',r1:'#E29AA2',r2:'#A3212E',slate:'#8C93A3'};
  let out='<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="#FFFFFF"/>';
  if(opts.title) out+='<text x="24" y="30" font-family="Georgia,serif" font-size="17" fill="#1B1F27">'+U.esc(opts.title)+'</text>';
  items.forEach((it,i)=>{
    const y=pad.t+i*rowH+rowH/2;
    const w=Math.max(2,(it.value/max)*(W-pad.l-pad.r));
    out+='<text x="24" y="'+(y+4)+'" font-family="system-ui,sans-serif" font-size="12" fill="#3A4250">'+U.esc(String(it.label).slice(0,30))+'</text>';
    out+='<rect x="'+pad.l+'" y="'+(y-7)+'" width="'+(W-pad.l-pad.r)+'" height="14" rx="7" fill="rgba(9,14,26,.07)"/>';
    out+='<rect x="'+pad.l+'" y="'+(y-7)+'" width="'+w.toFixed(1)+'" height="14" rx="7" fill="'+(toneColor[it.tone]||toneColor.gold)+'"/>';
    const label=(it.display!=null?it.display:U.fmtNum(it.value))+(it.suffix?' '+it.suffix:'');
    out+='<text x="'+(pad.l+w+10)+'" y="'+(y+4)+'" font-family="ui-monospace,monospace" font-size="11.5" fill="#1B1F27">'+U.esc(label)+'</text>';
    if(it.target!=null){
      const tx=pad.l+(it.target/max)*(W-pad.l-pad.r);
      out+='<line x1="'+tx.toFixed(1)+'" x2="'+tx.toFixed(1)+'" y1="'+(y-11)+'" y2="'+(y+11)+'" stroke="#8A93A5" stroke-width="1" stroke-dasharray="2 2"/>';
    }
  });
  return {svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">'+out+'</svg>', width:W, height:H};
};
C.hbars=function(el,cfg){
  if(!el) return;
  const items=(cfg.items||[]).slice(0,cfg.limit||8);
  el.__chartCfg={type:'bars',items,limit:cfg.limit||8};
  el.setAttribute('data-chart','bars');
  if(!el.style.position) el.style.position='relative';
  if(!items.length){ el.innerHTML='<div class="chart-empty">No data</div>'; return; }
  const max=Math.max.apply(null,items.map(i=>i.value).concat([1]));
  el.innerHTML='<div style="display:flex;flex-direction:column;gap:'+(cfg.gap||11)+'px">'+items.map((it,i)=>{
    const w=it.value/max*100, tone=it.tone||'gold';
    const colors={gold:'linear-gradient(90deg,var(--gold-600),var(--gold-300))',teal:'linear-gradient(90deg,var(--teal-700),var(--teal-400))',rose:'linear-gradient(90deg,var(--rose-600),var(--rose-300))',amber:'linear-gradient(90deg,var(--amber-600),var(--amber-300))',blue:'linear-gradient(90deg,#3F5F96,#7595C8)'};
    return '<div class="reveal" style="--i:'+i+'">'
     +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:4px">'
     +'<span style="font-size:11.6px;color:var(--text);display:flex;align-items:center;gap:6px">'+(it.icon?U.ic(it.icon,12):'')+U.esc(it.label)+'</span>'
     +'<span class="mono" style="font-size:11px;color:var(--text-muted)">'+U.esc(it.display!=null?it.display:U.fmtNum(it.value))+(it.suffix?' <span class="faint">'+U.esc(it.suffix)+'</span>':'')+'</span></div>'
     +'<div style="position:relative;height:6px;border-radius:99px;background:var(--surface-3);overflow:visible">'
     +'<div style="height:100%;border-radius:99px;background:'+colors[tone]+';width:'+(cfg.animate===false?w:'0%')+';transition:width .7s var(--spring) '+(i*45)+'ms" data-bar="'+w+'"></div>'
     +(it.target!=null?'<span data-tip="Target '+it.target+'" style="position:absolute;top:-2px;bottom:-2px;left:'+(it.target/max*100)+'%;width:1px;background:var(--text-faint);opacity:.7"></span>':'')
     +(it.marker!=null?'<span style="position:absolute;top:-3px;width:7px;height:12px;border-radius:2px;background:var(--pos);left:calc('+(it.marker/max*100)+'% - 3px);box-shadow:0 0 0 2px var(--surface)"></span>':'')
     +'</div></div>';
  }).join('')+'</div>';
  requestAnimationFrame(()=>{ U.$$('[data-bar]',el).forEach(b=>{ b.style.width=b.dataset.bar+'%'; }); });
};

/* ——— Ring gauge ——————————————————————— */
C.ring=(pct,cfg)=>{
  cfg=cfg||{}; const size=cfg.size||92, sw=cfg.stroke||6, r=(size-sw)/2, c=2*Math.PI*r;
  const p=U.clamp(pct,0,100);
  const color=cfg.color||(p>=95?'var(--pos)':p>=85?'var(--gold)':p>=70?'var(--warn)':'var(--crit)');
  return '<div class="score-ring" style="width:'+size+'px;height:'+size+'px">'
   +'<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" style="transform:rotate(-90deg)">'
   +'<circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="var(--surface-3)" stroke-width="'+sw+'"/>'
   +'<circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+(c-(p/100)*c)+'" style="transition:stroke-dashoffset 1.1s var(--spring)"/>'
   +'</svg><span class="val">'+(cfg.label||p+'<span style="font-size:.55em">%</span>')+'</span></div>';
};

/* ——— Heatmap ————————————————————————— */
C.heat=function(el,cfg){
  if(!el) return;
  el.setAttribute('data-chart','heat');
  const values=cfg.values||[]; const max=Math.max.apply(null,values.concat([1]));
  const tone=cfg.tone||'201,168,76';
  el.innerHTML='<div class="heat" style="grid-template-rows:repeat(7,1fr);grid-auto-flow:column">'
   +values.map((v,i)=>{ const a=v===null?0:(0.06+v/max*0.88);
     return '<div class="heat-cell" data-tip="'+U.esc((cfg.tips&&cfg.tips[i])||v)+'" style="background:rgba('+tone+','+a.toFixed(2)+');'+(v===null?'opacity:.25':'')+'"></div>'; }).join('')
   +'</div>';
};

/* ——— Levey–Jennings QC chart ——————————————— */
C.lj=function(el,cfg){
  if(!el) return;
  const pts=cfg.points||[]; const mean=cfg.mean, sd=cfg.sd;
  if(!pts.length){ el.innerHTML='<div class="chart-empty">No QC runs recorded</div>'; return; }
  const W=760,H=cfg.height||250,pad={l:44,r:16,t:14,b:26};
  const lo=mean-4*sd, hi=mean+4*sd;
  const X=i=>pad.l+i*(W-pad.l-pad.r)/Math.max(1,pts.length-1);
  const Y=v=>pad.t+(hi-v)/(hi-lo)*(H-pad.t-pad.b);
  let bands='';
  [[1,.05],[2,.07],[3,.09]].forEach(([k,op])=>{
    bands+='<rect x="'+pad.l+'" y="'+Y(mean+k*sd).toFixed(1)+'" width="'+(W-pad.l-pad.r)+'" height="'+Math.abs(Y(mean)-Y(mean+k*sd)).toFixed(1)+'" fill="rgba(63,211,182,'+op+')"/>';
    bands+='<rect x="'+pad.l+'" y="'+Y(mean).toFixed(1)+'" width="'+(W-pad.l-pad.r)+'" height="'+Math.abs(Y(mean)-Y(mean-k*sd)).toFixed(1)+'" fill="rgba(63,211,182,'+op+')"/>';
  });
  let lines='';
  for(let k=-4;k<=4;k++){ const y=Y(mean+k*sd);
    lines+='<line class="'+(k===0?'lj-target':'lj-limit')+'" x1="'+pad.l+'" x2="'+(W-pad.r)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'"/>';
    lines+='<text x="'+(pad.l-7)+'" y="'+(y+3).toFixed(1)+'" text-anchor="end">'+(k===0?'mean':(k>0?'+':'')+k+'SD')+'</text>';
  }
  const path=pts.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(p.value).toFixed(1)).join(' ');
  let xl=''; pts.forEach((p,i)=>{ if(i%4===0||i===pts.length-1) xl+='<text x="'+X(i).toFixed(1)+'" y="'+(H-7)+'" text-anchor="middle">'+U.esc(U.fmtDateShort(p.date).split(' ')[0])+'</text>'; });
  const dots=pts.map((p,i)=>{ const z=p.z||0, viol=Math.abs(z)>=3, warn=Math.abs(z)>=2;
    const col=viol?'var(--crit)':warn?'var(--warn)':'var(--gold)';
    return '<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(p.value).toFixed(1)+'" r="'+(viol?4.2:3)+'" fill="'+col+'" stroke="var(--surface)" stroke-width="1.5" data-tip="'+U.esc(U.fmtDate(p.date)+' · '+(p.z>0?'+':'')+p.z+' SD · '+(viol?'1-3s violation':warn?'2-2s warning':'in control'))+'"/>'; }).join('');
  el.innerHTML='<div class="chart-wrap"><svg class="chart-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="Levey Jennings control chart">'
    +bands+lines
    +'<path d="'+path+'" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linejoin="round" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1;animation:drawIn 1.5s var(--ease) forwards"/>'
    +dots+xl+'</svg></div>';
};

/* ——— Dual axis: bars + line ————————————————— */
C.dual=function(el,cfg){
  if(!el) return;
  const labels=cfg.labels||[], bars=cfg.bars||[], line=cfg.line||[];
  const W=760,H=cfg.height||230,pad={l:44,r:44,t:14,b:26};
  const maxB=Math.max.apply(null,bars.concat([1]))*1.15, maxL=Math.max.apply(null,line.concat([1]))*1.2;
  const n=labels.length||1;
  const bw=(W-pad.l-pad.r)/n;
  const YB=v=>pad.t+(1-v/maxB)*(H-pad.t-pad.b);
  const YL=v=>pad.t+(1-v/maxL)*(H-pad.t-pad.b);
  let grid=''; for(let i=0;i<=3;i++){ const y=pad.t+i*(H-pad.t-pad.b)/3; grid+='<line class="grid" x1="'+pad.l+'" x2="'+(W-pad.r)+'" y1="'+y+'" y2="'+y+'"/>';
    grid+='<text x="'+(pad.l-7)+'" y="'+(y+3)+'" text-anchor="end">'+U.fmtNum(Math.round(maxB*(1-i/3)))+'</text>';
    grid+='<text x="'+(W-pad.r+7)+'" y="'+(y+3)+'" style="fill:var(--gold)">'+U.fmtNum(Math.round(maxL*(1-i/3)))+'</text>'; }
  const barEls=bars.map((v,i)=>'<rect x="'+(pad.l+i*bw+bw*0.22).toFixed(1)+'" y="'+YB(v).toFixed(1)+'" width="'+(bw*0.56).toFixed(1)+'" height="'+Math.max(1,(H-pad.b-YB(v))).toFixed(1)+'" rx="2.5" fill="rgba(201,168,76,.42)" data-tip="'+U.esc(labels[i]+' · used '+U.fmtNum(v))+'"/>').join('');
  const pts=line.map((v,i)=>[pad.l+i*bw+bw/2, YL(v)]);
  const d=smoothPath(pts);
  let xl=''; labels.forEach((l,i)=>{ if(i%Math.ceil(n/8)===0||i===n-1) xl+='<text x="'+(pad.l+i*bw+bw/2).toFixed(1)+'" y="'+(H-7)+'" text-anchor="middle">'+U.esc(l)+'</text>'; });
  el.innerHTML='<div class="chart-wrap"><svg class="chart-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+grid+barEls
   +'<path d="'+d+'" fill="none" stroke="var(--pos)" stroke-width="1.8" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1;animation:drawIn 1.5s var(--ease) forwards"/>'
   +pts.map(p=>'<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="2.4" fill="var(--pos)"/>').join('')+xl+'</svg></div>';
};

/* ——— Tiny inline bar set ————————————————— */
C.barsInline=(values,tone)=>{
  const max=Math.max.apply(null,values.concat([1]));
  return '<span style="display:inline-flex;align-items:flex-end;gap:1.5px;height:16px">'+values.map(v=>'<i style="display:block;width:3px;border-radius:1px;height:'+Math.max(2,v/max*16)+'px;background:'+(tone||'var(--gold)')+';opacity:'+(0.35+v/max*0.65).toFixed(2)+'"></i>').join('')+'</span>';
};
})();
