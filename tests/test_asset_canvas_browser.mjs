import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Optional browser check. Supply PLAYWRIGHT_MODULE and CHROME_EXECUTABLE_PATH.
const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "prototype");
const mime = {
  ".html": "text/html",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
let server, browser, origin;
const errors = [];

before(async () => {
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://test").pathname;
      const path = resolve(source, "." + pathname);
      if (!path.startsWith(source + "/")) throw Error("Outside prototype");
      response.setHeader("Content-Type", mime[extname(path)] || "application/octet-stream");
      response.end(await readFile(path));
    } catch {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await pw.chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE_PATH,
    headless: true,
    args: ["--no-sandbox"],
  });
});

after(async () => {
  await browser?.close();
  server?.close();
  assert.deepEqual(errors, [], "No browser runtime errors");
});

async function page(width=1280) {
  const p=await browser.newPage({viewport:{width,height:844}});
  p.on('pageerror',error=>errors.push(error.message));
  await p.goto(`${origin}/asset-canvas.html`);
  await p.locator('#canvas-screen').waitFor({state:'visible'});return p;
}
async function fits(p) {
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page-level horizontal overflow');
}
test('phone sections, portrait Sankey, table and experimental charts remain reachable',async()=>{
  const p=await page(390);
  await fits(p);await p.locator('#step-to-flow').click();await fits(p);
  assert.equal(await p.locator('#flow-sankey-mobile').isVisible(),true);
  assert.equal(await p.locator('#flow-sankey').isVisible(),false);
  await p.locator('#flow-view-table').click();assert.equal(await p.locator('#flow-table-view').isVisible(),true);await fits(p);
  await p.locator('.flow-experimental summary').click();await p.locator('#flow-view-sunburst').click();
  assert.equal(await p.locator('#flow-sunburst-view').isVisible(),true);
  await p.locator('#flow-view-diagram').click();await p.locator('#flow-to-planning').click();await fits(p);
  assert.equal(await p.locator('#plan-adjust').isVisible(),true);await p.locator('#plan-adjust').click();
  assert.equal(await p.locator('#plan-controls').isVisible(),true);await fits(p);await p.close();
});
test('scenario growth leaves baseline unchanged and undo restores the previous outcome',async()=>{
 const p=await page();await p.locator('#assets-to-planning').click();
 const current=await p.locator('.plan-comparison-figures > div').nth(0).innerText();
 const original=await p.locator('.plan-comparison-figures > div').nth(1).innerText();
 await p.getByText('Growth & inflation',{exact:true}).click();
 const growth=p.getByLabel('Shares & general account: exact percentage',{exact:true});await growth.fill('5');await growth.press('Tab');
 assert.equal(await p.locator('.plan-comparison-figures > div').nth(0).innerText(),current);
 assert.notEqual(await p.locator('.plan-comparison-figures > div').nth(1).innerText(),original);
 await p.locator('#plan-undo').click();assert.equal(await p.locator('.plan-comparison-figures > div').nth(1).innerText(),original);
 await p.close();
});
test('cash and SAYE payoff preserves ISA and exposes sale tax',async()=>{
 const p=await page();await p.locator('#assets-to-planning').click();
 await p.getByText('Mortgage & debt',{exact:true}).click();
 await p.locator('#plan-payoff-source').selectOption('cashShares');await p.locator('#plan-payoff-now').check();
 const summary=await p.locator('#plan-payoff-summary').innerText();
 assert.match(summary,/SAYE[\s\S]*83,269/);assert.match(summary,/Estimated tax[\s\S]*13,269/);assert.match(summary,/Debt remaining[\s\S]*£0/);
 assert.doesNotMatch(summary,/ISA investment/);
 await p.close();
});
test('320px planning chart and controls fit without horizontal scrolling',async()=>{
 const p=await page(320);await p.locator('#assets-to-planning').click();await fits(p);
 const chart=await p.locator('#plan-chart').boundingBox();assert.ok(chart.width<=320);
 await p.locator('#plan-adjust').click();await fits(p);await p.close();
});
