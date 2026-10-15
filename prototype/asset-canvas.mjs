import {
  ASSET_TYPES,
  ACCESS_BUCKETS,
  DEBT_TYPES,
  accessBucket,
  createBlankDraft,
  createAlexExample,
  createId,
  summarizeDraft,
  validateDraft,
} from "./asset-ledger.mjs";
import { INCOME_FIELDS, SPENDING_FIELDS, createBlankMonthlyFlow, createExampleMonthlyFlow, summarizeMonthlyFlow, buildMonthlyFlowDiagram, monthlyFlowEvents, computeAllocationWaterfall, ISA_ALLOWANCE_2026_27, DEFAULT_RESERVE_MONTHS } from "./monthly-flow.mjs";
import { estimateRepaymentMortgagePayment } from "./mortgage-payment.mjs";

const $ = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat("en-GB", {
  style: "currency", currency: "GBP", maximumFractionDigits: value % 1 === 0 ? 0 : 2,
}).format(value);
const plain = (value) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
const make = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
};

let draft = createAlexExample();
let flowDraft = createExampleMonthlyFlow();
let mode = "example";
let dialogType = null;
let editingId = null;
let lastTrigger = null;
let addOwner = "primary";
let addTrigger = null;
let returnToFlowAssetId = null;
let editingFlowEntryId = null;
let flowEntryTrigger = null;
let flowDatedRequireStart = false;
let flowChartPath = [];
let chartView = "owner";
let chartSelection = null;
const openOwners = new Set();
const openCategories = new Set();

function announce(message) { $("live-message").textContent = message; }
function itemName(item, types) { return item.label?.trim() || types[item.kind].label; }
function countLabel(count, noun) { return count ? `${count} ${noun}${count === 1 ? "" : "s"} entered` : "Nothing entered yet"; }

function setTotals() {
  const summary = summarizeDraft(draft);
  $("asset-total").textContent = money(summary.assetTotal);
  $("debt-total").textContent = money(summary.debtTotal);
  $("accessible-total").textContent = money(summary.accessTotals.accessible);
  const netWorthText = money(summary.netWorth);
  $("net-worth").textContent = netWorthText;
  $("net-worth").style.fontSize = netWorthText.length > 15 ? "1.12rem" : netWorthText.length > 11 ? "1.4rem" : "";
  $("asset-count").textContent = countLabel(draft.assets.length, "asset");
  $("debt-count").textContent = countLabel(draft.debts.length, "debt");
  return summary;
}

const chartColours = ["#28745f", "#8064a4", "#bb893f", "#5d8191", "#ad674e", "#687a54", "#956f76", "#486c77"];
const chartViews = {
  owner: { title: "Assets by person", context: "Shared assets count once. Select a person to open their items below." },
  type: { title: "Assets by type", context: "Each slice shows a type of asset. Related borrowing is listed in the detail view." },
  access: { title: "Assets by access", context: "Access describes when money may generally be available; account and sale rules still apply." },
};
const accessLabels = { accessible: "Generally accessible", pension: "Pensions", illiquid: "Property & possessions", review: "Access to confirm" };
const share = (value, total) => `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value / total * 100)}%`;

function chartGroups(summary) {
  if (chartView === "owner") return ["primary", "partner", "shared"]
    .filter((owner) => owner !== "partner" && owner !== "shared" || draft.partnerName?.trim())
    .map((owner) => ({ key: owner, label: ownerName(owner), value: summary.ownership[owner].assetTotal,
      assets: draft.assets.filter((asset) => (asset.owner || "primary") === owner),
      debts: draft.debts.filter((debt) => (debt.owner || "primary") === owner) }));
  if (chartView === "type") return summary.assetGroups.map((group) => ({
    key: group.kind, label: group.label, value: group.total,
    assets: draft.assets.filter((asset) => asset.kind === group.kind),
    debts: draft.debts.filter((debt) => draft.assets.some((asset) => asset.kind === group.kind && asset.id === debt.linkedAssetId)),
  }));
  return ACCESS_BUCKETS.map((bucket) => ({ key: bucket, label: accessLabels[bucket], value: summary.accessTotals[bucket],
    assets: draft.assets.filter((asset) => accessBucket(asset) === bucket), debts: [] }));
}

function renderChart(summary) {
  const groups = chartGroups(summary).filter((group) => group.value > 0);
  if (!groups.some((group) => group.key === chartSelection)) chartSelection = null;
  for (const button of document.querySelectorAll("[data-chart-view]")) button.setAttribute("aria-pressed", String(button.dataset.chartView === chartView));
  $("donut-title").textContent = chartViews[chartView].title;
  $("chart-context").textContent = `${chartViews[chartView].context} Shares use total assets; debt is deducted separately from net worth.`;
  $("donut-total").textContent = money(summary.assetTotal);
  const svg = $("asset-donut");
  svg.querySelectorAll("circle").forEach((circle) => circle.remove());
  const ns = "http://www.w3.org/2000/svg";
  const track = document.createElementNS(ns, "circle");
  track.setAttribute("cx", "120"); track.setAttribute("cy", "120"); track.setAttribute("r", "88");
  track.setAttribute("fill", "none"); track.setAttribute("stroke", "#e4e8e2"); track.setAttribute("stroke-width", "30");
  svg.append(track);
  let offset = 0;
  const circumference = 2 * Math.PI * 88;
  for (const [index, group] of groups.entries()) {
    const fraction = group.value / summary.assetTotal;
    const segment = document.createElementNS(ns, "circle");
    segment.setAttribute("cx", "120"); segment.setAttribute("cy", "120"); segment.setAttribute("r", "88");
    segment.setAttribute("fill", "none"); segment.setAttribute("stroke", chartColours[index % chartColours.length]);
    segment.setAttribute("stroke-width", chartSelection === group.key ? "37" : "30");
    segment.setAttribute("stroke-dasharray", `${Math.max(0, fraction * circumference - 2)} ${circumference}`);
    segment.setAttribute("stroke-dashoffset", String(-offset * circumference));
    segment.setAttribute("transform", "rotate(-90 120 120)");
    segment.setAttribute("class", "donut-slice"); segment.dataset.chartKey = group.key;
    segment.setAttribute("tabindex", "0"); segment.setAttribute("role", "button");
    segment.setAttribute("aria-label", `${group.label}, ${money(group.value)}, ${share(group.value, summary.assetTotal)} of assets. View items`);
    svg.append(segment);
    offset += fraction;
  }
  const list = $("chart-categories");
  list.replaceChildren();
  if (!groups.length) {
    list.append(make("p", "chart-empty", "Add your first asset to see the breakdown."));
    const add = make("button", "button button-primary chart-add", "＋ Add an asset");
    add.type = "button"; add.dataset.chartAdd = "";
    list.append(add);
  }
  for (const [index, group] of groups.entries()) {
    const button = make("button", "chart-category");
    button.type = "button"; button.dataset.chartKey = group.key;
    button.setAttribute("aria-pressed", String(chartSelection === group.key));
    const swatch = make("span", "chart-swatch"); swatch.style.background = chartColours[index % chartColours.length];
    button.append(swatch, make("span", "chart-category-name", group.label), make("strong", "", money(group.value)), make("small", "", `${share(group.value, summary.assetTotal)} of assets →`));
    list.append(button);
  }
  const detail = $("chart-drilldown");
  detail.replaceChildren(); detail.hidden = !chartSelection || chartView === "owner";
  if (!chartSelection || chartView === "owner") return;
  const group = groups.find((entry) => entry.key === chartSelection);
  const heading = make("div", "drill-heading");
  const back = make("button", "drill-back", "← All categories"); back.type = "button"; back.dataset.chartBack = "";
  heading.append(back, make("h3", "", group.label), make("strong", "", money(group.value)));
  detail.append(heading);
  const items = make("div", "drill-items");
  for (const asset of group.assets) {
    const button = make("button", "drill-item"); button.type = "button"; button.dataset.drillType = "asset"; button.dataset.drillId = asset.id;
    button.append(make("span", "", itemName(asset, ASSET_TYPES)), make("strong", "", money(asset.value)));
    items.append(button);
  }
  detail.append(items);
  if (group.debts.length) {
    detail.append(make("p", "drill-debt-label", "Related debt · deducted from net worth, not from the asset slices"));
    const debtItems = make("div", "drill-items");
    for (const debt of group.debts) {
      const button = make("button", "drill-item drill-debt"); button.type = "button"; button.dataset.drillType = "debt"; button.dataset.drillId = debt.id;
      button.append(make("span", "", itemName(debt, DEBT_TYPES)), make("strong", "", `−${money(debt.balance)}`));
      debtItems.append(button);
    }
    detail.append(debtItems);
  }
  if (chartView === "owner" && group.debts.length) {
    const net = group.value - group.debts.reduce((sum, debt) => sum + debt.balance, 0);
    detail.append(make("p", "drill-net", `${group.label} net today: ${money(net)}`));
  }
}

const iconPaths = {
  home: "M3 10 12 3l9 7M5 9v12h14V9M9 21v-7h6v7",
  "other-property": "M4 21V6l8-3 8 3v15M4 21h16M8 9h1m6 0h1M8 13h1m6 0h1M8 17h1m6 0h1",
  cash: "M3 6h18v12H3zM12 9c-2 0-3 1-3 3s1 3 3 3 3-1 3-3-1-3-3-3ZM6 9h.01M18 15h.01",
  isa: "M4 20h16M6 17l4-5 3 2 5-8M15 6h3v3",
  shares: "M4 20h16M5 16l4-5 4 2 5-7M16 6h2v2",
  "dc-pension": "M4 20h16M6 20V9l6-5 6 5v11M9 12h6M9 16h6",
  car: "M4 16 6 9h12l2 7M4 16h16v3H4zM7 19v2m10-2v2M7 16h.01M17 16h.01",
  mortgage: "M3 10 12 3l9 7M5 9v12h14V9M9 16h6M12 13v6",
  loan: "M4 4h16v16H4zM8 9h8M8 13h8M8 17h5",
  "credit-card": "M3 6h18v12H3zM3 10h18M7 15h4",
  other: "M12 3 3 8v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
};
function icon(kind) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", iconPaths[kind] || iconPaths.other);
  svg.append(path);
  return svg;
}
function assetContext(asset) {
  const notes = [];
  if (asset.monthlyRent !== undefined) notes.push(`${money(asset.monthlyRent)}/month rent`);
  if (asset.interestRate !== undefined) notes.push(`${plain(asset.interestRate)}% cash rate`);
  if (asset.investmentLabel) notes.push(`Invested in ${asset.investmentLabel}`);
  if (asset.kind === "dc-pension") notes.push(asset.pensionAccessAge ? `Scheme access age ${asset.pensionAccessAge}` : "Check scheme access age");
  if (accessBucket(asset) === "review") notes.push("Access rules to confirm");
  return notes.join(" · ");
}
function debtContext(debt) {
  const notes = [];
  if (debt.interestRate !== undefined) notes.push(`${plain(debt.interestRate)}% mortgage rate`);
  if (debt.remainingYears !== undefined) notes.push(`${plain(debt.remainingYears)} years left`);
  if (debt.monthlyPayment !== undefined) notes.push(`${money(debt.monthlyPayment)}/month payment`);
  else if (debt.kind === "mortgage") {
    const estimate = estimateRepaymentMortgagePayment({ balance: debt.balance, annualRate: debt.interestRate, remainingYears: debt.remainingYears });
    if (estimate !== null) notes.push(`Estimated ${money(estimate)}/month repayment`);
  }
  return notes.join(" · ");
}
function ownerName(owner = "primary") {
  return owner === "partner" ? draft.partnerName : owner === "shared" ? "Shared" : draft.name;
}
function compactMoney(value) {
  if (value >= 1_000_000_000 && value % 1_000_000 === 0) return `£${plain(value / 1_000_000_000)}bn`;
  if (value >= 1_000_000 && value % 1_000 === 0) return `£${plain(value / 1_000_000)}m`;
  if (value >= 1000 && value % 1000 === 0) return `£${plain(value / 1000)}k`;
  return money(value);
}
function needsAccessReview(asset) {
  return (asset.kind === "dc-pension" && !asset.pensionAccessAge) || accessBucket(asset) === "review";
}
function renderAccessReview() {
  const items = draft.assets.filter(needsAccessReview);
  $("access-review").hidden = !items.length;
  if (!items.length) $("access-review").open = false;
  $("access-review-count").textContent = `${items.length} access detail${items.length === 1 ? "" : "s"} to confirm`;
  const list = $("access-review-items");
  list.replaceChildren();
  for (const asset of items) {
    const button = make("button", "access-review-item");
    button.type = "button";
    button.dataset.reviewId = asset.id;
    button.append(icon(asset.kind), make("span", "", `${ownerName(asset.owner)} · ${itemName(asset, ASSET_TYPES)}`), make("small", "", asset.kind === "dc-pension" ? "Confirm scheme access age →" : "Confirm access or sale rules →"));
    list.append(button);
  }
}
function showAddChoices(owner, trigger, assetOnly = false) {
  addOwner = owner;
  addTrigger = trigger;
  $("add-dialog-title").textContent = `Add for ${ownerName(owner)}`;
  const choices = $("add-choices");
  choices.replaceChildren();
  for (const [type, types] of (assetOnly ? [["asset", ASSET_TYPES]] : [["asset", ASSET_TYPES], ["debt", DEBT_TYPES]])) {
    choices.append(make("p", "add-choice-label", type === "asset" ? "Something you own" : "Something you owe"));
    for (const [kind, info] of Object.entries(types)) {
      const button = make("button", `add-choice add-choice-${type}`);
      button.type = "button";
      button.dataset.quickKind = kind;
      button.dataset.quickType = type;
      button.append(icon(kind), make("span", "", info.label));
      choices.append(button);
    }
  }
  $("add-dialog").showModal();
  choices.querySelector("button").focus();
}
function renderOrbit(summary) {
  const container = $("orbit-items");
  container.replaceChildren();
  for (const owner of ["primary", "partner", "shared"]) {
    if (owner !== "primary" && !draft.partnerName?.trim()) continue;
    const subtotal = summary.ownership[owner];
    const assets = draft.assets.filter((asset) => (asset.owner || "primary") === owner);
    const debts = draft.debts.filter((debt) => (debt.owner || "primary") === owner);
    const group = make("section", `owner-cluster owner-cluster-${owner}`);
    group.dataset.ownerGroup = owner;
    group.setAttribute("aria-label", `${ownerName(owner)}: ${money(subtotal.assetTotal)} assets, ${money(subtotal.debtTotal)} debt, ${money(subtotal.netWorth)} net`);
    const header = make("div", "owner-cluster-heading");
    const avatar = make("span", "owner-avatar", owner === "shared" ? "∞" : ownerName(owner).trim().charAt(0).toUpperCase());
    avatar.setAttribute("aria-hidden", "true");
    header.append(avatar);
    header.append(make("h2", "owner-cluster-title", ownerName(owner)));
    header.append(make("span", "owner-cluster-detail", `${subtotal.assetCount} asset${subtotal.assetCount === 1 ? "" : "s"}${subtotal.debtCount ? ` · ${subtotal.debtCount} debt${subtotal.debtCount === 1 ? "" : "s"}` : ""}`));
    const add = make("button", "owner-add", "＋ Add");
    add.type = "button";
    add.dataset.addOwner = owner;
    add.setAttribute("aria-label", `Add an asset or debt for ${ownerName(owner)}`);
    header.append(add);
    const balance = make("div", "owner-balance");
    for (const [label, value, className] of [["Assets", subtotal.assetTotal, "owner-assets"], ["Debt", subtotal.debtTotal, "owner-debt"], ["Net today", subtotal.netWorth, "owner-cluster-net"]]) {
      const metric = make("div", "owner-metric");
      metric.append(make("span", "", label), make("strong", className, money(value)));
      balance.append(metric);
    }
    const cells = ["accessible", "pension", "illiquid", "debt", "review"].flatMap((bucket) => {
      const cell = make("details", `bucket-cell bucket-${bucket}`);
      cell.dataset.bucket = bucket;
      cell.dataset.ownerBucket = `${owner}:${bucket}`;
      cell.open = openCategories.has(cell.dataset.ownerBucket);
      const members = bucket === "debt" ? debts.map((item) => ({ type: "debt", item })) : assets.filter((item) => accessBucket(item) === bucket).map((item) => ({ type: "asset", item }));
      if (!members.length) return [];
      const total = members.reduce((sum, { type, item }) => sum + (type === "debt" ? item.balance : item.value), 0);
      const heading = make("summary", "bucket-heading");
      heading.append(make("span", "bucket-mobile-label", { accessible: "Available now", pension: "Pensions", illiquid: "Property & possessions", review: "Access to confirm", debt: "Borrowing" }[bucket]));
      heading.append(make("strong", "bucket-total", `${bucket === "debt" ? "−" : ""}${compactMoney(total)}`));
      cell.append(heading);
      const nodes = make("div", "owner-nodes");
      for (const { type, item } of members) {
        const types = type === "asset" ? ASSET_TYPES : DEBT_TYPES;
        const value = type === "asset" ? item.value : item.balance;
        const context = type === "asset" ? assetContext(item) : debtContext(item);
        const button = make("button", `orbit-card orbit-${type} orbit-owner-${owner}`);
        button.type = "button";
        button.dataset.orbitType = type;
        button.dataset.orbitId = item.id;
        button.setAttribute("aria-label", `Edit ${ownerName(owner)} ${itemName(item, types)}, ${type === "debt" ? "debt " : "asset "}${money(value)}${context ? `, ${context}` : ""}, ${item.confidence || "estimate"}`);
        const pictogram = make("span", "orbit-icon");
        pictogram.append(icon(item.kind));
        if (type === "asset" && needsAccessReview(item)) {
          const cue = make("span", "access-cue");
          cue.title = "Access details to confirm";
          cue.setAttribute("aria-hidden", "true");
          pictogram.append(cue);
        }
        const words = make("span", "orbit-words");
        words.append(make("span", "orbit-name", itemName(item, types)));
        if (item.confidence === "review") words.append(make("span", "orbit-confidence", "Needs review"));
        if (type === "asset" && item.pensionAccessAge) words.append(make("span", "orbit-confidence", `Age ${item.pensionAccessAge}`));
        button.append(pictogram, words, make("strong", "orbit-value", `${type === "debt" ? "−" : ""}${compactMoney(value)}`));
        nodes.append(button);
      }
      cell.append(nodes);
      return cell;
    });
    const details = make("details", "owner-details");
    details.dataset.ownerDetails = owner;
    details.open = openOwners.has(owner);
    const itemCount = assets.length + debts.length;
    const categoryGrid = make("div", "owner-category-grid");
    categoryGrid.append(...cells);
    details.append(make("summary", "", `View ${itemCount} item${itemCount === 1 ? "" : "s"}`), categoryGrid);
    group.classList.toggle("owner-selected", chartView === "owner" && chartSelection === owner);
    group.append(header, balance);
    if (itemCount) group.append(details);
    else group.append(make("p", "owner-empty", "No items yet. Use Add to get started."));
    for (const asset of assets) {
      const equity = summary.linkedEquity.find((row) => row.assetId === asset.id);
      if (equity?.linkedDebtTotal) {
        const pair = make("div", "linked-pair-note");
        pair.append(make("span", "", `${itemName(asset, ASSET_TYPES)} ${compactMoney(asset.value)} − ${compactMoney(equity.linkedDebtTotal)} debt`), make("strong", "", `= ${compactMoney(equity.equity)} equity`));
        cells.find((cell) => cell.dataset.bucket === "illiquid")?.append(pair);
      }
    }
    container.append(group);
  }
  container.classList.toggle("single-owner", !draft.partnerName?.trim());
}

function render() {
  const summary = setTotals();
  const hasItems = draft.assets.length + draft.debts.length > 0;
  $("first-piece").hidden = hasItems || mode === "example";
  document.querySelector(".constellation-centre").hidden = !hasItems && mode !== "example";
  document.querySelector(".explore-panel").hidden = draft.assets.length === 0 && mode !== "example";
  document.querySelector(".people-panel").hidden = !hasItems && mode !== "example";
  document.querySelector(".snapshot-caveat").hidden = !hasItems && mode !== "example";
  renderChart(summary);
  $("person-heading").textContent = `${draft.name.trim() || "Your"}${draft.partnerName?.trim() ? ` & ${draft.partnerName.trim()}` : ""}’s`;
  $("snapshot-description").textContent = !hasItems && mode !== "example"
    ? `${draft.name}, age ${draft.age}${draft.partnerName?.trim() ? ` · ${draft.partnerName.trim()}` : ""} · Your picture is ready for its first item.`
    : `${draft.name}, age ${draft.age}${draft.partnerName?.trim() ? ` · ${draft.partnerName.trim()}` : ""} · ${mode === "example" ? "Editable fictional example" : "Your entries"}. Tap an item to see or change its details.`;
  $("example-badge").textContent = mode === "example" ? "Fictional example · edit anything" : "Your money picture";
  $("start-own-button").hidden = mode !== "example";
  $("reset-example-button").hidden = mode !== "example";
  $("value-context").textContent = mode === "example" ? "Example values are illustrative estimates. Edit anything to make it yours." : "Start with what you know. Mark values as exact, estimated, or needing review in the editor.";
  renderAccessReview();
  renderOrbit(summary);
  renderFlow();
}

const flowColors = {
  primaryPay: "#28745f", partnerPay: "#8064a4", pensionIncome: "#5f8093", otherIncome: "#78916d",
  homeBills: "#b68849", everyday: "#ce9d62", transport: "#7893a5", lifestyle: "#9b80a8", other: "#9b8770",
  rent: "#659277", mortgage: "#aa7251", datedIncome: "#3d8276", datedSpending: "#b87961",
  tax: "#ad6b58", nationalInsurance: "#c17b61", pensionContribution: "#9276a9", saving: "#398568",
  unallocated: "#8ba99a", gap: "#b25d45",
  "cash-reserve": "#2a9d8f", "isa-primary": "#3a8f6a", "isa-partner": "#6db888", trading: "#d4a843",
};
const svgNS = "http://www.w3.org/2000/svg";
function svgElement(tag, attributes = {}) {
  const node = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}
function flowColor(item) {
  if (item.kind === "mortgage") return "#b77b4c";
  if (item.kind === "datedSpending") return "#a57863";
  if (item.kind === "spending") {
    if (item.key?.startsWith("custom:")) {
      const palette = ["#5e8799", "#9273a3", "#ba6d5c", "#b77b4c", "#668a62", "#788ba8"];
      const hash = [...item.key].reduce((value, character) => value + character.charCodeAt(0), 0);
      return palette[hash % palette.length];
    }
    return ({ homeBills: "#b77b4c", everyday: "#5e8799", transport: "#8295a5", lifestyle: "#9273a3", other: "#ba6d5c" })[item.key] || "#b77b4c";
  }
  if (item.kind === "saving") return item.key === "partnerSaving" ? "#6ba989" : "#398568";
  return flowColors[item.bucket] || flowColors[item.key] || flowColors[item.kind] || "#78916d";
}
function flowIconPath(item) {
  if (item.kind === "tax" || item.kind === "nationalInsurance") return "M5 3h14v18H5zM8 8h8M8 12h8M8 16h5";
  if (item.kind === "pensionContribution" || item.key === "pensionIncome") return iconPaths["dc-pension"];
  if (item.kind === "saving" || item.kind === "unallocated") return iconPaths.cash;
  if (item.kind === "mortgage" || item.key === "homeBills") return iconPaths.home;
  if (item.kind === "rent") return iconPaths["other-property"];
  if (item.key === "transport") return iconPaths.car;
  if (item.key === "primaryPay" || item.key === "partnerPay") return "M4 7h16v13H4zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 12h16";
  return iconPaths.other;
}
function flowBand(x1, y1, x2, y2, height) {
  const middle = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${middle} ${y1} ${middle} ${y2} ${x2} ${y2} L ${x2} ${y2 + height} C ${middle} ${y2 + height} ${middle} ${y1 + height} ${x1} ${y1 + height} Z`;
}
function flowPositions(items, scale, chartHeight) {
  const gap = 9;
  const totalHeight = items.reduce((sum, item) => sum + item.amount * scale, 0) + Math.max(0, items.length - 1) * gap;
  let y = Math.max(52, (chartHeight - totalHeight) / 2);
  return items.map((item) => {
    const position = { ...item, y, height: item.amount * scale };
    y += position.height + gap;
    return position;
  });
}
function labelPositions(items, chartHeight) {
  const labels = items.map((item) => item.y + item.height / 2);
  for (let index = 1; index < labels.length; index++) labels[index] = Math.max(labels[index], labels[index - 1] + 32);
  const excess = labels.at(-1) - (chartHeight - 42);
  if (excess > 0) for (let index = 0; index < labels.length; index++) labels[index] -= excess;
  return labels;
}
function renderSankey(summary) {
  const svg = $("flow-sankey");
  [...svg.children].filter((child) => !["title", "desc"].includes(child.tagName.toLowerCase())).forEach((child) => child.remove());
  svg.hidden = !summary.hasEntries;
  $("flow-empty").hidden = summary.hasEntries;
  if (!summary.hasEntries) return;
  const chartWidth = 1520, startY = 112;
  const chartHeight = Math.max(630, 185 + Math.max(summary.sources.length, summary.uses.length) * 58);
  const streamHeight = chartHeight - 190;
  svg.setAttribute("viewBox", `0 0 ${chartWidth} ${chartHeight}`);
  const scale = streamHeight / Math.max(summary.chartTotal, 1);
  const payKeys = new Set(["primaryPay", "partnerPay"]);
  const enteredPay = new Set(summary.payDetails.filter((detail) => detail.enteredTakeHome).map((detail) => `${detail.owner}Pay`));
  const payrollIncome = summary.sources.filter((item) => payKeys.has(item.key) && !enteredPay.has(item.key));
  const directIncome = summary.sources.filter((item) => !payrollIncome.includes(item));
  const orderedSources = [...payrollIncome, ...directIncome];
  const place = (items, y) => {
    let cursor = y;
    return items.map((item) => { const placed = { ...item, y: cursor, height: item.amount * scale }; cursor += placed.height; return placed; });
  };
  const left = place(orderedSources, startY);
  const payroll = place(payrollIncome, startY);
  const direct = place(directIncome, startY + payrollIncome.reduce((total, item) => total + item.amount * scale, 0));
  const cuts = place(summary.deductions, startY);
  const payrollGross = payrollIncome.reduce((total, item) => total + item.amount, 0);
  const deductionTotal = summary.deductions.reduce((total, item) => total + item.amount, 0);
  const payrollNet = Math.max(0, payrollGross - deductionTotal);
  const payrollNetHeight = payrollNet * scale;
  const netTotal = summary.uses.reduce((total, item) => total + item.amount, 0);
  const available = { y: startY + deductionTotal * scale, height: netTotal * scale };
  const right = place(summary.uses, available.y);
  const nodeWidth = 16;
  const x = { source: 252, gross: 430, deduction: 620, available: 890, use: 1155 };
  const zones = [
    { left: 0, width: 292, title: summary.remainder < 0 ? "INCOME + SHORTFALL" : "INCOME ENTERS", fill: "#f3f7f2" },
    { left: 304, width: 220, title: "GROSS PAY", fill: "#eef5f1" },
    { left: 536, width: 318, title: "PAYROLL DEDUCTIONS", fill: "#faf2ee" },
    { left: 866, width: 246, title: summary.remainder < 0 ? "MONEY TO ACCOUNT FOR" : "MONEY FOR THE MONTH", fill: "#eff7f1" },
    { left: 1124, width: 396, title: summary.remainder < 0 ? "SPENDING TO COVER" : "SPENDING & SAVING", fill: "#f7f4ed" },
  ];
  for (const zone of zones) {
    svg.append(svgElement("rect", { x: zone.left, y: 75, width: zone.width, height: chartHeight - 108, rx: 13, fill: zone.fill, class: "flow-svg-stage" }));
  }
  if ($("flow-view-diagram").getAttribute("aria-pressed") === "true") {
    $("flow-view-help").textContent = summary.remainder < 0
      ? "Read left to right. The dashed red entry marks the amount not covered by recorded income; no source is assumed."
      : "Read left to right: gross pay splits into deductions and take-home; other income joins it before spending and saving. Wider flows mean larger monthly amounts.";
  }
  const addText = (x, y, label, anchor = "start", className = "flow-svg-label") => {
    const node = svgElement("text", { x, y, "text-anchor": anchor, class: className });
    node.textContent = label;
    svg.append(node);
  };
  for (const zone of zones) addText(zone.left + zone.width / 2, 34, zone.title, "middle", "flow-svg-heading");
  if (payrollGross > 0) addText(x.gross + nodeWidth / 2, 59, money(payrollGross), "middle", "flow-svg-stage-total");
  addText(x.available + nodeWidth / 2, 59, money(netTotal), "middle", "flow-svg-stage-total");

  for (const item of payroll) {
    const path = svgElement("path", { d: flowBand(x.source + nodeWidth, item.y, x.gross, item.y, item.height), fill: flowColor(item), class: "flow-ribbon flow-ribbon-in" });
    const title = svgElement("title"); title.textContent = `${item.label}: ${money(item.amount)} per month`;
    path.append(title); svg.append(path);
  }
  for (const item of direct) {
    const payOffset = direct.indexOf(item);
    const directTarget = available.y + payrollNetHeight + direct.slice(0, payOffset).reduce((total, row) => total + row.amount * scale, 0);
    const klass = item.key === "gap" ? "flow-ribbon flow-ribbon-gap" : "flow-ribbon flow-ribbon-in";
    const path = svgElement("path", { d: flowBand(x.source + nodeWidth, item.y, x.available, directTarget, item.height), fill: flowColor(item), class: klass });
    const title = svgElement("title"); title.textContent = `${item.label}: ${money(item.amount)} per month`;
    path.append(title); svg.append(path);
  }
  if (payrollGross > 0) svg.append(svgElement("rect", { x: x.gross, y: startY, width: nodeWidth, height: payrollGross * scale, rx: 5, fill: "#3e6957", class: "flow-svg-node" }));
  for (const item of cuts) {
    const grossOffset = cuts.slice(0, cuts.indexOf(item)).reduce((total, row) => total + row.amount * scale, 0);
    const path = svgElement("path", { d: flowBand(x.gross + nodeWidth, startY + grossOffset, x.deduction, item.y, item.height), fill: flowColor(item), class: "flow-ribbon flow-ribbon-cut" });
    const title = svgElement("title"); title.textContent = `${item.label}: ${money(item.amount)} per month`; path.append(title); svg.append(path);
    svg.append(svgElement("rect", { x: x.deduction, y: item.y, width: nodeWidth, height: Math.max(3, item.height), rx: 4, fill: flowColor(item), class: "flow-svg-node" }));
    addText(x.deduction + 29, item.y + item.height / 2 + 5, `${item.label} · ${money(item.amount)}`, "start", "flow-svg-deduction-label");
  }
  if (payrollNet > 0) {
    const path = svgElement("path", { d: flowBand(x.gross + nodeWidth, startY + deductionTotal * scale, x.available, available.y, payrollNetHeight), fill: "#438b70", class: "flow-ribbon flow-ribbon-net" });
    const title = svgElement("title"); title.textContent = `Estimated pay after deductions: ${money(payrollNet)} per month`;
    path.append(title); svg.append(path);
  }
  for (const item of right) {
    const path = svgElement("path", { d: flowBand(x.available + nodeWidth, item.y, x.use, item.y, item.height), fill: flowColor(item), class: "flow-ribbon flow-ribbon-out" });
    const title = svgElement("title"); title.textContent = `${item.label}: ${money(item.amount)} per month`;
    path.append(title); svg.append(path);
  }
  if (netTotal > 0) {
    svg.append(svgElement("rect", { x: x.available, y: available.y, width: nodeWidth, height: available.height, rx: 5, fill: "#28745f", class: "flow-svg-node" }));
  }
  for (const item of left) svg.append(svgElement("rect", { x: x.source, y: item.y, width: nodeWidth, height: Math.max(3, item.height), rx: 4, fill: flowColor(item), class: "flow-svg-node" }));
  for (const item of right) svg.append(svgElement("rect", { x: x.use, y: item.y, width: nodeWidth, height: Math.max(3, item.height), rx: 4, fill: flowColor(item), class: "flow-svg-node" }));

  const leftLabelY = labelPositions(left, chartHeight);
  left.forEach((item, index) => {
    const glyph = svgElement("g", { transform: `translate(226 ${leftLabelY[index] - 9}) scale(.62)`, fill: "none", stroke: flowColor(item), "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
    glyph.append(svgElement("path", { d: flowIconPath(item) })); svg.append(glyph);
    const payDetail = summary.payDetails.find((detail) => `${detail.owner}Pay` === item.key);
    let label = item.key === "gap" ? "Not covered" : payDetail ? `${payDetail.person} ${enteredPay.has(item.key) ? "take-home" : "gross"}` : item.kind === "rent" ? "Rent" : item.kind === "pensionIncome" ? "Pension income" : item.kind === "otherIncome" ? "Other income" : item.label.length > 22 ? `${item.label.slice(0, 20)}…` : item.label;
    addText(215, leftLabelY[index] + 5, `${label} · ${money(item.amount)}`, "end", "flow-svg-label");
  });
  const rightLabelY = labelPositions(right, chartHeight);
  right.forEach((item, index) => {
    const glyph = svgElement("g", { transform: `translate(1127 ${rightLabelY[index] - 9}) scale(.62)`, fill: "none", stroke: flowColor(item), "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
      glyph.append(svgElement("path", { d: flowIconPath(item) })); svg.append(glyph);
    const chartName = item.kind === "saving" ? `${item.label.split(" ")[0]} saving` : item.kind === "mortgage" ? "Mortgage" : item.kind === "rent" ? "Rent" : item.key === "homeBills" ? "Home & bills" : item.key === "everyday" ? "Everyday" : item.key === "transport" ? "Transport" : item.key === "lifestyle" ? "Lifestyle" : item.key === "other" ? "Other" : item.kind === "datedSpending" && /school/i.test(item.label) ? "School fees" : item.label.length > 22 ? `${item.label.slice(0, 20)}…` : item.label;
    addText(1166, rightLabelY[index] + 5, `${chartName} · ${money(item.amount)}`, "start", "flow-svg-label");
  });
}
function renderFlowBridge(diagram) {
  const root = $("flow-bridge-view"); root.replaceChildren();
  if (!diagram.hasEntries) { root.append(make("p", "flow-empty", "Add income or spending below to build this view.")); return; }
  const gross = diagram.sources.filter((item) => item.kind !== "gap").reduce((sum, item) => sum + item.amount, 0);
  const deductions = diagram.deductions.reduce((sum, item) => sum + item.amount, 0);
  const equation = make("div", "flow-bridge-equation");
  for (const [label, value, kind, operator] of [
    ["Gross pay and other income", gross, "gross", ""],
    ["Tax, NI and employee pension", deductions, "deductions", "−"],
    ["Money after deductions", diagram.incomeTotal, "net", "="],
  ]) {
    if (operator) equation.append(make("span", "flow-bridge-operator", operator));
    const card = make("div", `flow-bridge-amount flow-bridge-${kind}`);
    card.append(make("span", "", label), make("strong", "", money(value)));
    equation.append(card);
  }
  root.append(equation);
  const groups = [
    { label: "Home", color: "#ae744b", test: (item) => item.key === "homeBills" || item.kind === "mortgage" },
    { label: "Everyday", color: "#c2935d", test: (item) => ["everyday", "transport"].includes(item.key) },
    { label: "Lifestyle and other", color: "#967c64", test: (item) => ["lifestyle", "other"].includes(item.key) },
    { label: "Dated costs", color: "#b56d5d", test: (item) => item.kind === "datedSpending" },
  ];
  const spending = diagram.uses.filter((item) => item.kind === "spending" || item.kind === "mortgage" || item.kind === "datedSpending");
  const assigned = new Set();
  const buckets = groups.map((group) => {
    const items = spending.filter((item) => group.test(item));
    items.forEach((item) => assigned.add(item));
    return { ...group, items, amount: items.reduce((sum, item) => sum + item.amount, 0) };
  });
  const other = spending.filter((item) => !assigned.has(item));
  if (other.length) buckets.push({ label: "Other costs", color: "#a88968", items: other, amount: other.reduce((sum, item) => sum + item.amount, 0) });
  const saving = diagram.uses.filter((item) => item.kind === "saving");
  const savingTotal = saving.reduce((sum, item) => sum + item.amount, 0);
  const section = make("section", "flow-bridge-breakdown");
  const heading = make("div", "flow-bridge-breakdown-heading");
  heading.append(make("h3", "", "Where that money goes"), make("p", "", `${money(diagram.spendingTotal)} spending · ${money(savingTotal)} saving`));
  section.append(heading);
  const bar = make("div", "flow-bridge-bar"); bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", `Monthly spending ${money(diagram.spendingTotal)}; saving ${money(savingTotal)}${diagram.remainder < 0 ? `; uncovered gap ${money(-diagram.remainder)}` : ""}`);
  const total = diagram.spendingTotal + savingTotal;
  for (const group of buckets.filter((group) => group.amount > 0)) {
    const segment = make("span", "flow-bridge-segment"); segment.style.width = `${group.amount / total * 100}%`; segment.style.background = group.color;
    segment.title = `${group.label}: ${money(group.amount)}`; bar.append(segment);
  }
  if (savingTotal) { const segment = make("span", "flow-bridge-segment"); segment.style.width = `${savingTotal / total * 100}%`; segment.style.background = "#398568"; segment.title = `Saving: ${money(savingTotal)}`; bar.append(segment); }
  section.append(bar);
  if (diagram.remainder < 0) section.append(make("p", "flow-bridge-gap", `${money(-diagram.remainder)} of this spending is not covered by recorded income. No funding source is assumed.`));
  const list = make("div", "flow-bridge-groups");
  for (const group of buckets.filter((bucket) => bucket.amount > 0)) {
    const detail = make("details", "flow-bridge-group");
    const heading = make("summary", "");
    const label = make("span", "flow-bridge-group-label");
    const swatch = make("span", "flow-bridge-swatch"); swatch.style.background = group.color;
    label.append(swatch, document.createTextNode(group.label));
    heading.append(label, make("strong", "", money(group.amount))); detail.append(heading);
    const items = make("ul", "flow-bridge-items");
    for (const item of group.items) { const row = make("li", ""); row.append(make("span", "", item.label), make("strong", "", money(item.amount))); items.append(row); }
    detail.append(items); list.append(detail);
  }
  if (savingTotal) {
    const detail = make("div", "flow-bridge-group flow-bridge-saving");
    const heading = make("div", "flow-bridge-saving-heading");
    const label = make("span", "flow-bridge-group-label"); const swatch = make("span", "flow-bridge-swatch"); swatch.style.background = "#398568";
    label.append(swatch, document.createTextNode("Saving")); heading.append(label, make("strong", "", money(savingTotal))); detail.append(heading);
    const items = make("ul", "flow-bridge-items");
    for (const item of saving) { const row = make("li", ""); row.append(make("span", "", item.label), make("strong", "", money(item.amount))); items.append(row); }
    detail.append(items); list.append(detail);
  }
  section.append(list); root.append(section);
}
const flowChartPalette = ["#2d8067", "#c38a55", "#8b6ca7", "#678ba0", "#bd6e58", "#82965f", "#d0a844", "#6f8c7b"];
function flowChartHierarchy(diagram) {
  const uses = diagram.uses.filter((item) => ["spending", "mortgage", "datedSpending"].includes(item.kind));
  const spendingGroups = [
    ["Home", (item) => item.key === "homeBills" || item.kind === "mortgage"],
    ["Everyday", (item) => ["everyday", "transport"].includes(item.key)],
    ["Lifestyle", (item) => item.key === "lifestyle"],
    ["Other and dated", (item) => item.key === "other" || item.key?.startsWith("custom:") || item.kind === "datedSpending"],
  ].map(([label, matches], index) => {
    const children = uses.filter(matches).map((item) => ({ id: `item:${item.key}`, label: item.label, amount: item.amount, color: flowChartPalette[(index + 1) % flowChartPalette.length], children: [] }));
    return { id: `group:${index}`, label, amount: children.reduce((sum, item) => sum + item.amount, 0), color: flowChartPalette[(index + 1) % flowChartPalette.length], children };
  }).filter((group) => group.amount > 0);
  const spendTotal = spendingGroups.reduce((sum, group) => sum + group.amount, 0);
  const savingItems = diagram.uses.filter((item) => item.kind === "saving");
  const saveTotal = savingItems.reduce((sum, item) => sum + item.amount, 0);
  const children = [];
  if (spendTotal > 0) children.push({ id: "spending", label: "Spending", amount: spendTotal, color: "#bd8555", children: spendingGroups });
  if (saveTotal > 0) children.push({ id: "saving", label: "Saving", amount: saveTotal, color: "#398568", children: savingItems.map((item, index) => ({ id: `saving:${index}`, label: item.label, amount: item.amount, color: flowChartPalette[index], children: [] })) });
  return { id: "outgoings", label: "Spending and saving", amount: children.reduce((sum, item) => sum + item.amount, 0), color: "#315b4d", children, remainder: diagram.remainder };
}
function nodeAtPath(root, path) { return path.reduce((node, id) => node?.children?.find((child) => child.id === id), root) || root; }
function flowHierarchyHeader(root, path, container) {
  const nav = make("div", "flow-hierarchy-nav");
  if (path.length) {
    const back = make("button", "flow-hierarchy-back", "← Back"); back.type = "button"; back.addEventListener("click", () => { flowChartPath.pop(); renderFlow(); }); nav.append(back);
  }
  const crumbs = make("div", "flow-hierarchy-crumbs");
  const crumbNodes = [{ node: root, path: [] }];
  let branch = root;
  const validPath = [];
  path.forEach((id) => { branch = branch?.children?.find((item) => item.id === id); if (branch) validPath.push(id); });
  if (validPath.length !== path.length) flowChartPath = validPath;
  branch = root;
  validPath.forEach((id, index) => { branch = branch.children.find((item) => item.id === id); crumbNodes.push({ node: branch, path: validPath.slice(0, index + 1) }); });
  crumbNodes.forEach(({ node, path: crumbPath }, index) => {
    if (index) crumbs.append(make("span", "", " / "));
    if (index === crumbNodes.length - 1) crumbs.append(make("strong", "", node.label));
    else { const crumb = make("button", "flow-hierarchy-crumb", node.label); crumb.type = "button"; crumb.addEventListener("click", () => { flowChartPath = crumbPath; renderFlow(); }); crumbs.append(crumb); }
  });
  nav.append(crumbs, make("strong", "flow-hierarchy-total", money(nodeAtPath(root, path).amount)));
  container.append(nav);
  const selected = nodeAtPath(root, path);
  const help = make("p", "flow-hierarchy-help", selected.children.length ? "Select a section to open its next level." : "This is the most detailed level in the current entries.");
  container.append(help);
  return selected;
}
function chartPathFor(node, start, end, inner, outer, cx, cy) {
  const point = (radius, angle) => [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  const [x1, y1] = point(outer, start), [x2, y2] = point(outer, end), [x3, y3] = point(inner, end), [x4, y4] = point(inner, start);
  if (end - start >= Math.PI * 2 - 0.001) {
    const [xo, yo] = point(outer, start + Math.PI), [xi, yi] = point(inner, start + Math.PI);
    return `M ${x1} ${y1} A ${outer} ${outer} 0 1 1 ${xo} ${yo} A ${outer} ${outer} 0 1 1 ${x1} ${y1} L ${x4} ${y4} A ${inner} ${inner} 0 1 0 ${xi} ${yi} A ${inner} ${inner} 0 1 0 ${x4} ${y4} Z`;
  }
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
}
function hierarchyEntries(root) {
  const result = [];
  const visit = (node, path = [], depth = 0, parentAmount = root.amount) => {
    for (const child of node.children || []) {
      const next = [...path, child.id];
      result.push({ node: child, path: next, depth, parentAmount });
      visit(child, next, depth + 1, child.amount);
    }
  };
  visit(root);
  return result;
}
function flowChartGap(container, diagram) {
  if (diagram.remainder < 0) container.append(make("p", "flow-hierarchy-gap", `${money(-diagram.remainder)} monthly gap: spending is greater than recorded income. No funding source is assumed.`));
}
function hierarchyLegend(container, selected) {
  const list = make("div", "flow-hierarchy-legend");
  for (const child of selected.children) {
    const button = make("button", "flow-hierarchy-legend-item"); button.type = "button";
    if (child.children.length) button.addEventListener("click", () => { flowChartPath.push(child.id); renderFlow(); });
    else button.disabled = true;
    const swatch = make("span", "flow-hierarchy-swatch"); swatch.style.background = child.color;
    button.append(swatch, make("span", "", child.label), make("strong", "", money(child.amount)));
    list.append(button);
  }
  container.append(list);
}
function installChartNavigation(container) {
  if (container.dataset.navigationInstalled) return;
  container.dataset.navigationInstalled = "true";
  const activate = (event) => {
    const hit = event.target.closest("[data-flow-chart-path]");
    if (!hit) return;
    const path = JSON.parse(hit.dataset.flowChartPath);
    if (path.length) { flowChartPath = path; renderFlow(); }
  };
  container.addEventListener("click", activate);
  container.addEventListener("keydown", (event) => { if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-flow-chart-path]")) { event.preventDefault(); activate(event); } });
}
function renderSunburst(diagram) {
  const root = flowChartHierarchy(diagram), container = $("flow-sunburst-view"); container.replaceChildren();
  const selected = flowHierarchyHeader(root, flowChartPath, container);
  flowChartGap(container, diagram);
  const chart = svgElement("svg", { viewBox: "0 0 520 440", class: "flow-hierarchy-svg flow-sunburst", role: "img", "aria-label": "Sunburst of spending and saving; select a ring to drill down" });
  const chartTitle = svgElement("title"); chartTitle.textContent = "Sunburst of monthly spending and saving"; chart.append(chartTitle);
  const cx = 220, cy = 220, entries = hierarchyEntries(root);
  const angles = new Map([["outgoings", [-Math.PI / 2, Math.PI * 1.5]]]);
  for (const entry of entries) {
    const [start, end] = angles.get(entry.path.length === 1 ? "outgoings" : entry.path.at(-2)) || [-Math.PI / 2, Math.PI * 1.5];
    const siblings = entry.path.length === 1 ? root.children : nodeAtPath(root, entry.path.slice(0, -1)).children;
    const before = siblings.slice(0, siblings.indexOf(entry.node)).reduce((sum, item) => sum + item.amount, 0);
    const total = siblings.reduce((sum, item) => sum + item.amount, 0) || 1;
    const a0 = start + (end - start) * before / total;
    const a1 = a0 + (end - start) * entry.node.amount / total;
    angles.set(entry.node.id, [a0, a1]);
    const inner = 48 + entry.depth * 49, outer = inner + 46;
    const sector = svgElement("path", { d: chartPathFor(entry.node, a0, a1, inner, outer, cx, cy), fill: entry.node.color, stroke: "#fffefa", "stroke-width": 2, tabindex: "0", role: entry.node.children.length ? "button" : "img", "aria-label": `${entry.node.label}, ${money(entry.node.amount)}${entry.node.children.length ? ", drill down" : ""}`, "data-flow-chart-path": JSON.stringify(entry.node.children.length ? entry.path : []) });
    const title = svgElement("title"); title.textContent = `${entry.node.label}: ${money(entry.node.amount)}`; sector.append(title); chart.append(sector);
  }
  const centreLabel = svgElement("text", { x: cx, y: cy - 4, "text-anchor": "middle", class: "flow-chart-centre-label" }); centreLabel.textContent = selected.label;
  const centreValue = svgElement("text", { x: cx, y: cy + 19, "text-anchor": "middle", class: "flow-chart-centre-value" }); centreValue.textContent = money(selected.amount);
  chart.append(centreLabel, centreValue); container.append(chart); hierarchyLegend(container, selected); installChartNavigation(container);
}
function renderTreemap(diagram) {
  const root = flowChartHierarchy(diagram), container = $("flow-treemap-view"); container.replaceChildren();
  const selected = flowHierarchyHeader(root, flowChartPath, container);
  flowChartGap(container, diagram);
  const chart = svgElement("svg", { viewBox: "0 0 860 420", class: "flow-hierarchy-svg flow-treemap", role: "img", "aria-label": "Treemap of spending and saving; select a rectangle to drill down" });
  const chartTitle = svgElement("title"); chartTitle.textContent = "Treemap of monthly spending and saving"; chart.append(chartTitle);
  const children = selected.children;
  if (!children.length) {
    const empty = svgElement("text", { x: 430, y: 210, "text-anchor": "middle", class: "flow-chart-empty" }); empty.textContent = "No further breakdown for this section."; chart.append(empty);
  } else {
    const total = children.reduce((sum, item) => sum + item.amount, 0) || 1;
    const horizontal = children.length <= 3;
    let offset = 0;
    children.forEach((child) => {
      const ratio = child.amount / total;
      const x = horizontal ? offset : 0, y = horizontal ? 0 : offset;
      const width = horizontal ? 860 * ratio : 860, height = horizontal ? 420 : 420 * ratio;
      const inset = 4, nx = x + inset, ny = y + inset, nw = Math.max(0, width - inset * 2), nh = Math.max(0, height - inset * 2);
      const rect = svgElement("rect", { x: nx, y: ny, width: nw, height: nh, rx: 7, fill: child.color, stroke: "#fffefa", "stroke-width": 2, tabindex: child.children.length ? "0" : "-1", role: child.children.length ? "button" : "img", "aria-label": `${child.label}, ${money(child.amount)}${child.children.length ? ", drill down" : ""}`, "data-flow-chart-path": JSON.stringify(child.children.length ? [...flowChartPath, child.id] : []) });
      const title = svgElement("title"); title.textContent = `${child.label}: ${money(child.amount)}`; rect.append(title); chart.append(rect);
      const label = svgElement("text", { x: nx + 16, y: ny + Math.min(34, nh / 2), class: "flow-treemap-label", "pointer-events": "none" }); label.textContent = child.label; chart.append(label);
      if (nw > 120 && nh > 52) { const amount = svgElement("text", { x: nx + 16, y: ny + Math.min(62, nh / 2 + 26), class: "flow-treemap-amount", "pointer-events": "none" }); amount.textContent = money(child.amount); chart.append(amount); }
      offset += horizontal ? 860 * ratio : 420 * ratio;
    });
  }
  container.append(chart); hierarchyLegend(container, selected); installChartNavigation(container);
}
function renderDrillDonut(diagram) {
  const root = flowChartHierarchy(diagram), container = $("flow-donut-view"); container.replaceChildren();
  const selected = flowHierarchyHeader(root, flowChartPath, container);
  flowChartGap(container, diagram);
  const chart = svgElement("svg", { viewBox: "0 0 520 390", class: "flow-hierarchy-svg flow-drill-donut", role: "img", "aria-label": "Drill-down donut of monthly spending and saving" });
  const chartTitle = svgElement("title"); chartTitle.textContent = `${selected.label}: ${money(selected.amount)}`; chart.append(chartTitle);
  const cx = 195, cy = 195, radius = 145, inner = 78; let angle = -Math.PI / 2;
  selected.children.forEach((node) => {
    const portion = node.amount / (selected.amount || 1), end = angle + Math.PI * 2 * portion;
    const sector = svgElement("path", { d: chartPathFor(node, angle, end, inner, radius, cx, cy), fill: node.color, stroke: "#fffefa", "stroke-width": 2, tabindex: node.children.length ? "0" : "-1", role: node.children.length ? "button" : "img", "aria-label": `${node.label}, ${money(node.amount)}${node.children.length ? ", drill down" : ""}`, "data-flow-chart-path": JSON.stringify(node.children.length ? [...flowChartPath, node.id] : []) });
    const title = svgElement("title"); title.textContent = `${node.label}: ${money(node.amount)}`; sector.append(title); chart.append(sector); angle = end;
  });
  const centreLabel = svgElement("text", { x: cx, y: cy - 4, "text-anchor": "middle", class: "flow-chart-centre-label" }); centreLabel.textContent = selected.label;
  const centreValue = svgElement("text", { x: cx, y: cy + 19, "text-anchor": "middle", class: "flow-chart-centre-value" }); centreValue.textContent = money(selected.amount);
  chart.append(centreLabel, centreValue); container.append(chart); hierarchyLegend(container, selected); installChartNavigation(container);
}
function flowListItem(item, side) {
  const payOwner = item.key === "primaryPay" ? "primary" : item.key === "partnerPay" ? "partner" : "";
  const customSpendingId = item.key?.startsWith("custom:") ? item.key.slice(7) : "";
  const editable = payOwner || customSpendingId || (side === "income" ? INCOME_FIELDS.some((field) => field.key === item.key) : SPENDING_FIELDS.some((field) => field.key === item.key));
  const row = make("tr", "flow-table-row");
  const label = make("th"); label.scope = "row";
  const labelText = make("span", "flow-table-label", item.label);
  const swatch = make("span", "flow-list-swatch"); swatch.style.background = flowColor(item);
  label.append(swatch, labelText);
  const amount = make("td", "flow-table-amount", money(item.amount));
  const action = make("td", "flow-table-action");
  if (editable || item.kind === "saving" || item.kind === "rent" || item.kind === "mortgage" || item.kind === "datedIncome" || item.kind === "datedSpending") {
    const button = make("button", "flow-table-edit", "Edit");
    button.type = "button";
    button.setAttribute("aria-label", `Edit ${item.label}`);
    if (payOwner) button.dataset.flowPay = payOwner;
    else if (customSpendingId) button.dataset.flowCustomSpending = customSpendingId;
    else if (editable) button.dataset.flowFocus = `${side}:${item.key}`;
    else if (item.kind === "saving") button.dataset.flowSaving = item.key === "primarySaving" ? "primary" : "partner";
    else if (item.kind === "datedIncome" || item.kind === "datedSpending") button.dataset.flowEntry = item.key.slice(6);
    else if (item.kind === "mortgage") button.dataset.flowDebt = item.key.slice(9);
    else button.dataset.flowAsset = item.key.slice(5);
    action.append(button);
  }
  row.append(label, amount, action);
  return row;
}
function flowMonthLabel(month) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}
function renderDatedEntries(summary) {
  const overview = $("flow-entry-overview"); overview.replaceChildren();
  for (const detail of summary.payDetails) {
    const button = make("button", "flow-overview-card"); button.type = "button"; button.dataset.flowPay = detail.owner;
    button.append(make("span", "flow-overview-kicker", detail.enteredTakeHome ? "Pay · take-home entered" : "Pay · take-home estimated"), make("strong", "", detail.person), make("span", "flow-overview-amount", `${money(detail.monthlyTakeHome)}/month`), make("span", "flow-overview-edit", "Edit pay and pensions →"));
    overview.append(button);
  }
  const enteredIncome = INCOME_FIELDS.reduce((sum, field) => sum + (Number(flowDraft.income[field.key]) || 0), 0);
  const includedRent = flowDraft.includeLinkedRent ? summary.linkedRents.reduce((sum, rent) => sum + rent.amount, 0) : 0;
  const otherIncome = enteredIncome + includedRent;
  const income = make("button", "flow-overview-card flow-overview-income"); income.type = "button"; income.dataset.flowRegular = "income";
  income.append(make("span", "flow-overview-kicker", "Other regular income"), make("strong", "", "Other money in"), make("span", "flow-overview-amount", `${money(otherIncome)}/month`));
  const incomeLines = make("span", "flow-overview-lines");
  for (const field of INCOME_FIELDS) incomeLines.append(make("span", "", `${field.label} · ${money(Number(flowDraft.income[field.key]) || 0)}`));
  for (const rent of summary.linkedRents) incomeLines.append(make("span", "", `${rent.label} rent · ${money(rent.amount)}${flowDraft.includeLinkedRent ? " · included" : " · not included"}`));
  income.append(incomeLines, make("span", "flow-overview-edit", "Edit regular income →"));
  overview.append(income);

  const regular = SPENDING_FIELDS.reduce((sum, field) => sum + (Number(flowDraft.spending[field.key]) || 0), 0)
    + (flowDraft.customSpending || []).reduce((sum, category) => sum + (Number(category.amount) || 0), 0);
  const categoryCount = SPENDING_FIELDS.length + (flowDraft.customSpending || []).length;
  const spending = make("button", "flow-overview-card"); spending.type = "button"; spending.dataset.flowRegular = "spending";
  const spendingLines = [
    ...SPENDING_FIELDS.map((field) => ({ label: flowDraft.spendingLabels?.[field.key]?.trim() || field.label, amount: Number(flowDraft.spending[field.key]) || 0 })),
    ...(flowDraft.customSpending || []).map((category) => ({ label: category.label, amount: Number(category.amount) || 0 })),
  ].filter((item) => item.amount > 0);
  const spendingPreview = spendingLines.slice(0, 2).map((item) => `${item.label} · ${money(item.amount)}`).join("  ·  ");
  const remainingCategories = Math.max(0, spendingLines.length - 2);
  spending.append(make("span", "flow-overview-kicker", "Regular spending"), make("strong", "", `${categoryCount} categories`), make("span", "flow-overview-amount", `${money(regular)}/month`), make("span", "flow-overview-lines", spendingPreview ? `${spendingPreview}${remainingCategories ? ` · +${remainingCategories} more` : ""}` : "Add amounts to your categories"), make("span", "flow-overview-edit", "Edit names and amounts →"));
  overview.append(spending);
  $("flow-dated-asof").textContent = flowMonthLabel(summary.asOfMonth);
  $("flow-dated-empty").hidden = summary.entryDetails.length > 0;
  const list = $("flow-dated-list"); list.replaceChildren();
  for (const entry of summary.entryDetails) {
    const row = make("button", "flow-dated-row"); row.type = "button"; row.dataset.flowEntry = entry.id;
    const main = make("span", "flow-dated-row-main");
    const dates = entry.frequency === "once" ? `In ${flowMonthLabel(entry.startMonth)}` : `${entry.startMonth ? `From ${flowMonthLabel(entry.startMonth)}` : "Already started"} · ${entry.endMonth ? `Until ${flowMonthLabel(entry.endMonth)}` : "Ongoing"}`;
    const amountLabel = entry.frequency === "yearly" ? `${money(entry.amount)}/year` : entry.frequency === "once" ? `${money(entry.amount)} once` : `${money(entry.amount)}/month`;
    main.append(make("strong", "", entry.label), make("small", "", `${entry.side === "income" ? "Income" : "Expense"} · ${dates} · ${amountLabel}`));
    const status = make("span", `flow-dated-status is-${entry.status}`, entry.status === "active" ? "In diagram" : entry.status === "future" ? "Starts later" : "Ended");
    row.append(main, make("span", "flow-dated-row-amount", entry.frequency === "yearly" ? `${money(entry.monthlyAmount)}/month here` : "Edit →"), status);
    list.append(row);
  }
}
function renderAllocationOverview(plan) {
  $("flow-allocation-enabled").checked = plan.enabled;
  $("flow-allocation-settings").hidden = !plan.enabled;
  $("flow-allocation-context").textContent = plan.surplus === 0
    ? "There is no positive remainder to direct in this monthly picture."
    : plan.enabled ? "This month's illustrative split follows the order you selected. No money is moved."
      : "No destination is assumed. You can illustrate how you intend to use this month's remaining money.";
  $("flow-isa-primary-label").textContent = `${plan.summary.payDetails[0].person}'s ISA subscriptions this tax year`;
  $("flow-isa-partner-label").textContent = `${plan.summary.payDetails[1].person}'s ISA subscriptions this tax year`;
  $("flow-isa-used-partner-row").hidden = !plan.hasPartner;
  const steps = $("flow-allocation-steps"); steps.replaceChildren();
  if (!plan.enabled || plan.surplus === 0) return;
  for (const allocation of plan.allocations) {
    const card = make("div", "flow-allocation-step");
    const marker = make("span", "flow-allocation-marker"); marker.style.background = flowColor(allocation);
    const amount = make("strong", "", `${money(allocation.monthlyAmount)}/month`);
    const detail = allocation.bucket === "cash-reserve"
      ? `${money(plan.currentCash)} cash counted · ${money(plan.cashTarget)} target (${plan.reserveMonths} × recorded outgoings)`
      : allocation.bucket === "isa-primary" ? `${money(plan.allowance - plan.usedPrimary)} allowance left this tax year`
      : allocation.bucket === "isa-partner" ? `${money(plan.allowance - plan.usedPartner)} allowance left this tax year`
      : allocation.bucket === "unallocated" ? "Name an account above to describe this balance" : "Your named destination";
    card.append(marker, make("span", "flow-allocation-step-name", allocation.label), amount, make("small", "", detail));
    steps.append(card);
  }
}
function renderFlowTimeline() {
  const start = flowDraft.timelineStartMonth || flowDraft.asOfMonth;
  $("flow-month").min = start;
  $("flow-month").value = flowDraft.asOfMonth;
  const grouped = new Map();
  for (const event of monthlyFlowEvents(flowDraft, draft, { primary: draft.name, partner: draft.partnerName })) {
    if (!grouped.has(event.month)) grouped.set(event.month, []);
    grouped.get(event.month).push(event.label);
  }
  const rail = $("flow-timeline-events"); rail.replaceChildren();
  for (const [month, labels] of grouped) {
    const button = make("button", "flow-timeline-event"); button.type = "button"; button.dataset.flowMonth = month;
    button.setAttribute("aria-pressed", String(month === flowDraft.asOfMonth));
    button.setAttribute("aria-label", `${flowMonthLabel(month)}: ${labels.join("; ")}`);
    button.append(make("span", "flow-timeline-dot"), make("strong", "", flowMonthLabel(month)), make("small", "", labels.join(" · ")));
    rail.append(button);
  }
  $("flow-timeline-context").textContent = flowDraft.asOfMonth === start
    ? "Current month. Select a change or choose any later month. Future figures use today’s pounds."
    : `Viewing ${flowMonthLabel(flowDraft.asOfMonth)}. Entered amounts are held in today’s pounds; no inflation or future tax changes are applied.`;
}
function renderFlow() {
  const summary = summarizeMonthlyFlow(flowDraft, draft, { primary: draft.name, partner: draft.partnerName });
  renderCustomSpendingInputs();
  const plan = computeAllocationWaterfall(flowDraft, draft, { primary: draft.name, partner: draft.partnerName });
  const diagram = buildMonthlyFlowDiagram(flowDraft, draft, { primary: draft.name, partner: draft.partnerName });
  renderFlowTimeline();
  $("flow-income-total").textContent = money(summary.incomeTotal);
  $("flow-spending-total").textContent = money(summary.spendingTotal);
  $("flow-result-value").textContent = summary.hasEntries ? money(Math.abs(summary.remainder)) : "—";
  $("flow-result-label").textContent = !summary.hasEntries ? "Start with a monthly amount" : summary.remainder < 0 ? "More spent than recorded income" : summary.remainder === 0 ? "Income matches spending" : "Saving after spending";
  const payEstimated = summary.payDetails.some((detail) => !detail.enteredTakeHome && detail.annualGross > 0);
  $("flow-result-context").textContent = !summary.hasEntries ? "Enter income or spending below." : summary.remainder < 0 ? "This gap is not assumed to be funded from assets." : `Shown as saving, split ${diagram.primaryShare.toFixed(1)}% / ${(100 - diagram.primaryShare).toFixed(1)}%; no money moves.${payEstimated ? " Pay is estimated." : ""}`;
  $("flow-result-value").classList.toggle("is-gap", summary.remainder < 0);
  for (const detail of summary.payDetails) {
    $(`flow-pay-${detail.owner}-name`).textContent = detail.person;
    $(`flow-pay-${detail.owner}-monthly`).textContent = !detail.active ? `Pay ends after ${flowMonthLabel(detail.endDate)} · not in this month` : detail.annualTakeHome ? `${detail.enteredTakeHome ? "Entered" : "Estimated"} take-home ${money(detail.annualTakeHome)}/year · ${money(detail.monthlyTakeHome)}/month in this picture` : "Enter yearly salary or actual take-home pay to start.";
    $(`flow-pay-${detail.owner}-tax`).textContent = detail.annualGross ? `Rough 2026–27 estimate: Income Tax ${money(detail.estimate.incomeTax)}, employee NI ${money(detail.estimate.employeeNI)}, employee pension ${money(detail.employeePension)}${detail.employerPension ? `, employer pension ${money(detail.employerPension)}` : ""} per year. Employer pension is outside take-home pay.` : "";
  }
  $("flow-include-rent").checked = flowDraft.includeLinkedRent;
  $("flow-include-mortgage").checked = flowDraft.includeLinkedMortgage;
  $("flow-link-panel").hidden = summary.linkedRents.length === 0 && summary.linkedMortgages.length === 0;
  $("flow-rent-toggle-row").hidden = summary.linkedRents.length === 0;
  $("flow-mortgage-toggle-row").hidden = summary.linkedMortgages.length === 0;
  $("flow-link-description").textContent = "Recorded rent and mortgage payments can flow into this picture. A repayment estimate needs the balance, current rate and remaining term; enter your actual payment to replace it.";
  const rents = $("flow-rent-list"); rents.replaceChildren();
  for (const rent of summary.linkedRents) {
    const row = make("button", "flow-rent-row"); row.type = "button"; row.dataset.flowAsset = rent.id;
    row.append(make("span", "", `${rent.label} · recorded in assets`), make("strong", "", `${money(rent.amount)}/month`), make("span", "flow-rent-edit", "Edit property →"));
    rents.append(row);
  }
  const mortgages = $("flow-mortgage-list"); mortgages.replaceChildren();
  for (const mortgage of summary.linkedMortgages) {
    const row = make("button", "flow-rent-row"); row.type = "button"; row.dataset.flowDebt = mortgage.id;
    const basis = mortgage.estimated ? `${money(mortgage.balance)} balance · ${plain(mortgage.annualRate)}% · ${plain(mortgage.remainingYears)} years left` : "entered payment";
    row.append(make("span", "", `${mortgage.label} · ${basis}`), make("strong", "", mortgage.active ? `${money(mortgage.amount)}/month${mortgage.estimated ? " est." : ""}` : `Payment ended ${flowMonthLabel(mortgage.endMonth)}`), make("span", "flow-rent-edit", "Edit mortgage →"));
    mortgages.append(row);
  }
  const groupRow = (title) => {
    const row = make("tr", "flow-table-group");
    const heading = make("th", "", title); heading.scope = "rowgroup"; heading.colSpan = 3;
    row.append(heading);
    return row;
  };
  const sources = $("flow-source-list"); sources.replaceChildren(groupRow("Pay before deductions and other income"), ...diagram.sources.map((item) => flowListItem(item, "income")));
  const destinations = $("flow-use-list"); destinations.replaceChildren(groupRow("Deductions"), ...diagram.deductions.map((item) => flowListItem(item, "spending")), groupRow("Spending and saving"), ...diagram.uses.map((item) => flowListItem(item, "spending")));
  $("flow-table-scroll").hidden = !summary.hasEntries;
  $("flow-table-empty").hidden = summary.hasEntries;
  renderSankey(diagram);
  renderFlowBridge(diagram);
  renderSunburst(diagram);
  renderTreemap(diagram);
  renderDrillDonut(diagram);
  $("flow-payroll-note").hidden = !diagram.payrollEstimated;
  $("flow-split").hidden = !diagram.hasPartner || summary.remainder <= 0;
  $("flow-split-summary").textContent = `${draft.name || "First person"} ${diagram.primaryShare.toFixed(1)}% · ${draft.partnerName || "Partner"} ${(100 - diagram.primaryShare).toFixed(1)}% · Change split`;
  $("flow-primary-share").setAttribute("aria-label", `${draft.name || "First person"} share of saving, percent`);
  renderAllocationOverview(plan);

  renderDatedEntries(summary);
}
function setupFlowInputs() {
  for (const owner of ["primary", "partner"]) {
    const card = make("fieldset", "flow-pay-card");
    const legend = make("legend"); legend.id = `flow-pay-${owner}-name`; legend.textContent = owner === "primary" ? "Your pay" : "Partner's pay";
    card.append(legend);
    for (const [key, label] of [["annualGross", "Yearly base salary"], ["annualBonus", "Yearly bonus"], ["employeePensionRate", "Your pension (base pay rate)"], ["employeePension", "Your pension (yearly amount)"], ["employerPensionRate", "Employer pension (base pay rate)"], ["employerPension", "Employer pension (yearly amount)"], ["annualTakeHome", "Actual take-home (yearly)"]]) {
      const row = make("label", "flow-input-row"); row.append(make("span", "", label));
      const wrapper = make("span", "flow-money-input"); const input = make("input");
      const percent = key.endsWith("Rate");
      input.type = "number"; input.min = "0"; input.max = percent ? "100" : "100000000"; input.step = "0.01"; input.inputMode = "decimal"; input.placeholder = key === "annualTakeHome" ? "Use estimate" : "0";
      input.dataset.flowPayOwner = owner; input.dataset.flowPayKey = key; input.id = `flow-pay-${owner}-${key}`;
      wrapper.append(make("span", "", percent ? "%" : "£"), input); row.append(wrapper); card.append(row);
    }
    const dateRow = make("label", "flow-input-row"); dateRow.append(make("span", "", "Expected pay end month"));
    const date = make("input", "flow-date-input"); date.type = "month"; date.dataset.flowPayOwner = owner; date.dataset.flowPayKey = "endDate"; date.id = `flow-pay-${owner}-endDate`; dateRow.append(date); card.append(dateRow);
    card.append(make("p", "flow-pay-monthly", "")); const monthly = card.lastChild; monthly.id = `flow-pay-${owner}-monthly`;
    card.append(make("p", "flow-pay-tax", "")); card.lastChild.id = `flow-pay-${owner}-tax`;
    $("flow-pay-inputs").append(card);
  }
  for (const [side, fields] of [["income", INCOME_FIELDS], ["spending", SPENDING_FIELDS]]) {
    const container = $(`flow-${side}-inputs`);
    for (const { key, label } of fields) {
      const row = make(side === "spending" ? "div" : "label", "flow-input-row");
      const name = side === "spending" ? make("input", "flow-category-name") : make("span", "", label);
      name.id = `flow-${side}-${key}-label`;
      if (side === "spending") {
        name.type = "text"; name.maxLength = 48; name.value = flowDraft.spendingLabels?.[key] || label;
        name.dataset.flowSpendingLabel = key;
        name.setAttribute("aria-label", `Category name for ${label}`);
      }
      const moneyField = make("span", "flow-money-input");
      const input = make("input"); input.id = `flow-${side}-${key}`; input.type = "number"; input.min = "0"; input.max = "100000000"; input.step = "0.01"; input.inputMode = "decimal"; input.placeholder = "0";
      input.setAttribute("aria-label", `Monthly amount for ${label}`);
      input.dataset.flowSide = side; input.dataset.flowKey = key;
      moneyField.append(make("span", "", "£"), input);
      row.append(name, moneyField); container.append(row);
    }
  }
  const spendingFieldset = $("flow-spending-inputs").closest("fieldset");
  spendingFieldset.querySelector("legend").textContent = "Regular spending categories";
  spendingFieldset.insertBefore(make("p", "flow-category-help", "Rename a category, change its amount, or add your own. The monthly flow updates as you edit."), $("flow-spending-inputs"));
  const customList = make("div", "flow-custom-spending-list"); customList.id = "flow-custom-spending-list";
  spendingFieldset.append(customList);
  const customForm = make("form", "flow-custom-spending-form"); customForm.id = "flow-custom-spending-form";
  const customNameLabel = make("label", "", "Add a category");
  const customName = make("input"); customName.id = "flow-custom-spending-new-label"; customName.type = "text"; customName.maxLength = 48; customName.placeholder = "e.g. Holidays"; customName.required = true;
  customNameLabel.append(customName);
  const customAmountLabel = make("label", "", "Monthly amount");
  const customAmount = make("input"); customAmount.id = "flow-custom-spending-new-amount"; customAmount.type = "number"; customAmount.min = "0"; customAmount.max = "100000000"; customAmount.step = "0.01"; customAmount.inputMode = "decimal"; customAmount.value = "0";
  customAmountLabel.append(customAmount);
  const addCategory = make("button", "heading-action heading-action-secondary", "+ Add category"); addCategory.type = "submit";
  customForm.append(customNameLabel, customAmountLabel, addCategory);
  spendingFieldset.append(customForm);
}
function renderCustomSpendingInputs() {
  const container = $("flow-custom-spending-list");
  if (!container) return;
  const active = document.activeElement;
  const focusKind = active?.dataset.flowCustomSpendingLabel !== undefined ? "label" : active?.dataset.flowCustomSpendingAmount !== undefined ? "amount" : "";
  const focusId = active?.dataset.flowCustomSpendingLabel ?? active?.dataset.flowCustomSpendingAmount ?? "";
  const selectionStart = active?.selectionStart;
  const selectionEnd = active?.selectionEnd;
  container.replaceChildren();
  for (const category of flowDraft.customSpending || []) {
    const row = make("div", "flow-custom-spending-row");
    const name = make("input", "flow-category-name"); name.type = "text"; name.maxLength = 48; name.value = category.label;
    name.dataset.flowCustomSpendingLabel = category.id; name.setAttribute("aria-label", `Category name for ${category.label}`);
    const moneyField = make("span", "flow-money-input");
    const amount = make("input"); amount.type = "number"; amount.min = "0"; amount.max = "100000000"; amount.step = "0.01"; amount.inputMode = "decimal"; amount.value = category.amount ? String(category.amount) : "";
    amount.dataset.flowCustomSpendingAmount = category.id; amount.setAttribute("aria-label", `Monthly amount for ${category.label}`);
    moneyField.append(make("span", "", "£"), amount);
    const remove = make("button", "flow-custom-spending-remove", "Remove"); remove.type = "button"; remove.dataset.removeCustomSpending = category.id; remove.setAttribute("aria-label", `Remove ${category.label} category`);
    row.append(name, moneyField, remove); container.append(row);
  }
  if (!container.childElementCount) container.append(make("p", "flow-custom-spending-empty", "Add your own monthly category if the list above does not fit."));
  if (focusKind) {
    const selector = focusKind === "label" ? "[data-flow-custom-spending-label]" : "[data-flow-custom-spending-amount]";
    const target = [...container.querySelectorAll(selector)].find((input) => input.dataset[focusKind === "label" ? "flowCustomSpendingLabel" : "flowCustomSpendingAmount"] === focusId);
    target?.focus();
    if (target && selectionStart !== null && selectionStart !== undefined && target.setSelectionRange) target.setSelectionRange(selectionStart, selectionEnd);
  }
}
function syncFlowInputs() {
  editingFlowEntryId = null;
  $("flow-dated-form").hidden = true;
  for (const input of document.querySelectorAll("[data-flow-side]")) {
    const value = flowDraft[input.dataset.flowSide][input.dataset.flowKey];
    input.value = value ? String(value) : "";
  }
  for (const input of document.querySelectorAll("[data-flow-spending-label]")) input.value = flowDraft.spendingLabels?.[input.dataset.flowSpendingLabel] || SPENDING_FIELDS.find((field) => field.key === input.dataset.flowSpendingLabel)?.label || "Other spending";
  $("flow-custom-spending-new-label").value = "";
  $("flow-custom-spending-new-amount").value = "0";
  renderCustomSpendingInputs();
  for (const input of document.querySelectorAll("[data-flow-pay-owner]")) {
    const value = flowDraft.pay[input.dataset.flowPayOwner][input.dataset.flowPayKey];
    input.value = value || "";
  }
  $("flow-include-rent").checked = flowDraft.includeLinkedRent;
  $("flow-include-mortgage").checked = flowDraft.includeLinkedMortgage;
  $("flow-inflation-rate").value = flowDraft.assumptions.annualInflation ?? "";
  $("flow-income-growth").value = flowDraft.assumptions.incomeGrowthRate ?? "";
  for (const key of ["cash", "isa", "pension", "property", "shares"]) {
    const el = $(`flow-growth-${key}`);
    if (el) el.value = flowDraft.assumptions.assetGrowthRates?.[key] ?? "";
  }
  $("flow-reserve-months").value = flowDraft.assumptions.cashReserveMonths ?? DEFAULT_RESERVE_MONTHS;
  $("flow-isa-allowance").value = flowDraft.assumptions.isaAllowance ?? ISA_ALLOWANCE_2026_27;
  $("flow-isa-used-primary").value = flowDraft.assumptions.isaUsedPrimary ?? "";
  $("flow-isa-used-partner").value = flowDraft.assumptions.isaUsedPartner ?? "";
  $("flow-allocation-enabled").checked = flowDraft.assumptions.allocationEnabled === true;
  $("flow-trading-label").value = flowDraft.assumptions.tradingLabel ?? "";
  $("flow-primary-share").value = flowDraft.savings?.primaryShare ?? "";
}
function showScreen(screen) {
  $("canvas-screen").hidden = screen !== "assets";
  $("flow-screen").hidden = screen !== "flow";
  $("planning-screen").hidden = screen !== "planning";
  if (screen === "flow" || screen === "planning") {
    renderFlow();
    if (screen === "flow" && mode !== "example" && !summarizeMonthlyFlow(flowDraft, draft).hasEntries) { $("flow-pay-detail").open = true; }
  }
  (screen === "flow" ? $("flow-title") : screen === "planning" ? $("planning-title") : $("canvas-title")).focus();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function populateKinds(type, selected = "") {
  const select = $("item-kind");
  select.replaceChildren();
  const prompt = new Option(type === "asset" ? "Choose an asset" : "Choose a debt", "", true, !selected);
  prompt.disabled = true;
  select.add(prompt);
  for (const [kind, info] of Object.entries(type === "asset" ? ASSET_TYPES : DEBT_TYPES)) {
    select.add(new Option(info.label, kind, false, kind === selected));
  }
}

function populateOwners(type, selected = "primary") {
  const field = $("item-owner-field");
  const select = $("item-owner");
  field.hidden = !draft.partnerName?.trim();
  select.replaceChildren(new Option(draft.name, "primary"));
  if (!field.hidden) {
    select.add(new Option(draft.partnerName, "partner"));
    select.add(new Option("Shared", "shared"));
  }
  select.value = selected || "primary";
  $("item-owner-label").textContent = type === "asset" ? "Who owns it?" : "Who owes it?";
}

function populateLinks(selected = "") {
  const select = $("item-linked-asset");
  select.replaceChildren(new Option("No link", ""));
  const mortgage = $("item-kind").value === "mortgage";
  const options = draft.assets.filter((asset) => !mortgage || ["home", "other-property"].includes(asset.kind));
  for (const asset of options) select.add(new Option(itemName(asset, ASSET_TYPES), asset.id));
  select.value = options.some((asset) => asset.id === selected) ? selected : "";
  $("debt-link-field").hidden = dialogType !== "debt" || options.length === 0;
}

function updateDialogFields(selectedLink = "") {
  const mortgage = dialogType === "debt" && $("item-kind").value === "mortgage";
  $("mortgage-fields").hidden = !mortgage;
  $("rent-field").hidden = dialogType !== "asset" || !["home", "other-property"].includes($("item-kind").value);
  $("cash-rate-field").hidden = dialogType !== "asset" || $("item-kind").value !== "cash";
  $("investment-field").hidden = dialogType !== "asset" || !["isa", "dc-pension"].includes($("item-kind").value);
  $("access-bucket-field").hidden = dialogType !== "asset" || !["shares", "other"].includes($("item-kind").value);
  $("pension-access-field").hidden = dialogType !== "asset" || $("item-kind").value !== "dc-pension";
  $("item-amount-label").textContent = dialogType === "asset" ? "What is it worth today?" : "How much is still owed?";
  $("item-amount-help").textContent = dialogType === "asset" ? "Use the current value, not what you originally paid." : "Enter the outstanding balance, not the original loan or monthly payment.";
  if (dialogType === "debt") populateLinks(selectedLink);
}

function showItemDialog(type, id = null, trigger = null, initialKind = "", initialOwner = "primary") {
  dialogType = type;
  editingId = id;
  lastTrigger = trigger;
  const item = id ? draft[type === "asset" ? "assets" : "debts"].find((entry) => entry.id === id) : null;
  addOwner = item?.owner || initialOwner;
  $("item-form").reset();
  $("item-error").hidden = true;
  $("item-error").textContent = "";
  $("item-dialog-kicker").textContent = item ? "Edit a piece" : "A new piece";
  $("item-dialog-title").textContent = `${item ? "Edit" : "Add"} ${type === "asset" ? "an asset" : "a debt"}`;
  $("save-item-button").textContent = item ? "Save changes" : "Add to my picture";
  $("delete-item-button").hidden = !item;
  populateKinds(type, item?.kind || initialKind);
  populateOwners(type, item?.owner || initialOwner);
  $("item-label").value = item?.label || "";
  $("item-amount").value = item ? String(type === "asset" ? item.value : item.balance) : "";
  $("item-interest-rate").value = type === "debt" ? item?.interestRate ?? "" : "";
  $("item-monthly-payment").value = type === "debt" ? item?.monthlyPayment ?? "" : "";
  $("item-monthly-rent").value = item?.monthlyRent ?? "";
  $("item-cash-rate").value = type === "asset" ? item?.interestRate ?? "" : "";
  $("item-investment-label").value = item?.investmentLabel ?? "";
  $("item-remaining-years").value = item?.remainingYears ?? "";
  $("item-confidence").value = item?.confidence || "estimate";
  $("item-access-bucket").value = item?.accessBucket || "review";
  $("item-pension-access-age").value = item?.pensionAccessAge ?? "";
  $("mortgage-fields").open = Boolean(item?.interestRate !== undefined || item?.remainingYears !== undefined || item?.monthlyPayment !== undefined);
  updateDialogFields(item?.linkedAssetId);
  $("item-dialog").showModal();
  $(item || initialKind ? "item-amount" : "item-kind").focus();
}

function itemFromForm() {
  const kind = $("item-kind").value;
  const label = $("item-label").value.trim();
  const rawAmount = $("item-amount").value.trim();
  if (!kind) throw new Error("Choose what kind of item this is.");
  if (!rawAmount) throw new Error(dialogType === "asset" ? "Enter its current value." : "Enter the balance still owed.");
  const amount = Number(rawAmount);
  if (dialogType === "asset") {
    const asset = { id: editingId || createId("asset"), kind, label, value: amount, owner: $("item-owner").value || "primary", confidence: $("item-confidence").value };
    if (!$("access-bucket-field").hidden) asset.accessBucket = $("item-access-bucket").value;
    if (!$("pension-access-field").hidden && $("item-pension-access-age").value.trim()) asset.pensionAccessAge = Number($("item-pension-access-age").value);
    if (!$("rent-field").hidden && $("item-monthly-rent").value.trim()) asset.monthlyRent = Number($("item-monthly-rent").value);
    if (!$("cash-rate-field").hidden && $("item-cash-rate").value.trim()) asset.interestRate = Number($("item-cash-rate").value);
    if (!$("investment-field").hidden && $("item-investment-label").value.trim()) asset.investmentLabel = $("item-investment-label").value.trim();
    return asset;
  }
  const debt = { id: editingId || createId("debt"), kind, label, balance: amount, owner: $("item-owner").value || "primary", confidence: $("item-confidence").value };
  if (kind === "mortgage") {
    if ($("item-interest-rate").value.trim()) debt.interestRate = Number($("item-interest-rate").value);
    if ($("item-remaining-years").value.trim()) debt.remainingYears = Number($("item-remaining-years").value);
    if ($("item-monthly-payment").value.trim()) debt.monthlyPayment = Number($("item-monthly-payment").value);
  }
  if (!$("debt-link-field").hidden && $("item-linked-asset").value) debt.linkedAssetId = $("item-linked-asset").value;
  return debt;
}

function restoreFocus() { if (lastTrigger?.isConnected) lastTrigger.focus(); else document.querySelector(`[data-add-owner="${addOwner}"]`)?.focus(); }

$("welcome-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const candidate = { ...draft, name: $("person-name").value.trim(), age: Number($("person-age").value) };
  if (!candidate.name) { $("person-name").setCustomValidity("Enter a name or nickname."); $("person-name").reportValidity(); return; }
  const validation = validateDraft(candidate);
  if (!validation.valid) { $("person-age").setCustomValidity(validation.errors[0].message); $("person-age").reportValidity(); return; }
  draft = candidate;
  mode = "personal";
  $("welcome-screen").hidden = true;
  $("canvas-screen").hidden = false;
  render();
  $("canvas-title").focus?.();
  announce(`${draft.name}’s picture is ready. No assets or debts entered yet.`);
});
for (const id of ["person-name", "person-age"]) $(id).addEventListener("input", () => $(id).setCustomValidity(""));

$("first-piece-add").addEventListener("click", (event) => showAddChoices("primary", event.currentTarget, true));
$("first-piece").addEventListener("click", (event) => {
  const choice = event.target.closest("[data-first-kind]");
  if (choice) showItemDialog("asset", null, choice, choice.dataset.firstKind);
});
for (const id of ["step-to-flow", "continue-flow", "planning-to-flow"]) $(id).addEventListener("click", () => showScreen("flow"));
for (const id of ["step-to-assets", "back-to-assets", "planning-to-assets"]) $(id).addEventListener("click", () => showScreen("assets"));
for (const id of ["assets-to-planning", "flow-to-planning", "continue-planning"]) $(id).addEventListener("click", () => showScreen("planning"));
$("flow-month").addEventListener("change", (event) => {
  const month = event.currentTarget.value;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < (flowDraft.timelineStartMonth || flowDraft.asOfMonth)) return;
  flowDraft.asOfMonth = month; renderFlow();
});
$("flow-timeline-events").addEventListener("click", (event) => {
  const marker = event.target.closest("[data-flow-month]");
  if (marker) { flowDraft.asOfMonth = marker.dataset.flowMonth; renderFlow(); document.querySelector(`[data-flow-month="${flowDraft.asOfMonth}"]`)?.focus(); }
});
$("flow-primary-share").addEventListener("input", (event) => {
  const raw = event.currentTarget.value.trim();
  const value = raw === "" ? null : Number(raw);
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) { event.currentTarget.setCustomValidity("Enter a percentage from 0 to 100."); return; }
  event.currentTarget.setCustomValidity("");
  flowDraft.savings ||= { primaryShare: null };
  flowDraft.savings.primaryShare = value;
  renderFlow();
});
function setFlowView(view) {
  const table = view === "table";
  const bridge = view === "bridge";
  const sunburst = view === "sunburst";
  const treemap = view === "treemap";
  const donut = view === "donut";
  if (flowChartPath.length) {
    flowChartPath = [];
    const diagram = buildMonthlyFlowDiagram(flowDraft, draft, { primary: draft.name, partner: draft.partnerName });
    renderSunburst(diagram); renderTreemap(diagram); renderDrillDonut(diagram);
  }
  $("flow-diagram-view").hidden = table || bridge || sunburst || treemap || donut;
  $("flow-bridge-view").hidden = !bridge;
  $("flow-sunburst-view").hidden = !sunburst;
  $("flow-treemap-view").hidden = !treemap;
  $("flow-donut-view").hidden = !donut;
  $("flow-table-view").hidden = !table;
  $("flow-view-diagram").setAttribute("aria-pressed", String(view === "diagram"));
  $("flow-view-bridge").setAttribute("aria-pressed", String(bridge));
  $("flow-view-sunburst").setAttribute("aria-pressed", String(sunburst));
  $("flow-view-treemap").setAttribute("aria-pressed", String(treemap));
  $("flow-view-donut").setAttribute("aria-pressed", String(donut));
  $("flow-view-table").setAttribute("aria-pressed", String(table));
  $("flow-view-help").textContent = table
    ? "Exact monthly averages from the same entries, including estimated payroll deductions. Use Edit to change a figure."
    : bridge ? "Follow the calculation, then open a spending group to see its entries. Saving is the amount left after spending."
    : sunburst ? "Each ring shows a deeper level. Select a ring to focus on its children."
      : treemap ? "Rectangle size shows each amount's share. Select a section to open its detail."
        : donut ? "Select a slice to open its next level. Use the breadcrumb or Back to return."
          : "Read left to right: gross pay splits into deductions and take-home; other income joins it before spending and saving. Wider flows mean larger monthly amounts.";
}
$("flow-view-diagram").addEventListener("click", () => setFlowView("diagram"));
$("flow-view-bridge").addEventListener("click", () => setFlowView("bridge"));
$("flow-view-sunburst").addEventListener("click", () => setFlowView("sunburst"));
$("flow-view-treemap").addEventListener("click", () => setFlowView("treemap"));
$("flow-view-donut").addEventListener("click", () => setFlowView("donut"));
$("flow-view-table").addEventListener("click", () => setFlowView("table"));
organizeFlowInputs();
$("flow-editor").addEventListener("input", (event) => {
  const input = event.target.closest("[data-flow-side], [data-flow-pay-owner], [data-flow-spending-label], [data-flow-custom-spending-label], [data-flow-custom-spending-amount]");
  if (!input) return;
  if (input.dataset.flowSpendingLabel !== undefined) {
    flowDraft.spendingLabels ||= {};
    if (input.value.trim()) flowDraft.spendingLabels[input.dataset.flowSpendingLabel] = input.value.trim();
    renderFlow(); return;
  }
  if (input.dataset.flowCustomSpendingLabel !== undefined) {
    const category = flowDraft.customSpending.find((row) => row.id === input.dataset.flowCustomSpendingLabel);
    if (category && input.value.trim()) category.label = input.value.trim();
    renderFlow(); return;
  }
  if (input.dataset.flowCustomSpendingAmount !== undefined) {
    const category = flowDraft.customSpending.find((row) => row.id === input.dataset.flowCustomSpendingAmount);
    const value = input.value.trim() ? Number(input.value) : 0;
    if (!category || !Number.isFinite(value) || value < 0 || value > 100_000_000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.001) return;
    category.amount = value;
    renderFlow(); return;
  }
  if (input.dataset.flowPayKey === "endDate") { flowDraft.pay[input.dataset.flowPayOwner].endDate = input.value; renderFlow(); return; }
  const value = input.value.trim() === "" ? (input.dataset.flowPayKey === "annualTakeHome" ? null : 0) : Number(input.value);
  const maximum = input.dataset.flowPayKey?.endsWith("Rate") ? 100 : 100_000_000;
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > maximum || Math.abs(value * 100 - Math.round(value * 100)) > 0.001)) {
    $("flow-input-error").textContent = maximum === 100 ? "Enter a pension contribution rate from 0% to 100%." : "Enter an amount from £0 to £100,000,000, with no more than two decimal places.";
    $("flow-input-error").hidden = false;
    return;
  }
  $("flow-input-error").hidden = true;
  if (input.dataset.flowPayOwner) {
    const pay = flowDraft.pay[input.dataset.flowPayOwner];
    const key = input.dataset.flowPayKey; pay[key] = value;
    if (value && ["employeePension", "employeePensionRate", "employerPension", "employerPensionRate"].includes(key)) {
      const paired = key.endsWith("Rate") ? key.slice(0, -4) : `${key}Rate`;
      pay[paired] = 0; $(`flow-pay-${input.dataset.flowPayOwner}-${paired}`).value = "";
    }
  }
  else flowDraft[input.dataset.flowSide][input.dataset.flowKey] = value;
  renderFlow();
});
$("flow-editor").addEventListener("change", (event) => {
  const input = event.target.closest("[data-flow-spending-label], [data-flow-custom-spending-label]");
  if (!input || input.value.trim()) return;
  if (input.dataset.flowSpendingLabel !== undefined) {
    const original = SPENDING_FIELDS.find((field) => field.key === input.dataset.flowSpendingLabel)?.label || "Other spending";
    input.value = flowDraft.spendingLabels?.[input.dataset.flowSpendingLabel] || original;
  } else {
    input.value = flowDraft.customSpending.find((row) => row.id === input.dataset.flowCustomSpendingLabel)?.label || "";
  }
});
$("flow-editor").addEventListener("submit", (event) => {
  if (event.target.id !== "flow-custom-spending-form") return;
  event.preventDefault();
  const label = $("flow-custom-spending-new-label").value.trim();
  const rawAmount = $("flow-custom-spending-new-amount").value.trim();
  const amount = Number(rawAmount);
  try {
    if (!label || !rawAmount || !Number.isFinite(amount) || amount < 0 || amount > 100_000_000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.001) throw new RangeError("Enter a category name and a monthly amount up to £100,000,000.");
    const category = { id: createId("spend"), label, amount };
    summarizeMonthlyFlow({ ...flowDraft, customSpending: [...(flowDraft.customSpending || []), category] }, draft);
    flowDraft.customSpending ||= [];
    flowDraft.customSpending.push(category);
    $("flow-custom-spending-new-label").value = "";
    $("flow-custom-spending-new-amount").value = "0";
    renderFlow();
    $(`[data-flow-custom-spending-label="${category.id}"]`)?.focus();
    announce(`${category.label} added to regular spending.`);
  } catch (error) {
    $("flow-input-error").textContent = error.message;
    $("flow-input-error").hidden = false;
  }
});
$("flow-editor").addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove-custom-spending]");
  if (!remove) return;
  flowDraft.customSpending = flowDraft.customSpending.filter((row) => row.id !== remove.dataset.removeCustomSpending);
  renderFlow();
  announce("Spending category removed.");
});
$("flow-include-rent").addEventListener("change", (event) => {
  flowDraft.includeLinkedRent = event.currentTarget.checked;
  renderFlow();
});
$("flow-inflation-rate").addEventListener("input", (event) => {
  const value = event.currentTarget.value.trim();
  const valid = value === "" || (Number.isFinite(Number(value)) && Number(value) >= -30 && Number(value) <= 30);
  $("flow-input-error").hidden = valid;
  if (valid) flowDraft.assumptions.annualInflation = value === "" ? null : Number(value);
  else $("flow-input-error").textContent = "Enter an annual inflation assumption from -30% to 30%.";
  if (valid) renderFlow();
});
for (const key of ["cash", "isa", "pension", "property", "shares"]) {
  const el = $(`flow-growth-${key}`);
  if (el) el.addEventListener("input", (event) => {
    const value = event.currentTarget.value.trim();
    const valid = value === "" || (Number.isFinite(Number(value)) && Number(value) >= -30 && Number(value) <= 30);
    $("flow-input-error").hidden = valid;
    if (valid) {
      if (!flowDraft.assumptions.assetGrowthRates) flowDraft.assumptions.assetGrowthRates = {};
      flowDraft.assumptions.assetGrowthRates[key] = value === "" ? null : Number(value);
      renderFlow();
    } else $("flow-input-error").textContent = `Enter a ${key} growth rate from -30% to 30%.`;
  });
}
$("flow-income-growth").addEventListener("input", (event) => {
  const value = event.currentTarget.value.trim();
  const valid = value === "" || (Number.isFinite(Number(value)) && Number(value) >= -30 && Number(value) <= 30);
  $("flow-input-error").hidden = valid;
  if (valid) { flowDraft.assumptions.incomeGrowthRate = value === "" ? null : Number(value); renderFlow(); }
  else $("flow-input-error").textContent = "Enter an annual income growth rate from -30% to 30%.";
});
function updateAllocation(key, value) {
  const candidate = structuredClone(flowDraft);
  candidate.assumptions[key] = value;
  try {
    computeAllocationWaterfall(candidate, draft, { primary: draft.name, partner: draft.partnerName });
    flowDraft.assumptions[key] = value;
    $("flow-allocation-error").hidden = true;
    renderFlow();
  } catch (error) {
    $("flow-allocation-error").textContent = error.message;
    $("flow-allocation-error").hidden = false;
  }
}
$("flow-allocation-enabled").addEventListener("change", (event) => updateAllocation("allocationEnabled", event.currentTarget.checked));
for (const [id, key, integer] of [["flow-reserve-months", "cashReserveMonths", true], ["flow-isa-allowance", "isaAllowance", false], ["flow-isa-used-primary", "isaUsedPrimary", false], ["flow-isa-used-partner", "isaUsedPartner", false]]) {
  $(id).addEventListener("input", (event) => {
    const raw = event.currentTarget.value.trim();
    const value = raw === "" ? null : Number(raw);
    if (raw !== "" && (!Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value)))) {
      $("flow-allocation-error").textContent = "Enter a valid non-negative amount.";
      $("flow-allocation-error").hidden = false;
      return;
    }
    updateAllocation(key, value);
  });
}
$("flow-trading-label").addEventListener("input", (event) => updateAllocation("tradingLabel", event.currentTarget.value));
$("flow-include-mortgage").addEventListener("change", (event) => {
  flowDraft.includeLinkedMortgage = event.currentTarget.checked;
  renderFlow();
});
function showDatedForm(side, id = null, trigger = null) {
  $("flow-more-entries").open = true;
  const entry = flowDraft.datedEntries.find((item) => item.id === id);
  flowDatedRequireStart = entry?.label === "State Pension";
  editingFlowEntryId = entry?.id || null;
  flowEntryTrigger = trigger;
  $("flow-dated-side").value = entry?.side || side;
  $("flow-dated-label").value = entry?.label || "";
  $("flow-dated-amount").value = entry?.amount ?? "";
  $("flow-dated-frequency").value = entry?.frequency || "monthly";
  $("flow-dated-start").value = entry?.startMonth || "";
  $("flow-dated-end").value = entry?.endMonth || "";
  syncDatedFrequency();
  $("flow-dated-start").required = flowDatedRequireStart;
  if (flowDatedRequireStart) $("flow-dated-start-hint").textContent = "Required";
  $("flow-dated-form-title").textContent = `${entry ? "Edit" : "Add"} ${$("flow-dated-side").value === "income" ? "income" : "expense"}`;
  $("flow-dated-delete").hidden = !entry;
  $("flow-dated-error").hidden = true;
  $("flow-dated-form").hidden = false;
  $("flow-dated-label").focus();
  $("flow-dated-form").scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
$("flow-add-income").addEventListener("click", (event) => showDatedForm("income", null, event.currentTarget));
$("flow-add-expense").addEventListener("click", (event) => showDatedForm("spending", null, event.currentTarget));
$("flow-add-state-pension").addEventListener("click", (event) => {
  showDatedForm("income", null, event.currentTarget);
  flowDatedRequireStart = true;
  $("flow-dated-label").value = "State Pension";
  $("flow-dated-start").required = true;
  $("flow-dated-start-hint").textContent = "Required";
  $("flow-dated-form-title").textContent = "Add State Pension";
});
$("flow-dated-side").addEventListener("change", () => {
  $("flow-dated-form-title").textContent = `${editingFlowEntryId ? "Edit" : "Add"} ${$("flow-dated-side").value === "income" ? "income" : "expense"}`;
});
function syncDatedFrequency() {
  const once = $("flow-dated-frequency").value === "once";
  $("flow-dated-end-row").hidden = once;
  $("flow-dated-start-hint").textContent = once || flowDatedRequireStart ? "Required" : "Optional";
  if (once) $("flow-dated-end").value = "";
}
$("flow-dated-frequency").addEventListener("change", syncDatedFrequency);
$("flow-dated-list").addEventListener("click", (event) => {
  const row = event.target.closest("[data-flow-entry]");
  if (row) showDatedForm("income", row.dataset.flowEntry, row);
});
$("flow-entry-overview").addEventListener("click", (event) => {
  const pay = event.target.closest("[data-flow-pay]");
  const regular = event.target.closest("[data-flow-regular]");
  if (!pay && !regular) return;
  const otherIncome = regular?.dataset.flowRegular === "income";
  $(pay || otherIncome ? "flow-pay-detail" : "flow-spending-detail").open = true;
  const target = pay ? $(`flow-pay-${pay.dataset.flowPay}-annualGross`) : otherIncome ? $("flow-income-pensionIncome") : $("flow-spending-homeBills");
  target.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  target.focus();
});
$("flow-dated-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const amount = Number($("flow-dated-amount").value);
    if (!$("flow-dated-label").value.trim() || !$("flow-dated-amount").value.trim() || !Number.isFinite(amount) || amount <= 0)
      throw new RangeError("Give this entry a name and an amount greater than £0.");
    if (flowDatedRequireStart && !$("flow-dated-start").value) throw new RangeError("Choose the month when State Pension begins.");
    const entry = { id: editingFlowEntryId || createId("entry"), side: $("flow-dated-side").value, label: $("flow-dated-label").value.trim(), amount, frequency: $("flow-dated-frequency").value, startMonth: $("flow-dated-start").value, endMonth: $("flow-dated-end").value };
    const entries = flowDraft.datedEntries.filter((item) => item.id !== editingFlowEntryId).concat(entry);
    summarizeMonthlyFlow({ ...flowDraft, datedEntries: entries }, draft);
    flowDraft.datedEntries = entries;
    editingFlowEntryId = null;
    $("flow-dated-form").hidden = true;
    renderFlow();
    document.querySelector(`#flow-dated-list [data-flow-entry="${entry.id}"]`)?.focus();
    announce(`${entry.label} saved to income and spending.`);
  } catch (error) {
    $("flow-dated-error").textContent = error.message;
    $("flow-dated-error").hidden = false;
  }
});
$("flow-dated-cancel").addEventListener("click", () => {
  $("flow-dated-form").hidden = true;
  if (flowEntryTrigger?.isConnected) flowEntryTrigger.focus();
});
$("flow-dated-delete").addEventListener("click", () => {
  if (!editingFlowEntryId) return;
  flowDraft.datedEntries = flowDraft.datedEntries.filter((entry) => entry.id !== editingFlowEntryId);
  editingFlowEntryId = null;
  $("flow-dated-form").hidden = true;
  renderFlow();
  $("flow-add-expense").focus();
  announce("Dated entry removed from the picture.");
});
function editLinkedAsset(id, trigger) {
  const asset = draft.assets.find((entry) => entry.id === id);
  if (!asset) return;
  openOwners.add(asset.owner || "primary");
  openCategories.add(`${asset.owner || "primary"}:illiquid`);
  renderOrbit(summarizeDraft(draft));
  showScreen("assets");
  returnToFlowAssetId = id;
  showItemDialog("asset", id, trigger);
}
for (const id of ["flow-source-list", "flow-use-list", "flow-rent-list", "flow-mortgage-list"]) $(id).addEventListener("click", (event) => {
  const saving = event.target.closest("[data-flow-saving]");
  if (saving) { $("flow-split").open = true; $("flow-primary-share").focus(); return; }
  const entry = event.target.closest("[data-flow-entry]");
  if (entry) { showDatedForm("income", entry.dataset.flowEntry, entry); return; }
  const pay = event.target.closest("[data-flow-pay]");
  if (pay) { $("flow-pay-detail").open = true; $(`flow-pay-${pay.dataset.flowPay}-annualTakeHome`).focus(); return; }
  const custom = event.target.closest("[data-flow-custom-spending]");
  if (custom) {
    $("flow-spending-detail").open = true;
    const target = [...document.querySelectorAll("[data-flow-custom-spending-amount]")].find((input) => input.dataset.flowCustomSpendingAmount === custom.dataset.flowCustomSpending);
    target?.focus();
    target?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    return;
  }
  const debt = event.target.closest("[data-flow-debt]");
  if (debt) { showScreen("assets"); returnToFlowAssetId = debt.dataset.flowDebt; showItemDialog("debt", debt.dataset.flowDebt, debt); return; }
  const asset = event.target.closest("[data-flow-asset]");
  if (asset) { editLinkedAsset(asset.dataset.flowAsset, asset); return; }
  const item = event.target.closest("[data-flow-focus]");
  if (!item) return;
  const [side, key] = item.dataset.flowFocus.split(":");
  $(side === "income" ? "flow-pay-detail" : "flow-spending-detail").open = true;
  $(`flow-${side}-${key}`).focus();
  $("flow-editor").scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});
$("add-choices").addEventListener("click", (event) => {
  const button = event.target.closest("[data-quick-kind]");
  if (button) {
    $("add-dialog").close();
    showItemDialog(button.dataset.quickType, null, addTrigger, button.dataset.quickKind, addOwner);
  }
});
$("close-add-button").addEventListener("click", () => $("add-dialog").close());
$("add-dialog").addEventListener("close", () => { if (!$("item-dialog").open && addTrigger?.isConnected) addTrigger.focus(); });
$("access-review-items").addEventListener("click", (event) => {
  const button = event.target.closest("[data-review-id]");
  if (button) showItemDialog("asset", button.dataset.reviewId, button);
});
$("orbit-items").addEventListener("click", (event) => {
  const categorySummary = event.target.closest(".bucket-cell > summary");
  if (categorySummary) {
    const category = categorySummary.parentElement;
    if (category.open) openCategories.delete(category.dataset.ownerBucket);
    else openCategories.add(category.dataset.ownerBucket);
    return;
  }
  const summary = event.target.closest(".owner-details > summary");
  if (summary) {
    const details = summary.parentElement;
    if (details.open) openOwners.delete(details.dataset.ownerDetails);
    else openOwners.add(details.dataset.ownerDetails);
    return;
  }
  const add = event.target.closest("[data-add-owner]");
  if (add) { showAddChoices(add.dataset.addOwner, add); return; }
  const button = event.target.closest("[data-orbit-id]");
  if (button) showItemDialog(button.dataset.orbitType, button.dataset.orbitId, button);
});
document.querySelector(".explore-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-chart-view]");
  if (!button) return;
  chartView = button.dataset.chartView;
  chartSelection = null;
  const summary = summarizeDraft(draft);
  renderChart(summary);
  renderOrbit(summary);
});
function chooseChartCategory(key) {
  chartSelection = chartSelection === key ? null : key;
  if (chartView === "owner" && chartSelection) openOwners.add(chartSelection);
  renderChart(summarizeDraft(draft));
  const scrollBehaviour = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  if (chartView === "owner") {
    renderOrbit(summarizeDraft(draft));
    if (chartSelection) document.querySelector(`[data-owner-group="${chartSelection}"]`)?.scrollIntoView({ block: "center", behavior: scrollBehaviour });
  } else if (chartSelection) $("chart-drilldown").scrollIntoView({ block: "nearest", behavior: scrollBehaviour });
}
$("chart-categories").addEventListener("click", (event) => {
  const add = event.target.closest("[data-chart-add]");
  if (add) { showItemDialog("asset", null, add); return; }
  const button = event.target.closest("[data-chart-key]");
  if (button) chooseChartCategory(button.dataset.chartKey);
});
$("asset-donut").addEventListener("click", (event) => {
  const slice = event.target.closest("[data-chart-key]");
  if (slice) chooseChartCategory(slice.dataset.chartKey);
});
$("asset-donut").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const slice = event.target.closest("[data-chart-key]");
  if (slice) { event.preventDefault(); chooseChartCategory(slice.dataset.chartKey); }
});
$("chart-drilldown").addEventListener("click", (event) => {
  if (event.target.closest("[data-chart-back]")) { chartSelection = null; renderChart(summarizeDraft(draft)); return; }
  const item = event.target.closest("[data-drill-id]");
  if (item) showItemDialog(item.dataset.drillType, item.dataset.drillId, item);
});
$("item-kind").addEventListener("change", () => updateDialogFields());
$("close-item-button").addEventListener("click", () => $("item-dialog").close());
$("item-dialog").addEventListener("close", () => {
  if (returnToFlowAssetId) {
    const itemId = returnToFlowAssetId;
    returnToFlowAssetId = null;
    showScreen("flow");
    document.querySelector(`[data-flow-asset="${itemId}"], [data-flow-debt="${itemId}"]`)?.focus();
  } else restoreFocus();
});
$("item-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const item = itemFromForm();
    const key = dialogType === "asset" ? "assets" : "debts";
    const next = { ...draft, assets: [...draft.assets], debts: [...draft.debts] };
    const index = next[key].findIndex((entry) => entry.id === editingId);
    if (index >= 0) next[key][index] = item;
    else next[key].push(item);
    if (key === "assets" && index >= 0 && !["home", "other-property"].includes(item.kind)) {
      next.debts = next.debts.map((debt) => debt.kind === "mortgage" && debt.linkedAssetId === item.id ? { ...debt, linkedAssetId: undefined } : debt);
    }
    const check = validateDraft(next);
    if (!check.valid) throw new Error(check.errors[0].message);
    draft = next;
    $("item-dialog").close();
    render();
    announce(`${itemName(item, dialogType === "asset" ? ASSET_TYPES : DEBT_TYPES)} ${index >= 0 ? "updated" : "added"}. Net worth from entries ${money(summarizeDraft(draft).netWorth)}.`);
  } catch (error) {
    $("item-error").textContent = error.message;
    $("item-error").hidden = false;
  }
});
$("delete-item-button").addEventListener("click", () => {
  if (!editingId) return;
  const key = dialogType === "asset" ? "assets" : "debts";
  const item = draft[key].find((entry) => entry.id === editingId);
  if (!item) return;
  draft[key] = draft[key].filter((entry) => entry.id !== editingId);
  if (key === "assets") draft.debts = draft.debts.map((debt) => debt.linkedAssetId === editingId ? { ...debt, linkedAssetId: undefined } : debt);
  $("item-dialog").close();
  render();
  announce(`${itemName(item, dialogType === "asset" ? ASSET_TYPES : DEBT_TYPES)} removed. Net worth from entries ${money(summarizeDraft(draft).netWorth)}.`);
});

$("edit-profile-button").addEventListener("click", () => {
  $("profile-name").value = draft.name;
  $("profile-age").value = draft.age;
  $("profile-partner").value = draft.partnerName || "";
  $("profile-dialog").showModal();
  $("profile-name").focus();
});
$("close-profile-button").addEventListener("click", () => $("profile-dialog").close());
$("profile-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const candidate = { ...draft, name: $("profile-name").value.trim(), age: Number($("profile-age").value), partnerName: $("profile-partner").value.trim() };
  if (!candidate.name) {
    $("profile-name").setCustomValidity("Enter a name or nickname.");
    $("profile-name").reportValidity();
    return;
  }
  const check = validateDraft(candidate);
  if (!check.valid) {
    const field = check.errors[0].path === "name" ? $("profile-name") : check.errors[0].path === "age" ? $("profile-age") : $("profile-partner");
    field.setCustomValidity(check.errors[0].message);
    field.reportValidity();
    return;
  }
  draft = candidate;
  $("profile-dialog").close();
  render();
  announce("People in the picture updated.");
});
for (const id of ["profile-name", "profile-age", "profile-partner"]) $(id).addEventListener("input", () => $(id).setCustomValidity(""));

$("clear-button").addEventListener("click", () => $("clear-dialog").showModal());
$("start-own-button").addEventListener("click", () => {
  $("clear-dialog").showModal();
});
$("reset-example-button").addEventListener("click", () => {
  draft = createAlexExample();
  flowDraft = createExampleMonthlyFlow();
  syncFlowInputs();
  chartSelection = null;
  openOwners.clear();
  openCategories.clear();
  render();
  announce("Alex and Gemma’s fictional example has been reset.");
});
for (const id of ["close-clear-button", "cancel-clear-button"]) $(id).addEventListener("click", () => $("clear-dialog").close());
$("confirm-clear-button").addEventListener("click", () => {
  draft = createBlankDraft();
  flowDraft = createBlankMonthlyFlow();
  syncFlowInputs();
  mode = "personal";
  editingId = null;
  lastTrigger = null;
  addTrigger = null;
  returnToFlowAssetId = null;
  addOwner = "primary";
  chartSelection = null;
  openOwners.clear();
  openCategories.clear();
  $("clear-dialog").close();
  $("welcome-form").reset();
  $("profile-form").reset();
  $("item-form").reset();
  $("orbit-items").replaceChildren();
  $("chart-categories").replaceChildren();
  $("chart-drilldown").replaceChildren();
  $("asset-donut").querySelectorAll("circle").forEach((circle) => circle.remove());
  $("donut-total").textContent = "£0";
  $("access-review-items").replaceChildren();
  $("access-review-count").textContent = "";
  $("access-review").open = false;
  $("access-review").hidden = true;
  $("add-choices").replaceChildren();
  $("add-dialog-title").textContent = "Add a piece";
  $("item-linked-asset").replaceChildren();
  $("item-kind").replaceChildren();
  $("item-owner").replaceChildren();
  $("asset-total").textContent = "£0";
  $("debt-total").textContent = "£0";
  $("net-worth").textContent = "£0";
  $("accessible-total").textContent = "£0";
  $("asset-count").textContent = "Nothing entered yet";
  $("debt-count").textContent = "Nothing entered yet";
  $("person-heading").textContent = "Your";
  $("example-badge").textContent = "Your money picture";
  $("snapshot-description").textContent = "A snapshot from what you’ve entered. Add or change a piece whenever you like.";
  $("canvas-screen").hidden = true;
  $("flow-screen").hidden = true;
  $("planning-screen").hidden = true;
  $("welcome-screen").hidden = false;
  $("person-name").focus();
  announce("Your name, age, assets and debts have been cleared from this tab.");
});

function organizeFlowInputs() {
  const panel = $("flow-dated-panel");
  panel.querySelector(".section-kicker").textContent = "Future and linked entries";
  $("flow-dated-title").textContent = "Add a change over time";
  panel.querySelector(".flow-dated-heading p:last-child").textContent = "Add an income or cost with its own start and end month, or include rent and mortgage details from assets.";
  const oldEditor = $("flow-editor");
  const editor = document.createElement("section");
  editor.id = "flow-editor";
  editor.className = "flow-editor";
  editor.setAttribute("aria-labelledby", "flow-editor-title");
  const oldSummary = oldEditor.querySelector(":scope > summary");
  oldSummary?.remove();
  while (oldEditor.firstChild) editor.append(oldEditor.firstChild);
  oldEditor.replaceWith(editor);
  const editorHeading = make("div", "flow-editor-heading");
  editorHeading.append(make("h3", "", "Edit the amounts in this picture"), make("p", "", "The figures here feed the monthly flow. Changes update it immediately."));
  editorHeading.querySelector("h3").id = "flow-editor-title";
  const payDetail = document.createElement("details");
  payDetail.id = "flow-pay-detail";
  payDetail.className = "flow-editor-part";
  payDetail.innerHTML = "<summary>Pay and other income <span>Yearly pay, pensions and monthly income</span></summary>";
  const spendingDetail = document.createElement("details");
  spendingDetail.id = "flow-spending-detail";
  spendingDetail.className = "flow-editor-part";
  spendingDetail.innerHTML = "<summary>Spending categories <span>Rename, add or remove categories and edit monthly amounts</span></summary>";
  payDetail.addEventListener("toggle", () => { if (payDetail.open) spendingDetail.open = false; });
  spendingDetail.addEventListener("toggle", () => { if (spendingDetail.open) payDetail.open = false; });
  const grid = editor.querySelector(".flow-edit-grid");
  const incomeGuidance = editor.querySelector(":scope > p:last-child");
  incomeGuidance.className = "flow-input-guidance";
  payDetail.append(editor.querySelector(".flow-pay-section"), grid.firstElementChild, incomeGuidance);
  spendingDetail.append(grid.firstElementChild);
  grid.replaceWith(payDetail, spendingDetail);
  editor.prepend(editorHeading);
  $("flow-entry-overview").after(editor);

  const extras = document.createElement("details");
  extras.id = "flow-more-entries";
  extras.className = "flow-progressive";
  extras.innerHTML = '<summary><span><strong>Future entries and property cash flows</strong><small>Add income or expenses with dates, or include rent and mortgage payments</small></span><span class="flow-progressive-chevron" aria-hidden="true">⌄</span></summary><div class="flow-progressive-body"></div>';
  panel.after(extras);
  const extrasBody = extras.querySelector(".flow-progressive-body");
  extrasBody.append(panel.querySelector(".flow-dated-actions"), $("flow-dated-list"), $("flow-dated-empty"), $("flow-dated-form"), $("flow-link-panel"));
  const extrasIntro = document.createElement("p");
  extrasIntro.className = "flow-progressive-intro";
  extrasIntro.innerHTML = 'Entries active in <span id="flow-dated-asof">this month</span> affect the picture. Add a future start or end month, then visit it on the timeline above.';
  extrasBody.prepend(extrasIntro);
  panel.querySelector("#flow-dated-asof")?.remove();

  $("planning-content").append($("flow-allocation-panel"), $("flow-growth-panel"));
}

setupFlowInputs();
syncFlowInputs();
render();
$("canvas-screen").hidden = false;
