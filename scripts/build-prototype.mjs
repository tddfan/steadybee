import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'prototype');
const output = join(root, 'dist');

async function filesUnder(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(join(directory, entry.name), path));
    else files.push(path);
  }
  return files.sort();
}

const files = await filesUnder(source);
const hash = createHash('sha256');
for (const path of files) hash.update(path).update('\0').update(await readFile(join(source, path)));
const commit = process.env.COMMIT_REF || '';
const version = /^[a-f0-9]{40,64}$/.test(commit) ? commit : hash.digest('hex');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
for (const path of files.filter(path => path.endsWith('.html'))) {
  const html = await readFile(join(output, path), 'utf8');
  const marker = '<meta name="steadybee-version" content="development">';
  if (!html.includes(marker)) throw new Error(`Missing deployment version marker in ${path}`);
  await writeFile(join(output, path), html.replace(marker, `<meta name="steadybee-version" content="${version}">`));
}
await writeFile(join(output, 'version.json'), JSON.stringify({ version }) + '\n');
console.log(`Prepared ${files.filter(path => path.endsWith('.html')).length} pages; version ${version.slice(0, 12)}.`);
