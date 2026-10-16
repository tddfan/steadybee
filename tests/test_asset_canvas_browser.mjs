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
  await p.goto(`${origin}/app.html`);
  await p.locator('#canvas-screen').waitFor({state:'visible'});return p;
}
async function fits(p) {
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page-level horizontal overflow');
}
test('overviews lead with the visible breakdown and progressively reveal details',async()=>{
 const p=await page();assert.equal(await p.locator('#asset-breakdown').evaluate(e=>e.tagName),'SECTION');
 assert.equal(await p.locator('#asset-donut').isVisible(),true);assert.equal(await p.locator('#asset-records').isVisible(),false);
 await p.locator('#toggle-asset-records').click();assert.equal(await p.locator('#asset-records').isVisible(),true);
 await p.locator('#assets-to-planning').click();assert.equal(await p.locator('#plan-controls').isVisible(),false);
 assert.equal(await p.locator('.plan-comparison-figures').isVisible(),false);
 assert.equal(await p.locator('#plan-chart').isVisible(),true);assert.equal(await p.locator('#plan-detail-values').isVisible(),false);
 await p.locator('#plan-adjust').click();await p.locator('.plan-spending-card > summary').click();
 assert.equal(await p.locator('.plan-timing').evaluate(e=>e.open),false);assert.equal(await p.locator('#plan-spending-controls').isVisible(),true);
 await p.close();
});
test('owner filtering and direct editing preserve optional account details',async()=>{
 const p=await page(390);await p.locator('#toggle-asset-records').click();await p.locator('#holdings-owner-filter').getByRole('button',{name:'Gemma',exact:true}).click();
 assert.equal(await p.locator('.holding-row').count(),4);
 await p.getByRole('button',{name:'Edit Gemma Cash, £150,000',exact:true}).click();
 await p.getByText('Additional details',{exact:true}).click();await p.locator('#item-cash-rate').fill('3.4');await p.locator('#item-confidence').selectOption('exact');
 await p.getByRole('button',{name:'Save changes',exact:true}).click();
 await p.getByRole('button',{name:'Edit Gemma Cash, £150,000',exact:true}).click();
 await p.getByLabel('Current value',{exact:true}).fill('151000');await p.getByRole('button',{name:'Save changes',exact:true}).click();
 assert.equal(await p.locator('#net-worth').innerText(),'£2,146,000');
 await p.getByRole('button',{name:'Edit Gemma Cash, £151,000',exact:true}).click();await p.getByText('Additional details',{exact:true}).click();
 assert.equal(await p.locator('#item-cash-rate').inputValue(),'3.4');assert.equal(await p.locator('#item-confidence').inputValue(),'exact');await p.close();
});
test('blank setup captures a partner before shared debt entry',async()=>{
 const p=await page(320);await p.locator('#start-own-button').click();
 assert.equal(await p.locator('#welcome-screen').isVisible(),true);
 await p.getByLabel('Name or nickname',{exact:true}).fill('Sam');await p.getByLabel('Age',{exact:true}).fill('47');
 await p.getByText('Add a partner',{exact:true}).click();await p.getByLabel('Partner’s name',{exact:true}).fill('Jo');await p.getByLabel('Partner’s age Optional',{exact:true}).fill('45');
 await p.getByRole('button',{name:'Continue',exact:true}).click();assert.match(await p.locator('#snapshot-description').innerText(),/Sam, 47 · Jo, 45/);
 await p.getByRole('button',{name:'Add a debt',exact:true}).click();await p.getByLabel('Type',{exact:true}).selectOption('loan');await p.getByLabel('Owed by',{exact:true}).selectOption('shared');
 await p.getByLabel('Balance owed',{exact:true}).fill('5000');await p.getByRole('button',{name:'Add debt',exact:true}).click();
 assert.equal(await p.locator('#net-worth').innerText(),'-£5,000');assert.equal(await p.locator('#asset-total').innerText(),'£0');assert.equal(await p.locator('#debt-total').innerText(),'£5,000');await fits(p);await p.close();
});
test('linked equity stays in the item editor and a new debt inherits the owner filter',async()=>{
 const p=await page(320);await p.locator('#toggle-asset-records').click();await p.locator('#holdings-owner-filter').getByRole('button',{name:'Shared',exact:true}).click();
 await p.getByRole('button',{name:'Edit Shared Main home, £780,000',exact:true}).click();
 assert.match(await p.locator('#item-equity').innerText(),/Equity £400,000/);
 await p.getByLabel('Current value',{exact:true}).fill('800000');assert.match(await p.locator('#item-equity').innerText(),/Equity £420,000/);
 await p.getByRole('button',{name:'Close without saving',exact:true}).click();await p.locator('#debt-add').click();assert.equal(await p.locator('#item-owner').inputValue(),'shared');
 await p.getByLabel('Type',{exact:true}).selectOption('loan');await p.getByLabel('Balance owed',{exact:true}).fill('5000');await p.getByRole('button',{name:'Add debt',exact:true}).click();
 assert.equal(await p.locator('#debt-total').innerText(),'£385,000');assert.equal(await p.locator('#net-worth').innerText(),'£2,140,000');await fits(p);await p.close();
});
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
 await p.locator('#plan-baseline-comparison > summary').click();
 const current=await p.locator('.plan-comparison-figures > div').first().innerText();
 if(!await p.locator('#plan-baseline-comparison').evaluate(e=>e.open))await p.locator('#plan-baseline-comparison > summary').click();
 const original=await p.locator('.plan-comparison-figures > div').nth(2).locator('strong').innerText();
 await p.locator('#plan-adjust').click();await p.getByText('Growth & inflation',{exact:true}).click();
 const growth=p.getByLabel('Shares & general account: exact percentage',{exact:true});await growth.fill('5');await growth.press('Tab');
 assert.equal(await p.locator('.plan-comparison-figures > div').first().innerText(),current);
 assert.ok((await p.locator('.plan-comparison-figures > div').nth(2).locator('small').innerText()).includes(`Current plan ${original}`));
 assert.notEqual(await p.locator('.plan-comparison-figures > div').nth(2).locator('strong').innerText(),original);
 await p.locator('#plan-undo').click();assert.equal(await p.locator('.plan-comparison-figures > div').nth(2).locator('strong').innerText(),original);
 await p.close();
});
test('retirement ages map to dates, preserve the current plan and undo together',async()=>{
 const p=await page();await p.locator('#assets-to-planning').click();
 if(!await p.locator('#plan-baseline-comparison').evaluate(e=>e.open))await p.locator('#plan-baseline-comparison > summary').click();
 const original=await p.locator('.plan-comparison-figures > div').nth(2).locator('strong').innerText();
 await p.locator('#plan-adjust').click();await p.getByLabel('Alex retirement age: exact value',{exact:true}).fill('60');
 assert.match(await p.locator('#planning-title').innerText(),/retires at 60/);
 assert.match(await p.locator('#plan-question-detail').innerText(),/Dec 2043/);
 assert.ok((await p.locator('.plan-comparison-figures > div').nth(2).locator('small').innerText()).includes(`Current plan ${original}`));
 await p.locator('#plan-undo').click();assert.match(await p.locator('#planning-title').innerText(),/retires at 62/);
 assert.equal(await p.locator('.plan-comparison-figures > div').nth(2).locator('strong').innerText(),original);await p.close();
});
test('retirement age accounts for a final pay month before the opening-month anniversary',async()=>{
 const p=await page();await p.locator('#step-to-flow').click();
 await p.getByRole('button',{name:/^Alex's estimated take-home pay/}).click();
 await p.locator('#flow-pay-primary-endDate').fill('2045-05');await p.getByRole('button',{name:'Done',exact:true}).click();
 await p.locator('#flow-to-planning').click();await p.locator('#plan-adjust').click();await p.getByLabel('Alex retirement age: exact value',{exact:true}).fill('60');
 assert.match(await p.locator('#planning-title').innerText(),/retires at 60/);
 assert.equal(await p.locator('#plan-retirement-date-primary').innerText(),'Final pay: May 2044');
 await p.locator('#planning-to-flow').click();await p.getByRole('button',{name:/^Alex's estimated take-home pay/}).click();
 assert.equal(await p.locator('#flow-pay-primary-endDate').inputValue(),'2045-05');await p.close();
});
test('cash and SAYE payoff preserves ISA and exposes sale tax',async()=>{
 const p=await page();await p.locator('#assets-to-planning').click();
 await p.locator('#plan-adjust').click();await p.getByText('Mortgage & debt',{exact:true}).click();
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

test('protected picture survives reload, requires review and can be deleted',async()=>{
 const p=await page(390);await p.locator('#assets-to-planning').click();await p.locator('#plan-adjust').click();
 await p.getByLabel('Plan to age: exact value',{exact:true}).fill('100');await p.locator('#plan-adjust').click();
 await p.locator('#picture-storage-button').click();await p.locator('#storage-new-password').fill('Fictional browser test passphrase');await p.locator('#storage-confirm-password').fill('Fictional browser test passphrase');await p.getByRole('button',{name:'Save on this device',exact:true}).click();await p.getByText('Encrypted picture saved on this device.',{exact:true}).waitFor();await p.locator('#storage-close').click();
 await p.reload();assert.equal(await p.locator('#picture-storage-button').innerText(),'Resume picture');await p.locator('#picture-storage-button').click();await p.locator('#storage-unlock-password').fill('Fictional browser test passphrase');await p.getByRole('button',{name:'Unlock saved picture',exact:true}).click();await p.locator('#storage-preview').waitFor({state:'visible'});await p.locator('#storage-open').click();await p.locator('#assets-to-planning').click();assert.equal(await p.locator('#plan-confirm').isVisible(),true);await p.locator('#plan-confirm-button').click();await p.locator('#plan-baseline-comparison > summary').click();assert.match(await p.locator('#plan-comparison').innerText(),/Gemma 100/);
 await p.locator('#picture-storage-button').click();await p.locator('#storage-delete').click();await p.locator('#storage-delete-final').click();await p.reload();assert.equal(await p.locator('#picture-storage-button').innerText(),'Save picture');await p.close();
});
