'use strict';
const colName=index=>{let n=index+1,s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;};
function buildSnapshot(sheets,reader){
  if(!Array.isArray(sheets)||!sheets.length) throw Error('No workbook sheets');
  const months={},workbookCells={};
  for(const sheet of sheets){
    if(!sheet||typeof sheet.name!=='string'||!sheet.name||!Array.isArray(sheet.rows)||Object.hasOwn(workbookCells,sheet.name)||['__proto__','constructor','prototype'].includes(sheet.name)) throw Error('Invalid or duplicate sheet');
    const cells=[];
    sheet.rows.forEach((row,i)=>{
      if(!Array.isArray(row)) throw Error('Invalid sheet row');
      const number=row._sourceRow||i+1, formulas=row._formulas||{};
      row.forEach((value,col)=>{
        const formula=formulas[col]||'';
        if((value!==null&&value!==undefined&&value!=='')||formula) cells.push([colName(col)+number,value==null?'':value,formula]);
      });
    });
    workbookCells[sheet.name]=cells;
    if(/^data$/i.test(sheet.name.trim())) continue;
    const key=reader.monthFromName(sheet.name)||reader.monthFromRows(sheet.rows);
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key||'')) throw Error('Unrecognized month sheet: '+sheet.name);
    if(Object.hasOwn(months,key)) throw Error('Duplicate month: '+key);
    const result=reader.matchSheet(sheet.rows);
    if(!result||!result.matched||!result.values||!result.blood) throw Error('No mapped report data: '+sheet.name);
    months[key]={month:key,meta:{source:'District workbook · sheet “'+sheet.name+'”'},values:result.values,blood:result.blood,
      sourceReview:result.sourceWarnings||[],unmatched:result.unmatched||[],notes:'',lines:null};
  }
  if(!Object.keys(months).length) throw Error('No monthly reports found');
  return {months,workbookCells};
}
module.exports={buildSnapshot};
