// GATES.md G1: game module parses. Prints success-only marker.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const html = readFileSync('index.html', 'utf8');
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) throw new Error('module script not found');
const tmp = join(tmpdir(), 'unlazy-syntax-check.mjs');
writeFileSync(tmp, m[1]);
execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
// screen-shake port must also parse
execFileSync(process.execPath, ['--check', 'vendor/screen-shake.js'], { stdio: 'pipe' });
console.log('syntax verification passed');
