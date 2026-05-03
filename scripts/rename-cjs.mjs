#!/usr/bin/env node
import { readdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const root = process.argv[2];
if (!root) {
  console.error('usage: rename-cjs.mjs <dist-cjs-dir>');
  process.exit(1);
}

for await (const file of walk(root)) {
  if (extname(file) === '.js') {
    const cjs = file.replace(/\.js$/, '.cjs');
    let src = await readFile(file, 'utf8');
    src = src.replace(/require\(["'](\.\.?\/[^"']+?)\.js["']\)/g, "require('$1.cjs')");
    await writeFile(cjs, src, 'utf8');
    await rm(file);
    await rm(file + '.map', { force: true });
  }
}

await writeFile(join(root, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2));
