const {JSDOM,VirtualConsole}=require('jsdom'); const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['assets/css/app.css','assets/css/modules.css','assets/css/landing.css']){
  const vc=new VirtualConsole(); const errs=[]; vc.on('jsdomError',e=>errs.push(e.message));
  const d=new JSDOM('<!doctype html><html><head><style>'+fs.readFileSync(path.join(ROOT,f),'utf8')+'</style></head><body></body></html>',{virtualConsole:vc});
  console.log(f, errs.length?errs.slice(0,2):'ok');
}
