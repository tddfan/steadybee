import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDraft, field } from "../prototype/state.mjs";
import { evaluateExample as evaluateFixture } from "../prototype/fixtures.mjs";
import { landingChoices } from "../prototype/landing-choices.mjs";

// Optional browser check. Supply PLAYWRIGHT_MODULE and CHROME_EXECUTABLE_PATH.
const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let server, browser, origin;
const errors = [];
const mime = {
  ".html": "text/html",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};
before(async () => {
  server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, "http://test").pathname;
      const file = resolve(
        root,
        "prototype",
        "." + (path === "/" ? "/index.html" : path),
      );
      if (!file.startsWith(resolve(root, "prototype") + "/")) throw Error();
      res.setHeader(
        "Content-Type",
        mime[extname(file)] || "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = "http://127.0.0.1:" + server.address().port;
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
async function page(path = "app.html#setup", mobile = false) {
  const p = await browser.newPage({
    viewport: mobile
      ? { width: 375, height: 812 }
      : { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto(origin + "/" + path);
  await p.locator("main h1").waitFor();
  return p;
}
async function nav(p, view) {
  await p.locator(`.sidebar a[href="#${view}"]`).click();
  await p.waitForURL("**#" + view);
  await p.waitForFunction(
    (v) => window.snapshotSteadybeePlan()?.activeView === v,
    view,
  );
}
async function fillStart(
  p,
  {
    age = 58,
    target = 62,
    pension = 400000,
    savings = 90000,
    spend = 3000,
  } = {},
) {
  for (const [id, v] of Object.entries({
    age,
    targetRetirementAge: target,
    pensionTotal: pension,
    nonPensionTotal: savings,
    monthlySpending: spend,
  })) {
    if (await p.locator("#" + id).count())
      await p.locator("#" + id).fill(String(v));
  }
  await p.locator("#setup-form button[type=submit]").click();
  await p.waitForURL("**#overview");
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan()?.activeView === "overview",
  );
}
const snapshot = (p) => p.evaluate(() => window.snapshotSteadybeePlan());

const csvRows = (csv) => csv.split(/\r?\n/).map((line) => (
  [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((match) => match[1].replaceAll('""', '"'))
));
const pounds = (value) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);

test("the landing opens at a full age95 endpoint and every horizon updates gaps, range and chart accessibility", async () => {
  const p = await page("index.html");
  await p.locator("#bridge-chart svg").waitFor();
  assert.equal(await p.locator("#preview-horizon").inputValue(), "95");
  assert.equal(await p.locator('[data-zoom="full"]').getAttribute("aria-pressed"), "true");
  assert.equal(await p.locator('[data-view="funding"]').getAttribute("aria-pressed"), "true");
  for (const age of [95, 90, 100]) {
    await p.locator("#preview-horizon").selectOption(String(age));
    const result = evaluateFixture("early-dc", { horizonAge: age });
    const laterRows = result.rows.filter((row) => row.primaryAge >= 60 && row.annualGap > 0);
    assert.equal(await p.locator("#preview").getAttribute("data-chart-end-age"), String(age));
    assert.equal(await p.locator("#chart-range").innerText(), `Alex’s age 52–${age} →`);
    assert.match(await p.locator("#retirement-chart-title").textContent(), new RegExp(`ages 52 to ${age}`));
    assert.match(await p.locator("#retirement-chart-description").textContent(), new RegExp(`Planning ends at age ${age}`));
    assert.equal(await p.locator("#preview-gap").innerText(), pounds(result.summary.bridgeGapTotal));
    assert.equal(await p.locator("#preview-later-age").innerText(), "Age 81");
    assert.equal(await p.locator("#preview-later-gap").innerText(), `${pounds(laterRows.reduce((sum, row) => sum + row.annualGap, 0))} total across ${age - 81 + 1} years · 2055–${2026 + age - 52}`);
    assert.match(await p.locator("#preview-gap-years").innerText(), /Ages 57–59 · 2031–2033/);
    assert.equal(await p.locator("#bridge-chart svg g").count(), age - 52 + 1);
    assert.match(await p.locator("#bridge-chart svg g").nth(5).locator("title").textContent(), /Alex age 57[\s\S]*Spending not covered £34,777/);
    assert.match(await p.locator("#bridge-chart svg g").nth(29).locator("title").textContent(), /Alex age 81[\s\S]*Spending not covered £/);
    assert.match(await p.locator("#preview-outcome").innerText(), new RegExp(`remains at ${age}`));
    const href = new URL(await p.locator("#preview-open").getAttribute("href"), p.url());
    assert.equal(href.searchParams.get("horizon"), String(age));
    await p.locator('[data-view="balances"]').click();
    assert.equal(await p.locator('[data-view="balances"]').getAttribute("aria-pressed"), "true");
    assert.match(await p.locator("#retirement-chart-description").textContent(), /Earlier spending gaps are separate from assets/);
    const scale = await p.locator("#bridge-chart svg text").nth(2).textContent();
    const maximum = Math.max(...result.rows.flatMap((row) => [row.closingAccessible, row.closingPension]));
    assert.ok(Number(scale.replace(/[£k]/g, "")) * 1000 >= maximum, "Balance scale contains the largest displayed asset stock");
    await p.locator('[data-zoom="bridge"]').click();
    assert.equal(await p.locator("#preview").getAttribute("data-chart-end-age"), "62");
    assert.match(await p.locator("#retirement-chart-title").textContent(), /ages 52 to 62/);
    assert.equal(await p.locator("#preview-later-age").innerText(), "Age 81", "Zoom preserves the later-life warning");
    await p.locator('[data-zoom="full"]').click();
    await p.locator('[data-view="funding"]').click();
  }
  await p.close();
});

test("landing year inspection reconciles funding and keeps remaining money separate from unpaid gaps", async () => {
  const p = await page("index.html");
  await p.locator("#bridge-chart svg").waitFor();
  await p.locator("details.preview-year-detail > summary").click();
  for (const choice of landingChoices) {
    await p.locator(`[data-preview="${choice.id}"]`).click();
    const result = evaluateFixture("early-dc", { ...choice.overrides, horizonAge: 95 });
    for (const age of [52, 57, 60, 81, 95]) {
      await p.locator("#preview-year").selectOption(String(age));
      const row = result.rows.find((r) => r.primaryAge === age);
      const values = await p.locator("#preview-year-facts dl").evaluate((dl) => Object.fromEntries([...dl.children].map((el) => [el.querySelector("dt").textContent, Number(el.querySelector("dd").textContent.replace(/\/year$/, "").replace(/[^\d.-]/g, ""))])));
      assert.equal(values.Income, Math.round(Math.min(row.income, row.spending + row.majorCost)));
      assert.equal(values["Savings used"], Math.round(row.withdrawalsAccessible));
      assert.equal(values["Pension pot used"], Math.round(row.withdrawalsPension));
      assert.equal(values["Spending not covered"], Math.round(row.annualGap));
      assert.ok(Math.abs(values.Income + values["Savings used"] + values["Pension pot used"] + values["Spending not covered"] - values["Spending target"]) <= 2, `${choice.id}, age${age}: displayed funding adds to spending`);
      assert.equal(values["Savings outside pensions left"], Math.round(row.closingAccessible));
      assert.equal(values["Pension available to draw"], Math.round(row.closingAvailablePension));
      assert.equal(values["Pension still locked"], Math.round(row.closingLockedPension));
      assert.equal(values["Earlier and current spending not covered"], Math.round(row.cumulativeGap));
      assert.ok(Math.abs(values["Savings outside pensions left"] + values["Pension available to draw"] + values["Pension still locked"] - row.closingTotal) <= 1.5, "Closing assets contain only remaining savings and pensions");
      if (choice.id === "baseline" && age === 60) {
        assert.equal(values["Spending not covered"], 0);
        assert.equal(values["Earlier and current spending not covered"], 106777);
      }
    }
  }
  await p.close();
});

test("landing charts reflow at320,375 and1440 and choice plus horizon survive workspace handoff and refresh", async () => {
  const p = await page("index.html");
  for (const [index, width] of [320, 375, 1440].entries()) {
    await p.goto(origin + "/index.html");
    await p.setViewportSize({ width, height: 900 });
    await p.locator("#bridge-chart svg").waitFor();
    const choice = landingChoices[index];
    const horizon = [95, 90, 100][index];
    await p.locator(`[data-preview="${choice.id}"]`).click();
    await p.locator("#preview-horizon").selectOption(String(horizon));
    for (const view of ["funding", "balances"]) {
      await p.locator(`[data-view="${view}"]`).click();
      await p.waitForFunction(() => document.querySelector("#bridge-chart svg").viewBox.baseVal.width === Math.max(document.querySelector("#bridge-chart").clientWidth, 220));
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at${width}`);
      const labels = await p.locator("#bridge-chart svg").evaluate((svg) => [...svg.querySelectorAll("text")].map((el) => {
        const box = el.getBBox();
        return { font: parseFloat(getComputedStyle(el).fontSize) * svg.getBoundingClientRect().width / svg.viewBox.baseVal.width, left: box.x, right: box.x + box.width, width: svg.viewBox.baseVal.width };
      }));
      assert.ok(labels.every((label) => label.font >= 12), `Labels are legible at${width}`);
      assert.ok(labels.every((label) => label.left >= 0 && label.right <= label.width), `Labels stay inside the chart at${width}`);
      assert.ok(await p.locator('#bridge-chart path[fill="none"]').evaluateAll((paths) => paths.every((path) => path.getBBox().y >= 0)), "Balance paths stay within the chart scale");
    }
    const href = new URL(await p.locator("#preview-open").getAttribute("href"), p.url());
    assert.equal(href.searchParams.get("choice"), choice.id);
    assert.equal(href.searchParams.get("horizon"), String(horizon));
    await p.locator("#preview-open").click();
    await p.waitForURL(/\/app\.html\?/);
    await p.waitForFunction(() => window.snapshotSteadybeePlan?.()?.mode === "example");
    assert.equal((await snapshot(p)).sampleHorizonAge, horizon);
    assert.equal(await p.locator("#example-horizon").inputValue(), String(horizon));
    await p.reload();
    await p.waitForFunction(() => window.snapshotSteadybeePlan()?.mode === "example");
    const state = await snapshot(p);
    assert.equal(state.sampleHorizonAge, horizon);
    if (choice.id === "baseline") assert.equal(state.activeScenario, null);
    else assert.deepEqual(state.sampleScenarios["early-dc"].find((scenario) => scenario.id === state.activeScenario).overrides, choice.overrides);
    assert.equal(await p.locator("#funding-year-select option").count(), horizon - 52 + 1);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Workspace handoff has no overflow at${width}`);
  }
  await p.close();
});

test("explicit planning endpoints stay consistent across workspace, refresh, brief and exported annual rows", async () => {
  const p = await page("app.html?example=early-dc&choice=later&horizon=95#scenarios");
  assert.equal((await snapshot(p)).sampleHorizonAge, 95);
  assert.equal(await p.locator("#example-horizon").inputValue(), "95");
  for (const age of [90, 100, 95]) {
    await p.locator("#example-horizon").selectOption(String(age));
    assert.equal(new URL(p.url()).searchParams.get("horizon"), String(age));
    assert.equal((await snapshot(p)).sampleHorizonAge, age);
    const rows = p.locator("#funding-year-select option");
    assert.equal(await rows.count(), age - 52 + 1);
    const expectedYear = 2026 + age - 52;
    await p.locator("#funding-year-select").selectOption(String(age - 52));
    assert.equal(await p.locator("#funding-year h3").first().innerText(), `${expectedYear} · Alex ${age}`);
    await p.reload();
    await p.waitForFunction((horizon) => window.snapshotSteadybeePlan()?.sampleHorizonAge === horizon, age);
    const state = await snapshot(p);
    const selected = state.sampleScenarios["early-dc"].find((scenario) => scenario.id === state.activeScenario);
    assert.equal(selected.overrides.retirementAge, 58);
    assert.equal(await p.locator("#example-horizon").inputValue(), String(age));
    assert.doesNotMatch(await p.locator("#main ul.diff").innerText(), /Illustrated horizon/i, "A shared planning endpoint is not an alternative's changed input");
    await nav(p, "report");
    assert.match(await p.locator("#decision-brief").innerText(), new RegExp(`Horizon: end of primary age ${age}`));
    const download = p.waitForEvent("download");
    await p.locator('[data-action="export-csv"]').click();
    const csv = await readFile(await (await download).path(), "utf8");
    assert.match(csv, new RegExp(`The horizon is the end of primary age ${age}`), "The chosen endpoint remains explicit in exported assumptions");
    const parsed = csvRows(csv);
    const headerIndex = parsed.findIndex((row) => row[0] === "year");
    assert.ok(headerIndex >= 0);
    const headers = parsed[headerIndex];
    const annual = parsed.slice(headerIndex + 1).map((row) => Object.fromEntries(headers.map((key, index) => [key, Number(row[index])])));
    assert.equal(annual.length, age - 52 + 1);
    assert.equal(annual.at(-1).year, expectedYear);
    assert.equal(annual.at(-1).primaryAge, age);
    assert.ok(annual.at(-1).cumulativeGap > 0);
    for (const row of annual) {
      assert.ok(Math.abs(Math.min(row.income, row.spending + row.majorCost) + row.withdrawalsAccessible + row.withdrawalsPension + row.annualGap - row.spending - row.majorCost) <= 0.03, `Funding reconciles in ${row.year}`);
      assert.ok(Math.abs(row.closingTotal - row.closingAccessible - row.closingPension) <= 0.02, `Unpaid gaps do not become assets in ${row.year}`);
      assert.ok(Math.abs(row.closingPension - row.closingAvailablePension - row.closingLockedPension) <= 0.02);
    }
    await nav(p, "scenarios");
  }
  await p.close();
});

test("authored choices and switched examples remain truthful on a plain refresh", async () => {
  const p = await page("app.html?example=early-dc&choice=later&horizon=95#scenarios");
  await p.locator('[data-action="example-choice:part-time"]').click();
  assert.equal(new URL(p.url()).searchParams.get("choice"), "part-time");
  await p.reload();
  await p.waitForFunction(() => window.snapshotSteadybeePlan()?.mode === "example");
  let state = await snapshot(p);
  assert.deepEqual(state.sampleScenarios["early-dc"].find((scenario) => scenario.id === state.activeScenario).overrides, landingChoices.find((choice) => choice.id === "part-time").overrides);
  await nav(p, "start");
  await p.locator('a[href="#examples"]').first().click();
  await p.locator('[data-action="example:mixed-household"]').click();
  await p.waitForFunction(() => window.snapshotSteadybeePlan()?.sampleId === "mixed-household");
  assert.equal(new URL(p.url()).searchParams.get("example"), "mixed-household");
  await p.reload();
  await p.waitForFunction(() => window.snapshotSteadybeePlan()?.mode === "example");
  state = await snapshot(p);
  assert.equal(state.sampleId, "mixed-household");
  assert.equal(state.sampleHorizonAge, 95);
  await nav(p, "scenarios");
  await p.locator('[data-action="preset-household"]').click();
  const expected = (await snapshot(p)).sampleScenarios["mixed-household"][0].overrides;
  assert.equal(new URL(p.url()).searchParams.get("choice"), "household");
  await p.reload();
  await p.waitForFunction(() => window.snapshotSteadybeePlan()?.mode === "example");
  state = await snapshot(p);
  assert.equal(state.sampleHorizonAge, 95);
  assert.deepEqual(state.sampleScenarios["mixed-household"].find((scenario) => scenario.id === state.activeScenario)?.overrides, expected);
  await p.locator(`[data-action="delete-scenario:${state.activeScenario}"]`).click();
  assert.notEqual(new URL(p.url()).searchParams.get("choice"), "household", "The removed choice is no longer encoded for reload");
  await p.reload();
  await p.waitForFunction(() => window.snapshotSteadybeePlan()?.mode === "example");
  assert.equal((await snapshot(p)).activeScenario, null, "Reload cannot recreate a removed authored choice");
  await p.close();
});

test("the first access shortfall is distinct from total wealth and unpaid gaps survive later coverage", async () => {
  const p = await page("app.html?example=early-dc#overview", true);
  const text = await p.locator(".outcome-card").innerText();
  assert.match(text, /£34,777[\s\S]*2031 · Alex 57/);
  assert.match(text, /5 years after the example starts, 2 years after Alex retires/);
  assert.match(text, /£473,849 remains in pension money that cannot yet be drawn/);
  assert.match(text, /2031–2033[\s\S]*£106,777/);
  assert.match(text, /2055–2064/);
  await p.locator("#funding-year-select").selectOption("8");
  const year = await p.locator("#funding-year").innerText();
  assert.match(year, /2034 · Alex 60/);
  assert.match(year, /Covered by the income and withdrawals/);
  assert.match(year, /Spending left unpaid so far: £106,777/);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(
    await p.locator(".asset-chart svg text").first().evaluate((el) => {
      const scale = el.ownerSVGElement.getBoundingClientRect().width / el.ownerSVGElement.viewBox.baseVal.width;
      return parseFloat(getComputedStyle(el).fontSize) * scale >= 12;
    }),
    "Chart labels are readable without pinch zoom",
  );
  await p.close();
});

test("authored alternatives show results before editing, reuse saved choices and preserve later shortfalls and part-time dates", async () => {
  const p = await page("app.html?example=early-dc#overview");
  await p.locator('[data-action="example-choice:later"]').click();
  await p.waitForURL("**#scenarios");
  let state = await snapshot(p);
  assert.equal(state.personal, null);
  assert.equal(state.sampleScenarios["early-dc"][0].overrides.retirementAge, 58);
  const comparison = await p.locator("#comparison-result").innerText();
  assert.match(comparison, /£106,777/);
  assert.match(comparison, /2057 · Alex 83/);
  assert.match(comparison, /zero before-access shortfall does not mean all later years are covered/);
  assert.equal(await p.locator("details.scenario-editor").getAttribute("open"), null);
  assert.ok(await p.evaluate(() => !!(
    document.querySelector("#comparison-result").compareDocumentPosition(document.querySelector("#scenario-form")) & Node.DOCUMENT_POSITION_FOLLOWING
  )));
  await p.locator('[data-action="example-choice:later"]').click();
  assert.equal((await snapshot(p)).sampleScenarios["early-dc"].length, 1);
  await p.locator('[data-action="example-choice:part-time"]').click();
  state = await snapshot(p);
  assert.equal(state.sampleScenarios["early-dc"].length, 2);
  const selected = state.sampleScenarios["early-dc"].find((s) => s.id === state.activeScenario);
  assert.deepEqual(selected.overrides, { retirementAge: 55, partTimeAnnual: 24000, partTimeEndAge: 60 });
  await p.locator('[data-action="example-choice:part-time"]').click();
  assert.equal((await snapshot(p)).sampleScenarios["early-dc"].length, 2);
  await nav(p, "report");
  const brief = await p.locator("#decision-brief").innerText();
  assert.match(brief, /Not covered in that first year[\s\S]*£34,777/);
  assert.match(brief, /2057 · age 83/);
  assert.match(brief, /2029(?:–|-| to )2033/);
  assert.match(brief, /55(?:–|-| to )59/);
  assert.match(brief, /(?:ends|until|end)[^\n]{0,100}60/);
  await p.close();
});

test("zero savings outside pensions in a retired year still permits funded pension withdrawals", async () => {
  const p = await page("app.html?example=already-retired#overview");
  await p.locator("#funding-year-select").selectOption("5");
  const text = await p.locator("#funding-year").innerText();
  assert.match(text, /2031 · Priya 71/);
  assert.match(text, /Covered by the income and withdrawals/);
  assert.match(text, /Pension-pot withdrawals\s+£3,153/);
  assert.match(text, /Savings outside pensions\s+£0/);
  assert.match(text, /Pension money available to draw\s+£222,080/);
  assert.doesNotMatch(text, /Spending left unpaid/);
  await p.close();
});

test("deployment restoration keeps the inspected year, displayed funding and asset view consistent", async () => {
  const p = await page("app.html?example=early-dc#overview");
  await p.locator("#funding-year-select").selectOption("8");
  await p.locator('#asset-chart [data-asset-view="pensions"]').click();
  await p.evaluate(() => sessionStorage.setItem(
    "steadybee:update-state:/app.html",
    JSON.stringify({ savedAt: Date.now(), fields: [], plan: window.snapshotSteadybeePlan() }),
  ));
  await p.reload();
  await p.waitForFunction(() => document.querySelector("#funding-year-select")?.value === "8");
  assert.equal(await p.locator("#funding-year-select option:checked").innerText(), "2034 · Alex 60");
  assert.equal(await p.locator("#funding-year h3").first().innerText(), "2034 · Alex 60");
  assert.match(await p.locator("#funding-year").innerText(), /Covered by the income and withdrawals/);
  assert.match(await p.locator("#funding-year").innerText(), /Spending left unpaid so far: £106,777/);
  assert.equal(await p.locator('#asset-chart [data-asset-view="pensions"]').getAttribute("aria-pressed"), "true");
  await p.setViewportSize({ width: 375, height: 812 });
  await p.waitForFunction(() => document.querySelector("#asset-chart svg").viewBox.baseVal.width < 400);
  assert.ok(await p.locator(".asset-chart svg text").first().evaluate((el) => (
    parseFloat(getComputedStyle(el).fontSize) * el.ownerSVGElement.getBoundingClientRect().width / el.ownerSVGElement.viewBox.baseVal.width >= 12
  )));
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await p.locator("#funding-year-select").inputValue(), "8");
  assert.equal(await p.locator("#funding-year h3").first().innerText(), "2034 · Alex 60");
  await p.close();
});

test("intake tab edits stay staged and only confirmed changes revise the baseline", async () => {
  const p = await page();
  await fillStart(p);
  await nav(p, "scenarios");
  await p.locator("#scenario-name").fill("My comparison");
  await p.locator("#scenario-monthlySpending").fill("2500");
  await p.locator("#scenario-form button[type=submit]").click();
  await nav(p, "review");
  await p.locator("#device-save").check();
  const before = (await snapshot(p)).personal;
  await nav(p, "details");
  await p.locator('a[href="#setup"]').click();
  await p.locator("#targetRetirementAge").fill("65");
  await p.locator('[data-route="income"]').click();
  assert.equal((await snapshot(p)).personal.profile.targetRetirementAge.value, 62);
  assert.equal((await snapshot(p)).setupEdit.profile.targetRetirementAge.value, 65);
  await nav(p, "overview");
  let state = (await snapshot(p)).personal;
  assert.equal(state.profile.targetRetirementAge.value, 62);
  assert.equal(state.route, "dc");
  assert.equal(state.revision, before.revision);
  assert.equal(state.scenarios[0].stale, false);
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem("steadybee:workspace:v2")).personal.profile.targetRetirementAge.value), 62);
  await nav(p, "details");
  await p.locator('a[href="#setup"]').click();
  await p.locator("#targetRetirementAge").fill("65");
  await p.locator('[data-route="income"]').click();
  await p.locator("#annualPensionIncome").fill("12000");
  await p.locator("#setup-form button[type=submit]").click();
  await p.waitForURL("**#overview");
  await p.waitForFunction(() => window.snapshotSteadybeePlan()?.activeView === "overview");
  state = (await snapshot(p)).personal;
  assert.equal(state.profile.targetRetirementAge.value, 65);
  assert.equal(state.route, "income");
  assert.equal(state.revision, before.revision + 1);
  assert.equal(state.scenarios[0].baseRevision, before.revision);
  assert.equal(state.scenarios[0].stale, true);
  await p.close();
});

test("personal start preserves unknown/zero and never consumes fictional values", async () => {
  const p = await page();
  await p.locator("#age").fill("52");
  await p.locator("#targetRetirementAge").fill("55");
  await p.locator("#pensionTotal").fill("400000");
  await p.locator("#pensionTotal-status").selectOption("unknown");
  assert.equal(await p.locator("#pensionTotal").inputValue(), "");
  await p.locator("#nonPensionTotal").fill("0");
  await p.locator("#monthlySpending").fill("3000");
  await p.locator("#setup-form button[type=submit]").click();
  await p.waitForURL("**#overview");
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan()?.activeView === "overview",
  );
  let s = await snapshot(p);
  assert.equal(s.personal.profile.pensionTotal.value, null);
  assert.equal(s.personal.profile.nonPensionTotal.value, 0);
  await p.locator('a[href="#examples"]').first().click();
  await p.locator('[data-action="example:early-dc"]').click();
  assert.equal((await snapshot(p)).mode, "example");
  await nav(p, "start");
  await p
    .getByRole("button", { name: "Continue my draft", exact: true })
    .click();
  await p.waitForFunction(
    () =>
      window.snapshotSteadybeePlan().mode === "personal" &&
      window.snapshotSteadybeePlan().activeView === "overview",
  );
  s = await snapshot(p);
  assert.equal(s.mode, "personal");
  assert.equal(s.personal.profile.age.value, 52);
  assert.match(
    await p.locator("main").innerText(),
    /outcomes have not been calculated/,
  );
  await p.close();
});

test("own draft entry exits example mode and route changes preserve scope while clearing hidden future date", async () => {
  const p = await page("app.html?example=mixed-household#overview");
  await nav(p, "start");
  await p.locator("[data-action=personal]").click();
  await p.locator("#age").fill("60");
  await p.locator("#targetRetirementAge").fill("65");
  await p.locator("#scope").selectOption("household");
  await p.locator("#spendingBasis").selectOption("household");
  await p.locator("[data-route=retired]").click();
  assert.equal(await p.locator("#scope").inputValue(), "household");
  assert.equal(await p.locator("#spendingBasis").inputValue(), "household");
  await p.locator("#annualPensionIncome").fill("20000");
  await p.locator("#incomeBasis").selectOption("net");
  await p.locator("#nonPensionTotal").fill("50000");
  await p.locator("#monthlySpending").fill("2000");
  await p.locator("#setup-form button[type=submit]").click();
  await p.waitForURL("**#overview");
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan()?.activeView === "overview",
  );
  const s = await snapshot(p);
  assert.equal(s.mode, "personal");
  assert.equal(s.personal.profile.targetRetirementAge.value, null);
  assert.match(await p.locator("main").innerText(), /£20,000/);
  assert.match(await p.locator("main").innerText(), /income.*year.*net/);
  await p.close();
});

test("income/access next card resolves through actual editor and report retains the split", async () => {
  const p = await page();
  await fillStart(p);
  await p.goto(origin + "/app.html#start");
  /* fresh tab load intentionally clears unsaved work */ await p.goto(
    origin + "/app.html#setup",
  );
  await fillStart(p);
  await p.locator('a[href="#details/contributions"]').click();
  await p.locator("#contribution").fill("500");
  await p.locator("#employer").selectOption("yes");
  await p.locator("#contribution-form button[type=submit]").click();
  await p.waitForURL("**#overview");
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan()?.activeView === "overview",
  );
  await p.locator('a[href="#details/income"]').click();
  await p.locator("#income-amount").fill("12000");
  await p.locator("#income-start").fill("67");
  await p.locator("#stream-basis").selectOption("net");
  await p.locator("#income-form button[type=submit]").click();
  await p.waitForURL("**#overview");
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan()?.activeView === "overview",
  );
  await p.locator('a[href="#details/access"]').first().click();
  await p.locator("#pension-access").fill("60");
  await p.locator("#cash-total").fill("20000");
  await p.locator("#invested-total").fill("70000");
  await p.locator("#access-form button[type=submit]").click();
  await p.waitForURL("**#overview");
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan()?.activeView === "overview",
  );
  await nav(p, "report");
  const text = await p.locator("#decision-brief").innerText();
  assert.match(text, /pension access age\s+60/);
  assert.match(text, /Primary cash.*\s+£20,000/);
  assert.match(text, /Primary investments.*\s+£70,000/);
  await p.close();
});

test("household chronology aligns ages and solo brief excludes retained partner income", async () => {
  const p = await page();
  await fillStart(p, { age: 58, target: 62 });
  await p.goto(origin + "/app.html#details/partner");
  for (const [id, v] of Object.entries({
    "partner-age": 54,
    "partner-targetRetirementAge": 62,
    "partner-pensionTotal": 200000,
    "partner-nonPensionTotal": 30000,
    "partner-monthlySpending": 3000,
    "partner-income": 6000,
  }))
    await p.locator("#" + id).fill(String(v));
  await p.locator("#partner-basis").selectOption("gross");
  await p.locator("#joint-confirm").check();
  await p.locator("#partner-form button[type=submit]").click();
  await p.waitForURL("**#overview");
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan()?.activeView === "overview",
  );
  await p.goto(origin + "/app.html#details/income");
  await p.locator("#income-owner").selectOption("partner");
  await p.locator("#income-amount").fill("6000");
  await p.locator("#income-start").fill("62");
  await p.locator("#stream-basis").selectOption("gross");
  await p.locator("#income-form button[type=submit]").click();
  await p.waitForURL("**#overview");
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan()?.activeView === "overview",
  );
  let text = await p.locator("main").innerText();
  assert.match(text, /2030[\s\S]*Your retirement timing/);
  assert.match(text, /2034[\s\S]*Partner retirement timing/);
  assert.match(
    text,
    /Partner db income starts · primary age 66 · partner age 62/,
  );
  assert.match(text, /Partner pension income is gross/);
  await p.goto(origin + "/app.html#details/partner");
  await p.locator("[data-action=remove-partner]").click();
  await p.waitForURL("**#overview");
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan()?.activeView === "overview",
  );
  await nav(p, "report");
  text = await p.locator("#decision-brief").innerText();
  assert.doesNotMatch(text, /£6,000/);
  assert.equal((await snapshot(p)).personal.details.incomeStreams.length, 1);
  await p.close();
});

test("local saving/resume and hostile-ID import are truthful and inert", async () => {
  const p = await page();
  await fillStart(p);
  await nav(p, "review");
  await p.locator("#device-save").check();
  assert.ok(
    await p.evaluate(() => localStorage.getItem("steadybee:workspace:v2")),
  );
  await p.reload();
  await p.locator("h1").waitFor();
  await nav(p, "start");
  await p.locator("[data-action=resume]").click();
  assert.equal((await snapshot(p)).personal.profile.age.value, 58);
  const d = createDraft();
  d.profile.age = field(60);
  d.scenarios = [
    {
      id: 'test" data-injected="true" onclick="window.__injected=true',
      name: "Imported choice",
      baseRevision: 1,
      overrides: { monthlySpending: 2000 },
      stale: false,
      createdAt: new Date().toISOString(),
    },
  ];
  await nav(p, "review");
  await p.locator("#restore-file").setInputFiles({
    name: "draft.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(d)),
  });
  await p.waitForURL("**#overview");
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan()?.activeView === "overview",
  );
  assert.equal(
    await p.evaluate(() => localStorage.getItem("steadybee:workspace:v2")),
    null,
  );
  assert.equal((await snapshot(p)).personal.consent.deviceSave, false);
  await nav(p, "scenarios");
  assert.equal(await p.locator("[data-injected]").count(), 0);
  await p.getByRole("button", { name: "Imported choice", exact: true }).click();
  assert.equal(await p.evaluate(() => window.__injected), undefined);
  await nav(p, "review");
  await p.locator("#device-save").check();
  await p.locator("[data-action=delete-work]").click();
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan().personal === null,
  );
  assert.equal(
    await p.evaluate(() => localStorage.getItem("steadybee:workspace:v2")),
    null,
  );
  await p.close();
});

test("keyboard skip link focuses the current view without changing the route", async () => {
  const p = await page("app.html?example=mixed-household#overview");
  await p.keyboard.press("Tab");
  assert.equal(
    await p.locator(".skip").evaluate((el) => el === document.activeElement),
    true,
  );
  await p.keyboard.press("Enter");
  assert.equal(
    await p.locator("#main").evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(new URL(p.url()).hash, "#overview");
  assert.equal((await snapshot(p)).activeView, "overview");
  await p.close();
});

test("deployment restoration preserves personal work, example scenarios and unfinished edits", async () => {
  const p = await page();
  await fillStart(p);
  await nav(p, "scenarios");
  await p.locator("#scenario-name").fill("My reduced spending");
  await p.locator("#scenario-monthlySpending").fill("2500");
  await p.locator("#scenario-form button[type=submit]").click();
  await nav(p, "start");
  await p.locator('a[href="#examples"]').first().click();
  await p.locator('[data-action="example:mixed-household"]').click();
  await nav(p, "scenarios");
  await p.locator("[data-action=preset-household]").click();
  await p.locator("details.scenario-editor > summary").click();
  await p.locator("#scenario-name").fill("Unfinished example revision");
  await p.locator("#scenario-majorCost").fill("22000");
  await p.evaluate(() =>
    sessionStorage.setItem(
      "steadybee:update-state:/app.html",
      JSON.stringify({
        savedAt: Date.now(),
        fields: [],
        plan: window.snapshotSteadybeePlan(),
      }),
    ),
  );
  await p.reload();
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan()?.mode === "example",
  );
  const s = await snapshot(p);
  assert.equal(s.personal.profile.age.value, 58);
  assert.equal(s.personal.scenarios[0].name, "My reduced spending");
  assert.equal(s.sampleScenarios["mixed-household"].length, 1);
  assert.equal(s.activeView, "scenarios");
  assert.equal(await p.locator("details.scenario-editor").getAttribute("open"), "");
  assert.equal(
    await p.locator("#scenario-name").inputValue(),
    "Unfinished example revision",
  );
  assert.equal(await p.locator("#scenario-majorCost").inputValue(), "22000");
  assert.equal(
    await p.evaluate(() =>
      sessionStorage.getItem("steadybee:update-state:/app.html"),
    ),
    null,
  );
  assert.equal(
    await p.evaluate(() => localStorage.getItem("steadybee:workspace:v2")),
    null,
  );
  await p.close();
});

test("mixed household scenario preserves all changes, printable dates and CSV provenance", async () => {
  const p = await page("app.html?example=mixed-household#overview");
  await nav(p, "scenarios");
  await p.locator("[data-action=preset-household]").click();
  assert.equal(
    (await snapshot(p)).sampleScenarios["mixed-household"][0].overrides
      .retirementAge,
    59,
  );
  await nav(p, "report");
  const t = await p.locator("#decision-brief").innerText();
  assert.match(t, /60 → 59/);
  assert.match(t, /62 → 59/);
  assert.match(t, /£15,000/);
  assert.match(t, /£3,200/);
  assert.match(t, /2030/);
  assert.match(t, /Income and access milestones/);
  await p.emulateMedia({ media: "print" });
  assert.equal(await p.locator("#decision-brief").isVisible(), true);
  assert.equal(
    await p
      .getByText("Income and access milestones", { exact: true })
      .isVisible(),
    true,
  );
  await p.emulateMedia({ media: "screen" });
  const downloaded = p.waitForEvent("download");
  await p.locator("[data-action=export-csv]").click();
  const file = await downloaded;
  const csv = await readFile(await file.path(), "utf8");
  assert.match(csv, /Fictional example/);
  assert.match(csv, /openingAccessible/);
  assert.match(csv, /closingAvailablePension/);
  assert.match(csv, /closingLockedPension/);
  assert.match(csv, /closingTotal/);
  assert.match(csv, /cumulativeGap/);
  assert.match(csv, /no UK tax engine/);
  await p.close();
});

test("manual joint account is counted once and scenario edits flag stale baseline", async () => {
  const p = await page();
  await fillStart(p);
  await p.goto(origin + "/app.html#details/accounts");
  await p.locator("#account-name").fill("Joint savings");
  await p.locator("#account-owner").selectOption("joint");
  await p.locator("#account-type").selectOption("cash");
  await p.locator("#account-balance").fill("90000");
  await p.locator("#account-confirm").check();
  await p.locator("#account-form button[type=submit]").click();
  await p.waitForURL("**#overview");
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan()?.activeView === "overview",
  );
  assert.equal((await snapshot(p)).personal.accounts.length, 1);
  await p.goto(origin + "/app.html#details/accounts");
  await p.getByRole("button", { name: "Edit", exact: true }).click();
  assert.equal(await p.locator("#account-owner").inputValue(), "joint");
  assert.equal(await p.locator("#account-type").inputValue(), "cash");
  await p.locator("#account-balance").fill("85000");
  await p.locator("#account-confirm").check();
  await p.locator("#account-form button[type=submit]").click();
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan().activeView === "overview",
  );
  assert.equal((await snapshot(p)).personal.accounts[0].owner, "joint");
  assert.equal((await snapshot(p)).personal.accounts[0].type, "cash");
  await nav(p, "scenarios");
  await p.locator("#scenario-name").fill("Lower spending");
  await p.locator("#scenario-monthlySpending").fill("2500");
  await p.locator("#scenario-form button[type=submit]").click();
  await p.getByRole("link", { name: "My information", exact: true }).click();
  await p.locator('a[href="#setup"]').click();
  await p.locator("#monthlySpending").fill("2800");
  await p.locator("#setup-form button[type=submit]").click();
  await p.waitForURL("**#overview");
  await p.waitForFunction(
    () => window.snapshotSteadybeePlan()?.activeView === "overview",
  );
  assert.equal((await snapshot(p)).personal.scenarios[0].stale, true);
  await p.close();
});

test("retired example shows relevant levers; mobile screens reflow and screenshots are reviewable", async () => {
  const p = await page("app.html?example=already-retired#scenarios", true);
  assert.equal(await p.locator("#scenario-retirementAge").count(), 0);
  assert.equal(await p.locator("#scenario-monthlyContributions").count(), 0);
  await p.locator("#scenario-name").fill("Roof repair");
  await p.locator("#scenario-majorCost").fill("25000");
  await p.locator("#scenario-majorCostAge").fill("70");
  await p.locator("#scenario-form button[type=submit]").click();
  await nav(p, "report");
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "No mobile page overflow",
  );
  await mkdir(resolve(root, "test-artifacts"), { recursive: true });
  await p.screenshot({
    path: resolve(root, "test-artifacts/mobile-brief.png"),
    fullPage: true,
  });
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.goto(origin + "/index.html");
  await p.screenshot({
    path: resolve(root, "test-artifacts/landing.png"),
    fullPage: true,
  });
  await p.goto(origin + "/app.html?example=mixed-household#overview");
  await p.screenshot({
    path: resolve(root, "test-artifacts/overview.png"),
    fullPage: true,
  });
  await p.close();
});

test("default household brief with two long-named alternatives fits one A4 page; appendix is optional", async () => {
  const p = await page("app.html?example=mixed-household#scenarios");
  await p.locator("[data-action=preset-household]").click();
  await p.locator("[data-action=new-scenario]").click();
  await p
    .locator("#scenario-name")
    .fill(
      "A longer household discussion comparing later work and an additional major cost",
    );
  await p.locator("#scenario-retirementAge").fill("62");
  await p.locator("#scenario-partnerRetirementAge").fill("63");
  await p.locator("#scenario-monthlySpending").fill("3500");
  await p.locator("#scenario-monthlyContributions").fill("800");
  await p.locator("#scenario-partTimeAnnual").fill("10000");
  await p.locator("#scenario-partTimeEndAge").fill("65");
  await p.locator("#scenario-majorCost").fill("30000");
  await p.locator("#scenario-majorCostAge").fill("70");
  await p.locator("#scenario-form button[type=submit]").click();
  await nav(p, "report");
  await mkdir(resolve(root, "test-artifacts"), { recursive: true });
  const pdf = await p.pdf({
    path: resolve(root, "test-artifacts/household-brief.pdf"),
    format: "A4",
    margin: { top: "16mm", bottom: "18mm", left: "14mm", right: "14mm" },
    printBackground: true,
  });
  assert.equal(
    (pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length,
    1,
    "Discussion brief is one page",
  );
  await p.locator("#include-appendix").check();
  await p.evaluate(() => document.body.classList.add("print-appendix"));
  const appendix = await p.pdf({
    format: "A4",
    margin: { top: "16mm", bottom: "18mm", left: "14mm", right: "14mm" },
  });
  assert.ok(
    (appendix.toString("latin1").match(/\/Type \/Page\b/g) || []).length > 1,
  );
  await p.close();
});
