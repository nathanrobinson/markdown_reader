import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const vitestBin = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

execFileSync(process.execPath, [tscBin, '--noEmit'], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, [vitestBin, 'run'], { cwd: root, stdio: 'inherit' });

await build({
  entryPoints: [path.join(root, 'src', 'main.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  sourcemap: true,
  outfile: path.join(dist, 'app.js'),
});

cpSync(path.join(root, 'src', 'styles.css'), path.join(dist, 'styles.css'));
cpSync(path.join(root, 'src', 'index.html'), path.join(dist, 'index.html'));

console.log('Built to dist/');
