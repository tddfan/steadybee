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

async function page(mobile = false) {
  const browserPage = await browser.newPage({
    viewport: mobile ? { width: 375, height: 812 } : { width: 1440, height: 900 },
  });
  browserPage.on("pageerror", (error) => errors.push(error.message));
  browserPage.on("dialog", (dialog) => dialog.accept());
  await browserPage.goto(`${origin}/asset-canvas.html`);
  await browserPage.locator("#canvas-screen").waitFor({ state: "visible" });
  for (const summary of await browserPage.locator(".owner-details summary").all()) await summary.click();
  for (const summary of await browserPage.locator(".bucket-cell > summary").all()) await summary.click();
  return browserPage;
}

async function start(browserPage, name = "Alex", age = 52) {
  await browserPage.locator("#start-own-button").click();
  await browserPage.locator("#confirm-clear-button").click();
  await browserPage.locator("#person-name").fill(name);
  await browserPage.locator("#person-age").fill(String(age));
  await browserPage.locator("#start-button").click();
  await browserPage.locator("#canvas-screen").waitFor({ state: "visible" });
  const details = browserPage.locator('[data-owner-details="primary"]');
  if (await details.count()) await details.locator(":scope > summary").click();
}

async function addItem(browserPage, type, kind, label, amount, extras = {}) {
  await browserPage.locator(`[data-add-owner="${extras.owner || "primary"}"]`).click();
  await browserPage.locator(`[data-quick-type="${type}"][data-quick-kind="${kind}"]`).click();
  await browserPage.locator("#item-dialog").waitFor({ state: "visible" });
  await browserPage.locator("#item-kind").selectOption(kind);
  if (extras.owner) await browserPage.locator("#item-owner").selectOption(extras.owner);
  if (label) await browserPage.locator("#item-label").fill(label);
  await browserPage.locator("#item-amount").fill(String(amount));
  if (extras.rate !== undefined || extras.years !== undefined) await browserPage.locator("#mortgage-fields summary").click();
  if (extras.rate !== undefined) await browserPage.locator("#item-interest-rate").fill(String(extras.rate));
  if (extras.years !== undefined) await browserPage.locator("#item-remaining-years").fill(String(extras.years));
  if (extras.link !== undefined) await browserPage.locator("#item-linked-asset").selectOption(extras.link);
  await browserPage.locator("#save-item-button").click();
  await browserPage.locator("#item-dialog").waitFor({ state: "hidden" });
  const details = browserPage.locator(`[data-owner-details="${extras.owner || "primary"}"]`);
  if (await details.count() && !(await details.evaluate((element) => element.open))) await details.locator(":scope > summary").click();
  for (const summary of await details.locator(".bucket-cell:not([open]) > summary").all()) await summary.click();
}

async function displayedAmount(browserPage, selector) {
  const text = await browserPage.locator(selector).innerText();
  return Number(text.replace(/[^\d.-]/g, ""));
}

test("welcome gathers a name and age before showing an honestly empty picture", async () => {
  const p = await page();
  await p.locator("#start-own-button").click();
  await p.locator("#confirm-clear-button").click();
  assert.equal(await p.locator("#welcome-screen").isVisible(), true);
  await p.locator("#start-button").click();
  assert.equal(await p.locator("#canvas-screen").isVisible(), false);
  await p.locator("#person-name").fill("Alex");
  await p.locator("#person-age").fill("52");
  await p.locator("#start-button").click();
  assert.equal(await displayedAmount(p, "#asset-total"), 0);
  assert.equal(await displayedAmount(p, "#debt-total"), 0);
  assert.equal(await displayedAmount(p, "#net-worth"), 0);
  assert.equal(await p.locator('[data-orbit-type="asset"]').count(), 0);
  assert.equal(await p.locator('[data-orbit-type="debt"]').count(), 0);
  assert.equal(await p.locator("#first-piece").isVisible(), true);
  assert.equal(await p.locator(".constellation-centre").isVisible(), false);
  assert.equal(await p.locator(".explore-panel").isVisible(), false);
  await p.locator('[data-first-kind="cash"]').click();
  assert.equal(await p.locator("#item-kind").inputValue(), "cash");
  await p.locator("#item-amount").fill("25000");
  await p.locator("#save-item-button").click();
  assert.equal(await p.locator("#first-piece").isVisible(), false);
  assert.equal(await p.locator(".explore-panel").isVisible(), true);
  assert.equal(await displayedAmount(p, "#net-worth"), 25000);
  await p.close();
});

test("monthly Sankey links confirmed property rent and keeps asset values out of income", async () => {
  const p = await page();
  await p.locator("#step-to-flow").click();
  assert.equal(await displayedAmount(p, "#flow-income-total"), 14962.38);
  assert.equal(await displayedAmount(p, "#flow-spending-total"), 11191.97);
  assert.equal(await displayedAmount(p, "#flow-result-value"), 3770.41);
  assert.match(await p.locator("#flow-sankey").textContent(), /Alex gross · £16,375/);
  assert.match(await p.locator("#flow-sankey").textContent(), /Income Tax & NI · £8,991.38/);
  assert.match(await p.locator("#flow-sankey").textContent(), /Mortgage · £2,375.30/);
  assert.equal(await p.locator("#flow-view-diagram").getAttribute("aria-pressed"), "true");
  await p.locator("#flow-view-table").click();
  assert.equal(await p.locator("#flow-sankey").isVisible(), false);
  assert.match(await p.locator("#flow-source-list").innerText(), /Alex's estimated gross pay[\s\S]*£16,375/);
  await p.locator("#flow-view-diagram").click();
  assert.equal(await p.locator("#flow-sankey").isVisible(), true);
  assert.equal(await p.locator("#flow-pay-primary-annualGross").inputValue(), "146500");
  assert.equal(await p.locator("#flow-pay-primary-annualBonus").inputValue(), "50000");
  assert.equal(await p.locator("#flow-pay-primary-employeePensionRate").inputValue(), "7");
  assert.equal(await p.locator("#flow-pay-partner-annualGross").inputValue(), "125000");
  assert.equal(await p.locator("#flow-more-entries").evaluate((element) => element.open), false);
  assert.equal(await p.locator("#planning-screen").isVisible(), false);
  await p.locator("#flow-more-entries > summary").click();
  await p.locator("#flow-include-mortgage").uncheck();
  assert.equal(await displayedAmount(p, "#flow-spending-total"), 8816.67);
  await p.locator("#flow-include-mortgage").check();
  await p.locator("#flow-include-rent").uncheck();
  assert.equal(await displayedAmount(p, "#flow-income-total"), 14862.38);
  await p.locator("#flow-rent-list [data-flow-asset]").click();
  assert.equal(await p.locator("#item-monthly-rent").inputValue(), "100");
  await p.locator("#item-monthly-rent").fill("150");
  await p.locator("#save-item-button").click();
  await p.locator("#flow-screen").waitFor({ state: "visible" });
  await p.locator("#flow-include-rent").check();
  assert.equal(await displayedAmount(p, "#flow-income-total"), 15012.38);
  await p.locator("#flow-editor > summary").click();
  await p.locator("#flow-spending-detail > summary").click();
  assert.equal(await p.locator("#flow-pay-detail").evaluate((element) => element.open), false);
  await p.locator("#flow-spending-homeBills").fill("1200");
  assert.equal(await displayedAmount(p, "#flow-spending-total"), 11991.97);
  assert.equal(await displayedAmount(p, "#flow-result-value"), 3020.41);
  await p.locator("#step-to-assets").click();
  assert.equal(await displayedAmount(p, "#net-worth"), 2145000);
  await p.close();
});

test("dated entries are editable and update the monthly summary only when active", async () => {
  const p = await page();
  await p.locator("#step-to-flow").click();
  await p.locator("#flow-add-expense").click();
  await p.locator("#flow-dated-label").fill("School fees");
  await p.locator("#flow-dated-amount").fill("300");
  await p.locator("#flow-dated-form button[type=submit]").click();
  assert.equal(await displayedAmount(p, "#flow-spending-total"), 11491.97);
  assert.match(await p.locator("#flow-sankey").textContent(), /School fees: £300 per month/);
  await p.locator("#flow-add-income").click();
  await p.locator("#flow-dated-label").fill("Part-time work");
  await p.locator("#flow-dated-amount").fill("1200");
  await p.locator("#flow-dated-start").fill("2027-01");
  await p.locator("#flow-dated-form button[type=submit]").click();
  assert.match(await p.locator("#flow-dated-list").innerText(), /Part-time work[\s\S]*Starts later/);
  assert.equal(await displayedAmount(p, "#flow-income-total"), 14962.38);
  await p.locator("#flow-dated-list").getByRole("button", { name: /^School fees Expense/ }).click();
  await p.locator("#flow-dated-amount").fill("350");
  await p.locator("#flow-dated-form button[type=submit]").click();
  assert.equal(await displayedAmount(p, "#flow-spending-total"), 11541.97);
  await p.close();
});

test("monthly remainder becomes saving with an editable split, while planning stays separate", async () => {
  const p = await page();
  await p.locator("#step-to-flow").click();
  assert.match(await p.locator("#flow-sankey").textContent(), /Alex saving[\s\S]*Gemma saving/);
  await p.locator("#flow-split > summary").click();
  await p.locator("#flow-primary-share").fill("60");
  assert.match(await p.locator("#flow-sankey").textContent(), /Alex saving · £2,262.25[\s\S]*Gemma saving · £1,508.16/);
  await p.locator("#flow-to-planning").click();
  assert.equal(await p.locator("#planning-screen").isVisible(), true);
  assert.equal(await p.locator("#flow-allocation-settings").isVisible(), false);
  await p.locator("#flow-allocation-enabled").check();
  assert.equal(await p.locator("#flow-allocation-settings").isVisible(), true);
  assert.match(await p.locator("#flow-allocation-steps").innerText(), /Cash reserve[\s\S]*£0\/month[\s\S]*Alex's ISA[\s\S]*£3,770.41\/month/);
  await p.locator("#flow-isa-used-primary").fill("20000");
  await p.locator("#flow-isa-used-partner").fill("20000");
  assert.match(await p.locator("#flow-sankey").textContent(), /Alex saving · £2,262.25/);
  await p.locator("#flow-trading-label").fill("My trading account");
  assert.match(await p.locator("#flow-allocation-steps").innerText(), /My trading account[\s\S]*£3,770.41\/month/);
  await p.locator("#flow-growth-panel > summary").click();
  await p.locator("#flow-inflation-rate").fill("2.5");
  assert.equal(await displayedAmount(p, "#flow-spending-total"), 11191.97);
  await p.close();
});

test("timeline markers show dated school costs, mortgage ending and entered State Pension", async () => {
  const p = await page();
  await p.locator("#step-to-flow").click();
  await p.locator('[data-flow-month="2028-11"]').click();
  assert.equal(await displayedAmount(p, "#flow-spending-total"), 12025.30);
  await p.locator('[data-flow-month="2047-10"]').click();
  assert.equal(await displayedAmount(p, "#flow-income-total"), 100);
  assert.equal(await displayedAmount(p, "#flow-spending-total"), 7150);
  await p.locator("#flow-add-state-pension").click();
  await p.locator("#flow-dated-amount").fill("1200");
  await p.locator("#flow-dated-start").fill("2047-11");
  await p.locator("#flow-dated-form button[type=submit]").click();
  await p.locator('[data-flow-month="2047-11"]').click();
  assert.equal(await displayedAmount(p, "#flow-income-total"), 1300);
  assert.match(await p.locator("#flow-source-list").innerText(), /State Pension/);
  await p.close();
});

test("personal monthly flow starts empty and shows an unfunded gap honestly", async () => {
  const p = await page();
  await start(p, "Jordan", 55);
  await p.locator("#step-to-flow").click();
  assert.equal(await p.locator("#flow-empty").isVisible(), true);
  assert.equal(await p.locator("#flow-editor").evaluate((element) => element.open), true);
  assert.equal(await p.locator("#flow-pay-detail").evaluate((element) => element.open), true);
  assert.equal(await p.locator("#flow-rent-toggle-row").isVisible(), false);
  await p.locator("#flow-pay-primary-annualTakeHome").fill("36000");
  await p.locator("#flow-spending-detail > summary").click();
  await p.locator("#flow-spending-homeBills").fill("3500");
  assert.equal(await p.locator("#flow-result-label").innerText(), "More spent than recorded income");
  assert.equal(await displayedAmount(p, "#flow-result-value"), 500);
  await p.locator("#flow-view-table").click();
  assert.equal(await p.locator("#flow-source-list").innerText().then((text) => text.includes("Amount not covered")), true);
  await p.close();
});

test("assets, linked mortgage and edits reconcile without double counting equity", async () => {
  const p = await page();
  await start(p);
  await addItem(p, "asset", "home", "Our home", 480000);
  const homeId = await p.locator('[data-orbit-type="asset"]').first().getAttribute("data-orbit-id");
  assert.ok(homeId);
  await addItem(p, "debt", "mortgage", "Home mortgage", 190000, { rate: 4.5, years: 18, link: homeId });
  await addItem(p, "asset", "isa", "Stocks and shares ISA", 35000);
  assert.equal(await displayedAmount(p, "#asset-total"), 515000);
  assert.equal(await displayedAmount(p, "#debt-total"), 190000);
  assert.equal(await displayedAmount(p, "#net-worth"), 325000);
  assert.match(await p.locator('[data-owner-group="primary"] .linked-pair-note').innerText(), /£480k − £190k debt[\s\S]*£290k equity/);

  await p.locator('[data-orbit-type="debt"]').first().click();
  assert.equal(await p.locator("#item-interest-rate").inputValue(), "4.5");
  assert.equal(await p.locator("#item-remaining-years").inputValue(), "18");
  await p.locator("#item-amount").fill("175000");
  await p.locator("#save-item-button").click();
  assert.equal(await displayedAmount(p, "#asset-total"), 515000);
  assert.equal(await displayedAmount(p, "#debt-total"), 175000);
  assert.equal(await displayedAmount(p, "#net-worth"), 340000);
  assert.match(await p.locator('[data-owner-group="primary"] .linked-pair-note').innerText(), /£305k equity/);

  await p.locator('[data-orbit-type="debt"]').first().click();
  await p.locator("#delete-item-button").click();
  assert.equal(await p.locator('[data-orbit-type="debt"]').count(), 0);
  assert.equal(await displayedAmount(p, "#net-worth"), 515000);
  await p.close();
});

test("a mortgage can be linked with the keyboard, without dragging", async () => {
  const p = await page();
  await start(p);
  await addItem(p, "asset", "home", "Flat", 250000);
  await p.locator('[data-add-owner="primary"]').click();
  await p.locator('[data-quick-type="debt"][data-quick-kind="mortgage"]').click();
  await p.locator("#item-kind").selectOption("mortgage");
  const link = p.locator("#item-linked-asset");
  assert.equal(await link.isVisible(), true);
  assert.equal(await link.isEnabled(), true);
  await link.focus();
  await link.press("End");
  const chosen = await link.inputValue();
  assert.equal(chosen, await p.locator('[data-orbit-type="asset"]').first().getAttribute("data-orbit-id"));
  await p.locator("#item-amount").fill("100000");
  await p.locator("#save-item-button").click();
  assert.equal(await displayedAmount(p, "#net-worth"), 150000);
  await p.close();
});

test("editing a mortgage links it to a home without changing the totals", async () => {
  const p = await page();
  await start(p);
  await addItem(p, "asset", "home", "The house", 300000);
  await addItem(p, "debt", "mortgage", "The mortgage", 120000);
  const before = await displayedAmount(p, "#net-worth");
  const homeId = await p.locator('[data-orbit-type="asset"]').first().getAttribute("data-orbit-id");
  await p.locator('[data-orbit-type="debt"]').first().click();
  await p.locator("#item-linked-asset").selectOption(homeId);
  await p.locator("#save-item-button").click();
  assert.match(await p.locator('[data-owner-group="primary"] .linked-pair-note').innerText(), /£300k − £120k debt[\s\S]*£180k equity/);
  assert.equal(await displayedAmount(p, "#net-worth"), before);
  await p.close();
});

test("profile edits, deliberate zero and a negative entered balance stay distinct", async () => {
  const p = await page();
  await start(p);
  await p.locator("#edit-profile-button").click();
  await p.locator("#profile-name").fill("Sam");
  await p.locator("#profile-age").fill("60");
  await p.locator("#profile-form button[type=submit]").click();
  assert.match(await p.locator(".canvas-heading").innerText(), /Sam’s money picture\.[\s\S]*Sam, age 60/);
  await addItem(p, "asset", "car", "Old car", 0);
  assert.match(await p.locator("#asset-count").innerText(), /1 asset entered/);
  assert.match(await p.locator("#orbit-items").innerText(), /£0/);
  await addItem(p, "debt", "loan", "Small loan", 5000);
  assert.equal(await displayedAmount(p, "#net-worth"), -5000);
  await p.reload();
  assert.equal(await p.locator("#canvas-screen").isVisible(), true);
  assert.equal(await displayedAmount(p, "#net-worth"), 2145000);
  assert.equal(await p.locator("#person-name").inputValue(), "");
  await p.close();
});

test("clear removes entered details, and the canvas fits a narrow phone", async () => {
  const p = await page(true);
  await start(p, "Alex Example", 53);
  await addItem(p, "asset", "home", "Private home label", 480000);
  await addItem(p, "debt", "mortgage", "Private debt label", 190000);
  const width = await p.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(width.page <= width.viewport + 1, `Page width ${width.page} exceeds viewport ${width.viewport}`);
  await p.locator("#clear-button").click();
  assert.equal(await p.locator("#clear-dialog").isVisible(), true);
  await p.locator("#confirm-clear-button").click();
  assert.equal(await p.locator("#welcome-screen").isVisible(), true);
  const body = await p.locator("body").innerText();
  for (const secret of ["Alex Example", "Private home label", "Private debt label", "480,000", "190,000"])
    assert.equal(body.includes(secret), false, `Cleared page still shows ${secret}`);
  const hiddenData = await p.evaluate(() => ({
    markup: document.body.innerHTML,
    controls: [...document.querySelectorAll("input, select")].map((control) => control.value),
  }));
  for (const secret of ["Alex Example", "Private home label", "Private debt label", "480,000", "190,000"])
    assert.equal(JSON.stringify(hiddenData).includes(secret), false, `Cleared DOM still contains ${secret}`);
  const storage = await p.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }));
  assert.deepEqual(storage, { local: 0, session: 0 });
  await p.reload();
  assert.equal(await p.locator("#canvas-screen").isVisible(), true);
  assert.equal(await displayedAmount(p, "#net-worth"), 2145000);
  await p.close();
});

test("Alex and Gemma's owner sections are editable and reconcile shared values once", async () => {
  const p = await page();
  assert.equal(await displayedAmount(p, "#asset-total"), 2525000);
  assert.equal(await displayedAmount(p, "#debt-total"), 380000);
  assert.equal(await displayedAmount(p, "#net-worth"), 2145000);
  assert.equal(await p.locator(".orbit-card").count(), 12);
  assert.deepEqual(await p.locator("[data-owner-group]").evaluateAll((groups) => groups.map((group) => group.dataset.ownerGroup)), ["primary", "partner", "shared"]);
  assert.match(await p.locator('[data-owner-group="primary"]').innerText(), /Alex[\s\S]*£1,225,000/);
  assert.match(await p.locator('[data-owner-group="partner"]').innerText(), /Gemma[\s\S]*£520,000/);
  assert.match(await p.locator('[data-owner-group="shared"]').innerText(), /Shared[\s\S]*£400,000/);
  assert.match(await p.locator('[data-owner-group="shared"] .linked-pair-note').innerText(), /Main home £780k − £380k debt[\s\S]*£400k equity/);
  assert.deepEqual(await p.locator('[data-owner-group="shared"] [data-bucket]').evaluateAll((cells) => cells.map((cell) => cell.dataset.bucket)), ["illiquid", "debt"]);
  assert.deepEqual(await p.locator('[data-owner-group="partner"] [data-bucket]').evaluateAll((cells) => cells.map((cell) => cell.dataset.bucket)), ["accessible", "pension"]);
  const hierarchy = await p.evaluate(() => document.querySelector('.constellation-centre').getBoundingClientRect().bottom < document.querySelector('.picture-panel').getBoundingClientRect().top);
  assert.equal(hierarchy, true, "The household summary leads the grid");
  assert.equal(await displayedAmount(p, "#accessible-total"), 690000);
  assert.doesNotMatch(await p.locator('#orbit-items').innerText(), /Estimate|Scheme age\?/);
  assert.match(await p.locator('[data-owner-group="shared"] [data-bucket="debt"]').innerText(), /Main home mortgage/);
  await p.locator('[data-chart-view="access"]').click();
  assert.match(await p.locator('#chart-categories').innerText(), /Generally accessible[\s\S]*£690,000[\s\S]*Pensions[\s\S]*£710,000[\s\S]*Property & possessions[\s\S]*£1,025,000[\s\S]*Access to confirm[\s\S]*£100,000/);
  assert.equal(await p.locator('[data-owner-group="shared"] .orbit-card').count(), 2);
  assert.equal(await p.locator('[data-orbit-id="alex-home"]').getAttribute("class").then((text) => text.includes("orbit-owner-shared")), true);
  assert.equal(await p.locator('[data-orbit-id="alex-mortgage"]').getAttribute("class").then((text) => text.includes("orbit-owner-shared")), true);
  assert.equal(await p.locator('[data-orbit-id="gemma-pension"]').getAttribute("class").then((text) => text.includes("orbit-owner-partner")), true);
  assert.match(await p.locator("#example-badge").innerText(), /Fictional example/);
  await p.locator('[data-orbit-id="alex-gurgaon"]').click();
  assert.equal(await p.locator("#item-monthly-rent").inputValue(), "100");
  await p.locator("#item-monthly-rent").fill("125");
  await p.locator("#save-item-button").click();
  assert.equal(await displayedAmount(p, "#net-worth"), 2145000);
  await p.locator('[data-orbit-id="alex-gurgaon"]').click();
  assert.equal(await p.locator("#item-monthly-rent").inputValue(), "125");
  await p.locator("#close-item-button").click();
  await p.locator('[data-orbit-id="alex-cash"]').click();
  assert.equal(await p.locator("#item-cash-rate").inputValue(), "4");
  await p.locator("#close-item-button").click();
  await p.locator('[data-orbit-id="alex-pension"]').click();
  assert.equal(await p.locator("#item-investment-label").inputValue(), "S&P");
  await p.locator("#close-item-button").click();
  await p.locator('[data-orbit-id="alex-mortgage"]').click();
  assert.equal(await p.locator("#item-interest-rate").inputValue(), "4.7");
  assert.equal(await p.locator("#item-owner").inputValue(), "shared");
  await p.locator("#close-item-button").click();
  await p.locator("#item-dialog").waitFor({ state: "hidden" });
  await p.waitForFunction(() => document.activeElement?.dataset.orbitId === "alex-mortgage");
  await p.locator('[data-orbit-id="gemma-isa"]').focus();
  await p.keyboard.press("Enter");
  assert.equal(await p.locator("#item-owner").inputValue(), "partner");
  assert.equal(await p.locator("#item-investment-label").inputValue(), "S&P");
  await p.locator("#close-item-button").click();
  await p.locator('[data-orbit-id="alex-shares"]').click();
  assert.equal(await p.locator("#item-amount").inputValue(), "100000");
  await p.locator("#close-item-button").click();
  await p.locator("#reset-example-button").click();
  await p.locator('[data-orbit-id="alex-gurgaon"]').click();
  assert.equal(await p.locator("#item-monthly-rent").inputValue(), "100");
  await p.locator("#close-item-button").click();
  await p.setViewportSize({ width: 320, height: 800 });
  const layout = await p.evaluate(() => {
    const centre = document.querySelector(".constellation-centre").getBoundingClientRect();
    const amount = document.querySelector("#net-worth").getBoundingClientRect();
    return { width: document.documentElement.scrollWidth, viewport: innerWidth, centre: centre.toJSON(), amount: amount.toJSON() };
  });
  assert.ok(layout.width <= layout.viewport + 1);
  assert.ok(layout.amount.left >= layout.centre.left && layout.amount.right <= layout.centre.right, "Net worth stays inside the summary");
  await p.close();
});

test("donut categories drill into assets and keep shared debt separate", async () => {
  const p = await page();
  assert.equal(await p.locator("#donut-total").innerText(), "£2,525,000");
  await p.locator('[data-owner-details="shared"] summary').click();
  await p.locator('[data-chart-key="shared"].chart-category').click();
  assert.equal(await p.locator('[data-owner-details="shared"]').evaluate((element) => element.open), true);
  assert.match(await p.locator('[data-owner-group="shared"]').innerText(), /Main home[\s\S]*£780k[\s\S]*Main home mortgage[\s\S]*−£380k[\s\S]*£400k equity/);
  await p.locator('[data-orbit-id="alex-home"]').click();
  assert.equal(await p.locator("#item-dialog").isVisible(), true);
  await p.locator("#close-item-button").click();
  await p.locator('[data-chart-view="type"]').click();
  assert.equal(await p.locator("#chart-drilldown").isVisible(), false);
  await p.locator('[data-chart-key="home"].chart-category').click();
  assert.match(await p.locator("#chart-drilldown").innerText(), /Main home mortgage/);
  await p.close();
});

test("partner ownership can be edited without duplicating a shared home", async () => {
  const p = await page();
  await start(p, "Pat", 48);
  await p.locator("#edit-profile-button").click();
  await p.locator("#profile-partner").fill("Robin");
  await p.locator("#profile-form button[type=submit]").click();
  await addItem(p, "asset", "home", "Our flat", 300000, { owner: "shared" });
  await addItem(p, "asset", "isa", "Robin ISA", 20000, { owner: "partner" });
  assert.equal(await displayedAmount(p, "#asset-total"), 320000);
  assert.equal(await p.locator(".orbit-owner-shared").count(), 1);
  assert.equal(await p.locator(".orbit-owner-partner").count(), 1);
  await p.locator(".orbit-owner-partner").click();
  await p.locator("#item-owner").selectOption("shared");
  await p.locator("#save-item-button").click();
  assert.equal(await p.locator('[data-owner-group="partner"] .orbit-card').count(), 0);
  assert.equal(await p.locator('[data-owner-group="shared"] .orbit-card').count(), 2);
  assert.match(await p.locator('[data-owner-group="shared"]').innerText(), /£320,000/);
  assert.equal(await displayedAmount(p, "#asset-total"), 320000);
  await p.locator("#edit-profile-button").click();
  await p.locator("#profile-partner").fill("");
  await p.locator("#profile-form button[type=submit]").click();
  assert.equal(await p.locator("#profile-dialog").isVisible(), true, "A partner with items cannot disappear silently");
  await p.close();
});

test("a large entered total stays inside the household summary", async () => {
  const p = await page(true);
  await start(p);
  await addItem(p, "asset", "other", "Large holding", 100000000000);
  assert.equal(await displayedAmount(p, "#net-worth"), 100000000000);
  const fit = await p.evaluate(() => {
    const circle = document.querySelector(".constellation-centre").getBoundingClientRect();
    const amount = document.querySelector("#net-worth");
    const text = amount.getBoundingClientRect();
    return { inside: text.left >= circle.left && text.right <= circle.right, scroll: amount.scrollWidth, width: amount.clientWidth };
  });
  assert.ok(fit.inside && fit.scroll <= fit.width + 1, JSON.stringify(fit));
  await p.close();
});

test("quick add and access review update the household picture without changing net worth", async () => {
  const p = await page();
  assert.match(await p.locator('#access-review-count').innerText(), /3 access details/);
  await p.locator('#access-review summary').click();
  assert.equal(await p.locator('[data-owner-group="primary"] [data-bucket="review"] [data-orbit-id="alex-shares"]').count(), 1);
  await p.locator('[data-review-id="alex-shares"]').click();
  assert.equal(await p.locator("#item-access-bucket").inputValue(), "review");
  await p.locator("#item-access-bucket").selectOption("accessible");
  await p.locator("#item-confidence").selectOption("exact");
  await p.locator("#save-item-button").click();
  assert.equal(await p.locator('[data-owner-group="primary"] [data-bucket="accessible"] [data-orbit-id="alex-shares"]').count(), 1);
  await p.locator('[data-chart-view="access"]').click();
  assert.match(await p.locator("#chart-categories").innerText(), /Generally accessible[\s\S]*£790,000/);
  assert.equal(await displayedAmount(p, "#net-worth"), 2145000);
  assert.equal(await displayedAmount(p, "#accessible-total"), 790000);
  assert.match(await p.locator('#access-review-count').innerText(), /2 access details/);
  await p.locator('[data-review-id="alex-pension"]').click();
  await p.locator("#item-pension-access-age").fill("55");
  await p.locator("#save-item-button").click();
  assert.match(await p.locator('[data-orbit-id="alex-pension"]').innerText(), /Age 55/);
  await p.locator('[data-review-id="gemma-pension"]').click();
  await p.locator('#item-pension-access-age').fill('57');
  await p.locator('#save-item-button').click();
  assert.equal(await p.locator('#access-review').isVisible(), false);
  await p.locator('[data-add-owner="partner"]').click();
  await p.keyboard.press('Escape');
  await p.locator('#add-dialog').waitFor({ state: 'hidden' });
  await p.waitForFunction(() => document.activeElement?.dataset.addOwner === 'partner');
  await p.keyboard.press('Enter');
  await p.locator('[data-quick-kind="isa"]').click();
  assert.equal(await p.locator("#item-kind").inputValue(), "isa");
  assert.equal(await p.locator("#item-owner").inputValue(), "partner", "The row preselects its owner");
  await p.locator("#item-amount").fill("25000");
  await p.locator("#save-item-button").click();
  assert.equal(await displayedAmount(p, "#net-worth"), 2170000);
  await p.locator('[data-chart-view="owner"]').click();
  assert.match(await p.locator('[data-chart-key="partner"].chart-category').innerText(), /£545,000/);
  assert.match(await p.locator('[data-owner-group="partner"] [data-bucket="accessible"]').innerText(), /£325k/);
  await p.close();
});
