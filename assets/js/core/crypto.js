/* ============================================================================
   LAB SYSTEMS · CRYPTO — password hashing and one-time codes, over WebCrypto
   ----------------------------------------------------------------------------
   Zero dependencies on the rest of the console, on purpose: this file must be
   loadable (and testable) on its own, because everything that protects an
   account flows through it.

   Passwords — PBKDF2-HMAC-SHA256, 310 000 iterations, 16-byte salt, 32-byte key.
   Stored format:  pbkdf2$310000$<salt hex>$<hash hex>
   The old build stored one unsalted SHA-256 pass in a public repository, which
   is a dictionary attack with the dictionary already written for you. A slow,
   salted derivation is the honest minimum for a credential that ships in code.

   One-time codes — RFC 6238 TOTP, 30-second steps, 6 digits, compared with a
   one-step clock window. SHA-1 is the algorithm every authenticator app
   implements (the URI says so explicitly); for a 6-digit code it is in no
   practical way weaker than SHA-256, and compatibility at 03:00 matters more.
   The secret lives with the account record on
   this device, so the factor defends the published password list, not a stolen
   unlocked phone. Security Center says so in plain words.
   ========================================================================== */
(function(){
'use strict';
/* WebCrypto resolves lazily, at the moment a password or code operation runs — not at
   script load. A console on an http page (or in a stripped test environment) must still
   boot and show its public view; only the sign-in needs a secure context, and only the
   sign-in explains why it cannot proceed. */
function subtle(){
  const s=(globalThis.crypto&&globalThis.crypto.subtle)||(typeof window!=='undefined'&&window.crypto&&window.crypto.subtle);
  if(!s) throw new Error('WebCrypto is not available here — sign-in needs a secure context (https or localhost).');
  return s;
}

const ITERATIONS=310000, STEP=30, DIGITS=6;

/* UTF-8 without leaning on TextEncoder: every browser has it, but a stripped-down
   environment (a test realm, an old webview) should still be able to verify a password
   rather than crash on the first byte. */
function utf8(str){
  const s=String(str);
  if(typeof TextEncoder!=='undefined') return new TextEncoder().encode(s);
  const latin=encodeURIComponent(s).replace(/%([0-9A-F]{2})/g,(_,p)=>String.fromCharCode(parseInt(p,16)));
  return Uint8Array.from(latin, c=>c.charCodeAt(0));
}

function bytesToHex(b){ return Array.prototype.map.call(b,x=>('0'+x.toString(16)).slice(-2)).join(''); }
function hexToBytes(h){ const out=new Uint8Array(h.length/2); for(let i=0;i<out.length;i++) out[i]=parseInt(h.substr(i*2,2),16); return out; }

/* A salt is 16 random bytes; a secret is 20 (RFC 4226 recommends ≥160 bits). */
function randomHex(n){ const b=new Uint8Array(n); crypto.getRandomValues(b); return bytesToHex(b); }

async function pbkdf2(password, saltHex, iterations){
  const it=Number(iterations)||ITERATIONS;
  const key=await subtle().importKey('raw', utf8(password), 'PBKDF2', false, ['deriveBits']);
  const bits=await subtle().deriveBits({name:'PBKDF2', hash:'SHA-256', salt:hexToBytes(String(saltHex)), iterations:it}, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

/* Full stored-string helpers — derive a fresh record, and compare one. */
function encode(iterations, saltHex, hashHex){ return 'pbkdf2$'+iterations+'$'+saltHex+'$'+hashHex; }
function decode(stored){
  const m=/^pbkdf2\$(\d+)\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(String(stored||''));
  return m?{iterations:+m[1], salt:m[2], hash:m[3]}:null;
}
function isModern(stored){ return !!decode(stored); }
function isLegacy(stored){ return /^[0-9a-f]{64}$/.test(String(stored||'')); }

/* Same length, same position, every byte — without short-circuiting on the
   first difference. Hashes are compared by attackers with oracles; this closes
   the cheapest one. */
function equalHex(a,b){
  a=String(a||''); b=String(b||'');
  if(a.length!==b.length) return false;
  let diff=0;
  for(let i=0;i<a.length;i++) diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}

async function hashPassword(password){
  const salt=randomHex(16);
  const hash=await pbkdf2(password, salt, ITERATIONS);
  return encode(ITERATIONS, salt, hash);
}
async function verifyPassword(password, stored){
  const rec=decode(stored);
  if(!rec) return false;
  const given=await pbkdf2(password, rec.salt, rec.iterations);
  return equalHex(given, rec.hash);
}

/* ——— RFC 4648 base32 ———————————————————————————————————————— */
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32encode(bytes){
  let out='', bits=0, val=0;
  for(let i=0;i<bytes.length;i++){
    val=(val<<8)|bytes[i]; bits+=8;
    while(bits>=5){ out+=B32[(val>>>(bits-5))&31]; bits-=5; }
  }
  if(bits>0) out+=B32[(val<<(5-bits))&31];
  return out;
}
function b32decode(str){
  const clean=String(str||'').toUpperCase().replace(/[^A-Z2-7]/g,'');
  let bits=0, val=0; const out=[];
  for(let i=0;i<clean.length;i++){
    val=(val<<5)|B32.indexOf(clean[i]); bits+=5;
    if(bits>=8){ out.push((val>>>(bits-8))&255); bits-=8; }
  }
  return new Uint8Array(out);
}

function newTotpSecret(){ return b32encode(crypto.getRandomValues(new Uint8Array(20))); }

/* RFC 6238: HMAC over the big-endian step counter, dynamic truncation.
   SHA-1, for the reason in the header. */
async function totpAt(secretB32, counter){
  const key=await subtle().importKey('raw', b32decode(secretB32), {name:'HMAC', hash:'SHA-1'}, false, ['sign']);
  const msg=new ArrayBuffer(8); const dv=new DataView(msg);
  dv.setUint32(0, Math.floor(counter/0x100000000)); dv.setUint32(4, counter>>>0);
  const mac=new Uint8Array(await subtle().sign('HMAC', key, msg));
  const o=mac[mac.length-1]&0xf;
  const bin=((mac[o]&0x7f)<<24)|(mac[o+1]<<16)|(mac[o+2]<<8)|mac[o+3];
  const mod=Math.pow(10, DIGITS);
  return ('0'+(bin%mod)).slice(-DIGITS);
}

/* The current code, or verification across ±1 step: a phone clock a few seconds
   off must not lock a technologist out of the register at 03:00. */
async function totp(secretB32, atMs){
  return totpAt(secretB32, Math.floor((atMs==null?Date.now():atMs)/1000/STEP));
}
async function totpVerify(secretB32, code, atMs){
  const c=String(code==null?'':code).replace(/\s+/g,'');
  if(!/^\d{6}$/.test(c)) return false;
  const counter=Math.floor((atMs||Date.now())/1000/STEP);
  for(const off of [0,-1,1]){
    const want=await totpAt(secretB32, counter+off);
    if(equalHex(want,c)) return true;
  }
  return false;
}

/* otpauth:// URI — manual entry into any authenticator app. No QR library in
   the bundle: the label and secret are short enough to type once. */
function otpauthUri(secret, account, issuer){
  return 'otpauth://totp/'+encodeURIComponent((issuer||'Lab Systems')+':'+(account||''))
    +'?secret='+secret+'&issuer='+encodeURIComponent(issuer||'Lab Systems')
    +'&algorithm=SHA1&digits=6&period=30';
}

window.LSC={ITERATIONS, STEP, DIGITS, pbkdf2, randomHex, hashPassword, verifyPassword,
  isModern, isLegacy, equalHex, newTotpSecret, totp, totpVerify, otpauthUri, b32encode, b32decode};
})();
