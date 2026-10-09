import { evaluateExample, FIXTURE_VERSION } from "./fixtures.mjs";
import { landingChoices } from "./landing-choices.mjs";

const $ = (selector) => document.querySelector(selector);
const money = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const baseline = evaluateExample("early-dc");
let choice = landingChoices[0];
let result = baseline;

function drawChart() {
  const element = $("#bridge-chart");
  const width = Math.max(element.clientWidth, 250),
    height = window.matchMedia("(max-width: 650px)").matches ? 185 : 210;
  const margin = { left: 39, right: 13, top: 34, bottom: 25 };
  const plotWidth = width - margin.left - margin.right,
    plotHeight = height - margin.top - margin.bottom;
  const rows = result.rows.filter((row) => row.primaryAge <= 62);
  const baseRows = baseline.rows.filter((row) => row.primaryAge <= 62);
  const maxMoney = 80000;
  const x = (age) => margin.left + ((age - 52) / 10) * plotWidth;
  const y = (amount) => margin.top + plotHeight * (1 - amount / maxMoney);
  const path = (items) =>
    items
      .map(
        (row, index) =>
          (index ? "L" : "M") +
          x(row.primaryAge).toFixed(2) +
          "," +
          y(row.closingAccessible).toFixed(2),
      )
      .join(" ");
  const mainPath = path(rows);
  const areaPath =
    mainPath + " L" + x(62) + "," + y(0) + " L" + x(52) + "," + y(0) + " Z";
  const retirement = result.summary.retirementAge;
  const access = result.profile.primary.pensionAccessAge;
  const gapRow = rows.find((row) => row.bridgeGap > 0);
  const title =
    choice.label + ": Alex’s accessible savings at year-end, ages 52 to 62.";
  const ticks = [0, 40000, 80000];
  const gapDot = gapRow
    ? '<circle cx="' +
      x(gapRow.primaryAge) +
      '" cy="' +
      y(gapRow.closingAccessible) +
      '" r="4.5" fill="#b57842" stroke="#fff" stroke-width="2"/>'
    : "";
  element.innerHTML =
    '<svg viewBox="0 0 ' +
    width +
    " " +
    height +
    '" role="img" aria-labelledby="bridge-title bridge-description"><title id="bridge-title">' +
    esc(title) +
    '</title><desc id="bridge-description">Fictional example. ' +
    esc(money(result.summary.bridgeGapTotal)) +
    " unfunded before assumed pension access at " +
    access +
    '. A zero bridge gap is not a complete affordability result. The shaded period is retirement before pension access.</desc><defs><linearGradient id="savings-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b4d1c2" stop-opacity=".6"/><stop offset="100%" stop-color="#b4d1c2" stop-opacity=".04"/></linearGradient></defs><rect x="' +
    x(retirement) +
    '" y="' +
    (margin.top - 5) +
    '" width="' +
    (x(access) - x(retirement)) +
    '" height="' +
    (plotHeight + 5) +
    '" fill="#f7efdb" rx="3"/>' +
    ticks
      .map(
        (amount) =>
          '<line x1="' +
          margin.left +
          '" y1="' +
          y(amount) +
          '" x2="' +
          (width - margin.right) +
          '" y2="' +
          y(amount) +
          '" stroke="#e7ece5" stroke-width="1"/><text x="' +
          (margin.left - 7) +
          '" y="' +
          (y(amount) + 4) +
          '" text-anchor="end" font-size="11" fill="#707c72">' +
          (amount ? "£" + amount / 1000 + "k" : "£0") +
          "</text>",
      )
      .join("") +
    '<text x="' +
    (x(retirement) + 6) +
    '" y="17" font-size="10" fill="#856b37">Bridge to ' +
    access +
    '</text><line x1="' +
    x(access) +
    '" y1="' +
    (margin.top - 5) +
    '" x2="' +
    x(access) +
    '" y2="' +
    y(0) +
    '" stroke="#c6a768" stroke-dasharray="4 4"/><path d="' +
    areaPath +
    '" fill="url(#savings-fill)"/>' +
    (choice.id !== "baseline"
      ? '<path d="' +
        path(baseRows) +
        '" fill="none" stroke="#9ea99f" stroke-width="2" stroke-dasharray="5 5"/>'
      : "") +
    '<path d="' +
    mainPath +
    '" fill="none" stroke="#267a65" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
    rows
      .map(
        (row) =>
          '<circle cx="' +
          x(row.primaryAge) +
          '" cy="' +
          y(row.closingAccessible) +
          '" r="2" fill="#267a65"><title>Age ' +
          row.primaryAge +
          " · " +
          row.year +
          ": " +
          esc(money(row.closingAccessible)) +
          " accessible at year-end; annual uncovered spending " +
          esc(money(row.annualGap)) +
          ".</title></circle>",
      )
      .join("") +
    gapDot +
    [52, 55, 57, 60, 62]
      .map(
        (age) =>
          '<text x="' +
          x(age) +
          '" y="' +
          (height - 6) +
          '" text-anchor="middle" font-size="11" fill="#637168">' +
          age +
          "</text>",
      )
      .join("") +
    "</svg>";
}

function setChoice(next) {
  choice = next;
  result = evaluateExample("early-dc", choice.overrides);
  for (const button of document.querySelectorAll("[data-preview]"))
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.preview === choice.id),
    );
  $("#preview-age").textContent = result.summary.retirementAge;
  $("#preview-spend").textContent = money(result.summary.monthlySpending);
  $("#preview-years").textContent =
    result.profile.primary.pensionAccessAge - result.summary.retirementAge;
  $("#preview-gap").textContent = money(result.summary.bridgeGapTotal);
  const count = result.summary.bridgeGapYears.length;
  $("#preview-gap-years").textContent = count
    ? count + " unfunded " + (count === 1 ? "year" : "years")
    : "No gap before age 60";
  $(".preview-result").classList.toggle("no-bridge-gap", count === 0);
  const later = result.summary.firstGapAge;
  $("#preview-outcome").textContent = count
    ? "Accessible savings run short at age " +
      result.summary.firstGapAge +
      ", before this example’s pension access."
    : (choice.id === "part-time"
        ? "£24,000/year part-time income from 55 to 59 bridges the gap. "
        : "Working to 58 bridges these years. ") +
      (later !== null
        ? "Later shortfalls still start at " + later + "."
        : "Full-plan assumptions still matter.");
  $("#chart-choice-label").textContent = choice.label;
  $("#baseline-legend").hidden = choice.id === "baseline";
  $("#preview-open").href =
    "app.html?example=early-dc&choice=" +
    choice.id +
    (choice.id === "baseline" ? "#overview" : "#scenarios");
  $("#preview").dataset.choice = choice.id;
  $("#preview").dataset.bridgeGap = result.summary.bridgeGapTotal;
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

for (const button of document.querySelectorAll("[data-preview]"))
  button.addEventListener("click", () =>
    setChoice(
      landingChoices.find((item) => item.id === button.dataset.preview),
    ),
  );
renderInsights();
setChoice(choice);
if (typeof ResizeObserver !== "undefined")
  new ResizeObserver(drawChart).observe($("#bridge-chart"));
