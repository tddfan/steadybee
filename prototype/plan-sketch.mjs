import { projectPlan, validatePlan } from "./personal-engine.mjs";

const groups = [
  {
    title: "Your dates",
    hint: "We use your birthday to place pension access and retirement on the same calendar.",
    fields: [
      { key: "birthDate", label: "Date of birth", type: "date", hint: "Your age is calculated from this date.", required: true },
      { key: "retirementAge", label: "Age you plan to stop work", type: "integer", min: 18, max: 100, hint: "Try a different age after you inspect the baseline.", required: true },
      { key: "endAge", label: "Plan through age", type: "integer", min: 50, max: 110, hint: "This includes the full year at that age; it is not a lifespan prediction.", required: true },
    ],
  },
  {
    title: "Annual money",
    hint: "These amounts are your estimates of money available to spend, in today’s pounds.",
    fields: [
      { key: "spendingToday", label: "Annual spending you want covered", type: "money", hint: "Your annual target in today’s buying power.", required: true },
      { key: "annualNetEarnings", label: "Annual take-home pay while working", type: "money", hint: "Spendable pay after tax and regular DC contributions. Any surplus after spending goes to cash.", required: true },
      { key: "annualDcContribution", label: "Annual DC pension contributions while working", type: "money", hint: "Your and your employer’s contributions combined; exclude these from take-home pay above.", required: true },
      { key: "statePensionAge", label: "Age your State Pension starts", type: "integer", min: 0, max: 100, hint: "Use your own forecast. If you include a payment, enter an age from 60 to 100. If excluding it, enter age zero and amount zero.", required: true },
      { key: "annualStatePensionNet", label: "Annual State Pension available to spend", type: "money", hint: "Your after-tax estimate, or zero if excluding it. It keeps its purchasing power in this model; entitlement is not checked.", required: true },
    ],
  },
  {
    title: "What you have now",
    hint: "Enter current balances. The model separates savings you can access from a DC pension you cannot yet draw.",
    fields: [
      { key: "cash", label: "Cash savings", type: "money", hint: "Money you can use for the early bridge.", required: true },
      { key: "isa", label: "Invested ISA balance", type: "money", hint: "This whole pot is modelled at the invested return, and can be withdrawn at any time. Put uninvested money in cash.", required: true },
      { key: "dc", label: "DC pension balance", type: "money", hint: "Use zero if this plan has no defined contribution pension.", required: true },
      { key: "pensionAccessDate", label: "First date you can access this DC pension", type: "date", hint: "Needed if you have DC money. Enter the date your provider confirms. General minimum access rises from 55 to 57 on 6 April 2028; protected ages and scheme rules can differ.", required: true },
    ],
  },
  {
    title: "Withdrawal and tax assumptions",
    hint: "These choices determine the order money is used. The tax rate is a simplified user assumption.",
    fields: [
      { key: "withdrawalPolicy", label: "Use accessible accounts in this order", type: "choice", hint: "After spendable income, use cash or ISA first; DC is used only after its access date.", options: [["cash-first", "Cash first, then ISA"], ["isa-first", "ISA first, then cash"]], required: true },
      { key: "dcWithdrawalTaxRate", label: "Effective tax rate on DC withdrawals", type: "percent", hint: "Needed if you have DC money. A flat rate you choose; UK tax bands, allowances and tax-free cash are not calculated.", required: true },
    ],
  },
  {
    title: "Illustration assumptions",
    hint: "These are starting assumptions for exploring the mechanics. Change them if you want to test another set.",
    fields: [
      { key: "inflationRate", label: "Annual inflation", type: "percent", hint: "Spending rises in future pounds to keep its buying power. The chart converts balances back to today’s pounds.", defaultValue: 2.5 },
      { key: "investedReturnRate", label: "Annual ISA and DC return", type: "percent", hint: "A constant nominal return in the baseline; actual returns vary.", defaultValue: 5 },
      { key: "cashReturnRate", label: "Annual cash return", type: "percent", hint: "A constant nominal cash return in the baseline.", defaultValue: 2 },
      { key: "shockRate", label: "One-year invested-market shock", type: "percent", hint: "Applied to ISA and DC in the early and later stress tests.", defaultValue: -20 },
    ],
  },
];

const fields = groups.flatMap((group) => group.fields);
const fieldByKey = new Map(fields.map((field) => [field.key, field]));
const values = Object.fromEntries(fields.map((field) => [field.key, field.defaultValue ?? undefined]));
const statuses = Object.fromEntries(fields.filter((field) => field.required && field.type !== "choice").map((field) => [field.key, "unknown"]));
const poundsFormat = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const stages = ["enter", "review", "explore"];
let activeStage = "enter";
let baseline = null;
let earlyShock = null;
let lateShock = null;
let shockRequested = false;
let alternative = null;
let alternativeAge = null;
let selectedYearIndex = 0;

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const pounds = (value) => Number.isFinite(value) ? poundsFormat.format(value) : "—";
const percent = (value) => Number.isFinite(value) ? `${Number((value * 100).toFixed(1))}%` : "—";

function todayInLondon() {
  const pieces = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${pieces.year}-${pieces.month}-${pieces.day}`;
}

function fieldValueForInput(field, value = values[field.key]) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function statusChoices(field, selected) {
  const choices = [["unknown", "Unknown"], ["known", "Known"], ["estimated", "Estimated"]];
  if (field.type === "money" || field.type === "percent" || field.key === "statePensionAge") choices.push(["zero", "Zero"]);
  return choices.map(([value, label]) => `<option value="${value}"${selected === value ? " selected" : ""}>${label}</option>`).join("");
}

function fieldControl(field, prefix = "field") {
  const id = `${prefix}-${field.key}`;
  const current = fieldValueForInput(field);
  if (field.type === "choice") {
    return `<select id="${id}" data-field="${field.key}" aria-describedby="${id}-hint"><option value="">Choose an order</option>${field.options.map(([value, label]) => `<option value="${value}"${current === value ? " selected" : ""}>${label}</option>`).join("")}</select>`;
  }
  const type = field.type === "date" ? "date" : "number";
  const bounds = field.type === "integer" ? ` min="${field.min ?? 18}" max="${field.max ?? 110}" step="1" inputmode="numeric"` : field.type === "percent" ? ' min="-100" max="100" step="0.1" inputmode="decimal"' : field.type === "money" ? ' min="0" step="1" inputmode="decimal"' : "";
  const input = `<input id="${id}" data-field="${field.key}" type="${type}"${bounds} value="${escapeHtml(current)}" aria-describedby="${id}-hint">`;
  if (field.type === "money" || field.type === "percent") return `<span class="unit-input${field.type === "percent" ? " percent" : ""}">${input}<span class="unit-marker" aria-hidden="true">${field.type === "money" ? "£" : "%"}</span></span>`;
  return input;
}

function renderEntryFields() {
  byId("entry-groups").innerHTML = groups.map((group) => `<section class="field-group"><div class="field-group-head"><h3>${group.title}</h3><p>${group.hint}</p></div><div class="field-grid">${group.fields.map((field) => `<div class="field"><label for="field-${field.key}">${field.label}</label><span id="field-${field.key}-hint" class="field-hint">${field.hint}</span><div class="field-controls">${fieldControl(field)}${field.required && field.type !== "choice" ? `<select id="status-${field.key}" data-status="${field.key}" aria-label="Certainty of ${field.label}">${statusChoices(field, statuses[field.key])}</select>` : ""}</div>${field.defaultValue !== undefined ? '<span class="field-status">Editable model assumption</span>' : ""}</div>`).join("")}</div></section>`).join("");
}

function parseFieldValue(field, raw) {
  if (raw === "") return undefined;
  if (field.type === "date" || field.type === "choice") return raw;
  const number = Number(raw);
  if (!Number.isFinite(number)) return undefined;
  return number;
}

function updateValue(key, raw, status = undefined) {
  const field = fieldByKey.get(key);
  if (!field) return;
  let value = parseFieldValue(field, raw);
  if (status === "zero") value = 0;
  if (status === "unknown") value = undefined;
  values[key] = value;
  if (["pensionAccessDate", "birthDate", "dc", "annualDcContribution"].includes(key)) {
    byId("pension-provider-confirmed").checked = false;
    byId("protected-pension-age-confirmed").checked = false;
  }
  if (key === "dcWithdrawalTaxRate" || key === "dc" || key === "annualDcContribution") byId("tax-assumption-confirmed").checked = false;
  if (field.required && field.type !== "choice") {
    if (status) statuses[key] = status;
    else if (value === undefined) statuses[key] = "unknown";
    else if (value === 0 && (field.type === "money" || field.type === "percent" || key === "statePensionAge")) statuses[key] = "zero";
    else if (statuses[key] === "unknown" || statuses[key] === "zero") statuses[key] = "estimated";
  }
  invalidateResults();
}

function invalidateResults() {
  baseline = null;
  earlyShock = null;
  lateShock = null;
  shockRequested = false;
  alternative = null;
  alternativeAge = null;
  byId("receipt-confirmed").checked = false;
  byId("calculate-button").disabled = true;
  const exploreButton = document.querySelector('[data-stage-button="explore"]');
  exploreButton.disabled = true;
}

function syncEntryField(key) {
  const field = fieldByKey.get(key);
  const input = byId(`field-${key}`);
  if (!input) return;
  input.value = fieldValueForInput(field);
  const statusSelect = byId(`status-${key}`);
  if (statusSelect) statusSelect.value = statuses[key];
}

function buildInput() {
  const input = { asOfDate: todayInLondon(), pensionAccessConfirmed: byId("pension-provider-confirmed").checked, protectedPensionAgeConfirmed: byId("protected-pension-age-confirmed").checked, dcTaxAssumptionConfirmed: byId("tax-assumption-confirmed").checked };
  for (const field of fields) {
    const value = values[field.key];
    if (value !== undefined) input[field.key] = field.type === "percent" ? value / 100 : value;
  }
  return input;
}

function displayValue(field) {
  const value = values[field.key];
  if (value === undefined) return "Unknown";
  if (field.type === "money") return pounds(value);
  if (field.type === "percent") return `${value}%`;
  if (field.type === "date") return dateFormat.format(new Date(`${value}T00:00:00Z`));
  if (field.type === "choice") return field.options.find(([option]) => option === value)?.[1] ?? "Unknown";
  return field.key === "statePensionAge" && value === 0 ? "Excluded (age 0)" : `Age ${value}`;
}

function statusText(field) {
  if (!fieldNeeded(field) && ["pensionAccessDate", "dcWithdrawalTaxRate"].includes(field.key)) return "Not needed while no DC pension is entered";
  if (field.defaultValue !== undefined) return "Model assumption · editable";
  if (field.type === "choice") return "Selected by you";
  const status = statuses[field.key];
  return status === "zero" ? "Explicit zero · entered by you" : status === "known" ? "Known · entered by you" : status === "estimated" ? "Estimated · entered by you" : "Still unknown";
}

function receiptEditor(field) {
  const control = fieldControl(field, "receipt");
  return `<div class="receipt-edit" hidden><label>Value${control}</label>${field.required && field.type !== "choice" ? `<label>How certain is it?<select id="receipt-status-${field.key}">${statusChoices(field, statuses[field.key])}</select></label>` : ""}<button type="button" class="button secondary" data-save="${field.key}">Update receipt</button></div>`;
}

function renderReceipt() {
  byId("receipt-list").innerHTML = groups.map((group) => `<section class="receipt-group"><h3>${group.title}</h3>${group.fields.map((field) => `<div class="receipt-row" data-receipt-row="${field.key}"><div class="receipt-label">${field.label}<span class="receipt-sub">${statusText(field)}</span></div><div class="receipt-value${values[field.key] === undefined ? " unknown" : ""}">${escapeHtml(!fieldNeeded(field) && ["pensionAccessDate", "dcWithdrawalTaxRate"].includes(field.key) ? "Not applicable" : displayValue(field))}</div><div class="receipt-actions"><button type="button" class="text-button" data-edit="${field.key}" aria-expanded="false">Edit</button></div>${receiptEditor(field)}</div>`).join("")}</section>`).join("");
  updateReviewState();
}

function hasDc() { return Number(values.dc) > 0 || Number(values.annualDcContribution) > 0; }

function protectedAgeNeeded() {
  if (!hasDc() || !/^\d{4}-\d{2}-\d{2}$/.test(values.birthDate ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(values.pensionAccessDate ?? "")) return false;
  if (values.pensionAccessDate < "2028-04-06") return false;
  let age = Number(values.pensionAccessDate.slice(0, 4)) - Number(values.birthDate.slice(0, 4));
  if (values.pensionAccessDate < birthdayForAge(age)) age -= 1;
  return age === 55 || age === 56;
}

function fieldNeeded(field) {
  return field.required && (!(["pensionAccessDate", "dcWithdrawalTaxRate"].includes(field.key)) || hasDc());
}

function reviewIssues() {
  const missing = fields.filter((field) => fieldNeeded(field) && (values[field.key] === undefined || (field.type !== "choice" && statuses[field.key] === "unknown"))).map((field) => ({ field: field.key, message: `${field.label} is unknown.` }));
  const input = buildInput();
  let result;
  try { result = validatePlan(input); }
  catch (error) { result = { valid: false, errors: [{ field: "plan", message: error.message }] }; }
  const byField = new Map(missing.map((issue) => [issue.field, issue]));
  for (const issue of result.errors ?? []) if (!byField.has(issue.field)) byField.set(issue.field, issue);
  return [...byField.values()];
}

function updateReviewState() {
  byId("pension-provider-confirmed").closest("label").hidden = !hasDc();
  byId("protected-pension-age-confirmed").closest("label").hidden = !protectedAgeNeeded();
  byId("tax-assumption-confirmed").closest("label").hidden = !hasDc();
  const issues = reviewIssues();
  const summary = byId("receipt-summary");
  summary.classList.toggle("has-errors", issues.length > 0);
  if (issues.length) {
    summary.textContent = `${issues.length} item${issues.length === 1 ? "" : "s"} need attention before this can be calculated: ${issues.slice(0, 5).map((issue) => issue.message).join(" ")}${issues.length > 5 ? " See each unknown row below." : ""}`;
  } else summary.textContent = "The required figures are present. Check each row, then confirm below to see the illustration.";
  const checked = byId("receipt-confirmed").checked && (!hasDc() || (byId("pension-provider-confirmed").checked && byId("tax-assumption-confirmed").checked && (!protectedAgeNeeded() || byId("protected-pension-age-confirmed").checked)));
  byId("calculate-button").disabled = issues.length > 0 || !checked;
  byId("review-errors").textContent = issues.length === 0 && !checked ? "Please confirm the applicable statements above." : "";
}

function showStage(stage) {
  activeStage = stage;
  for (const name of stages) {
    byId(`${name}-stage`).hidden = name !== stage;
    const button = document.querySelector(`[data-stage-button="${name}"]`);
    button.classList.toggle("is-active", name === stage);
    if (name === stage) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  }
  if (stage === "review") renderReceipt();
  byId(`${stage}-stage`).scrollIntoView({ block: "start" });
  byId(stage === "enter" ? "enter-heading" : stage === "review" ? "review-heading" : "explore-heading").setAttribute("tabindex", "-1");
  byId(stage === "enter" ? "enter-heading" : stage === "review" ? "review-heading" : "explore-heading").focus({ preventScroll: true });
}

function setText(id, value) { byId(id).textContent = value; }

function birthdayForAge(age) {
  const [year, month, day] = String(values.birthDate).split("-").map(Number);
  const targetYear = year + age;
  const adjustedDay = Math.min(day, new Date(Date.UTC(targetYear, month, 0)).getUTCDate());
  return `${targetYear}-${String(month).padStart(2, "0")}-${String(adjustedDay).padStart(2, "0")}`;
}

function isPartialFirstYear(row) { return row === baseline.years[0] && row.startDate !== birthdayForAge(row.age); }

function addDefinition(list, term, detail) {
  const row = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = term;
  dd.textContent = detail;
  row.append(dt, dd);
  list.append(row);
}

function resultGapPhrase(result) {
  return result.firstGapAge === null || result.firstGapAge === undefined ? `No uncovered year through age ${values.endAge} in this illustration` : `First uncovered spending at age ${result.firstGapAge}`;
}

function renderHeadline() {
  const firstGap = baseline.firstGapAge;
  const bridgeGap = baseline.firstBridgeGapAge;
  const laterGap = baseline.firstLaterGapAge;
  setText("coverage-headline", resultGapPhrase(baseline));
  if (firstGap === null || firstGap === undefined) setText("coverage-detail", `This is a conditional result to age ${values.endAge}, based on your entries and the stated return, inflation and tax assumptions. It does not predict what will happen.`);
  else setText("coverage-detail", `At age ${firstGap}, the model cannot cover all of your entered annual spending from spendable income and money it treats as accessible. Inspect that year below.`);
  const gapText = !hasDc() ? "No DC pension was entered, so a pension-access bridge does not apply." : bridgeGap !== null && bridgeGap !== undefined ? `The bridge before your entered DC access date has uncovered spending starting at age ${bridgeGap}.` : "The model shows no uncovered spending before your entered DC access date.";
  setText("bridge-callout", `${gapText}${hasDc() ? " Your pension provider’s access date is an input to this illustration, not eligibility checked by Steadybee." : ""}${laterGap !== null && laterGap !== undefined ? ` A later uncovered year starts at age ${laterGap}.` : ""}`);
  const alert = byId("result-alert");
  alert.classList.toggle("has-gap", firstGap !== null && firstGap !== undefined);
  alert.textContent = firstGap === null || firstGap === undefined ? "All years shown have spending covered in this conditional illustration. Actual returns, tax and pension rules may differ." : "At least one year has uncovered spending in this conditional illustration. Use the timeline to see when and why.";
}

function renderAssumptions() {
  const list = byId("assumption-list");
  list.replaceChildren();
  addDefinition(list, "Illustration starts", buildInput().asOfDate);
  addDefinition(list, "Annual inflation", percent(buildInput().inflationRate));
  addDefinition(list, "ISA and DC return", percent(buildInput().investedReturnRate));
  addDefinition(list, "Cash return", percent(buildInput().cashReturnRate));
  addDefinition(list, "Market shock", percent(buildInput().shockRate));
  addDefinition(list, "DC first-access date you entered", hasDc() ? displayValue(fieldByKey.get("pensionAccessDate")) : "Not applicable");
  addDefinition(list, "Withdrawal order", displayValue(fieldByKey.get("withdrawalPolicy")));
  addDefinition(list, "DC effective tax rate you assumed", hasDc() ? percent(buildInput().dcWithdrawalTaxRate) : "Not applicable");
  if (isPartialFirstYear(baseline.years[0])) addDefinition(list, "First age row", `Partial year, ${baseline.years[0].startDate} to ${baseline.years[0].endDate}`);
  const currentAge = baseline.years[0]?.age;
  const later = baseline.years.find((row) => row.age === currentAge + 20) ?? baseline.years.at(-1);
  if (later) addDefinition(list, `Spending at age ${later.age}: today → future pounds`, `${pounds(later.spendingToday)} → ${pounds(later.spendingNominal)}`);
}

function statusLabel(row) {
  if (row.accessStatus === "not-applicable") return "No DC pension";
  if (row.accessStatus === "mixed") return "🔓 Opens during year";
  if (row.accessStatus === "locked") return "🔒 Locked";
  return "Accessible";
}

function renderChart() {
  const chart = byId("year-chart");
  chart.replaceChildren();
  const maxBalance = Math.max(1, ...baseline.years.map((row) => row.closingToday.cash + row.closingToday.isa + row.closingToday.dc));
  baseline.years.forEach((row, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "year-column";
    button.dataset.yearIndex = String(index);
    button.setAttribute("aria-pressed", index === selectedYearIndex ? "true" : "false");
    button.setAttribute("aria-label", `Age ${row.age}${isPartialFirstYear(row) ? ", partial year" : ""}: cash ${pounds(row.closingToday.cash)}, invested ISA ${pounds(row.closingToday.isa)}, DC pension ${pounds(row.closingToday.dc)} ${statusLabel(row)}, uncovered spending ${pounds(row.uncoveredToday)}. Amounts in today's pounds.`);
    const stack = document.createElement("span");
    stack.className = "chart-stack";
    const segments = [
      ["dc", row.closingToday.dc],
      ["isa", row.closingToday.isa],
      ["cash", row.closingToday.cash],
    ];
    for (const [kind, amount] of segments) {
      const segment = document.createElement("span");
      segment.className = `chart-segment ${kind === "dc" && row.accessStatus === "locked" ? "locked" : kind === "dc" && row.accessStatus === "mixed" ? "mixed" : kind}`;
      segment.style.height = `${Math.max(0, amount / maxBalance * 210)}px`;
      stack.append(segment);
    }
    const gap = document.createElement("span");
    gap.className = `chart-gap${row.uncoveredToday > 0.005 ? " has-gap" : ""}`;
    const age = document.createElement("span");
    age.className = "chart-age";
    age.textContent = index === selectedYearIndex || index === 0 || row.age % 5 === 0 || index === baseline.years.length - 1 ? `${row.age}${isPartialFirstYear(row) ? "*" : ""}` : "";
    button.append(stack, gap, age);
    button.addEventListener("click", () => selectYear(index));
    chart.append(button);
  });
}

function renderTable() {
  const body = byId("year-table");
  body.replaceChildren();
  baseline.years.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.classList.toggle("is-selected", index === selectedYearIndex);
    const cells = [`${row.age}${isPartialFirstYear(row) ? " (partial)" : ""}`, pounds(row.spendingToday), pounds(row.closingToday.cash + row.closingToday.isa), pounds(row.closingToday.dc), statusLabel(row), pounds(row.uncoveredToday)];
    for (const content of cells) { const td = document.createElement("td"); td.textContent = content; tr.append(td); }
    const action = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-button";
    button.textContent = "Inspect";
    button.setAttribute("aria-label", `Inspect age ${row.age}`);
    button.addEventListener("click", () => { selectYear(index); byId("year-inspector").scrollIntoView({ block: "start" }); byId("year-inspector").focus({ preventScroll: true }); });
    action.append(button); tr.append(action); body.append(tr);
  });
}

function selectYear(index) {
  selectedYearIndex = index;
  renderInspector();
  for (const button of byId("year-chart").querySelectorAll(".year-column")) button.setAttribute("aria-pressed", Number(button.dataset.yearIndex) === index ? "true" : "false");
  for (const [rowIndex, tr] of [...byId("year-table").rows].entries()) tr.classList.toggle("is-selected", rowIndex === index);
}

function renderInspector() {
  const row = baseline.years[selectedYearIndex];
  if (!row) return;
  setText("inspector-heading", `Age ${row.age}: where the money goes`);
  setText("selected-year-badge", statusLabel(row));
  setText("year-summary", `${isPartialFirstYear(row) ? "This first age row runs from today to your next birthday, so it is a partial year. " : ""}${row.uncoveredNominal > 0.005 ? `${pounds(row.uncoveredToday)} of spending in today’s pounds is uncovered in this year. The future-pound gap is ${pounds(row.uncoveredNominal)}.` : "The entered spending is covered in this year under the model assumptions."}`);
  const workings = byId("year-workings");
  workings.replaceChildren();
  addDefinition(workings, "Year", `${row.startDate} to ${row.endDate}`);
  addDefinition(workings, "Price factor at year end, since today", `${Number(row.inflationFactor.toFixed(3))}×`);
  if (row.spendingInflationFactor !== null) addDefinition(workings, "Average spending inflation factor this year", `${Number(row.spendingInflationFactor.toFixed(3))}×`);
  addDefinition(workings, "Spending, today’s pounds", pounds(row.spendingToday));
  addDefinition(workings, "Spending needed, future pounds", pounds(row.spendingNominal));
  addDefinition(workings, "Take-home pay, future pounds", pounds(row.netEarningsNominal));
  addDefinition(workings, "State Pension available to spend, future pounds", pounds(row.statePensionNetNominal));
  addDefinition(workings, "DC contributions, future pounds", pounds(row.dcContributionsNominal));
  addDefinition(workings, "Opening cash · ISA · DC, future pounds", `${pounds(row.opening.cash)} · ${pounds(row.opening.isa)} · ${pounds(row.opening.dc)}`);
  addDefinition(workings, "Investment change: cash · ISA · DC", `${pounds(row.returns.cash)} · ${pounds(row.returns.isa)} · ${pounds(row.returns.dc)}`);
  addDefinition(workings, "Cash withdrawal", pounds(row.withdrawals.cash));
  addDefinition(workings, "ISA withdrawal", pounds(row.withdrawals.isa));
  addDefinition(workings, "DC withdrawal before assumed tax", pounds(row.withdrawals.dcGross));
  addDefinition(workings, "Assumed tax on DC withdrawal", pounds(row.withdrawals.dcTax));
  addDefinition(workings, "DC withdrawal available to spend", pounds(row.withdrawals.dcNet));
  addDefinition(workings, "Uncovered spending, future pounds", pounds(row.uncoveredNominal));
  if (row.accessStatus === "mixed") {
    addDefinition(workings, "Uncovered before DC access, today’s pounds", pounds(row.uncoveredBeforeAccessToday));
    addDefinition(workings, "Uncovered after DC access, today’s pounds", pounds(row.uncoveredAfterAccessToday));
  }
  addDefinition(workings, "Closing cash · ISA · DC, today’s pounds", `${pounds(row.closingToday.cash)} · ${pounds(row.closingToday.isa)} · ${pounds(row.closingToday.dc)}`);
  setText("year-explanation", row.accessStatus === "not-applicable" ? "No DC pension was entered. Spending uses the spendable income, cash and invested ISA you supplied." : row.accessStatus === "locked" ? `The DC pension is locked throughout this year in the model, until your entered date of ${displayValue(fieldByKey.get("pensionAccessDate"))}. Spending can only use net income, cash and ISA. Provider eligibility is not verified here.` : row.accessStatus === "mixed" ? `The DC pension first becomes accessible on ${displayValue(fieldByKey.get("pensionAccessDate"))}, during this year. The model splits cash flows at that date. The displayed ending DC balance is accessible by year end; any earlier gap remains visible above.` : "The DC pension can be drawn this year under the first-access date you supplied. The effective withdrawal tax rate is your flat assumption; actual UK tax may differ.");
}

function comparisonCard(title, result, note, active = false) {
  const card = document.createElement("article");
  card.className = `comparison${active ? " active" : ""}`;
  const heading = document.createElement("h4"); heading.textContent = title;
  const strong = document.createElement("strong"); strong.textContent = result ? resultGapPhrase(result) : "Not available";
  const detail = document.createElement("p"); detail.textContent = note;
  card.append(heading, strong, detail);
  if (result) {
    const metrics = document.createElement("p");
    metrics.className = "comparison-metrics";
    metrics.textContent = `Across shown years: ${pounds(result.totals.uncoveredToday)} uncovered in today’s pounds. Closing cash and invested ISA: ${pounds(result.totals.finalBalancesToday.cash + result.totals.finalBalancesToday.isa)} in today’s pounds.`;
    card.append(metrics);
  }
  return card;
}

function renderComparisons() {
  const grid = byId("comparison-grid");
  grid.replaceChildren();
  grid.append(comparisonCard(`Original date: age ${values.retirementAge}`, baseline, "Constant annual returns at the rates you entered.", true));
  grid.append(comparisonCard(alternativeAge === null ? "Your alternative date" : `Retire at age ${alternativeAge}`, alternative, alternative ? "Same figures and assumptions, with the retirement age you chose." : "Enter another age above to compare this decision."));
  byId("shock-action").hidden = shockRequested;
  byId("shock-method-note").hidden = !shockRequested;
  if (!shockRequested) {
    setText("shock-method", "");
    return;
  }
  const shock = percent(buildInput().shockRate);
  const earlyAvailable = Boolean(earlyShock?.assumptions.shockAvailable);
  const lateAvailable = Boolean(lateShock?.assumptions.shockAvailable);
  grid.append(comparisonCard(`Early market shock: ${shock}`, earlyAvailable ? earlyShock : null, earlyAvailable ? `A one-year invested return shock begins ${earlyShock.assumptions.shockStartDate}, with the first ISA or DC withdrawal in the original plan.` : "No suitable invested withdrawal year for this shock in the original plan."));
  grid.append(comparisonCard(`Later market shock: ${shock}`, lateAvailable ? lateShock : null, lateAvailable ? `The same one-year shock begins ${lateShock.assumptions.shockStartDate}, five years after the early shock.` : "The later shock needs a suitable later year in the planning window."));
  const assumptions = earlyShock?.assumptions ?? baseline.assumptions ?? {};
  const anchor = assumptions.firstInvestedDrawdownDate ? `The first invested withdrawal begins on ${assumptions.firstInvestedDrawdownDate}.` : "An invested withdrawal was not found in this plan.";
  setText("shock-method", `${anchor} The early stress test replaces the ${percent(buildInput().investedReturnRate)} annual invested ISA/DC return with ${shock} over one year starting at the first invested withdrawal interval. This is an annual return shock, not an instant one-day fall. The later test puts the same one-year return shock five years later. Both hold your entries and other assumptions fixed. These are selected scenarios, not probabilities or predictions.`);
}

function renderResult() {
  selectedYearIndex = Math.max(0, Math.min(selectedYearIndex, baseline.years.length - 1));
  renderHeadline(); renderAssumptions(); renderChart(); renderTable(); renderInspector(); renderComparisons();
}

function createBrief() {
  const lines = ["Steadybee Plan Sketch", "Illustration, not advice.", `Created ${todayInLondon()}. This file includes financial figures.`, "", "Your receipt"];
  for (const group of groups) { lines.push(`\n${group.title}`); for (const field of group.fields) lines.push(`${field.label}: ${displayValue(field)} (${statusText(field)})`); }
  lines.push("", "Model limits: conditional illustration using user-entered effective DC withdrawal tax, after-tax income estimates, and user-entered provider-confirmed access date. Steadybee does not calculate UK tax rules or verify pension eligibility. Annual calculations begin on the as-of date. Market returns vary; the baseline uses constant rates.", "", "Result", resultGapPhrase(baseline), "", "Annual rows in today's pounds unless marked future pounds", "Age | Spending today | Spending future | Cash today | ISA today | DC today | DC access | Uncovered today | Uncovered future");
  for (const row of baseline.years) lines.push(`${row.age} | ${pounds(row.spendingToday)} | ${pounds(row.spendingNominal)} | ${pounds(row.closingToday.cash)} | ${pounds(row.closingToday.isa)} | ${pounds(row.closingToday.dc)} | ${row.accessStatus} | ${pounds(row.uncoveredToday)} | ${pounds(row.uncoveredNominal)}`);
  lines.push("", "Scenario comparison", ...[...byId("comparison-grid").children].map((card) => `${card.querySelector("h4")?.textContent}: ${card.querySelector("strong")?.textContent}`));
  return lines.join("\n") + "\n";
}

function downloadBrief() {
  const url = URL.createObjectURL(new Blob([createBrief()], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `steadybee-plan-sketch-${todayInLondon()}.txt`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function clearPlan() {
  for (const field of fields) { values[field.key] = field.defaultValue ?? undefined; if (field.required && field.type !== "choice") statuses[field.key] = "unknown"; }
  for (const id of ["pension-provider-confirmed", "protected-pension-age-confirmed", "tax-assumption-confirmed", "receipt-confirmed"]) byId(id).checked = false;
  invalidateResults();
  renderEntryFields();
  for (const id of ["receipt-list", "assumption-list", "year-chart", "year-workings", "year-table", "comparison-grid"]) byId(id).replaceChildren();
  for (const id of ["receipt-summary", "review-errors", "result-alert", "coverage-headline", "coverage-detail", "bridge-callout", "selected-year-badge", "year-summary", "year-explanation", "alternative-error", "shock-method"]) byId(id).textContent = "";
  byId("receipt-summary").classList.remove("has-errors");
  byId("result-alert").classList.remove("has-gap");
  byId("inspector-heading").textContent = "Selected year";
  byId("entry-errors").textContent = "Your figures have been cleared from this tab.";
  byId("alternative-age").value = "";
  byId("shock-action").hidden = false;
  byId("shock-method-note").hidden = true;
  byId("shock-method-note").open = false;
  byId("shock-error").textContent = "";
  showStage("enter");
}

renderEntryFields();
byId("entry-groups").addEventListener("input", (event) => {
  const key = event.target.dataset.field;
  if (!key) return;
  updateValue(key, event.target.value);
  const statusSelect = byId(`status-${key}`);
  if (statusSelect) statusSelect.value = statuses[key];
  byId("entry-errors").textContent = "";
});
byId("entry-groups").addEventListener("change", (event) => {
  const key = event.target.dataset.status;
  if (!key) return;
  const input = byId(`field-${key}`);
  updateValue(key, input.value, event.target.value);
  syncEntryField(key);
});
byId("plan-form").addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelector('[data-stage-button="review"]').disabled = false;
  showStage("review");
});
byId("receipt-list").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit]");
  if (edit) { const editor = edit.closest(".receipt-row").querySelector(".receipt-edit"); editor.hidden = !editor.hidden; edit.setAttribute("aria-expanded", String(!editor.hidden)); if (!editor.hidden) editor.querySelector("input, select")?.focus(); return; }
  const save = event.target.closest("[data-save]");
  if (!save) return;
  const key = save.dataset.save;
  const control = byId(`receipt-${key}`);
  const status = byId(`receipt-status-${key}`)?.value;
  updateValue(key, control.value, status);
  syncEntryField(key);
  renderReceipt();
  byId("receipt-summary").focus?.();
});
for (const id of ["pension-provider-confirmed", "protected-pension-age-confirmed", "tax-assumption-confirmed", "receipt-confirmed"]) byId(id).addEventListener("change", updateReviewState);
byId("back-to-entry").addEventListener("click", () => showStage("enter"));
byId("edit-figures").addEventListener("click", () => showStage("review"));
byId("calculate-button").addEventListener("click", () => {
  if (reviewIssues().length || byId("calculate-button").disabled) return;
  try {
    const input = buildInput();
    baseline = projectPlan(input);
    earlyShock = null;
    lateShock = null;
    shockRequested = false;
    alternative = null;
    alternativeAge = null;
    selectedYearIndex = 0;
    renderResult();
    document.querySelector('[data-stage-button="explore"]').disabled = false;
    byId("review-errors").textContent = "";
    showStage("explore");
  } catch (error) { byId("review-errors").textContent = `This illustration could not be calculated: ${error.message}`; }
});
byId("alternative-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!baseline) return;
  const age = Number(byId("alternative-age").value);
  if (!Number.isInteger(age) || age < 18 || age > 100 || age === values.retirementAge) { setText("alternative-error", "Enter a different whole-number retirement age in the planning window."); return; }
  try {
    alternative = projectPlan({ ...buildInput(), retirementAge: age });
    alternativeAge = age;
    setText("alternative-error", "");
    renderComparisons();
  } catch (error) { setText("alternative-error", error.message); }
});
byId("compare-shocks-button").addEventListener("click", () => {
  if (!baseline || shockRequested) return;
  try {
    const input = buildInput();
    earlyShock = projectPlan(input, { shockTiming: "early" });
    lateShock = projectPlan(input, { shockTiming: "late" });
    shockRequested = true;
    setText("shock-error", "");
    renderComparisons();
  } catch (error) { setText("shock-error", `The market-shock comparison could not be calculated: ${error.message}`); }
});
byId("export-button").addEventListener("click", downloadBrief);
byId("clear-button").addEventListener("click", clearPlan);
document.querySelectorAll("[data-stage-button]").forEach((button) => button.addEventListener("click", () => { if (!button.disabled && (button.dataset.stageButton !== "explore" || baseline)) showStage(button.dataset.stageButton); }));
