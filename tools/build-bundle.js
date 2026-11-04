#!/usr/bin/env node
/* ============================================================================
   BUILD · THE SINGLE-FILE BUNDLE  →  bundle.html
   ============================================================================
   One page that carries every stylesheet and every script inside it. Nothing is
   fetched at run time except the fonts and the favicon, no service worker is
   registered, and no module is loaded on demand.

   It exists because a laboratory reported that the landing page opened but no
   screen would load, and every layer that could have caused that — a stored copy
   of the build, a half-written cache, a network that drops a request, a browser
   extension that blocks dynamically inserted scripts — is removed by having
   nothing left to fetch.

   Run it after changing anything:   node tools/build-bundle.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* The order the console itself expects: a file may only use what came before it. */
const CORE = [
  'assets/js/core/icons.js',
  'assets/js/core/seed.js',
  'assets/data/plan-archive.js',
  'assets/js/core/utils.js',
  'assets/js/core/store.js',
  'assets/js/core/ui.js',
  'assets/js/core/charts.js',
  'assets/js/core/sheets.js',
  'assets/js/core/xlsxread.js',
  'assets/js/core/i18n.js',
  'assets/js/core/auth.js',
  'assets/js/core/landing.js',
  'assets/js/core/shell.js',
  'assets/js/core/shared.js',
  'assets/js/core/sync.js'
];
const MODULES = [
  'dash', 'samples', 'stock', 'report', 'training', 'revenue', 'roster', 'leave',
  'eqa', 'pbf', 'quality', 'equipment', 'staff', 'security', 'design', 'roadmap'
].map(m => 'assets/js/modules/' + m + '.js');

const CSS = [
  'assets/css/tokens.css',
  'assets/css/app.css',
  'assets/css/landing.css',
  'assets/css/modules.css'
];

/* A script inserted inline ends at the first `</script`, and a comment can contain one.
   Nothing in this build does, but the build must not depend on that staying true. */
const safe = js => js.replace(/<\/script/gi, '<\\/script');

function inlineCss(){
  return CSS.map(p=>{
    let css = read(p);
    /* Every url() in the stylesheets is written relative to its own folder. Inlined into
       a page at the site root those paths would point one level too high, so they are
       rewritten to point at the same files from here. */
    css = css.replace(/url\((['"]?)\.\.\//g, 'url($1assets/');
    css = css.replace(/url\((['"]?)\.\//g, 'url($1assets/css/');
    return '/* ——— ' + p + ' ————————————————————— */\n' + css;
  }).join('\n');
}

function inlineJs(files){
  return files.map(p=>{
    const code = read(p);
    if(/<\/script/i.test(code)) throw new Error('contains </script and cannot be inlined: '+p);
    return '\n/* ——— ' + p + ' ————————————————————— */\n' + safe(code) + '\n';
  }).join('\n');
}

function build(){
  let html = read('index.html');

  /* 1 · stylesheets in, links out */
  html = html.replace(/[ \t]*<link rel="stylesheet" href="assets\/css\/[^"]+">\n/g, '');
  html = html.replace('</head>', '<style>\n' + inlineCss() + '\n</style>\n</head>');

  /* 2 · scripts in, tags out. Everything before boot.js is core plus every screen;
     boot.js stays last, inline, so the console starts with nothing left to fetch. */
  const bootTag = /[ \t]*<script src="assets\/js\/core\/boot\.js[^"]*"><\/script>\n/;
  if(!bootTag.test(html)) throw new Error('boot.js tag not found in index.html');
  html = html.replace(bootTag, '');
  html = html.replace(/[ \t]*<script src="assets\/[^"]+"><\/script>\n/g, '');

  const payload =
    '<script>window.__LS_BUNDLE=true;/* single-file build — every screen is already here */</script>\n'
    + '<script>' + inlineJs(CORE) + '</script>\n'
    + '<script>' + inlineJs(MODULES) + '</script>\n'
    + '<script>' + inlineJs(['assets/js/core/boot.js']) + '</script>\n';

  /* boot.js is the last thing in the body, so the payload goes just before it */
  const marker = '<script>\n/* ——— The last line of defence';
  if(html.indexOf(marker) < 0) throw new Error('the inline failsafe was not found in index.html');
  html = html.replace(marker, payload + marker);

  /* 3 · say what this page is, in the title bar and on the page */
  html = html.replace(/<title>([^<]*)<\/title>/, '<title>$1 · offline bundle</title>');

  const out = path.join(ROOT, 'bundle.html');
  fs.writeFileSync(out, html);
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  console.log('bundle.html · ' + kb + ' KB · '
    + (CORE.length + MODULES.length + 1) + ' scripts, ' + CSS.length + ' stylesheets inlined');
}

build();
