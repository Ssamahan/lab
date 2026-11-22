const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const doc=fs.readFileSync(path.join(__dirname,'../README.md'),'utf8');
assert(!/five clicks on the crest|three clicks on the profile button/i.test(doc),'README must not publish hidden entry gestures');
assert(!/Nothing about\s+an account[^.]+is written in this repository/i.test(doc),'README must not claim shipped credentials are absent');
assert(!/clear this site's browser data/i.test(doc),'README must not suggest destructive account recovery');
assert(/browser.local gate/i.test(doc),'README must disclose browser-local authentication limitations');
console.log('public-access-docs181: entry gestures removed and local authentication limitations disclosed');
