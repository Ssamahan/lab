import assert from 'node:assert/strict';import {zipSync,strToU8} from 'fflate';import worker,{readTimeliness} from './src.mjs';
const files={'xl/workbook.xml':`<workbook><workbookPr/><sheets><sheet name="Ruli HIV Reports" r:id="rId1"/></sheets></workbook>`,'xl/_rels/workbook.xml.rels':`<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,'xl/worksheets/sheet1.xml':`<worksheet><sheetData><row><c r="C1" t="inlineStr"><is><t>Completion time</t></is></c><c r="D1" t="inlineStr"><is><t>Health Facility Name</t></is></c><c r="G1" t="inlineStr"><is><t>Reporting Month</t></is></c></row><row><c r="C2"><v>46329</v></c><c r="D2" t="inlineStr"><is><t>Coko HC</t></is></c><c r="G2" t="inlineStr"><is><t>October</t></is></c><c r="H2" t="inlineStr"><is><t>DO NOT EXPOSE TEST DATA</t></is></c></row><row><c r="C3"><v>46333</v></c><c r="D3" t="inlineStr"><is><t>Coko HC</t></is></c><c r="G3" t="inlineStr"><is><t>October</t></is></c></row></sheetData></worksheet>`};
const bytes=zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)])));
const records=readTimeliness(bytes);assert.equal(records.length,1);assert.equal(records[0].period,'2026-10');assert.equal(records[0].responses,2);assert.equal(records[0].completed,'2026-11-03T00:00:00');assert(!JSON.stringify(records).includes('DO NOT EXPOSE'));
const res=await worker.fetch(new Request('https://example.com/'),{});assert.equal(res.status,503);assert(!JSON.stringify(await res.json()).includes('SOURCE_URL'));
assert.throws(()=>readTimeliness(strToU8('not a zip')));
const oldFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes,{status:200});
const live=await worker.fetch(new Request('https://example.com/'),{SOURCE_URL:'https://1drv.ms/example?secret=do-not-print'});assert.equal(live.status,200);const result=await live.text();assert(!result.includes('DO NOT EXPOSE')&&!result.includes('do-not-print'));assert.equal(JSON.parse(result).records.length,1);globalThis.fetch=oldFetch;
// Diagnostics never expose link, redirect locations, workbook or headers.
const messages=[];const oldError=console.error;console.error=(...args)=>messages.push(args.join(' '));
let calls=0;globalThis.fetch=async (_url,opts)=>{calls++;if(opts.redirect==='manual')return new Response(null,{status:302,headers:{location:'https://untrusted.example/private?token=hidden'}});return new Response('',{status:401});};
const diagnostic=await worker.fetch(new Request('https://example.com/?diagnose=redirects'),{SOURCE_URL:'https://1drv.ms/example?token=hidden'});
assert.equal(diagnostic.status,503);assert.equal(calls,2);assert(messages.some(x=>x.includes('short-link:302 -> blocked-unrecognized-destination')));assert(!messages.join(' ').includes('hidden'));assert(!(await diagnostic.text()).includes('hidden'));
globalThis.fetch=oldFetch;console.error=oldError;
console.log('feed: synthetic workbook, duplicate handling, privacy filtering and fail-closed passed');
