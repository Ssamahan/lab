import {cpSync,existsSync,mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(process.argv[2]||join(root,'.preview-assets'));
// Never erase an existing directory: a preview build must not overwrite local work.
if(existsSync(out)&&readdirSync(out).length) throw Error('Preview output directory must be empty: '+out);
mkdirSync(out,{recursive:true});
cpSync(join(root,'assets'),join(out,'assets'),{recursive:true});
for(const file of ['manifest.json','check.html','reset.html']) cpSync(join(root,file),join(out,file));
const html=readFileSync(join(root,'index.html'),'utf8');
if(!html.includes('<body>')) throw Error('Expected body tag missing');
const banner='<div role="status" style="position:fixed;z-index:2147483647;bottom:0;left:0;right:0;background:#7c2d12;color:white;text-align:center;padding:6px;font:600 13px sans-serif">PREVIEW ONLY — live services are blocked; changes stay in this browser.</div>';
writeFileSync(join(out,'index.html'),html.replace('<body>','<body>'+banner));
// Cloudflare applies this response policy to all preview assets, including workers.
// Same-origin fetches still load the local assets; external sync and APIs are blocked.
const policy="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; object-src 'none'; form-action 'self'; base-uri 'self'";
writeFileSync(join(out,'_headers'),'/*\n  Content-Security-Policy: '+policy+'\n  X-Robots-Tag: noindex, nofollow\n');
console.log('Built offline-only lab preview in '+out);
