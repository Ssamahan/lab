export default [{
  files: ['assets/js/modules/{report,quality,dash}.js', 'harness/{population153,quality153}.js'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'script' },
  rules: { 'no-dupe-keys': 'error', 'no-unreachable': 'error', 'no-constant-condition': ['error', { checkLoops: false }] }
}];
