import {
  createDraft,
  validateDraft,
  getNextDetail,
  summariseDraft,
  createScenario,
  updateBaseline,
  serialise,
  parseSaved,
} from "./state.mjs";
import { examples, evaluateExample } from "./fixtures.mjs";

const $ = (s) => document.querySelector(s);
const money = (v) =>
  v == null
    ? "Unknown"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
      }).format(v);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const val = (v) => (v && typeof v === "object" ? v.value : v);
const field = (value = null, status = "provided") => ({
  value,
  status: value == null ? "unknown" : status,
});
const copy = (x) => JSON.parse(JSON.stringify(x));
const KEY = "steadybee:workspace:v2";
let workspace = {
  personal: null,
  mode: "personal",
  sampleId: "mixed-household",
  sampleScenarios: {},
  activeScenario: null,
  activeView: "start",
  feedback: null,
};
let storageProblem = "",
  savedAvailable = null,
  toastTimer;
const params = new URLSearchParams(location.search);
const pendingRestore = window.__steadybeeRestore;
const template = (title, sub, body) =>
  `<div class="intro"><div class="eyebrow">Your retirement workspace</div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>${body}`;
const buttons = (content) => `<div class="actions">${content}</div>`;
const btn = (text, action, style = "") =>
  `<button type="button" class="btn ${style}" data-action="${esc(action)}">${text}</button>`;
const link = (text, route, style = "secondary") =>
  `<a class="btn ${style}" href="#${route}">${text}</a>`;
const sample = () =>
  examples.find((e) => e.id === workspace.sampleId) || examples[0];
const isExample = () => workspace.mode === "example";
const draft = () => workspace.personal;
const scenarios = () =>
  isExample()
    ? workspace.sampleScenarios[workspace.sampleId] || []
    : draft()?.scenarios || [];
const selected = () =>
  scenarios().find((s) => s.id === workspace.activeScenario) || null;
const modeBar = () =>
  isExample()
    ? `<div class="mode example"><p><b>Fictional example · ${esc(sample().name)}</b><br>These outcomes belong to this named example. Your personal information is separate.</p>${btn(draft() ? "Return to my draft" : "Start my own draft", "personal", "secondary")}</div>`
    : `<div class="mode"><p><b>Your information so far</b><br>${draft() ? "Personal retirement outcomes have not been calculated." : "Start with what you know. Add detail at your pace."}</p>${link("View an example", "examples", "quiet")}</div>`;
const navViews = [
  ["start", "Start"],
  ["overview", "Overview"],
  ["details", "My information"],
  ["scenarios", "Explore changes"],
  ["report", "Decision brief"],
  ["review", "Saved work"],
];

function numericInput(id, label, f, help = "", max = null) {
  const fval = val(f),
    status = f?.status || "unknown";
  return `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="number" inputmode="decimal" min="0" ${max ? `max="${max}"` : ""} step="any" value="${fval == null ? "" : esc(fval)}" placeholder="I don't know yet" aria-describedby="${id}-help"><span class="help" id="${id}-help">${help || "Leave blank if unknown. A deliberate zero is different from unknown."}</span><label class="sr-only" for="${id}-status">${label} information status</label><select id="${id}-status" class="state"><option value="provided" ${status === "provided" ? "selected" : ""}>Provided</option><option value="estimated" ${status === "estimated" ? "selected" : ""}>Estimate</option><option value="unknown" ${status === "unknown" ? "selected" : ""}>Unknown</option></select></div>`;
}
function readNumber(id) {
  const el = $("#" + id),
    raw = el?.value?.trim() ?? "",
    n = raw === "" ? null : Number(raw);
  const status = $("#" + id + "-status")?.value;
  return field(
    n,
    raw === "" ? "unknown" : status === "estimated" ? "estimated" : "provided",
  );
}
function inputRows(p, route = "dc", prefix = "") {
  return `<div class="grid">${numericInput(prefix + "age", "Your age", p.age, "Whole years.", 100)}${route === "retired" ? `<div class="field"><label for="${prefix}retirementStatus">Retirement status</label><select id="${prefix}retirementStatus"><option value="already-retired">Already retired</option><option value="working" ${p.retirementStatus === "working" ? "selected" : ""}>Still working</option></select><span class="help">If still working, add your intended retirement age in My information.</span></div>` : numericInput(prefix + "targetRetirementAge", "Intended retirement age", p.targetRetirementAge, "Separate from when you can access your pension.", 100)}${route === "dc" ? numericInput(prefix + "pensionTotal", "Invested pension pots (£)", p.pensionTotal, "DC / invested pensions only. Promised DB income goes in Income.") : numericInput(prefix + "annualPensionIncome", "Pension income (£ / year)", p.annualPensionIncome, "DB / State Pension / other pension income. You will confirm gross or net below.")}${numericInput(prefix + "nonPensionTotal", route === "dc" ? "Other savings & investments (£)" : "Accessible savings (£)", p.nonPensionTotal, "Exclude your home and pension pots. Access restrictions can be added later.")}${numericInput(prefix + "monthlySpending", "Retirement spending (£ / month)", p.monthlySpending, "In today’s pounds. Decide whether it includes housing/debt costs.")}</div>`;
}
function startView() {
  return template(
    "A plan starts with a question.",
    "Bring your own information together, or explore a fictional retirement decision.",
    `${savedAvailable ? `<section class="card tinted"><h2>Your saved work is here.</h2><p class="small">Saved on this browser. Resume it or begin a separate draft.</p>${buttons(btn("Resume saved work", "resume") + btn("Start fresh", "fresh", "secondary"))}</section>` : ""}${storageProblem ? `<div class="notice">${esc(storageProblem)}</div>` : ""}<div class="grid"><section class="card"><div class="eyebrow">My own information</div><h2>Start with what you know.</h2><p>Five starting fields, optional estimates and a checklist that helps you gather the rest.</p><p class="small">This draft organises your inputs. It does not yet calculate your retirement outcomes.</p>${btn(draft() ? "Continue my draft" : "Create my draft", "personal")}</section><section class="card"><div class="eyebrow">A complete worked example</div><h2>Explore a retirement choice.</h2><p>Follow income, spending and accessible money across the years. Compare a change and read the brief.</p>${link("Choose an example", "examples", "")}</section></div><p class="small">Your inputs stay in this browser while open. Optional device saving uses this browser’s storage; anyone with access to it may see the draft. No bank connection, signup or upload.</p>`,
  );
}
function examplesView() {
  return template(
    "A real decision. Fictional people.",
    "Choose a story, then explore how its assumptions and choices affect the picture.",
    examples
      .map(
        (e) =>
          `<section class="card"><div class="eyebrow">Fictional worked example</div><h2>${esc(e.name)}</h2><p>${esc(e.description)}</p>${btn("Explore this example", `example:${e.id}`)}</section>`,
      )
      .join("") +
      `<p class="small">All example numbers are generated deterministically from disclosed fictional assumptions. No personal tax calculation or pension-rule inference is included.</p>`,
  );
}
function setupView() {
  const p = draft() || createDraft();
  if (!draft()) workspace.personal = p;
  const route = p.route;
  return template(
    "A short start. Detail later.",
    "The first picture is an information summary. No account required.",
    `<div class="pill-tabs"><a href="#setup" data-route="dc" class="${route === "dc" ? "active" : ""}">Invested pension pots</a><a href="#setup" data-route="income" class="${route === "income" ? "active" : ""}">DB / income-led</a><a href="#setup" data-route="retired" class="${route === "retired" ? "active" : ""}">Already retired</a></div><form id="setup-form" novalidate><div id="form-error"></div><section class="card"><div class="field"><label for="scope">Who is this picture for?</label><select id="scope"><option value="individual">Just me</option><option value="household" ${p.planningScope === "household" ? "selected" : ""}>Me and a partner</option></select><span class="help">Start with your information. Add your partner progressively.</span></div>${inputRows(p.profile, route)}${route !== "dc" ? `<div class="field"><label for="incomeBasis">Is the pension income gross or net?</label><select id="incomeBasis"><option value="unknown">Not sure</option><option value="gross" ${p.profile.incomeBasis === "gross" ? "selected" : ""}>Gross · before tax</option><option value="net" ${p.profile.incomeBasis === "net" ? "selected" : ""}>Net · after tax</option></select></div>` : ""}<div class="field"><label for="spendingBasis">This spending figure covers</label><select id="spendingBasis"><option value="individual">Just me</option><option value="household" ${p.spendingBasis === "household" ? "selected" : ""}>Our household</option></select><span class="help">Include regular costs and travel in your target. Major one-off costs can be recorded separately. We will confirm housing/debt inclusion later.</span></div><button class="btn" type="submit">See my information picture →</button></section></form><p class="small">While this tab is open, your inputs stay in this browser. Device saving is optional; saved drafts are visible to anyone using the same browser profile. Your entries remain separate from fictional examples.</p>`,
  );
}

function errors(items) {
  const el = $("#form-error");
  if (!el) return;
  el.innerHTML = `<div class="error" role="alert"><b>Please check these details.</b><ul>${items.map((x) => `<li>${esc(x.message || x)}</li>`).join("")}</ul></div>`;
  el.scrollIntoView({ block: "center" });
}
function toast(s) {
  clearTimeout(toastTimer);
  $("#message").textContent = s;
  toastTimer = setTimeout(() => ($("#message").textContent = ""), 6500);
}
function go(route) {
  if (location.hash === "#" + route) render();
  else location.hash = route;
}
function normalRoute() {
  let v = location.hash.slice(1) || "start";
  if (
    ![
      "start",
      "setup",
      "examples",
      "overview",
      "details",
      "details/accounts",
      "details/partner",
      "details/income",
      "details/access",
      "details/costs",
      "details/contributions",
      "scenarios",
      "report",
      "review",
      "feedback",
    ].includes(v)
  )
    v = "start";
  if (v === "setup") workspace.mode = "personal";
  if (
    ["overview", "details", "scenarios", "report"].some(
      (r) => v === r || v.startsWith(r + "/"),
    ) &&
    !isExample() &&
    !draft()
  )
    v = "setup";
  return v;
}
function render() {
  const route = normalRoute();
  workspace.activeView = route;
  $("#navigation").innerHTML =
    navViews
      .map(
        ([id, label]) =>
          `<a href="#${id}" ${route === id || route.startsWith(id + "/") ? 'aria-current="page"' : ""}>${label}</a>`,
      )
      .join("") +
    `<div class="small"><a href="#feedback">Help shape the offer</a><span class="save-status">${draft()?.consent.deviceSave ? "Device saving enabled" : "Draft stays in this tab"}</span></div>`;
  const views = {
    start: startView,
    setup: setupView,
    examples: examplesView,
    overview: overviewView,
    details: detailsView,
    "details/accounts": accountsView,
    "details/partner": partnerView,
    "details/income": incomeView,
    "details/access": accessView,
    "details/costs": costsView,
    "details/contributions": contributionsView,
    scenarios: scenariosView,
    report: reportView,
    review: reviewView,
    feedback: feedbackView,
  };
  $("#main").innerHTML =
    (["start", "setup", "examples", "feedback"].includes(route)
      ? ""
      : modeBar()) + views[route]();
  $("#main").querySelector("h1")?.setAttribute("tabindex", "-1");
  bindForms();
}

function activeStreams(d) {
  return d.details.incomeStreams.filter(
    (i) =>
      i.owner === "primary" || (d.planningScope === "household" && d.partner),
  );
}
function activeAccounts(d) {
  return d.accounts.filter(
    (a) =>
      a.owner !== "partner" || (d.planningScope === "household" && d.partner),
  );
}
function personalTimeline(d) {
  const events = [],
    year = new Date(d.updatedAt).getFullYear(),
    primary = val(d.profile.age),
    partner = val(d.partner?.age);
  const add = (owner, age, label) => {
    const current = owner === "partner" ? partner : primary;
    if (age == null) return;
    const offset = current == null ? null : age - current;
    events.push({
      year: offset == null ? null : year + offset,
      owner,
      age,
      primaryAge: offset == null || primary == null ? null : primary + offset,
      partnerAge: offset == null || partner == null ? null : partner + offset,
      label,
    });
  };
  add("primary", primary, "Your age today");
  add("primary", val(d.profile.targetRetirementAge), "Your retirement timing");
  if (d.planningScope === "household" && d.partner) {
    add("partner", partner, "Partner age today");
    add(
      "partner",
      val(d.partner.targetRetirementAge),
      "Partner retirement timing",
    );
  }
  add(
    "primary",
    val(d.details.pensionAccessAge),
    "Your entered pension access age",
  );
  for (const i of activeStreams(d))
    add(
      i.owner,
      val(i.startAge),
      `${i.owner === "partner" ? "Partner" : "Your"} ${i.type} income starts`,
    );
  return events.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
}
function inputTimelineMarkup(d) {
  return personalTimeline(d)
    .map(
      (e) =>
        `<div class="milestone"><b>${e.year ?? (e.owner === "partner" ? "Partner age " + e.age : "Your age " + e.age)}</b><span>${esc(e.label)} · ${e.primaryAge != null ? "primary age " + e.primaryAge : ""}${d.planningScope === "household" && e.partnerAge != null ? " · partner age " + e.partnerAge : ""}${e.year == null ? " · calendar date unknown" : ""}</span></div>`,
    )
    .join("");
}
function overviewView() {
  if (isExample()) return exampleOverview();
  const d = draft(),
    sum = summariseDraft(d),
    total = sum.totals.combined;
  const known = total != null;
  const incomeLed = d.route !== "dc";
  const next = getNextDetail(d);
  const group = next?.group || next?.id;
  const route = group?.includes("partner")
    ? "details/partner"
    : group?.includes("income")
      ? "details/income"
      : group?.includes("contribution")
        ? "details/contributions"
        : group?.includes("cost") || group?.includes("spending")
          ? "details/costs"
          : "details/access";
  return template(
    "Your information, brought together.",
    "A clear starting point for gathering the details that matter.",
    `<section class="card"><div class="eyebrow">Entered information · no forecast</div><div class="metrics"><div class="metric"><strong>${incomeLed ? money(val(d.profile.annualPensionIncome)) : known ? money(total) : "Unknown"}</strong><span>${incomeLed ? "Primary pension income / year · " + d.profile.incomeBasis : "Known " + (d.planningScope === "household" ? "household" : "primary") + " balances · " + (sum.totals.pensionComplete && sum.totals.nonPensionComplete ? "entered" : "partial")}</span></div><div class="metric"><strong>${money(val(d.profile.monthlySpending))}</strong><span>Spending per month · ${d.spendingBasis === "household" ? "household" : "individual"}</span></div><div class="metric"><strong>${val(d.profile.targetRetirementAge) == null ? (d.profile.retirementStatus === "already-retired" ? "Retired" : "Unknown") : "Age " + val(d.profile.targetRetirementAge)}</strong><span>${d.profile.retirementStatus === "already-retired" ? "Current status" : "Intended retirement"}</span></div></div><div class="notice">These are entered totals, not an affordability conclusion. Pension pots may be inaccessible. Income and spending have not been reconciled.</div>${incomeLed ? `<div class="row"><span>Known entered balances</span><b>${money(total)} · ${d.planningScope === "household" ? "household" : "primary"}</b></div>` : ""}${d.planningScope === "household" ? `<p class="small"><b>Household status: ${sum.householdIncomplete ? "incomplete; see the gaps below" : "information entered; outcomes not calculated"}.</b> Combined totals include supplied person-owned balances once. They do not establish affordability.</p>` : ""}${buttons(link("Review my information", "details") + link("Keep this summary", "report"))}</section>${next && !d.ui.dismissedDetailIds.includes(next.id) ? `<section class="card tinted"><div class="eyebrow">Next useful detail · optional</div><h2>${esc(next.title)}</h2><p>${esc(next.question)}</p><p class="small">${esc(next.why)}</p>${buttons(link("Add this detail", route, "") + btn("Not sure", `dismiss:${next.id}`, "secondary") + btn("Later", `dismiss:${next.id}`, "quiet"))}</section>` : ""}<div class="grid"><section class="card"><h2>Your entered dates</h2><div class="timeline">${inputTimelineMarkup(d) || "<p>No dates entered yet.</p>"}</div><p class="small">Calendar years align both people’s ages. This is a timeline of entered dates, not a calculated funding plan.</p></section><section class="card"><h2>Still to clarify</h2><ul class="clean">${
      missingList(d)
        .map((x) => `<li class="small">${esc(x)}</li>`)
        .join("") ||
      "<li>Inputs gathered. Personal modelling is a separate step.</li>"
    }</ul>${link("Add detail when ready", "details", "quiet")}</section></div><section class="card dark"><div class="eyebrow">Explore the planned experience</div><h2>What does a complete comparison look like?</h2><p>A named fictional example demonstrates income, spending and funding gaps. Switching preserves your own draft.</p>${link("Choose a worked example", "examples", "secondary")}</section>`,
  );
}
function missingList(d) {
  const m = [];
  const people = [["Primary", d.profile]];
  if (d.planningScope === "household" && d.partner)
    people.push(["Partner", d.partner]);
  for (const [owner, p] of people) {
    for (const [key, label] of [
      ["age", "age"],
      ["targetRetirementAge", "retirement timing"],
    ])
      if (
        val(p[key]) == null &&
        (key !== "targetRetirementAge" ||
          p.retirementStatus !== "already-retired")
      )
        m.push(`${owner} ${label} is unknown.`);
    if (val(p.nonPensionTotal) == null)
      m.push(`${owner} non-pension savings are unknown.`);
    if (d.route === "dc" && val(p.pensionTotal) == null)
      m.push(`${owner} invested pension total is unknown.`);
    if (val(p.annualPensionIncome) != null && p.incomeBasis !== "net")
      m.push(
        `${owner} pension income is gross or tax basis unknown; spendable income is not established.`,
      );
    const owned = activeStreams(d).filter(
      (i) => i.owner === (owner === "Primary" ? "primary" : "partner"),
    );
    if (!owned.length)
      m.push(
        `${owner} detailed income sources and start dates have not been entered, even if an aggregate income is supplied.`,
      );
    for (const i of owned) {
      if (val(i.annualAmount) == null)
        m.push(`${owner} ${i.type} annual amount is unknown.`);
      if (val(i.startAge) == null)
        m.push(`${owner} ${i.type} start age is unknown.`);
      if (i.incomeBasis !== "net")
        m.push(`${owner} ${i.type} income is gross or has unknown tax basis.`);
    }
  }
  if (val(d.profile.monthlySpending) == null)
    m.push("Monthly spending target is unknown.");
  if (d.planningScope === "household" && !d.partner)
    m.push("Add your partner to complete the shared picture.");
  if (d.planningScope === "household" && d.spendingBasis !== "household")
    m.push("Confirm a shared household spending target.");
  if (d.details.housingIncluded == null)
    m.push("Confirm whether spending includes housing/debt payments.");
  if (d.details.housingIncluded === false)
    m.push("Housing/debt payments are still to add to the spending picture.");
  if (
    val(d.details.pensionAccessAge) == null &&
    val(d.profile.pensionTotal) != null
  )
    m.push("Primary invested pension access age is unknown.");
  if (
    val(d.details.cashTotal) != null &&
    val(d.details.investedTotal) != null &&
    val(d.profile.nonPensionTotal) != null &&
    val(d.details.cashTotal) + val(d.details.investedTotal) !==
      val(d.profile.nonPensionTotal)
  )
    m.push(
      "Primary cash + investments do not match the non-pension total. They are not added twice.",
    );
  for (const r of summariseDraft(d).reconciliation)
    if (r.difference !== 0)
      m.push(
        `${r.group} account detail differs from the entered aggregate; reconcile it before future modelling.`,
      );
  m.push(
    "Personal projections, tax and survivor calculations are not available in this prototype.",
  );
  return m;
}
function detailsView() {
  if (isExample())
    return template(
      "The example’s assumptions.",
      "These belong to the fictional story. Your personal draft remains separate.",
      assumptionsCard(evaluateExample(workspace.sampleId)) +
        buttons(
          link("Return to overview", "overview") +
            link("Explore a change", "scenarios", ""),
        ),
    );
  const d = draft();
  return template(
    "Your information, at your pace.",
    "Choose what to add. No group is required to open the others.",
    `<div class="grid">${[
      [
        "accounts",
        "Accounts & ownership",
        "Add manually, check access dates and reconcile totals.",
      ],
      [
        "income",
        "Income & start dates",
        "Promised pension income is separate from invested pots.",
      ],
      [
        "access",
        "Money & access",
        "Clarify accessible savings, invested pots and their dates.",
      ],
      [
        "contributions",
        "Contributions",
        "Amount, employer inclusion and changes when work ends.",
      ],
      [
        "costs",
        "Spending & major costs",
        "Housing inclusion and one-off expenses.",
      ],
      [
        "partner",
        "Your partner",
        "Keep ages, balances and income ownership clear.",
      ],
    ]
      .map(
        ([route, title, text]) =>
          `<section class="card"><h2>${title}</h2><p class="small">${text}</p>${link(route === "partner" && d.partner ? "Review partner" : "Open details", `details/${route}`, "")}</section>`,
      )
      .join(
        "",
      )}<section class="card"><h2>Your starting point</h2><p class="small">Correct age, timing, totals or spending. Saved alternatives are marked out of date when the baseline changes.</p>${link("Edit starting fields", "setup", "")}</section></div><p class="small">Your balances belong to the primary person unless separately entered under Partner. Joint assets must be assigned once; this prototype does not allocate shared assets automatically.</p>`,
  );
}
function partnerView() {
  if (isExample()) return detailsView();
  const d = draft(),
    p = d.partner || createDraft("dc").profile;
  return template(
    "Two people. One conversation.",
    "Add partner details without losing your individual information.",
    `<form id="partner-form" novalidate><div id="form-error"></div><section class="card"><p class="small">${d.details.incomeStreams.some((i) => i.owner === "partner") ? "Previously entered partner income is retained; review it in Income. " : ""}Enter partner-owned assets only. Joint balances already in the primary person's total should not be entered again.</p><div class="field"><label for="partner-status">Partner retirement status</label><select id="partner-status"><option value="working">Still working</option><option value="already-retired" ${p.retirementStatus === "already-retired" ? "selected" : ""}>Already retired</option></select></div>${inputRows(p, "dc", "partner-")}<div class="field"><label for="partner-income">Partner pension income (£ / year)</label><input id="partner-income" type="number" min="0" value="${val(p.annualPensionIncome) ?? ""}" placeholder="Unknown"><span class="help">Optional. Income source, start date and gross/net basis can be added in Income.</span></div><div class="field"><label for="partner-basis">Income basis</label><select id="partner-basis"><option value="unknown">Not sure</option><option value="gross" ${p.incomeBasis === "gross" ? "selected" : ""}>Gross · before tax</option><option value="net" ${p.incomeBasis === "net" ? "selected" : ""}>Net · after tax</option></select></div><div class="field"><label for="shared-spending">The spending target covers</label><select id="shared-spending"><option value="household">Our household</option><option value="individual" ${d.spendingBasis === "individual" ? "selected" : ""}>Just the primary person</option></select></div><label class="check"><input id="joint-confirm" type="checkbox"><span>I have checked that joint balances are counted once. No automatic split is made.</span></label><button class="btn" type="submit">Keep partner details</button>${d.partner ? btn("Remove partner", "remove-partner", "quiet") : ""}</section></form>`,
  );
}
function incomeView() {
  if (isExample()) return detailsView();
  const d = draft();
  return template(
    "Income has its own timeline.",
    "Record the amount and when it starts. Unknown State Pension remains unknown.",
    `<section class="card"><h2>Income entered so far</h2>${val(d.profile.annualPensionIncome) != null ? `<div class="row"><span>Primary pension income from short start</span><b>${money(val(d.profile.annualPensionIncome))} / year · ${esc(d.profile.incomeBasis)}</b></div><p class="small">Detailed income streams below replace this aggregate for future modelling; the prototype does not add both together.</p>` : ""}${
      activeStreams(d)
        .map(
          (i) =>
            `<div class="row"><span>${i.owner === "partner" ? "Partner" : "Primary"} · ${esc(i.type)}<br><small>Starts age ${val(i.startAge) ?? "unknown"} · ${esc(i.incomeBasis)}</small></span><b>${money(val(i.annualAmount))} / year ${btn("Remove", `remove-income:${i.id}`, "quiet")}</b></div>`,
        )
        .join("") || '<p class="small">No detailed income streams yet.</p>'
    }</section><form id="income-form" novalidate><div id="form-error"></div><section class="card"><h2>Add an income stream</h2><div class="grid"><div class="field"><label for="income-owner">Belongs to</label><select id="income-owner"><option value="primary">Primary person</option>${d.partner ? '<option value="partner">Partner</option>' : ""}</select></div><div class="field"><label for="income-type">Income type</label><select id="income-type"><option value="db">DB pension</option><option value="state">State Pension</option><option value="other">Other income</option></select></div>${numericInput("income-amount", "Annual income (£)", null, "Enter your estimate or statement amount. No entitlement is assumed.")}${numericInput("income-start", "Starts at owner’s age", null, "A start age is separate from retirement age.", 100)}<div class="field"><label for="stream-basis">Gross or net?</label><select id="stream-basis"><option value="unknown">Not sure</option><option value="gross">Gross · before tax</option><option value="net">Net · after tax</option></select></div></div><button class="btn" type="submit">Add income</button></section></form><p class="small">DB escalation, early-retirement reductions and survivor benefits need scheme-specific information. This prototype does not evaluate them.</p>`,
  );
}
function accessView() {
  if (isExample()) return detailsView();
  const d = draft();
  return template(
    "A balance is only part of the picture.",
    "Access dates and cash/investment splits clarify your entered information.",
    `<form id="access-form" novalidate><div id="form-error"></div><section class="card"><div class="grid">${numericInput("pension-access", "Primary pension access age", d.details.pensionAccessAge, "Enter the age supplied by your scheme or confirmed source. This app does not infer legal access.", 100)}${numericInput("cash-total", "Cash within other savings (£)", d.details.cashTotal, "Part of the existing non-pension total, not an additional asset.")}${numericInput("invested-total", "Investments within other savings (£)", d.details.investedTotal, "Part of the existing non-pension total. Restricted access remains a limitation.")}</div><p class="small">Entered non-pension total: <b>${money(val(d.profile.nonPensionTotal))}</b>. The split must reconcile with it; mismatches remain visible.</p><button class="btn" type="submit">Keep money details</button></section></form>`,
  );
}
function contributionsView() {
  if (isExample()) return detailsView();
  const d = draft();
  return template(
    "What is being added?",
    "Record contributions without assuming they continue indefinitely.",
    `<form id="contribution-form" novalidate><div id="form-error"></div><section class="card">${numericInput("contribution", "Monthly contributions (£)", d.details.monthlyContributions, "Total contribution toward pension/investment savings.")}<div class="field"><label for="employer">Does this include employer contributions?</label><select id="employer"><option value="unknown">Not sure</option><option value="yes" ${d.details.employerIncluded === true ? "selected" : ""}>Yes</option><option value="no" ${d.details.employerIncluded === false ? "selected" : ""}>No</option></select></div><p class="small">Future modelling must capture destination and the date contributions stop or change. This entered summary does not project them.</p><button class="btn" type="submit">Keep contributions</button></section></form>`,
  );
}
function costsView() {
  if (isExample()) return detailsView();
  const d = draft();
  return template(
    "Spending that fits the life you mean.",
    "Clarify regular costs and keep major expenses separate.",
    `<form id="cost-form" novalidate><div id="form-error"></div><section class="card"><div class="field"><label for="housing">Does your monthly target include housing and debt payments?</label><select id="housing"><option value="unknown">Not sure yet</option><option value="yes" ${d.details.housingIncluded === true ? "selected" : ""}>Yes, included</option><option value="no" ${d.details.housingIncluded === false ? "selected" : ""}>No, still to add</option></select><span class="help">Mortgage/rent, regular household costs and travel should be clear before any affordability calculation.</span></div><div class="grid">${numericInput("major-cost", "One-off cost (£)", null, "Optional. Roof repair, car or another major expense.")}${numericInput("major-age", "At your age", null, "When the cost occurs.", 100)}</div><button class="btn" type="submit">Keep cost details</button></section></form><section class="card"><h2>Major costs entered</h2>${d.details.majorCosts.map((c) => `<div class="row"><span>At primary age ${val(c.age) ?? "unknown"}</span><b>${money(val(c.amount))} ${btn("Remove", `remove-cost:${c.id}`, "quiet")}</b></div>`).join("") || '<p class="small">No one-off costs recorded.</p>'}</section>`,
  );
}

const overrideLabels = {
  retirementAge: "Primary retirement age",
  partnerRetirementAge: "Partner retirement age",
  monthlySpending: "Monthly spending",
  monthlyContributions: "Monthly contributions",
  partTimeAnnual: "Part-time net income / year",
  partTimeEndAge: "Part-time ends at primary age",
  majorCost: "One-off cost",
  majorCostAge: "Cost at primary age",
};
function changesList(s) {
  return Object.entries(s?.overrides || {})
    .map(
      ([key, value]) =>
        `<li>${esc(overrideLabels[key] || key)}: <b>${key.includes("Age") ? value : money(value)}</b></li>`,
    )
    .join("");
}
function chartMarkup(result, alt = null) {
  const rows = result.rows,
    a = alt?.rows;
  const all = rows.concat(a || []);
  const max = Math.max(...all.map((r) => r.closingTotal), 1);
  const points = (rs) =>
    rs
      .map(
        (r, i) =>
          `${30 + (i / (rs.length - 1 || 1)) * 690},${220 - (r.closingTotal / max) * 188}`,
      )
      .join(" ");
  return `<svg class="chart" viewBox="0 0 750 252" role="img" aria-label="Fictional total accessible and pension wealth over time. The detailed yearly table follows."><line x1="30" y1="220" x2="720" y2="220" stroke="#bacbc4"/><line x1="30" y1="120" x2="720" y2="120" stroke="#e2e9e4"/><polyline points="${points(rows)}" stroke="#14665f" stroke-width="3" fill="none"/>${a ? `<polyline points="${points(a)}" stroke="#967339" stroke-width="3" fill="none" stroke-dasharray="7 4"/>` : ""}<text x="30" y="245" font-size="13" fill="#536568">${rows[0]?.year}</text><text x="720" y="245" font-size="13" text-anchor="end" fill="#536568">${rows.at(-1)?.year}</text><text x="30" y="21" font-size="13" fill="#536568">Up to ${money(max)} · today’s pounds</text></svg><p class="small">Total wealth includes pension assets that may be inaccessible. The funding-gap table below shows whether spending is covered at each point.</p><div class="legend"><span>Baseline</span>${alt ? '<span class="alt">Alternative</span>' : ""}</div>`;
}
function cashTable(result) {
  return `<div class="table-wrap"><table><caption class="sr-only">Fictional annual cash flow in today’s pounds. Income is assumed net.</caption><thead><tr><th>Year / ages</th><th>Net income</th><th>Spending + costs</th><th>Accessible closing</th><th>Pension closing</th><th>Unfunded gap</th></tr></thead><tbody>${result.rows.map((r) => `<tr><td>${r.year}<br><span class="mini">Primary ${r.primaryAge}${r.partnerAge != null ? " · partner " + r.partnerAge : ""}</span></td><td>${money(r.income)}</td><td>${money(r.spending + r.majorCost)}</td><td>${money(r.closingAccessible)}</td><td>${money(r.closingPension)}</td><td>${money(r.annualGap)}</td></tr>`).join("")}</tbody></table></div><details><summary>Explain opening-to-closing balances</summary><p class="small">Opening assets + growth + pension contributions + saved income surplus − withdrawals = closing assets. Income is assumed net after supplied contributions. Gaps remain unpaid and do not create negative assets.</p><div class="table-wrap"><table><thead><tr><th>Year</th><th>Opening assets</th><th>Growth</th><th>Contributions</th><th>Saved income surplus</th><th>Withdrawals</th><th>Closing assets</th></tr></thead><tbody>${result.rows.map((r) => `<tr><td>${r.year}</td><td>${money(r.openingAccessible + r.openingPension)}</td><td>${money(r.accessibleGrowth + r.pensionGrowth)}</td><td>${money(r.contributions)}</td><td>${money(Math.max(0, r.income - r.spending - r.majorCost))}</td><td>${money(r.withdrawalsAccessible + r.withdrawalsPension)}</td><td>${money(r.closingTotal)}</td></tr>`).join("")}</tbody></table></div></details>`;
}
function assumptionsCard(result) {
  return `<section class="card"><h2>Assumptions behind this example</h2><p class="small">Fictional input values and simplified arithmetic demonstrate the experience. Income is assumed net; no UK tax engine, DB scheme calculation or entitlement check is included.</p><ul class="steps small">${result.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul><div class="notice">DB escalation, early-retirement reductions and survivor benefits are not evaluated. This example cannot establish a complete household retirement conclusion.</div><p class="small">Illustration, not advice. No current UK pension or tax rules are inferred by this demonstration.</p></section>`;
}
function eventsMarkup(result) {
  return `<div class="timeline">${(result.events || []).map((e) => `<div class="milestone"><b>${esc(e.year || (e.age != null ? "Age " + e.age : ""))}</b><span>${esc(e.label || e.description || e.type)}${e.primaryAge != null ? " · primary age " + e.primaryAge : ""}${e.partnerAge != null ? " · partner age " + e.partnerAge : ""}</span></div>`).join("")}</div>`;
}
function exampleHeadline(result) {
  return result.summary.firstGapYear
    ? `A funding gap appears in ${result.summary.firstGapYear} under these assumptions.`
    : "Spending is covered through the illustrated horizon under these assumptions.";
}
function exampleOverview() {
  const e = sample(),
    r = evaluateExample(e.id);
  return template(
    "See the years between the milestones.",
    esc(e.description),
    `<section class="card"><div class="eyebrow">${esc(e.name)} · fictional baseline</div><h2>${exampleHeadline(r)}</h2><div class="metrics"><div class="metric"><strong>${r.summary.retirementAge}</strong><span>Primary retirement age${r.summary.partnerRetirementAge != null ? " · partner " + r.summary.partnerRetirementAge : ""}</span></div><div class="metric"><strong>${money(r.summary.bridgeGapTotal)}</strong><span>Unfunded gap before pension access</span></div><div class="metric"><strong>Age ${r.summary.horizonAge}</strong><span>Illustrated primary horizon · not a life-expectancy claim</span></div></div>${chartMarkup(r)}${buttons(link("Explore a change", "scenarios", "") + link("Read the decision brief", "report"))}</section><div class="grid"><section class="card"><h2>When things change</h2>${eventsMarkup(r)}</section><section class="card tinted"><h2>What this helps you ask</h2><ul class="steps"><li>What funds spending before pensions can be accessed?</li><li>How do two different work and income dates fit together?</li><li>What changes if work, spending or a major cost changes?</li></ul><p class="small">Any gap is a conditional result for this named example. It does not say whether you can retire.</p></section></div><section class="card"><details><summary>Show the yearly cash-flow table</summary>${cashTable(r)}</details></section><details><summary>See assumptions and limitations</summary>${assumptionsCard(r)}</details>`,
  );
}
function scenarioForm() {
  const s = selected(),
    o = s?.overrides || {},
    is = isExample();
  return `<form id="scenario-form" novalidate><div id="form-error"></div><section class="card"><h2>${s ? "Edit this alternative" : "Name a choice to compare"}</h2><div class="field"><label for="scenario-name">Scenario name</label><input id="scenario-name" maxlength="80" value="${esc(s?.name || "")}" placeholder="For example: part-time before retirement" required></div><p class="small">Set only what changes. Blank fields keep the baseline. ${is ? "Changes apply only to this fictional example." : "Personal comparisons show entered changes only; they do not calculate outcomes."}</p><div class="grid">${Object.entries(
    overrideLabels,
  )
    .filter(
      ([k]) =>
        (k !== "partnerRetirementAge" ||
          (is ? workspace.sampleId === "mixed-household" : draft()?.partner)) &&
        (!(
          (is && workspace.sampleId === "already-retired") ||
          (!is && draft()?.profile.retirementStatus === "already-retired")
        ) ||
          ![
            "retirementAge",
            "monthlyContributions",
            "partTimeAnnual",
            "partTimeEndAge",
          ].includes(k)),
    )
    .map(
      ([k, label]) =>
        `<div class="field"><label for="scenario-${k}">${label}${!k.includes("Age") ? " (£)" : ""}</label><input id="scenario-${k}" type="number" min="${k.includes("Age") ? 18 : 0}" max="${k.includes("Age") ? 100 : 10000000}" step="${k.includes("Age") ? 1 : "any"}" value="${o[k] ?? ""}" placeholder="Keep baseline"></div>`,
    )
    .join(
      "",
    )}</div>${buttons(`<button class="btn" type="submit">${s ? "Update" : "Keep"} alternative</button>` + btn("Clear changes", "reset-scenario", "secondary"))}<p class="small">Baseline plus two alternatives in this prototype. You can edit or remove an alternative.</p></section></form>`;
}
function comparisonMarkup(base, alt, s) {
  return `<section class="card"><h2>Baseline and ${esc(s.name)}</h2><div class="grid"><div><div class="tag">Baseline</div><p style="margin-top:12px">${exampleHeadline(base)}</p><div class="row"><span>Bridge gap</span><b>${money(base.summary.bridgeGapTotal)}</b></div><div class="row"><span>Horizon closing total</span><b>${money(base.summary.finalTotal)}</b></div></div><div><div class="tag warn">${esc(s.name)}</div><p style="margin-top:12px">${exampleHeadline(alt)}</p><div class="row"><span>Bridge gap</span><b>${money(alt.summary.bridgeGapTotal)}</b></div><div class="row"><span>Horizon closing total</span><b>${money(alt.summary.finalTotal)}</b></div></div></div>${chartMarkup(base, alt)}<details><summary>Inspect the alternative's yearly table</summary>${cashTable(alt)}</details><p class="small">Amounts are conditional on fictional assumptions. Total wealth alone does not show whether money is accessible. No scenario is ranked as best.</p></section>`;
}
function scenariosView() {
  const s = selected(),
    items = scenarios();
  let content = template(
    "One choice can change several things.",
    "Keep the baseline. Compare your timing, work and spending changes together.",
    `${isExample() && workspace.sampleId === "mixed-household" ? `<section class="card tinted"><h3>Try a household choice</h3><p class="small">Change both retirement dates, add a period of part-time income and change monthly spending together.</p>${btn("Load the combined example", "preset-household", "secondary")}</section>` : ""}<div class="pill-tabs"><button class="btn ${!s ? "" : "secondary"}" data-action="new-scenario">New alternative</button>${items.map((x) => `<button class="btn ${s?.id === x.id ? "" : "secondary"}" data-action="${esc("select-scenario:" + x.id)}">${esc(x.name)}${x.stale ? " · out of date" : ""}</button>`).join("")}</div>${s ? `<section class="card"><h3>What changes in ${esc(s.name)}</h3><ul class="diff">${changesList(s)}</ul>${s.stale ? '<div class="notice">Your baseline changed. Review these overrides and save the scenario again to rebase it.</div>' : ""}${btn("Remove this alternative", `delete-scenario:${s.id}`, "quiet")}</section>` : ""}${scenarioForm()}`,
  );
  if (s && !s.stale && isExample()) {
    const b = evaluateExample(workspace.sampleId),
      a = evaluateExample(workspace.sampleId, s.overrides);
    content +=
      comparisonMarkup(b, a, s) +
      buttons(link("Keep the decision brief", "report", ""));
  } else if (s && !isExample())
    content += `<div class="notice">This is an input comparison for your draft. Personal cash-flow outcomes are not yet calculated.</div>${buttons(link("Keep my input comparison", "report", ""))}`;
  return content;
}

function reportView() {
  const items = scenarios().filter((s) => !s.stale);
  if (isExample()) {
    return compactExampleReport(items);
  }
  const d = draft();
  return template(
    "Your information summary.",
    "Keep your inputs and the questions still to answer.",
    `<article class="card brief" id="decision-brief"><div class="brief-meta"><b>Steadybee · personal information draft</b><span>${esc(d.updatedAt.slice(0, 10))} · revision ${d.revision}</span></div><div class="tag">Entered information · outcomes not calculated</div><h2 style="margin-top:20px">My retirement starting point</h2><div class="row"><span>Planning scope / spending basis</span><b>${esc(d.planningScope)} / ${esc(d.spendingBasis)}</b></div>${profileTable(d.profile, "Primary")}${d.planningScope === "household" && d.partner ? profileTable(d.partner, "Partner") : ""}${d.planningScope === "household" && !d.partner ? '<div class="notice">Partner pending. This is an incomplete household draft.</div>' : ""}<h3 style="margin-top:24px">Entered income streams</h3>${
      activeStreams(d)
        .map(
          (i) =>
            `<div class="row"><span>${esc(i.owner)} · ${esc(i.type)} · starts at age ${val(i.startAge) ?? "unknown"}</span><b>${money(val(i.annualAmount))} / year · ${esc(i.incomeBasis)}</b></div>`,
        )
        .join("") || '<p class="small">Detailed income streams not entered.</p>'
    }<h3 style="margin-top:24px">Money and access</h3><div class="row"><span>Primary invested pension access age</span><b>${val(d.details.pensionAccessAge) ?? "Unknown"} · ${esc(d.details.pensionAccessAge.status)}</b></div><div class="row"><span>Primary cash within other savings</span><b>${money(val(d.details.cashTotal))} · ${esc(d.details.cashTotal.status)}</b></div><div class="row"><span>Primary investments within other savings</span><b>${money(val(d.details.investedTotal))} · ${esc(d.details.investedTotal.status)}</b></div><h3 style="margin-top:24px">Entered dates</h3><div class="timeline">${inputTimelineMarkup(d)}</div><h3 style="margin-top:24px">Costs and contributions</h3><div class="row"><span>Monthly contributions</span><b>${money(val(d.details.monthlyContributions))} · ${esc(d.details.monthlyContributions.status)}</b></div><div class="row"><span>Housing/debt included in spending</span><b>${d.details.housingIncluded == null ? "Unknown" : d.details.housingIncluded ? "Included" : "Still to add"}</b></div>${d.details.majorCosts.map((c) => `<div class="row"><span>${esc(c.label)} at primary age ${val(c.age) ?? "unknown"}</span><b>${money(val(c.amount))}</b></div>`).join("")}<h3 style="margin-top:24px">Account detail</h3>${
      activeAccounts(d)
        .map(
          (a) =>
            `<div class="row"><span>${esc(a.name)} · ${esc(a.owner)} · ${esc(a.type)}<br><small>Access: owner age ${val(a.accessAge) ?? "unknown"}</small></span><b>${money(val(a.balance))} · ${esc(a.balance.status)}</b></div>`,
        )
        .join("") || '<p class="small">No account detail entered.</p>'
    }<h3 style="margin-top:24px">Choices recorded</h3>${
      scenarios()
        .map(
          (s) =>
            `<h4>${esc(s.name)}${s.stale ? " · out of date" : ""}</h4><ul class="diff">${changesList(s)}</ul>`,
        )
        .join("") || '<p class="small">No input comparison recorded yet.</p>'
    }<h3>Open questions</h3><ul class="steps">${missingList(d)
      .map((m) => `<li>${esc(m)}</li>`)
      .join(
        "",
      )}</ul><p class="small">This document records what you entered. Pension balances may be inaccessible; gross income is not spendable income. No personal retirement outcomes, tax or survivor calculations are included.</p></article>${buttons(btn("Print / save PDF", "print") + btn("Export my draft (JSON)", "export-draft", "secondary") + link("Keep on this device", "review"))}`,
  );
}
function profileTable(p, who) {
  return `<h3 style="margin-top:24px">${who}</h3>${[
    ["age", "Age"],
    ["targetRetirementAge", "Intended retirement age"],
    ["pensionTotal", "Invested pension pots"],
    ["nonPensionTotal", "Other savings"],
    ["annualPensionIncome", "Pension income / year"],
    ["monthlySpending", "Spending / month"],
  ]
    .filter(([k]) => who !== "Partner" || k !== "monthlySpending")
    .map(
      ([k, label]) =>
        `<div class="row"><span>${label}</span><b>${k.includes("Age") || k === "age" ? (val(p[k]) ?? "Unknown") : money(val(p[k]))} <small>· ${esc(p[k]?.status ?? "unknown")}${k === "annualPensionIncome" ? " · " + esc(p.incomeBasis) : ""}</small></b></div>`,
    )
    .join("")}`;
}
function reviewView() {
  const d = draft();
  return template(
    "Keep the work you have done.",
    "Return when a statement, a work plan or a life event changes.",
    `<section class="card"><h2>On this device</h2><p>Your draft can be kept in this browser. It is not encrypted account storage and is not shared across devices. Anyone using this browser profile may see it.</p>${d ? `<label class="check"><input id="device-save" type="checkbox" ${d.consent.deviceSave ? "checked" : ""}><span>Keep my draft on this device. I can delete it here at any time.</span></label><p class="small">${d.consent.deviceSave ? "Device saving enabled." : "Device saving is off. The current draft remains only while this tab is open."}</p>${buttons(btn("Export a backup", "export-draft", "secondary") + btn("Delete saved work", "delete-work", "danger"))}` : `<p class="small">Create a personal draft to enable device saving. You can print fictional example briefs without saving a personal draft.</p>${link("Start my information draft", "setup", "")}`}${storageProblem ? `<div class="notice">${esc(storageProblem)}</div>` : ""}</section><section class="card"><h2>Restore an exported draft</h2><p class="small">Import a Steadybee JSON draft exported from this prototype. It is read locally, validated and can replace the current draft after confirmation.</p><div class="field"><label for="restore-file">Choose a saved draft (.json)</label><input id="restore-file" type="file" accept="application/json,.json"></div></section>${
      d?.reviewHistory.length
        ? `<section class="card"><h2>Recent input revisions</h2><p class="small">These are input edits, not financial outcome history.</p>${d.reviewHistory
            .slice(-5)
            .reverse()
            .map(
              (r) =>
                `<div class="row"><span>Revision ${r.revision}</span><b>${esc(r.at?.slice(0, 10))}</b></div>`,
            )
            .join("")}</section>`
        : ""
    }<section class="card tinted"><h2>A reason to return</h2><p>Review after a new pension statement, a changed work intention, a major cost or your next annual check-in.</p>${link("Review my information", "details", "secondary")}</section>`,
  );
}
function feedbackView() {
  return template(
    "Would this help your real decision?",
    "The future offer is a personal decision package with comparisons, a brief and a defined review period.",
    `<section class="card dark"><div class="eyebrow">Offer preview · no checkout</div><h2>Pay for an answer you can understand.</h2><p>The planned package would add verified personal cash-flow comparisons, disclosed assumptions and a portable decision brief. That personal modelling is not connected in this prototype.</p><p class="small">Price and access period are still being tested. Saving more fictional examples alone is not the paid offer.</p></section><form id="feedback-form"><section class="card"><div class="field"><label for="feedback-task">What decision are you currently trying to make, and when?</label><textarea id="feedback-task" maxlength="2000" placeholder="For example, compare stopping full-time work with working part-time…">${esc(workspace.feedback?.task || "")}</textarea></div><div class="field"><label for="feedback-workaround">What do you use today?</label><textarea id="feedback-workaround" maxlength="2000" placeholder="A spreadsheet, adviser, another app or nothing yet…">${esc(workspace.feedback?.workaround || "")}</textarea></div><div class="field"><label for="feedback-value">What did this prototype actually help you do today?</label><textarea id="feedback-value" maxlength="2000">${esc(workspace.feedback?.value || "")}</textarea></div><div class="field"><label for="feedback-gap">What was better or worse than your current approach, and what is missing?</label><textarea id="feedback-gap" maxlength="2000" placeholder="A missing capability, trust concern or better current workaround…">${esc(workspace.feedback?.gap || "")}</textarea></div><div class="field"><label for="feedback-intent">Future preference: if your decision were answered reliably, would you pay?</label><select id="feedback-intent"><option value="unsure">Unsure</option><option value="one-off">Possibly, a one-off decision package</option><option value="recurring">Possibly, ongoing access for repeat reviews</option><option value="free-only">Free version only / no paid need</option></select></div><button class="btn" type="submit">Download my feedback</button><p class="small" style="margin:14px 0 0">This downloads your feedback only. Purchase preference is a conditional statement, not payment evidence. Nothing is submitted to a server.</p></section></form>`,
  );
}

function download(name, content, type = "application/json") {
  const blob = new Blob([content], { type }),
    url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function saveWorkspace() {
  if (!draft()?.consent.deviceSave) return;
  try {
    serialise(draft());
    localStorage.setItem(
      KEY,
      JSON.stringify({
        format: 2,
        personal: draft(),
        sampleId: workspace.sampleId,
        sampleScenarios: workspace.sampleScenarios,
        activeView: workspace.activeView,
        activeScenario: workspace.activeScenario,
        mode: workspace.mode,
      }),
    );
    storageProblem = "";
  } catch (e) {
    storageProblem =
      "This browser could not save your work. Keep an exported backup; the current tab still has your draft.";
    toast(storageProblem);
  }
}
function commit(patch) {
  workspace.mode = "personal";
  workspace.personal = updateBaseline(draft(), patch);
  saveWorkspace();
  go("overview");
  toast("Information kept in the current draft.");
}
function id() {
  return crypto.randomUUID();
}
function collectProfile(p, prefix = "", route = "dc") {
  const out = copy(p);
  for (const key of [
    "age",
    "targetRetirementAge",
    "pensionTotal",
    "nonPensionTotal",
    "annualPensionIncome",
    "monthlySpending",
  ])
    if ($("#" + prefix + key)) out[key] = readNumber(prefix + key);
  if ($("#" + prefix + "retirementStatus"))
    out.retirementStatus = $("#" + prefix + "retirementStatus").value;
  return out;
}
function safeAction(fn) {
  try {
    fn();
  } catch (e) {
    errors([{ message: e.message }]);
    toast(e.message);
  }
}
function bindForms() {
  if ($("#account-owner"))
    $("#account-owner").value =
      draft().accounts.find((a) => a.id === workspace.editAccountId)?.owner ||
      "primary";
  if ($("#account-type"))
    $("#account-type").value =
      draft().accounts.find((a) => a.id === workspace.editAccountId)?.type ||
      "pension";
  $("#account-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    safeAction(() => {
      if (!$("#account-confirm").checked)
        throw Error("Check this account is counted once.");
      const old = draft().accounts.find(
        (a) => a.id === workspace.editAccountId,
      );
      const a = {
        id: old?.id || id(),
        name: $("#account-name").value.trim(),
        owner: $("#account-owner").value,
        type: $("#account-type").value,
        balance: readNumber("account-balance"),
        accessAge: readNumber("account-access"),
      };
      if (!a.name) throw Error("Give this account a recognisable label.");
      const accounts = old
        ? draft().accounts.map((x) => (x.id === old.id ? a : x))
        : [...draft().accounts, a];
      workspace.editAccountId = null;
      commit({ accounts });
    });
  });
  $("#setup-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    safeAction(() => {
      if (!draft()) workspace.personal = createDraft();
      const d = draft(),
        p = collectProfile(d.profile, "", d.route);
      p.incomeBasis = $("#incomeBasis")?.value || p.incomeBasis;
      p.savingsAccessibility = d.route === "dc" ? "unknown" : "accessible";
      const scope = $("#scope").value,
        basis = $("#spendingBasis").value;
      commit({
        profile: p,
        planningScope: scope,
        spendingBasis: basis,
        householdStatus:
          scope === "individual"
            ? "individual"
            : d.partner
              ? "confirmed"
              : "pending",
      });
    });
  });
  $("#partner-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    safeAction(() => {
      if (!$("#joint-confirm").checked)
        throw Error(
          "Confirm that joint balances are counted once before keeping partner details.",
        );
      const p = collectProfile(
        draft().partner || createDraft().profile,
        "partner-",
      );
      p.annualPensionIncome = readNumber("partner-income");
      p.incomeBasis = $("#partner-basis").value;
      p.retirementStatus = $("#partner-status").value;
      commit({
        partner: p,
        planningScope: "household",
        spendingBasis: $("#shared-spending").value,
        householdStatus: "confirmed",
      });
    });
  });
  $("#income-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    safeAction(() => {
      const type = $("#income-type").value,
        row = {
          id: id(),
          owner: $("#income-owner").value,
          type,
          label:
            type === "db"
              ? "DB pension"
              : type === "state"
                ? "State Pension"
                : "Other income",
          annualAmount: readNumber("income-amount"),
          startAge: readNumber("income-start"),
          endAge: field(),
          incomeBasis: $("#stream-basis").value,
        };
      commit({
        details: { incomeStreams: [...draft().details.incomeStreams, row] },
      });
    });
  });
  $("#access-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    safeAction(() =>
      commit({
        details: {
          pensionAccessAge: readNumber("pension-access"),
          cashTotal: readNumber("cash-total"),
          investedTotal: readNumber("invested-total"),
          accessReviewed: true,
        },
      }),
    );
  });
  $("#contribution-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    safeAction(() =>
      commit({
        details: {
          monthlyContributions: readNumber("contribution"),
          employerIncluded:
            $("#employer").value === "unknown"
              ? null
              : $("#employer").value === "yes",
        },
      }),
    );
  });
  $("#cost-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    safeAction(() => {
      const amount = readNumber("major-cost"),
        age = readNumber("major-age");
      const costs = [...draft().details.majorCosts];
      if (val(amount) != null || val(age) != null)
        costs.push({
          id: id(),
          label: "One-off expense",
          owner: "primary",
          amount,
          age,
        });
      commit({
        details: {
          housingIncluded:
            $("#housing").value === "unknown"
              ? null
              : $("#housing").value === "yes",
          majorCosts: costs,
          costsReviewed: true,
        },
      });
    });
  });
  $("#scenario-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    safeAction(() => {
      const overrides = {};
      for (const key of Object.keys(overrideLabels)) {
        const el = $("#scenario-" + key);
        if (el && el.value.trim() !== "") overrides[key] = Number(el.value);
      }
      if (!Object.keys(overrides).length)
        throw Error("Enter at least one change to compare.");
      const current = selected(),
        context = isExample() ? copy(sample().draft) : copy(draft());
      context.scenarios = scenarios().filter((x) => x.id !== current?.id);
      const s = createScenario(context, $("#scenario-name").value, overrides);
      if (isExample()) evaluateExample(workspace.sampleId, overrides);
      if (current) s.id = current.id;
      const list = current
        ? scenarios().map((x) => (x.id === current.id ? s : x))
        : [...scenarios(), s];
      if (isExample()) workspace.sampleScenarios[workspace.sampleId] = list;
      else draft().scenarios = list;
      workspace.activeScenario = s.id;
      saveWorkspace();
      render();
      toast("Alternative kept with all changed inputs.");
    });
  });
  $("#device-save")?.addEventListener("change", (e) => {
    draft().consent.deviceSave = e.target.checked;
    if (e.target.checked) {
      saveWorkspace();
      toast(storageProblem || "Draft saved on this browser.");
    } else {
      try {
        localStorage.removeItem(KEY);
        savedAvailable = null;
        storageProblem = "";
        toast(
          "Device saving off. Stored draft deleted; current tab still has your work.",
        );
      } catch {
        toast(
          "Browser storage could not be cleared. Use browser settings to remove site data.",
        );
      }
    }
    render();
  });
  $("#restore-file")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1000000) {
      toast("Draft file is too large. The current draft is unchanged.");
      return;
    }
    const parsed = parseSaved(await file.text());
    if (!parsed.ok) {
      toast("Could not restore: " + parsed.error);
      return;
    }
    if (
      (draft() || savedAvailable) &&
      !confirm(
        "Replace this tab’s draft and remove any older saved work? The imported draft will start with device saving off. Export a backup first if needed.",
      )
    )
      return;
    try {
      localStorage.removeItem(KEY);
      savedAvailable = null;
    } catch {
      toast(
        "Could not remove the older saved work. Import cancelled; current draft unchanged.",
      );
      return;
    }
    workspace.personal = parsed.draft;
    workspace.personal.consent.deviceSave = false;
    workspace.mode = "personal";
    workspace.activeScenario = null;
    go("overview");
    toast("Draft restored in this tab. Device saving remains off.");
  });
  $("#feedback-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    workspace.feedback = {
      task: $("#feedback-task").value,
      gap: $("#feedback-gap").value,
      workaround: $("#feedback-workaround").value,
      value: $("#feedback-value").value,
      intent: $("#feedback-intent").value,
      context: isExample() ? "fictional-example" : "personal-information-draft",
      date: new Date().toISOString(),
      submitted: false,
    };
    download(
      "steadybee-feedback.json",
      JSON.stringify(workspace.feedback, null, 2),
    );
    toast("Feedback downloaded. It has not been submitted to a server.");
  });
}
function exportCSV() {
  const base = evaluateExample(workspace.sampleId),
    result = selected()
      ? evaluateExample(workspace.sampleId, selected().overrides)
      : base;
  const quote = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
  const keys = [
    "year",
    "primaryAge",
    "partnerAge",
    "openingAccessible",
    "openingPension",
    "accessibleGrowth",
    "pensionGrowth",
    "contributions",
    "income",
    "spending",
    "majorCost",
    "withdrawalsAccessible",
    "withdrawalsPension",
    "closingAccessible",
    "closingPension",
    "annualGap",
    "bridgeGap",
  ];
  const lines = [
    ["Fictional example", sample().name],
    ["Scenario", selected()?.name || "Baseline"],
    ["Fixture version", result.provenance.fixtureVersion],
    [
      "Mode",
      "Not your plan; fictional net-assumed income; no personal tax model",
    ],
    ...result.assumptions.map((a, i) => ["Assumption " + (i + 1), a]),
    ...result.changes.map((c) => [c.label, c.from, c.to]),
    [],
    keys,
    ...result.rows.map((r) => keys.map((k) => r[k])),
  ];
  download(
    "steadybee-fictional-example.csv",
    lines.map((l) => l.map(quote).join(",")).join("\r\n"),
    "text/csv",
  );
  toast("Fictional example tables exported with assumptions.");
}
function restoreWorkspace(raw) {
  const s = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!s || s.format !== 2)
    throw Error(
      "Saved workspace format is unsupported. Export or delete it before starting again.",
    );
  const parsed = parseSaved(JSON.stringify(s.personal));
  if (!parsed.ok)
    throw Error(
      "Saved draft is invalid. The original saved data has not been changed.",
    );
  const sampleId = examples.some((e) => e.id === s.sampleId)
    ? s.sampleId
    : "mixed-household";
  const clean = {};
  for (const [exampleId, list] of Object.entries(s.sampleScenarios || {})) {
    const e = examples.find((x) => x.id === exampleId);
    if (!e || !Array.isArray(list) || list.length > 2) continue;
    const context = copy(e.draft);
    context.scenarios = [];
    clean[exampleId] = list.map((x) => {
      const sc = createScenario(context, x.name, x.overrides);
      sc.id = x.id;
      evaluateExample(exampleId, sc.overrides);
      context.scenarios.push(sc);
      return sc;
    });
  }
  return {
    personal: parsed.draft,
    mode: s.mode === "example" ? "example" : "personal",
    sampleId,
    sampleScenarios: clean,
    activeScenario: s.activeScenario || null,
    activeView: s.activeView || "overview",
    feedback: null,
  };
}
function fresh() {
  if (
    draft() &&
    !confirm(
      "Start a new draft in this tab? Export the current draft first if you need it.",
    )
  )
    return;
  workspace.personal = createDraft();
  workspace.mode = "personal";
  workspace.activeScenario = null;
  go("setup");
}
function handleAction(a) {
  if (a.startsWith("example:")) {
    workspace.sampleId = a.slice(8);
    workspace.mode = "example";
    workspace.activeScenario = null;
    go("overview");
    return;
  }
  if (a === "personal") {
    workspace.mode = "personal";
    workspace.activeScenario = null;
    go(draft() ? "overview" : "setup");
    return;
  }
  if (a.startsWith("dismiss:")) {
    draft().ui.dismissedDetailIds.push(a.slice(8));
    saveWorkspace();
    render();
    return;
  }
  if (a === "resume") {
    workspace = restoreWorkspace(savedAvailable);
    go(workspace.activeView);
    toast("Saved work resumed.");
    return;
  }
  if (a === "fresh") return fresh();
  if (a === "print") {
    document.body.classList.toggle(
      "print-appendix",
      !!$("#include-appendix")?.checked,
    );
    window.print();
    return;
  }
  if (a === "export-draft") {
    if (draft()) download("steadybee-personal-draft.json", serialise(draft()));
    return;
  }
  if (a === "export-csv") return exportCSV();
  if (a === "remove-partner") {
    if (
      confirm(
        "Remove the partner profile and switch to an individual draft? Partner income/accounts will be retained but excluded. The same spending amount will be labelled individual; review it after removing the partner.",
      )
    ) {
      commit({
        partner: null,
        planningScope: "individual",
        householdStatus: "individual",
        spendingBasis: "individual",
      });
      toast(
        "Partner profile removed. Partner-owned income/accounts are retained but excluded from the solo summary.",
      );
    }
    return;
  }
  if (a.startsWith("remove-income:")) {
    commit({
      details: {
        incomeStreams: draft().details.incomeStreams.filter(
          (x) => x.id !== a.slice(14),
        ),
      },
    });
    return;
  }
  if (a.startsWith("remove-account:")) {
    commit({ accounts: draft().accounts.filter((x) => x.id !== a.slice(15)) });
    return;
  }
  if (a.startsWith("edit-account:")) {
    workspace.editAccountId = a.slice(13);
    render();
    return;
  }
  if (a.startsWith("remove-cost:")) {
    commit({
      details: {
        majorCosts: draft().details.majorCosts.filter(
          (x) => x.id !== a.slice(12),
        ),
      },
    });
    return;
  }
  if (a === "new-scenario") {
    workspace.activeScenario = null;
    render();
    return;
  }
  if (a === "reset-scenario") {
    $("#scenario-form").reset();
    for (const el of $("#scenario-form").querySelectorAll("input[type=number]"))
      el.value = "";
    return;
  }
  if (a.startsWith("select-scenario:")) {
    workspace.activeScenario = a.slice(16);
    render();
    return;
  }
  if (a.startsWith("delete-scenario:")) {
    const id = a.slice(16);
    const list = scenarios().filter((x) => x.id !== id);
    if (isExample()) workspace.sampleScenarios[workspace.sampleId] = list;
    else draft().scenarios = list;
    workspace.activeScenario = null;
    saveWorkspace();
    render();
    return;
  }
  if (a === "preset-household") {
    const context = copy(sample().draft);
    context.scenarios = scenarios();
    const s = createScenario(context, "Step back with part-time work", {
      retirementAge: 59,
      partnerRetirementAge: 59,
      partTimeAnnual: 15000,
      partTimeEndAge: 63,
      monthlySpending: 3200,
    });
    workspace.sampleScenarios[workspace.sampleId] = [...scenarios(), s];
    workspace.activeScenario = s.id;
    saveWorkspace();
    render();
    return;
  }
  if (a === "delete-work") {
    if (
      !confirm(
        "Delete the saved work and the personal draft in this tab? Export a backup first if needed.",
      )
    )
      return;
    try {
      localStorage.removeItem(KEY);
      savedAvailable = null;
      workspace.personal = null;
      workspace.mode = "personal";
      workspace.activeScenario = null;
      storageProblem = "";
      go("start");
      toast("Saved work and current personal draft deleted.");
    } catch {
      toast(
        "Could not delete browser storage. Use browser settings to clear site data.",
      );
    }
    return;
  }
}

document.addEventListener("click", (e) => {
  if (e.target.closest(".skip")) {
    e.preventDefault();
    $("#main")?.focus();
    return;
  }
  const a = e.target.closest("[data-action]");
  if (a) {
    e.preventDefault();
    safeAction(() => handleAction(a.dataset.action));
    return;
  }
  const r = e.target.closest("[data-route]");
  if (r) {
    e.preventDefault();
    const current = draft() || createDraft();
    current.profile = collectProfile(current.profile, "", current.route);
    current.profile.incomeBasis =
      $("#incomeBasis")?.value || current.profile.incomeBasis;
    current.planningScope = $("#scope")?.value || current.planningScope;
    current.spendingBasis = $("#spendingBasis")?.value || current.spendingBasis;
    current.householdStatus =
      current.planningScope === "individual"
        ? "individual"
        : current.partner
          ? "confirmed"
          : "pending";
    const oldRoute = current.route;
    current.route = r.dataset.route;
    if (
      oldRoute === "dc" &&
      current.route !== "dc" &&
      val(current.profile.nonPensionTotal) != null &&
      !confirm(
        "Are these non-pension savings accessible? If not sure, keep the amount as unknown and clarify account access later.",
      )
    )
      current.profile.nonPensionTotal = field();
    current.profile.retirementStatus =
      current.route === "retired" ? "already-retired" : "working";
    if (
      current.route === "retired" &&
      val(current.profile.targetRetirementAge) > val(current.profile.age)
    )
      current.profile.targetRetirementAge = field();
    current.profile.savingsAccessibility =
      current.route === "dc" ? "unknown" : "accessible";
    workspace.personal = current;
    render();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.type === "number") {
    const status = $("#" + e.target.id + "-status");
    if (status && status.value === "unknown") status.value = "provided";
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id?.endsWith("-status") && e.target.value === "unknown") {
    const input = $("#" + e.target.id.slice(0, -7));
    if (input) input.value = "";
  }
});
window.addEventListener("hashchange", () => {
  render();
  $("#main h1")?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  saveWorkspace();
});
window.snapshotSteadybeePlan = () => ({
  format: 2,
  ...copy(workspace),
  editFields: [
    ...document.querySelectorAll("input[id],select[id],textarea[id]"),
  ]
    .filter((e) => e.type !== "file")
    .map((e) => ({ id: e.id, value: e.value, checked: e.checked })),
});
window.restoreSteadybeePlan = (s) => {
  if (!s || s.format !== 2) return;
  try {
    if (s.personal) {
      const parsed = parseSaved(JSON.stringify(s.personal));
      if (!parsed.ok) return;
    }
    workspace = { ...workspace, ...s };
    render();
    for (const f of s.editFields || []) {
      const el = document.getElementById(f.id);
      if (el) {
        el.value = f.value;
        el.checked = f.checked;
      }
    }
  } catch {
    toast(
      "The temporary draft could not be restored. Use a saved backup if available.",
    );
  }
};
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    if (raw.length > 1000000)
      throw Error("Saved draft is too large to restore here.");
    restoreWorkspace(raw);
    savedAvailable = raw;
  }
} catch (e) {
  storageProblem = "Could not open saved work. " + e.message;
}
if (
  params.has("example") &&
  examples.some((e) => e.id === params.get("example"))
) {
  workspace.mode = "example";
  workspace.sampleId = params.get("example");
}
if (pendingRestore) {
  window.restoreSteadybeePlan(pendingRestore);
  window.__steadybeeRestore = null;
} else render();

function accountsView() {
  if (isExample()) return detailsView();
  const d = draft(),
    a = d.accounts.find((x) => x.id === workspace.editAccountId),
    sum = summariseDraft(d);
  return template(
    "Each account belongs somewhere.",
    "Manual details explain your existing totals. They are never added a second time.",
    `<section class="card"><h2>Accounts entered</h2>${
      activeAccounts(d)
        .map(
          (a) =>
            `<div class="row"><span>${esc(a.name)} · ${esc(a.owner)} · ${esc(a.type)}<br><small>Access at owner age ${val(a.accessAge) ?? "unknown"}</small></span><b>${money(val(a.balance))} ${btn("Edit", `edit-account:${a.id}`, "quiet")}${btn("Remove", `remove-account:${a.id}`, "quiet")}</b></div>`,
        )
        .join("") || '<p class="small">No active account detail entered.</p>'
    }<p class="small">Joint accounts count once across the household. When solo, a joint account is listed as jointly owned; no personal share is inferred.</p>${sum.reconciliation.map((r) => `<div class="notice">${esc(r.group)}: entered aggregate ${money(r.enteredTotal)}, account detail ${money(r.accountTotal)}. ${r.difference === 0 ? "Matches the aggregate." : "Difference " + money(r.difference) + " — review the values; the account total does not replace your aggregate automatically."}</div>`).join("")}</section><form id="account-form" novalidate><div id="form-error"></div><section class="card"><h2>${a ? "Edit account" : "Add an account"}</h2><div class="field"><label for="account-name">A label you recognise</label><input id="account-name" maxlength="100" value="${esc(a?.name || "")}" placeholder="For example: Pension A"><span class="help">No account number or institution name needed.</span></div><div class="grid"><div class="field"><label for="account-owner">Owner</label><select id="account-owner"><option value="primary">Primary person</option>${d.partner ? '<option value="partner">Partner</option>' : ""}<option value="joint">Joint · count once</option></select></div><div class="field"><label for="account-type">Type</label><select id="account-type"><option value="pension">Invested pension</option><option value="cash">Cash</option><option value="investment">Investment / ISA</option><option value="other">Other</option></select></div>${numericInput("account-balance", "Balance (£)", a?.balance, "Part of your previously entered total.")}${numericInput("account-access", "Access at owner’s age", a?.accessAge, "Unknown allowed. For a joint account use the primary person’s age as the date basis.", 100)}</div><label class="check"><input id="account-confirm" type="checkbox"><span>I checked this account is not already entered as another row. A joint pension pot is not supported.</span></label><button class="btn" type="submit">${a ? "Update" : "Add"} account detail</button></section></form>`,
  );
}

function compactExampleReport(items) {
  const e = sample(),
    base = evaluateExample(e.id),
    results = [
      { name: "Baseline", result: base },
      ...items.map((s) => ({
        name: s.name,
        result: evaluateExample(e.id, s.overrides),
      })),
    ];
  const row = (label, fn) =>
    `<tr><th>${label}</th>${results.map((x) => `<td>${fn(x.result)}</td>`).join("")}</tr>`;
  const incomeDates = base.events
    .filter((x) => x.type === "income-start")
    .map(
      (e) =>
        `${esc(e.label)} · ${e.year} (${e.owner === "partner" ? "partner" : "primary"} age ${e.owner === "partner" ? e.partnerAge : e.primaryAge})`,
    )
    .join("; ");
  return template(
    "A brief you can talk through.",
    "The decision on one page. Full workings when you want them.",
    `<div class="print-provenance">Fictional example · ${esc(e.name)} · ${esc(base.provenance.fixtureVersion)} · not your plan</div><article class="card brief brief-core" id="decision-brief"><div class="brief-meta"><b>Steadybee · fictional decision brief</b><span>${esc(base.provenance.sourceDate)} · ${esc(base.provenance.fixtureVersion)}</span></div><div class="tag warn">Fictional example · ${esc(e.name)}</div><h2 style="margin-top:16px">${esc(e.name)}: retirement choices</h2><p class="statement">${exampleHeadline(base)}</p><div class="table-wrap"><table class="brief-table"><thead><tr><th>Choice</th>${results.map((r) => `<th>${esc(r.name)}</th>`).join("")}</tr></thead><tbody>${row("Primary retirement", (r) => `${r.summary.retirementYear} · age ${r.summary.retirementAge}`)}${base.summary.partnerRetirementAge != null ? row("Partner retirement", (r) => `${r.summary.partnerRetirementYear} · age ${r.summary.partnerRetirementAge}`) : ""}${row("Monthly spending", (r) => money(r.summary.monthlySpending))}${row("First unfunded year", (r) => r.summary.firstGapYear ?? "None in illustrated horizon")}${row("Unfunded bridge gap", (r) => money(r.summary.bridgeGapTotal))}${row("Bridge gap years", (r) => (r.summary.bridgeGapYears.length ? r.summary.bridgeGapYears.join(", ") : "None under these assumptions"))}</tbody></table></div>${
      items.length
        ? `<h3>Changed inputs</h3>${items
            .map((s) => {
              const r = evaluateExample(e.id, s.overrides);
              return `<p class="small"><b>${esc(s.name)}:</b> ${r.changes.map((c) => `${esc(c.label)} ${c.key.includes("Age") ? c.from : money(c.from)} → ${c.key.includes("Age") ? c.to : money(c.to)}`).join("; ")}.</p>`;
            })
            .join("")}`
        : '<p class="small">Explore a change to add your chosen alternative to this brief.</p>'
    }<h3>Income and access milestones</h3><p class="small">${incomeDates}</p><p class="small">${[
      base.profile.primary,
      base.profile.partner,
    ]
      .filter(Boolean)
      .map(
        (p) =>
          `${esc(p.name)}: invested pot access at fictional age ${p.pensionAccessAge}`,
      )
      .join(
        " · ",
      )}. Contributions end at each selected retirement date.</p><h3>Questions for the conversation</h3><p class="small">Does this spending match the life we mean? What funds the years before pensions start? Which unknown input could change this choice?</p><div class="notice">Open assumptions: fictional net income and pound-for-pound pension withdrawals; no UK tax calculation, scheme-specific DB escalation/reductions or survivor effects. Figures cannot establish personal affordability.</div><p class="small">Today’s pounds; chosen fixed annual real returns of ${(base.profile.realAccessibleReturn * 100).toFixed(0)}% on accessible savings and ${(base.profile.realPensionReturn * 100).toFixed(0)}% on pension pots, after assumed fees. Horizon: end of primary age ${base.summary.horizonAge}. No life-expectancy inference.</p><p class="small">Review after a pension statement, changed work plans or a major cost. Source: ${esc(base.provenance.fixtureId)} · ${esc(base.provenance.fixtureVersion)}. Illustration, not advice. Fictional example — not your plan.</p></article><div class="no-print"><label class="check"><input type="checkbox" id="include-appendix"><span>Include the full appendix when printing / saving PDF</span></label></div>${buttons(btn("Print / save PDF", "print") + btn("Export example tables (CSV)", "export-csv", "secondary") + link("Preview the decision bundle", "feedback"))}<section class="card example-appendix"><div class="eyebrow">Optional appendix · fictional example</div><h2>Full timelines and workings</h2><p class="small">Every table belongs to ${esc(e.name)}. Income is assumed net and no personal forecast is connected.</p>${results.map(({ name, result }) => `<section><h3>${esc(name)}</h3>${eventsMarkup(result)}<details><summary>Show annual cash flow — ${esc(name)}</summary>${cashTable(result)}</details></section>`).join("")}${assumptionsCard(base)}<p class="small">Fictional example · ${esc(e.name)} · ${esc(base.provenance.fixtureVersion)}. Illustration, not advice.</p></section>`,
  );
}
