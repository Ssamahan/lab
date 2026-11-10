import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {publish} from './publisher.mjs';
const root=await mkdtemp(join(tmpdir(),'hiv-pub-test-'));const key='a'.repeat(64);
const sourcePath='hiv-readonly:report.xlsx';let calls=[];
const fetchImpl=async(url,opts)=>{calls.push({url,opts});if(opts.method==='PUT')return new Response('{}');return new Response('secret-initial-config');};
const summaryFn=({configPath})=>{assert.equal(sourcePath,'hiv-readonly:report.xlsx');return {version:1,checkedAt:'2026-11-09T12:00:00Z',records:[]};};
try{
 await publish({key,sourcePath,fetchImpl,summaryFn,tempRoot:root});
 assert.deepEqual(calls.map(x=>new URL(x.url).pathname),['/private/config','/private/config','/private/summary']);
 assert.equal(Buffer.from(calls[1].opts.body).toString(),'secret-initial-config');assert.deepEqual(await readdir(root),[]);
 calls=[];await assert.rejects(()=>publish({key,sourcePath,fetchImpl,summaryFn:()=>{throw Error('hidden');},tempRoot:root}));
 assert.deepEqual(calls.map(x=>new URL(x.url).pathname),['/private/config','/private/config']);assert.deepEqual(await readdir(root),[]);
 calls=[];const failingFetch=async(url,opts)=>{calls.push(url);if(opts.method==='PUT')return new Response('',{status:500});return new Response('secret-initial-config');};
 await assert.rejects(()=>publish({key,sourcePath,fetchImpl:failingFetch,summaryFn,tempRoot:root}));assert.equal(calls.length,2);assert.deepEqual(await readdir(root),[]);
 console.log('publisher runner: update order, failure handling and cleanup passed');
}finally{await rm(root,{recursive:true,force:true});}
