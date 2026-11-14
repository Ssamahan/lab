import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const dir=mkdtempSync(join(tmpdir(),'lab-preview-test-'));
try{
 const result=spawnSync(process.execPath,[join(root,'scripts/build-lab-preview.mjs'),dir],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const headers=readFileSync(join(dir,'_headers'),'utf8');
 assert.match(headers,/connect-src 'self'/); assert.match(headers,/worker-src 'none'/); assert.match(headers,/form-action 'self'/);
 const html=readFileSync(join(dir,'index.html'),'utf8');
 assert.match(html,/PREVIEW ONLY/i); assert.match(html,/live services are blocked/i);
 assert(existsSync(join(dir,'assets/js/modules/roster.js')));
 assert(!existsSync(join(dir,'sw.js'))); assert(!existsSync(join(dir,'workers'))); assert(!existsSync(join(dir,'private-deliverables')));
 const lab=JSON.parse(readFileSync(join(root,'preview/lab.json'),'utf8'));
 assert.equal(lab.name,'lab'); assert.deepEqual(lab.previews,{}); assert.equal(lab.assets.directory,'../.preview-assets');
 const hiv=JSON.parse(readFileSync(join(root,'workers/hiv-publisher/wrangler.jsonc'),'utf8'));
 assert.equal(hiv.previews.d1_databases[0].binding,'STATE');
 assert.equal(hiv.previews.d1_databases[0].database_id,'fbf856b8-f1d5-4a41-a603-824e9d490afd');
 assert.notEqual(hiv.previews.d1_databases[0].database_id,hiv.d1_databases[0].database_id);
 assert(!('vars' in hiv.previews));
 console.log('Preview build: isolated static assets and separate HIV D1 configuration verified.');
}finally{rmSync(dir,{recursive:true,force:true});}
