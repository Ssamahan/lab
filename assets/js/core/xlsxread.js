/* Reading a workbook back in — the district sends the HMIS return as a spreadsheet
   with one sheet per month. The app already writes .xlsx; this is the other
   direction, so the whole workbook can be brought in at once instead of a month at
   a time. A zip is read straight from the file (the central directory first, then
   each sheet through the browser's own inflater) and the cell references are
   resolved into plain rows of values. No library, nothing uploaded anywhere: the
   file never leaves the device. */
window.LSXLSX=(function(){
  const TD=typeof TextDecoder==='function'?new TextDecoder('utf-8'):null;
  const USE={decode:b=>TD?TD.decode(b):Array.prototype.map.call(b,c=>String.fromCharCode(c)).join('')};

  const u16=(dv,o)=>dv.getUint16(o,true);
  const u32=(dv,o)=>dv.getUint32(o,true);

  /* the last 66 kB is where the end-of-central-directory record lives */
  function endOfCentral(buf){
    const dv=new DataView(buf), min=Math.max(0,buf.byteLength-66000);
    for(let i=buf.byteLength-22;i>=min;i--){
      if(u32(dv,i)===0x06054b50) return {count:u16(dv,i+10),cdSize:u32(dv,i+12),cdOff:u32(dv,i+16)};
    }
    return null;
  }
  function entries(buf){
    const dv=new DataView(buf), eocd=endOfCentral(buf);
    if(!eocd) throw new Error('This file is not a workbook — it has no zip directory.');
    const out={}, at=new Uint8Array(buf);
    let p=eocd.cdOff;
    for(let n=0;n<eocd.count;n++){
      if(u32(dv,p)!==0x02014b50) break;
      const method=u16(dv,p+10), compSize=u32(dv,p+20), nameLen=u16(dv,p+28);
      const extraLen=u16(dv,p+30), commentLen=u16(dv,p+32), localOff=u32(dv,p+42);
      const name=USE.decode(at.subarray(p+46,p+46+nameLen));
      out[name]={method,compSize,localOff};
      p+=46+nameLen+extraLen+commentLen;
    }
    return out;
  }
  /* the local header repeats the name and carries its own extra field, so the data
     offset has to be taken from there rather than from the directory */
  function rawBytes(buf,ent,dir){
    const dv=new DataView(buf), lo=ent.localOff;
    if(u32(dv,lo)!==0x04034b50) throw new Error('This workbook is damaged — a sheet could not be located.');
    const nameLen=u16(dv,lo+26), extraLen=u16(dv,lo+28);
    const start=lo+30+nameLen+extraLen;
    return new Uint8Array(buf,start,ent.compSize);
  }
  async function inflate(bytes){
    if(typeof DecompressionStream!=='function') throw new Error('NOSTREAM');
    const ds=new DecompressionStream('deflate-raw');
    const stream=new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function readEntry(buf,ent){
    const raw=rawBytes(buf,ent);
    if(ent.method===0) return new Uint8Array(raw);
    if(ent.method!==8) throw new Error('This workbook uses a compression the app cannot read.');
    return inflate(raw);
  }

  function xml(bytes){
    const text=USE.decode(bytes);
    const doc=new DOMParser().parseFromString(text,'application/xml');
    if(doc.getElementsByTagName('parsererror').length) throw new Error('This workbook is damaged — a sheet could not be read.');
    return doc;
  }
  const kids=(el,name)=>Array.prototype.filter.call(el.children,c=>c.tagName===name);
  const colIndex=(ref)=>{
    const m=/^([A-Z]+)\d*$/i.exec(String(ref||''));
    if(!m) return -1;
    let n=0; const s=m[1].toUpperCase();
    for(let i=0;i<s.length;i++) n=n*26+(s.charCodeAt(i)-64);
    return n-1;
  };
  function textOf(el){
    /* a shared/inline string can be split into several runs */
    const ts=el.getElementsByTagName('t');
    let out='';
    for(let i=0;i<ts.length;i++) out+=ts[i].textContent;
    return out;
  }
  function cellValue(c,shared){
    const t=c.getAttribute('t');
    if(t==='s'){ const v=c.getElementsByTagName('v')[0]; return shared[+(v&&v.textContent)||0]||''; }
    if(t==='inlineStr'||t==='str') return textOf(c);
    if(t==='b'){ const v=c.getElementsByTagName('v')[0]; return v? v.textContent==='1' : false; }
    const v=c.getElementsByTagName('v')[0];
    if(!v) return textOf(c);
    const n=Number(v.textContent);
    return isNaN(n)?v.textContent:n;
  }
  function rowsOf(sheetDoc,shared){
    const rows=[];
    const rowEls=sheetDoc.getElementsByTagName('row');
    for(let r=0;r<rowEls.length;r++){
      const cells=rowEls[r].children, row=[];
      for(let i=0;i<cells.length;i++){
        const c=cells[i];
        if(c.tagName!=='c') continue;
        let at=colIndex(c.getAttribute('r'));
        if(at<0) at=row.length;
        row[at]=cellValue(c,shared);
      }
      for(let i=0;i<row.length;i++) if(row[i]===undefined) row[i]=null;
      rows.push(row);
    }
    return rows;
  }
  function sharedStrings(doc){
    if(!doc) return [];
    const out=[];
    const si=doc.getElementsByTagName('si');
    for(let i=0;i<si.length;i++) out.push(textOf(si[i]));
    return out;
  }
  function rels(doc){
    const map={};
    if(!doc) return map;
    const r=doc.getElementsByTagName('Relationship');
    for(let i=0;i<r.length;i++){
      const id=r[i].getAttribute('Id'), t=r[i].getAttribute('Target')||'';
      map[id]=t.replace(/^\/xl\//,'').replace(/^\//,'');
    }
    return map;
  }

  /* → [{name, rows}] in workbook order, hidden sheets skipped */
  async function readWorkbook(file){
    const buf=file instanceof ArrayBuffer?file:await file.arrayBuffer();
    const list=entries(buf);
    const get=async name=>{ const e=list[name]; return e?readEntry(buf,e):null; };

    const wbBytes=await get('xl/workbook.xml');
    if(!wbBytes) throw new Error('This file has no workbook inside it — is it really an .xlsx?');
    const wb=xml(wbBytes);
    const relBytes=await get('xl/_rels/workbook.xml.rels');
    const relMap=rels(relBytes?xml(relBytes):null);
    const ssBytes=await get('xl/sharedStrings.xml');
    const shared=ssBytes?sharedStrings(xml(ssBytes)):[];
    const sheets=[];
    const sheetEls=wb.getElementsByTagName('sheet');
    for(let i=0;i<sheetEls.length;i++){
      const el=sheetEls[i];
      const rid=(el.getAttribute('r:id')||el.getAttribute('id')||'');
      const target=relMap[rid];
      if(!target) continue;
      const path=target.indexOf('xl/')===0?target:('xl/'+target);
      const bytes=await get(path);
      if(!bytes) continue;
      sheets.push({name:(el.getAttribute('name')||('Sheet '+(i+1))).trim(),
        hidden:el.getAttribute('state')==='hidden'||el.getAttribute('state')==='veryHidden',
        rows:rowsOf(xml(bytes),shared)});
    }
    if(!sheets.length) throw new Error('No readable sheets were found in this workbook.');
    return sheets.filter(s=>!s.hidden);
  }

  return {readWorkbook};
})();
