import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDraft, field } from "../prototype/state.mjs";

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
