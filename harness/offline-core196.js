'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
for(const name of ['crypto.js','admin-transport.js','watchdog.js']){
 assert(html.includes('assets/js/core/'+name+'?v=6.9.178'),'missing page script '+name);
 assert(sw.includes('./assets/js/core/'+name+'?v=6.9.178'),'missing offline core '+name);
}
console.log('offline-core196: merged authentication and sync scripts are precached');
