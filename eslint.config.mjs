export default [{
  files: ['assets/js/modules/{report,quality,dash,eqa,roster}.js', 'assets/js/core/sheets.js', 'harness/{temperature163,browser-temperature163,weekly164,browser-weekly164,weekroster68}.js', 'harness/{population153,quality153,eqa_layout161,browser-eqa-layout161,cqi_sort162}.js'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'script' },
  rules: { 'no-dupe-keys': 'error', 'no-unreachable': 'error', 'no-constant-condition': ['error', { checkLoops: false }] }
}];
