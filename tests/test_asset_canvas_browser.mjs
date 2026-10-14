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
  return browserPage;
}

async function start(browserPage, name = "Alex", age = 52) {
  await browserPage.locator("#start-own-button").click();
  await browserPage.locator("#confirm-clear-button").click();
  await browserPage.locator("#person-name").fill(name);
  await browserPage.locator("#person-age").fill(String(age));
  await browserPage.locator("#start-button").click();
  await browserPage.locator("#canvas-screen").waitFor({ state: "visible" });
}

async function addItem(browserPage, type, kind, label, amount, extras = {}) {
  await browserPage.locator(type === "asset" ? "#add-asset-button" : "#add-debt-button").click();
  await browserPage.locator("#item-dialog").waitFor({ state: "visible" });
  await browserPage.locator("#item-kind").selectOption(kind);
  if (label) await browserPage.locator("#item-label").fill(label);
  await browserPage.locator("#item-amount").fill(String(amount));
  if (extras.rate !== undefined || extras.years !== undefined) await browserPage.locator("#mortgage-fields summary").click();
  if (extras.rate !== undefined) await browserPage.locator("#item-interest-rate").fill(String(extras.rate));
  if (extras.years !== undefined) await browserPage.locator("#item-remaining-years").fill(String(extras.years));
  if (extras.link !== undefined) await browserPage.locator("#item-linked-asset").selectOption(extras.link);
  await browserPage.locator("#save-item-button").click();
  await browserPage.locator("#item-dialog").waitFor({ state: "hidden" });
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
  assert.equal(await p.locator("[data-asset-id]").count(), 0);
  assert.equal(await p.locator("[data-debt-id]").count(), 0);
  assert.match(await p.locator("#canvas-screen").innerText(), /(?:nothing|no assets|none|start|entered)/i);
  await p.close();
});

test("assets, linked mortgage and edits reconcile without double counting equity", async () => {
  const p = await page();
  await start(p);
  await addItem(p, "asset", "home", "Our home", 480000);
  const homeId = await p.locator("[data-asset-id]").first().getAttribute("data-asset-id");
  assert.ok(homeId);
  await addItem(p, "debt", "mortgage", "Home mortgage", 190000, { rate: 4.5, years: 18, link: homeId });
  await addItem(p, "asset", "isa", "Stocks and shares ISA", 35000);
  await p.locator(".list-disclosure summary").click();
  assert.equal(await displayedAmount(p, "#asset-total"), 515000);
  assert.equal(await displayedAmount(p, "#debt-total"), 190000);
  assert.equal(await displayedAmount(p, "#net-worth"), 325000);
  assert.match(await p.locator("#asset-list").innerText(), /290,000/);
  assert.match(await p.locator("#debt-list").innerText(), /4\.5\s*%/);
  assert.match(await p.locator("#debt-list").innerText(), /18\s*(?:years|yrs)/i);

  await p.locator("[data-edit-debt]").first().click();
  await p.locator("#item-amount").fill("175000");
  await p.locator("#save-item-button").click();
  assert.equal(await displayedAmount(p, "#asset-total"), 515000);
  assert.equal(await displayedAmount(p, "#debt-total"), 175000);
  assert.equal(await displayedAmount(p, "#net-worth"), 340000);
  assert.match(await p.locator("#asset-list").innerText(), /305,000/);

  await p.locator("[data-edit-debt]").first().click();
  await p.locator("#delete-item-button").click();
  assert.equal(await p.locator("[data-debt-id]").count(), 0);
  assert.equal(await displayedAmount(p, "#net-worth"), 515000);
  await p.close();
});

test("a mortgage can be linked with the keyboard, without dragging", async () => {
  const p = await page();
  await start(p);
  await addItem(p, "asset", "home", "Flat", 250000);
  await p.locator("#add-debt-button").click();
  await p.locator("#item-kind").selectOption("mortgage");
  const link = p.locator("#item-linked-asset");
  assert.equal(await link.isVisible(), true);
  assert.equal(await link.isEnabled(), true);
  await link.focus();
  await link.press("End");
  const chosen = await link.inputValue();
  assert.equal(chosen, await p.locator("[data-asset-id]").first().getAttribute("data-asset-id"));
  await p.locator("#item-amount").fill("100000");
  await p.locator("#save-item-button").click();
  assert.equal(await displayedAmount(p, "#net-worth"), 150000);
  await p.close();
});

test("dragging a mortgage onto a home links it without changing the totals", async () => {
  const p = await page();
  await start(p);
  await addItem(p, "asset", "home", "The house", 300000);
  await addItem(p, "debt", "mortgage", "The mortgage", 120000);
  await p.locator(".list-disclosure summary").click();
  const before = await displayedAmount(p, "#net-worth");
  await p.locator("[data-debt-id]").dragTo(p.locator("[data-asset-id]"));
  assert.match(await p.locator("#debt-list").innerText(), /Linked to The house/);
  assert.match(await p.locator("#asset-list").innerText(), /180,000/);
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
  assert.match(await p.locator(".canvas-heading").innerText(), /Sam’s money picture\.[\s\S]*Age 60/);
  await addItem(p, "asset", "car", "Old car", 0);
  assert.match(await p.locator("#asset-count").innerText(), /1 asset entered/);
  assert.match(await p.locator("#orbit-items").innerText(), /£0/);
  await addItem(p, "debt", "loan", "Small loan", 5000);
  assert.equal(await displayedAmount(p, "#net-worth"), -5000);
  await p.reload();
  assert.equal(await p.locator("#canvas-screen").isVisible(), true);
  assert.equal(await displayedAmount(p, "#net-worth"), 1525000);
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
  assert.equal(await displayedAmount(p, "#net-worth"), 1525000);
  await p.close();
});

test("Alex's opening picture includes editable details and reconciles exactly", async () => {
  const p = await page();
  assert.equal(await displayedAmount(p, "#asset-total"), 1905000);
  assert.equal(await displayedAmount(p, "#debt-total"), 380000);
  assert.equal(await displayedAmount(p, "#net-worth"), 1525000);
  assert.equal(await p.locator(".orbit-card").count(), 8);
  assert.match(await p.locator("#example-badge").innerText(), /Fictional example/);
  await p.locator('[data-orbit-id="alex-gurgaon"]').click();
  assert.equal(await p.locator("#item-monthly-rent").inputValue(), "100");
  await p.locator("#item-monthly-rent").fill("125");
  await p.locator("#save-item-button").click();
  assert.match(await p.locator('[data-orbit-id="alex-gurgaon"]').innerText(), /£125\/month rent/);
  assert.equal(await displayedAmount(p, "#net-worth"), 1525000);
  await p.locator('[data-orbit-id="alex-cash"]').click();
  assert.equal(await p.locator("#item-cash-rate").inputValue(), "4");
  await p.locator("#close-item-button").click();
  await p.locator('[data-orbit-id="alex-pension"]').click();
  assert.equal(await p.locator("#item-investment-label").inputValue(), "S&P");
  await p.locator("#close-item-button").click();
  await p.locator('[data-orbit-id="alex-mortgage"]').click();
  assert.equal(await p.locator("#item-interest-rate").inputValue(), "4.7");
  await p.locator("#close-item-button").click();
  await p.locator("#reset-example-button").click();
  assert.match(await p.locator('[data-orbit-id="alex-gurgaon"]').innerText(), /£100\/month rent/);
  await p.close();
});
