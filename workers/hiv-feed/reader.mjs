/* Private, read-only rclone reader. Does not publish, schedule, or log secrets. */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readTimeliness } from './src.mjs';

const MAX_WORKBOOK = 2 * 1024 * 1024;
export class ReaderFailure extends Error {
  constructor(category){super('Workbook read failed');this.category=category;}
}
function failureCategory(child){
  if(child.error?.code==='ENOENT')return 'rclone-unavailable';
  if(child.error?.code==='ETIMEDOUT')return 'timeout';
  if(child.error?.code==='ENOBUFS')return 'size-limit';
  const text=String(child.stderr||'').toLowerCase();
  if(/invalid_grant|invalid authentication|unauthorized|http error 401/.test(text))return 'authorization';
  if(/directory not found|object not found|file not found|404 not found/.test(text))return 'file-not-found';
  if(/permission denied|http error 403/.test(text))return 'access-denied';
  if(/unknown flag/.test(text))return 'rclone-options';
  return 'other';
}
export function createSummary({configPath, sourcePath, run = spawnSync, now = () => new Date()}) {
  if (typeof configPath !== 'string' || !configPath || /[\r\n\0]/.test(configPath)) throw new ReaderFailure('invalid-config-path');
  // A path identifies one workbook; never run sync, copy, delete, or any remote mutation.
  if (typeof sourcePath !== 'string' || !sourcePath.startsWith('hiv-readonly:') || /[\r\n\0]/.test(sourcePath)) throw new ReaderFailure('invalid-workbook-path');
  const child = run('rclone', ['--config', configPath, 'cat', '--', sourcePath], {
    encoding: null, timeout: 60000, maxBuffer: MAX_WORKBOOK + 1, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  // rclone diagnostics can contain paths, account identifiers or tokens. Never log them.
  if (child.error || child.status !== 0 || !child.stdout || child.stdout.length > MAX_WORKBOOK) throw new ReaderFailure(failureCategory(child));
  let records;try{records=readTimeliness(new Uint8Array(child.stdout));}catch{throw new ReaderFailure('invalid-workbook');}
  return {version: 1, checkedAt: now().toISOString(), records};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = createSummary({configPath: process.env.RCLONE_CONFIG_PATH, sourcePath: process.env.HIV_WORKBOOK_PATH});
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch {
    process.stderr.write('Timeliness reader failed; no summary was produced.\n');
    process.exitCode = 1;
  }
}
