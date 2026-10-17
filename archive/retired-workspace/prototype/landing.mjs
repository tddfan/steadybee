import { evaluateExample, FIXTURE_VERSION } from "./fixtures.mjs";
import { landingChoices } from "./landing-choices.mjs";
import { exampleInsights } from "./example-insights.mjs";

const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let horizonAge = 95;
let baseline = evaluateExample("early-dc", { horizonAge });
let choice = landingChoices[0];
let result = baseline;
let chartView = "funding";
let decisions = {};
let inspectedAge = 67;
const colors = { income: "#14665f", savings: "#94bfad", pension: "#d3af57", gap: "#b87055" };
const sources = (row) => [
  { key: "income", label: "Income", amount: Math.min(row.income, row.spending + row.majorCost) },
  { key: "savings", label: "Savings used", amount: row.withdrawalsAccessible },
  { key: "pension", label: "Pension pot used", amount: row.withdrawalsPension },
  { key: "payoff", label: "Mortgage payoff from savings", amount: row.mortgagePayoff },
  { key: "gap", label: "Spending not covered", amount: row.annualGap },
];

function drawChart() {
  const element = $("#bridge-chart"), width = Math.max(element.clientWidth, 220), height = 240;
  const left = 46, right = width - 8, top = 20, bottom = height - 42;
  const rows = result.rows, stepWidth = (right - left) / rows.length;
  const x = (age) => left + (age - rows[0].primaryAge + .5) * stepWidth;
  const need = (r) => r.spending + r.majorCost + r.mortgagePayoff;
  const maximum = chartView === "funding" ? Math.max(...rows.map(need), 1) : Math.max(...rows.flatMap(r => [r.closingAccessible, r.closingPension]), 1);
  const step = maximum > 200000 ? 100000 : maximum > 80000 ? 20000 : 10000;
  const max = Math.ceil(maximum / step) * step, y = v => bottom - v / max * (bottom - top);
  const grid = [0, max / 2, max].map(v => `<line x1="${left}" y1="${y(v)}" x2="${right}" y2="${y(v)}" stroke="#e3e9e2"/><text x="${left - 6}" y="${y(v)+4}" text-anchor="end" font-size="13" fill="#536568">${v ? "£"+v/1000+"k" : "£0"}</text>`).join("");
  const stepped = fn => rows.flatMap(r => [`${x(r.primaryAge)-stepWidth/2},${y(fn(r))}`, `${x(r.primaryAge)+stepWidth/2},${y(fn(r))}`]);
  const target = stepped(need), covered = stepped(r => need(r)-r.annualGap);
  let plots;
  if (chartView === "funding") {
    plots = `<polygon points="${left},${bottom} ${covered.join(" ")} ${right},${bottom}" fill="#87baaa"/><polygon points="${target.join(" ")} ${[...covered].reverse().join(" ")}" fill="#df8e78"/><polyline points="${target.join(" ")}" fill="none" stroke="#314d4a" stroke-width="1.5"/>`;
    $("#chart-heading").textContent = "Will the money cover spending?";
    $("#chart-unit").textContent = `${money(result.profile.monthlySpending * 12)}/year before changes`;
    $("#preview-legend").innerHTML = '<span><i style="background:#87baaa"></i>Covered</span><span><i style="background:#df8e78"></i>Needs more money</span>';
    $("#chart-reading").textContent = "Green covers spending. Coral shows what’s missing. Tap any year for the figures.";
  } else {
    plots = [ ["closingAccessible", "#14665f"], ["closingPension", "#b18d36"] ].map(([key,color]) => `<path d="${rows.map((r,i) => `${i ? "L" : "M"}${x(r.primaryAge)},${y(r[key])}`).join(" ")}" fill="none" stroke="${color}" stroke-width="3"/>`).join("");
    $("#chart-heading").textContent = "Money remaining at year-end";
    $("#chart-unit").textContent = "Today’s pounds";
    $("#preview-legend").innerHTML = '<span><i style="background:#14665f"></i>Savings outside pensions</span><span><i style="background:#b18d36"></i>Pension pots</span>';
    $("#chart-reading").textContent = "Pension pots include money locked before 60. Tap a year to see what is available.";
  }
  const strips = rows.map(r => `<rect x="${x(r.primaryAge)-stepWidth/2}" y="${bottom+6}" width="${stepWidth+.1}" height="5" fill="${r.annualGap ? "#df8e78" : "#87baaa"}"/>`).join("");
  const hits = rows.map(r => `<g><title>Alex age ${r.primaryAge}, ${r.year}: ${sources(r).map(v => `${v.label} ${money(v.amount)}`).join("; ")}. Spending ${money(need(r))} per year.</title><rect data-year="${r.primaryAge}" x="${x(r.primaryAge)-stepWidth/2}" y="${top}" width="${stepWidth}" height="${bottom-top+12}" fill="transparent" style="cursor:pointer"/></g>`).join("");
  const ticks = [52,60,70,80,horizonAge].map((age,i) => `<text x="${x(age)}" y="${height-8}" font-size="13" text-anchor="${i===0 ? "start" : i===4 ? "end" : "middle"}" fill="#536568">${age}</text>`).join("");
  element.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="retirement-chart-title retirement-chart-description"><title id="retirement-chart-title">${esc(choice.label)}: Alex ages 52 to ${horizonAge}, ${chartView === "funding" ? "annual spending coverage" : "year-end money remaining"}.</title><desc id="retirement-chart-description">Fictional illustration. Spending includes one-off expenses and any cash mortgage payoff in their actual year. Earlier gaps remain unpaid. Planning ends at age ${horizonAge}, not a lifespan prediction.</desc>${grid}${plots}${strips}${rows.filter(r => r.majorCost || r.mortgagePayoff || r.homeCashReleased).map(r => `<circle cx="${x(r.primaryAge)}" cy="${y(chartView === "funding" ? need(r) : r.closingAccessible)}" r="3" fill="#314d4a"><title>Age ${r.primaryAge}: ${r.majorCost ? "one-off expense" : r.mortgagePayoff ? "mortgage payoff" : "home move"}. Tap this year for figures.</title></circle>`).join("")}${hits}${ticks}</svg>`;
  $("#chart-range").textContent = `Alex’s age 52–${horizonAge} →`;
  $("#preview").dataset.chartEndAge = horizonAge;
  $("#preview").dataset.chartView = chartView;
}

function renderYear() {
  const row = result.rows.find((r) => r.primaryAge === inspectedAge);
  if (!row) return;
  const incomeLabels = { employment: "pay from work", partTime: "part-time pay", state: "fictional State Pension", db: "promised pension income", other: "other income" };
  const income = Object.entries(row.incomeBreakdown).filter(([, amount]) => amount > 0).map(([key, amount]) => `${incomeLabels[key]} ${money(amount)}/year`).join("; ");
  $("#preview-year-facts").innerHTML = `<p><b>${row.year} · Alex ${row.primaryAge}</b> · ${row.annualGap ? "Spending partly uncovered" : "Spending covered this year"}</p><p>Income this year: ${income || "none"}.</p><dl>${sources(row).map((s) => `<div><dt>${s.label}</dt><dd>${money(s.amount)}/year</dd></div>`).join("")}<div><dt>Spending target</dt><dd>${money(row.spending + row.majorCost + row.mortgagePayoff)}/year</dd></div><div><dt>Net cash released by moving home</dt><dd>${money(row.homeCashReleased)}</dd></div><div><dt>Mortgage within yearly spending</dt><dd>${money(row.mortgagePayment)}</dd></div><div><dt>Savings outside pensions left</dt><dd>${money(row.closingAccessible)}</dd></div><div><dt>Pension available to draw</dt><dd>${money(row.closingAvailablePension)}</dd></div><div><dt>Pension still locked</dt><dd>${money(row.closingLockedPension)}</dd></div><div><dt>Earlier and current spending not covered</dt><dd>${money(row.cumulativeGap)}</dd></div></dl><p>Money left is measured at year-end. Earlier gaps stay unresolved; this example does not borrow money to meet them.</p>`;
}

function setChoice(next) {
  const evaluated = evaluateExample("early-dc", { ...next.overrides, ...decisions, horizonAge });
  choice = next;
  baseline = evaluateExample("early-dc", { horizonAge });
  result = evaluated;
  const facts = exampleInsights(result);
  $("#preview-early-range").textContent = facts.gapPeriods.length ? facts.gapPeriods.map(p => p.start.primaryAge === p.end.primaryAge ? `Age ${p.start.primaryAge}` : `Ages ${p.start.primaryAge}–${p.end.primaryAge}`).join(" · ") : `None through age ${horizonAge}`;
  const access = facts.gapPeriods.filter((p) => p.kind === "access");
  const later = facts.gapPeriods.find((p) => p.kind === "later");
  for (const button of document.querySelectorAll("[data-preview]")) button.setAttribute("aria-pressed", String(button.dataset.preview === choice.id));
  $("#preview-age").textContent = result.summary.retirementAge;
  $("#preview-spend").textContent = money(result.summary.monthlySpending);
  $("#preview-gap").textContent = money(result.summary.bridgeGapTotal);
  const period = access[0];
  const accessAge = result.profile.primary.pensionAccessAge;
  $("#preview-gap-label").textContent = `Spending gap before ${accessAge}`;
  $("#preview-gap-years").textContent = period ? `Total across ${period.end.year - period.start.year + 1} years · Ages ${period.start.primaryAge}–${period.end.primaryAge} · ${period.start.year}–${period.end.year}` : `No spending gap before age ${accessAge}`;
  $("#preview-later-age").textContent = later ? `Age ${later.start.primaryAge}` : `None through ${horizonAge}`;
  $("#preview-later-gap").textContent = later ? `${money(later.total)} total across ${later.end.year - later.start.year + 1} years · ${later.start.year}–${later.end.year}` : "Spending covered under these assumptions";
  const workContext = choice.id === "part-time"
    ? `Part-time: ${money(result.profile.partTimeAnnual / 12)}/month assumed take-home pay, ages ${result.summary.retirementAge}–${result.profile.partTimeEndAge - 1}.`
    : `Alex stops work at ${result.summary.retirementAge}.`;
  const gapContext = period ? `Spending gaps at ${period.start.primaryAge}–${period.end.primaryAge}${later ? ` and from ${later.start.primaryAge}` : ""}.` : `No spending gap before ${accessAge}${later ? `; a gap starts at ${later.start.primaryAge}` : ` or through ${horizonAge}`}.`;
  $("#preview-choice-context").textContent = workContext;
  const nextCovered = period?.nextCovered;
  const coverageEnd = nextCovered ? result.rows.find(r => r.primaryAge > nextCovered.primaryAge && r.annualGap > 0)?.primaryAge - 1 : null;
  $("#preview-outcome").textContent = (nextCovered ? `Spending is covered again from age ${nextCovered.primaryAge} to ${Number.isFinite(coverageEnd) ? coverageEnd : horizonAge}; the earlier spending gap stays unresolved. ` : "Closing the early gap still leaves later gaps. ") + `${money(result.summary.finalTotal)} remains at ${horizonAge} in savings and pension pots. Gap totals add up spending not covered across those years; they are not a top-up required today.`;
  const stages = [
    ["Stop full-time work", result.summary.retirementAge],
    ["Pension pot access", accessAge],
    [result.profile.statePensionAnnual ? "State Pension starts" : "State Pension excluded", result.profile.statePensionAnnual ? result.profile.statePensionAge : null], ["Plan through", horizonAge],
  ];
  $("#preview-milestones").innerHTML = stages.map(([label, age]) => `<div><span>${label}</span><strong>${age ?? "—"}</strong><small>${age == null ? "No income included" : result.profile.startYear + age - result.profile.primary.age}</small></div>`).join("");
  $("#preview-open").href = `app.html?example=early-dc&choice=${choice.id}&horizon=${horizonAge}${Object.keys(decisions).length ? `&decisions=${encodeURIComponent(JSON.stringify(decisions))}` : ""}${choice.id === "baseline" && !Object.keys(decisions).length ? "#overview" : "#scenarios"}`;
  for (const link of document.querySelectorAll('a[href*="example="]')) {
    const url = new URL(link.href);
    url.searchParams.set("horizon", horizonAge);
    link.href = url.pathname.split("/").at(-1) + url.search + url.hash;
  }
  $("#preview").dataset.choice = choice.id;
  $("#preview").dataset.bridgeGap = result.summary.bridgeGapTotal;
  $("#preview").dataset.horizonAge = horizonAge;
  $("#preview").dataset.laterGapAge = later?.start.primaryAge ?? "";
  inspectedAge = Math.min(inspectedAge, horizonAge);
  $("#preview-year").innerHTML = result.rows.map((r) => `<option value="${r.primaryAge}" ${r.primaryAge === inspectedAge ? "selected" : ""}>${r.primaryAge} · ${r.year}</option>`).join("");
  $("#preview-assumptions").innerHTML = `<p>Alex’s fictional plan · source ${esc(FIXTURE_VERSION)} · through age ${horizonAge}. All choices share the same endpoint.</p><ul>${result.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`;
  renderYear();
  drawChart();
}

function renderInsights() {
  const profile = baseline.profile.primary;
  const total = profile.savings + profile.pensionPot;
  const percent = (profile.savings / total) * 100;
  $("#accessible-percent").textContent = Math.round(percent) + "%";
  $("#accessible-value").textContent = money(profile.savings);
  $("#pension-value").textContent = money(profile.pensionPot);
  $("#total-assets").textContent = money(total);
  $("#access-donut").style.background =
    "conic-gradient(#14665f 0deg " +
    percent * 3.6 +
    "deg, #e6cf93 " +
    percent * 3.6 +
    "deg 360deg)";
  $("#access-donut").setAttribute(
    "aria-label",
    "Alex’s fictional starting assets: " +
      money(profile.savings) +
      " accessible savings and " +
      money(profile.pensionPot) +
      " in an invested pension pot, with access assumed at age " +
      profile.pensionAccessAge +
      ". " +
      Math.round(percent) +
      "% accessible at the start.",
  );
  const lower = evaluateExample("early-dc", {
    monthlySpending: baseline.summary.monthlySpending - 300,
  });
  $("#spend-base-gap").textContent = money(baseline.summary.bridgeGapTotal);
  $("#spend-lower-gap").textContent = money(lower.summary.bridgeGapTotal);
  $("#spend-base-bar").style.width = "100%";
  $("#spend-lower-bar").style.width =
    (lower.summary.bridgeGapTotal / baseline.summary.bridgeGapTotal) * 100 +
    "%";
  const household = evaluateExample("mixed-household");
  const start = household.profile.startYear,
    end = start + 10;
  $("#morgan-date").textContent =
    household.summary.retirementYear +
    " · age " +
    household.summary.retirementAge;
  $("#sam-date").textContent =
    household.summary.partnerRetirementYear +
    " · age " +
    household.summary.partnerRetirementAge;
  $("#morgan-marker").style.left =
    ((household.summary.retirementYear - start) / (end - start)) * 100 + "%";
  $("#sam-marker").style.left =
    ((household.summary.partnerRetirementYear - start) / (end - start)) * 100 +
    "%";
  $("#couple-start").textContent = start;
  $("#couple-end").textContent = end;
  $("#couple-gap").textContent =
    Math.abs(
      household.summary.partnerRetirementYear -
        household.summary.retirementYear,
    ) + " years";
  $("#preview-assumptions").innerHTML =
    "<p>Alex’s fictional plan · source version " +
    esc(FIXTURE_VERSION) +
    ". Preview choices use the same calculations and inputs as the worked example in the workspace.</p><ul>" +
    baseline.assumptions.map((item) => "<li>" + esc(item) + "</li>").join("") +
    "</ul>";
}

for (const button of document.querySelectorAll("[data-preview]")) {
  button.addEventListener("click", () => { try { setChoice(landingChoices.find((c) => c.id === button.dataset.preview)); } catch(error) { $(".life-decisions-panel").open = true; $("#decision-error").textContent = `Changes not applied: ${error.message}`; } });
}
for (const button of document.querySelectorAll("[data-view]")) {
  button.addEventListener("click", () => {
    chartView = button.dataset.view;
    for (const b of document.querySelectorAll("[data-view]")) b.setAttribute("aria-pressed", String(b === button));
    drawChart();
  });
}
$("#preview-horizon").addEventListener("change", (e) => {
  const previous = horizonAge;
  horizonAge = Number(e.target.value);
  try { setChoice(choice); } catch(error) { horizonAge = previous; e.target.value = previous; $(".life-decisions-panel").open = true; $("#decision-error").textContent = `Changes not applied: ${error.message}`; }
});
$("#preview-year").addEventListener("change", (e) => {
  inspectedAge = Number(e.target.value);
  renderYear();
});
renderInsights();
setChoice(choice);
if (typeof ResizeObserver !== "undefined") new ResizeObserver(drawChart).observe($("#bridge-chart"));

$("#bridge-chart").addEventListener("click", e => {
  const age = e.target.dataset.year;
  if (!age) return;
  inspectedAge = Number(age);
  $("#preview-year").value = age;
  $(".preview-year-detail").open = true;
  renderYear();
  $(".preview-year-detail").scrollIntoView({block:"nearest", behavior:"smooth"});
});
$("#life-decisions").addEventListener("submit", e => {
  e.preventDefault();
  const candidate = {};
  for (const input of e.target.querySelectorAll("[name]")) if (input.value !== "") candidate[input.name] = Number(input.value);
  try {
    evaluateExample("early-dc", {...choice.overrides, ...candidate, horizonAge});
    decisions = candidate;
    setChoice(choice);
    $("#decision-error").textContent = "Changes applied to Alex’s fictional plan.";
  } catch (error) { $("#decision-error").textContent = `Changes not applied: ${error.message}`; }
});

for (const button of document.querySelectorAll("[data-life]")) button.addEventListener("click", () => {
  const presets = {
    mortgage: {mortgageMonthly:600,mortgageEndAge:65},
    downsize: {mortgageMonthly:600,mortgageEndAge:65,homeSaleAmount:700000,replacementHomeCost:450000,mortgageSettlement:100000,movingCosts:25000,downsizeAge:60},
    expense: {majorCost:20000,majorCostAge:70},
    state: {statePensionAnnual:0},
    reset: {},
  };
  const candidate = button.dataset.life === "reset" ? {} : {...decisions,...presets[button.dataset.life]};
  try {
    evaluateExample("early-dc", {...choice.overrides,...candidate,horizonAge});
    decisions = candidate;
    for(const input of $("#life-decisions").querySelectorAll("[name]")) input.value = decisions[input.name] ?? "";
    setChoice(choice);
    $("#decision-error").textContent = button.dataset.life === "reset" ? "Original life assumptions restored." : "Fictional choice applied. Review the inputs below.";
  } catch(error) { $("#decision-error").textContent = `Changes not applied: ${error.message}`; }
});
