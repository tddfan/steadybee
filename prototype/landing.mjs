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
let zoom = "full";
let inspectedAge = 67;
const colors = { income: "#14665f", savings: "#94bfad", pension: "#d3af57", gap: "#b87055" };
const sources = (row) => [
  { key: "income", label: "Income", amount: Math.min(row.income, row.spending + row.majorCost) },
  { key: "savings", label: "Savings used", amount: row.withdrawalsAccessible },
  { key: "pension", label: "Pension pot used", amount: row.withdrawalsPension },
  { key: "gap", label: "Shortfall", amount: row.annualGap },
];

function drawChart() {
  const element = $("#bridge-chart");
  const width = Math.max(element.clientWidth, 220);
  const height = window.matchMedia("(max-width:650px)").matches ? 190 : 220;
  const left = 48, right = width - 9, top = 16, bottom = height - 34;
  const endAge = zoom === "bridge" ? 62 : horizonAge;
  const rows = result.rows.filter((row) => row.primaryAge <= endAge);
  const baseRows = baseline.rows.filter((row) => row.primaryAge <= endAge);
  const plotWidth = right - left, plotHeight = bottom - top;
  const barWidth = plotWidth / rows.length;
  const x = (age) => left + barWidth / 2 + (age - rows[0].primaryAge) / (rows.length - 1) * (plotWidth - barWidth);
  const maximum = chartView === "funding"
    ? Math.max(...rows.map((row) => row.spending + row.majorCost), 1)
    : Math.max(...rows.concat(baseRows).flatMap((row) => [row.closingAccessible, row.closingPension]), 1);
  const step = maximum > 200000 ? 100000 : maximum > 80000 ? 20000 : 10000;
  const max = Math.ceil(maximum / step) * step;
  const y = (value) => bottom - value / max * plotHeight;
  const path = (items, key) => items.map((row, index) => `${index ? "L" : "M"}${x(row.primaryAge).toFixed(2)},${y(row[key]).toFixed(2)}`).join(" ");
  const grid = [0, max / 2, max].map((value) => `<line x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}" stroke="#e3e9e2"/><text x="${left - 7}" y="${y(value) + 4}" text-anchor="end" font-size="13" fill="#536568">${value ? "£" + value / 1000 + "k" : "£0"}</text>`).join("");
  const ages = zoom === "bridge" ? [52, 55, 60, 62] : [52, 60, 70, 80, endAge];
  const ticks = ages.map((age, index) => `<text x="${x(age)}" y="${height - 9}" font-size="13" text-anchor="${index === 0 ? "start" : index === ages.length - 1 ? "end" : "middle"}" fill="#536568">${age}</text>`).join("");
  let plots;
  if (chartView === "funding") {
    plots = rows.map((row) => {
      let used = 0;
      const bars = sources(row).map((source) => {
        const from = used;
        used += source.amount;
        return source.amount > 0 ? `<rect x="${x(row.primaryAge) - barWidth / 2 + .5}" y="${y(used)}" width="${Math.max(.8, barWidth - 1)}" height="${y(from) - y(used)}" fill="${source.key === "gap" ? "url(#uncovered)" : colors[source.key]}"/>` : "";
      }).join("");
      return `<g><title>Alex age ${row.primaryAge}, ${row.year}: ${sources(row).map((s) => `${s.label} ${money(s.amount)}`).join("; ")}. Spending ${money(row.spending + row.majorCost)} per year.</title>${bars}</g>`;
    }).join("");
    $("#chart-heading").textContent = "What covers spending";
    $("#chart-unit").textContent = "£ / year · today’s money";
    $("#preview-legend").innerHTML = sources(rows[0]).map((s) => `<span><i style="background:${colors[s.key]}" class="legend-${s.key}" aria-hidden="true"></i>${s.label}</span>`).join("");
  } else {
    const gaps = rows.filter((r) => r.annualGap > 0).map((r) => `<rect x="${x(r.primaryAge) - barWidth / 2}" y="${top}" width="${barWidth}" height="${plotHeight}" fill="#fbede5"/>`).join("");
    const lines = (items, dashed = false) => [
      ["closingAccessible", "#14665f"], ["closingPension", "#b18d36"],
    ].map(([key, color]) => `<path d="${path(items, key)}" fill="none" stroke="${color}" stroke-width="${dashed ? 1.7 : 3}" ${dashed ? 'stroke-dasharray="5 4" opacity=".6"' : ""}/>`).join("");
    plots = gaps + (choice.id === "baseline" ? "" : lines(baseRows, true)) + lines(rows);
    $("#chart-heading").textContent = "Money remaining at year-end";
    $("#chart-unit").textContent = "Balances · today’s money";
    $("#preview-legend").innerHTML = '<span><i style="background:#14665f" aria-hidden="true"></i>Outside pensions</span><span><i style="background:#b18d36" aria-hidden="true"></i>Pension pots</span><span><i style="background:#fbede5;border:1px solid #b87055" aria-hidden="true"></i>Shortfall years</span>' + (choice.id === "baseline" ? "" : '<span>Dashed: retire at 55</span>');
  }
  const description = chartView === "funding"
    ? "Income used, savings withdrawals, pension withdrawals and uncovered spending add up to the spending target in each year. Income is assumed after tax; pension withdrawals have no tax applied."
    : "Separate savings and pension balances. Some pension money is locked before age 60. Shaded shortfall years can coexist with a positive locked pension. Earlier unpaid spending is separate from assets.";
  element.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="retirement-chart-title retirement-chart-description"><title id="retirement-chart-title">${esc(choice.label)}: Alex ages 52 to ${endAge}, ${chartView === "funding" ? "annual spending coverage" : "year-end money remaining"}.</title><desc id="retirement-chart-description">Fictional illustration. ${esc(description)} Planning ends at age ${horizonAge}; this is not a lifespan prediction.</desc><defs><pattern id="uncovered" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#b87055"/><path d="M-1 1 L1 -1 M0 6 L6 0 M5 7 L7 5" stroke="#eac6b5" stroke-width="1"/></pattern></defs>${chartView === "funding" ? grid + plots : plots + grid}${ticks}</svg>`;
  $("#chart-range").textContent = `Alex’s age 52–${endAge} →`;
  $("#preview").dataset.chartEndAge = endAge;
  $("#preview").dataset.chartView = chartView;
}

function renderYear() {
  const row = result.rows.find((r) => r.primaryAge === inspectedAge);
  if (!row) return;
  $("#preview-year-facts").innerHTML = `<p><b>${row.year} · Alex ${row.primaryAge}</b> · ${row.annualGap ? "Spending partly uncovered" : "Spending covered this year"}</p><dl>${sources(row).map((s) => `<div><dt>${s.label}</dt><dd>${money(s.amount)}/year</dd></div>`).join("")}<div><dt>Spending target</dt><dd>${money(row.spending + row.majorCost)}/year</dd></div><div><dt>Savings outside pensions left</dt><dd>${money(row.closingAccessible)}</dd></div><div><dt>Pension available to draw</dt><dd>${money(row.closingAvailablePension)}</dd></div><div><dt>Pension still locked</dt><dd>${money(row.closingLockedPension)}</dd></div><div><dt>Earlier and current spending unpaid</dt><dd>${money(row.cumulativeGap)}</dd></div></dl><p>Money left is measured at year-end. Unpaid spending stays separate and is not repaid automatically.</p>`;
}

function setChoice(next) {
  choice = next;
  baseline = evaluateExample("early-dc", { horizonAge });
  result = evaluateExample("early-dc", { ...choice.overrides, horizonAge });
  const facts = exampleInsights(result);
  const access = facts.gapPeriods.filter((p) => p.kind === "access");
  const later = facts.gapPeriods.find((p) => p.kind === "later");
  for (const button of document.querySelectorAll("[data-preview]")) button.setAttribute("aria-pressed", String(button.dataset.preview === choice.id));
  $("#preview-age").textContent = result.summary.retirementAge;
  $("#preview-spend").textContent = money(result.summary.monthlySpending);
  $("#preview-gap").textContent = money(result.summary.bridgeGapTotal);
  const period = access[0];
  $("#preview-gap-years").textContent = period ? `Ages ${period.start.primaryAge}–${period.end.primaryAge} · ${period.start.year}–${period.end.year}` : "No shortfall before age 60";
  $("#preview-later-age").textContent = later ? `Age ${later.start.primaryAge}` : `None through ${horizonAge}`;
  $("#preview-later-gap").textContent = later ? `${money(later.total)} unpaid · ${later.start.year}–${later.end.year}` : "Spending covered under these assumptions";
  const nextCovered = period?.nextCovered;
  const coverageEnd = nextCovered ? result.rows.find(r => r.primaryAge > nextCovered.primaryAge && r.annualGap > 0)?.primaryAge - 1 : null;
  $("#preview-outcome").textContent = (choice.id === "part-time" ? `${result.profile.primary.name} earns ${money(result.profile.partTimeAnnual)}/year from ${result.summary.retirementAge} until ${result.profile.partTimeEndAge}. ` : "") + (nextCovered ? `Spending is covered again from age ${nextCovered.primaryAge} to ${Number.isFinite(coverageEnd) ? coverageEnd : horizonAge}; earlier gaps remain unpaid. ` : "Closing the early gap still leaves later shortfalls. ") + `${money(result.summary.finalTotal)} remains at ${horizonAge}. Shortfall amounts add up unpaid yearly spending; they are not a top-up required today.`;
  const stages = [
    ["Step back", result.summary.retirementAge],
    ["Pension access", result.profile.primary.pensionAccessAge],
    ["Later income", result.profile.incomeStreams.find(s => s.type === "state").startAge], ["Plan ends", horizonAge],
  ];
  $("#preview-milestones").innerHTML = stages.map(([label, age]) => `<div><span>${label}</span><strong>${age}</strong><small>${result.profile.startYear + age - result.profile.primary.age}</small></div>`).join("");
  $("#preview-open").href = `app.html?example=early-dc&choice=${choice.id}&horizon=${horizonAge}${choice.id === "baseline" ? "#overview" : "#scenarios"}`;
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
  button.addEventListener("click", () => setChoice(landingChoices.find((c) => c.id === button.dataset.preview)));
}
for (const button of document.querySelectorAll("[data-view]")) {
  button.addEventListener("click", () => {
    chartView = button.dataset.view;
    for (const b of document.querySelectorAll("[data-view]")) b.setAttribute("aria-pressed", String(b === button));
    drawChart();
  });
}
for (const button of document.querySelectorAll("[data-zoom]")) {
  button.addEventListener("click", () => {
    zoom = button.dataset.zoom;
    for (const b of document.querySelectorAll("[data-zoom]")) b.setAttribute("aria-pressed", String(b === button));
    drawChart();
  });
}
$("#preview-horizon").addEventListener("change", (e) => {
  horizonAge = Number(e.target.value);
  setChoice(choice);
});
$("#preview-year").addEventListener("change", (e) => {
  inspectedAge = Number(e.target.value);
  renderYear();
});
renderInsights();
setChoice(choice);
if (typeof ResizeObserver !== "undefined") new ResizeObserver(drawChart).observe($("#bridge-chart"));
