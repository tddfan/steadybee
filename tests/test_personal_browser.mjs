import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const prototype = resolve(dirname(fileURLToPath(import.meta.url)), "../prototype");
const types = {
  ".html": "text/html",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
let server;
let browser;
let origin;
const pageErrors = [];

before(async () => {
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://test").pathname;
      const file = resolve(prototype, "." + pathname);
      if (!file.startsWith(prototype + "/")) throw new Error("Invalid path");
      const body = await readFile(file);
      response.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
      response.end(body);
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
  if (server) await new Promise((done) => server.close(done));
  assert.deepEqual(pageErrors, [], "The Plan Sketch should have no browser runtime errors");
});

async function openPage(viewport = { width: 1360, height: 900 }) {
  const page = await browser.newPage({ viewport, acceptDownloads: true });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(origin + "/plan-sketch.html");
  await page.locator("#field-birthDate").waitFor();
  return page;
}

async function enterBridgePlan(page, changes = {}) {
  const fields = {
    birthDate: "1973-06-01",
    retirementAge: "53",
    endAge: "70",
    spendingToday: "70000",
    cash: "10000",
    isa: "0",
    dc: "500000",
    annualNetEarnings: "60000",
    annualDcContribution: "0",
    statePensionAge: "67",
    annualStatePensionNet: "12000",
    pensionAccessDate: "2030-06-01",
    dcWithdrawalTaxRate: "20",
    inflationRate: "2.5",
    investedReturnRate: "5",
    cashReturnRate: "2",
    shockRate: "-20",
    ...changes,
  };
  for (const [key, value] of Object.entries(fields)) {
    await page.locator(`#field-${key}`).fill(value);
  }
  await page.locator("#field-withdrawalPolicy").selectOption("cash-first");
  await page.locator('#plan-form button[type="submit"]').click();
  await page.locator("#review-stage").waitFor({ state: "visible" });
}

async function confirmReceipt(page) {
  await page.locator("#pension-provider-confirmed").check();
  await page.locator("#tax-assumption-confirmed").check();
  await page.locator("#receipt-confirmed").check();
  assert.equal(await page.locator("#calculate-button").isEnabled(), true);
  await page.locator("#calculate-button").click();
  await page.locator("#explore-stage").waitFor({ state: "visible" });
}

test("unknown essentials and unchecked receipt prevent a personal result", async () => {
  const page = await openPage();
  try {
    await page.locator('#plan-form button[type="submit"]').click();
    assert.equal(await page.locator("#explore-stage").isVisible(), false);
    const message = [
      await page.locator("#entry-errors").innerText(),
      await page.locator("#review-errors").innerText(),
      await page.locator("#receipt-summary").innerText(),
    ].join(" ");
    assert.match(message, /unknown|missing|required|need|enter|confirm/i);

    if (await page.locator("#review-stage").isVisible()) {
      await page.locator("#back-to-entry").click();
    }
    await enterBridgePlan(page);
    assert.equal(await page.locator("#calculate-button").isEnabled(), false);
    assert.equal(await page.locator("#explore-stage").isVisible(), false);
    assert.match(await page.locator("#receipt-list").innerText(), /70,000/);
  } finally {
    await page.close();
  }
});

test("access at age 55 after April 2028 requires an explicit protected-age confirmation", async () => {
  const page = await openPage();
  try {
    await enterBridgePlan(page, { pensionAccessDate: "2028-06-01" });
    assert.equal(await page.locator("#protected-pension-age-confirmed").isVisible(), true);
    assert.match(await page.locator("#receipt-summary").innerText(), /protected pension age/i);
    await page.locator("#pension-provider-confirmed").check();
    await page.locator("#tax-assumption-confirmed").check();
    await page.locator("#receipt-confirmed").check();
    assert.equal(await page.locator("#calculate-button").isEnabled(), false);
    assert.equal(await page.locator("#explore-stage").isVisible(), false);

    await page.locator("#protected-pension-age-confirmed").check();
    assert.equal(await page.locator("#calculate-button").isEnabled(), true);
    await page.locator("#calculate-button").click();
    await page.locator("#explore-stage").waitFor({ state: "visible" });
    assert.ok(await page.locator("#year-table tr").count() > 0);
  } finally {
    await page.close();
  }
});

test("a plan with no DC pension does not demand pension-access or DC-tax confirmations", async () => {
  const page = await openPage();
  try {
    await enterBridgePlan(page, { dc: "0", pensionAccessDate: "", dcWithdrawalTaxRate: "" });
    assert.equal(await page.locator("#pension-provider-confirmed").isVisible(), false);
    assert.equal(await page.locator("#protected-pension-age-confirmed").isVisible(), false);
    assert.equal(await page.locator("#tax-assumption-confirmed").isVisible(), false);
    assert.match(await page.locator("#receipt-summary").innerText(), /required figures are present/i);
    await page.locator("#receipt-confirmed").check();
    assert.equal(await page.locator("#calculate-button").isEnabled(), true);
    await page.locator("#calculate-button").click();
    await page.locator("#explore-stage").waitFor({ state: "visible" });
    assert.match(await page.locator("#bridge-callout").innerText(), /no DC pension/i);
    assert.equal(await page.locator("#year-chart .chart-segment.locked").count(), 0);
  } finally {
    await page.close();
  }
});

test("personal result exposes inflation, locked bridge, annual workings, market timing and a date comparison", async () => {
  const page = await openPage();
  try {
    await enterBridgePlan(page);
    await confirmReceipt(page);

    assert.match(await page.locator("#assumption-list").innerText(), /inflation[\s\S]*2\.5\s*%/i);
    const inflationExample = await page.locator("#assumption-list dd").last().innerText();
    const illustratedSpending = [...inflationExample.matchAll(/£([\d,]+)/g)]
      .map((match) => Number(match[1].replaceAll(",", "")));
    assert.equal(illustratedSpending[0], 70000);
    assert.ok(illustratedSpending[1] > illustratedSpending[0],
      "The result must show that today's spending requires a larger future-pound withdrawal");
    assert.match(await page.locator(".chart-card").innerText(), /today.s pounds/i);
    assert.match(await page.locator(".table-card").innerText(), /today.s pounds/i);
    assert.match(await page.locator("#bridge-callout").innerText(), /bridge|before.*access|locked/i);
    assert.ok((await page.locator("#coverage-headline").innerText()).trim().length > 0);
    assert.ok(await page.locator("#year-table tr").count() >= 17);

    const firstYear = page.locator("#year-chart .year-column").first();
    assert.match(await firstYear.getAttribute("aria-label"), /age 53/i);
    assert.ok(await firstYear.locator(".chart-segment.locked").count() > 0,
      "Age 53 shows inaccessible DC money with the striped locked segment");
    await firstYear.click();
    assert.match(await page.locator("#inspector-heading").innerText(), /age 53/i);
    assert.match(await page.locator("#year-workings").innerText(), /spending|uncovered/i);
    assert.match(await page.locator("#year-explanation").innerText(), /locked|access/i);

    const accessYear = page.locator('#year-chart .year-column[aria-label*="57"]');
    assert.equal(await accessYear.count(), 1);
    await accessYear.click();
    assert.match(await page.locator("#inspector-heading").innerText(), /age 57/i);
    assert.match(await page.locator("#year-table").innerText(), /locked[\s\S]*accessible/i);

    assert.doesNotMatch(await page.locator("#comparison-grid").innerText(), /early market shock|later market shock/i);
    assert.equal(await page.locator("#shock-method-note").isVisible(), false);
    await page.locator("#alternative-age").fill("58");
    await page.locator('#alternative-form button[type="submit"]').click();
    assert.match(await page.locator("#comparison-grid").innerText(), /58/);
    assert.match(await page.locator("#comparison-grid").innerText(), /53/);
    assert.doesNotMatch(await page.locator("#comparison-grid").innerText(), /early market shock|later market shock/i,
      "Comparing retirement dates must not reveal market stress results");
    const [originalOutcome, alternateOutcome] = await page.locator("#comparison-grid article strong").allInnerTexts();
    assert.notEqual(originalOutcome, alternateOutcome,
      "The date comparison must show a changed outcome when five more years of pay are entered");

    await page.locator("#compare-shocks-button").click();
    const comparisons = await page.locator("#comparison-grid").innerText();
    assert.match(comparisons, /early market shock/i);
    assert.match(comparisons, /later market shock/i);
    assert.equal(await page.locator("#shock-method-note").isVisible(), true);
    const earlyOutcome = await page.locator("#comparison-grid article").nth(2)
      .locator(".comparison-metrics").innerText();
    const lateOutcome = await page.locator("#comparison-grid article").nth(3)
      .locator(".comparison-metrics").innerText();
    assert.notEqual(earlyOutcome, lateOutcome,
      "Moving the same one-year market shock must change the shown outcome");
    await page.locator("#shock-method-note summary").click();
    assert.match(await page.locator("#shock-method").innerText(), /20\s*%|−20\s*%|-20\s*%/);
    assert.match(await page.locator("#shock-method").innerText(), /first|early|drawdown/i);

    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true,
      "The whole page should not scroll sideways on a narrow phone");
    const keyboardYear = page.locator("#year-chart .year-column").first();
    assert.equal(await keyboardYear.evaluate((element) => element.tagName), "BUTTON");
    assert.ok(await keyboardYear.evaluate((element) => element.tabIndex) >= 0);
    await keyboardYear.focus();
    await keyboardYear.press("Enter");
    assert.equal(await keyboardYear.getAttribute("aria-pressed"), "true");
    assert.match(await page.locator("#year-explanation").innerText(), /locked|access/i);

    await page.locator("#clear-button").click();
    await page.locator("#enter-stage").waitFor({ state: "visible" });
    assert.equal(await page.locator("#field-spendingToday").inputValue(), "");
    assert.equal(await page.locator("#field-cash").inputValue(), "");
    assert.equal(await page.locator("#year-table tr").count(), 0);
    assert.equal(await page.locator("#receipt-list").innerText(), "");
    assert.equal(await page.locator("#comparison-grid").innerText(), "");
    assert.equal(await page.evaluate(() => document.body.textContent.includes("£70,000")), false,
      "Clear removes personal amounts even from hidden receipt and result sections");
  } finally {
    await page.close();
  }
});
