import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('deployment contains one active app, redirects old routes and versions nested imports',async()=>{
 execFileSync(process.execPath,['scripts/build-prototype.mjs'],{cwd:root});
 const read=path=>readFile(new URL(`../dist/${path}`,import.meta.url),'utf8');
 const files=await readdir(new URL('../dist/',import.meta.url));
 for(const retired of ['app.mjs','state.mjs','landing.mjs','fixtures.mjs','workspace.css'])assert.equal(files.includes(retired),false);
 assert.match(await read('index.html'),/asset-canvas.html#assets/);
 assert.match(await read('plan.html'),/asset-canvas.html#planning/);
 assert.equal(JSON.parse(await read('manifest.webmanifest')).start_url,'/asset-canvas.html');
 const version=JSON.parse(await read('version.json')).version;
 assert.ok((await read('asset-canvas.html')).includes(`asset-canvas.mjs?v=${version}`));
 assert.ok((await read('planning-view.mjs')).includes(`planning.mjs?v=${version}`));
 assert.ok((await read('planning.mjs')).includes(`withdrawals.mjs?v=${version}`));
});
