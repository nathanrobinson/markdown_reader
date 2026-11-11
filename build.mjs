import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const result = await build({
  entryPoints: [path.join(root, 'src', 'main.ts')],
  bundle: true,
  format: 'esm',
  splitting: true,
  target: 'es2020',
  minify: true,
  sourcemap: true,
  metafile: true,
  outdir: dist,
  entryNames: 'app-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
});

const entryOutput = Object.entries(result.metafile.outputs).find(([, out]) => out.entryPoint?.endsWith('src/main.ts'));
if (!entryOutput) throw new Error('esbuild produced no entry output');
const appFile = path.basename(entryOutput[0]);

const stylesSource = readFileSync(path.join(root, 'src', 'styles.css'));
const stylesFile = `styles-${createHash('sha256').update(stylesSource).digest('hex').slice(0, 8)}.css`;
writeFileSync(path.join(dist, stylesFile), stylesSource);

const html = readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const htmlWithHash = html
  .replace('src="app.js"', `src="${appFile}"`)
  .replace('href="styles.css"', `href="${stylesFile}"`);
if (!htmlWithHash.includes(appFile) || !htmlWithHash.includes(stylesFile)) {
  throw new Error('index.html is missing an app.js or styles.css reference');
}
writeFileSync(path.join(dist, 'index.html'), htmlWithHash);

console.log('Built to dist/');
