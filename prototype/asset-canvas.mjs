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
function flowColor(item) { return flowColors[item.bucket] || flowColors[item.key] || flowColors[item.kind] || "#78916d"; }
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
  for (let index = 1; index < labels.length; index++) labels[index] = Math.max(labels[index], labels[index - 1] + 25);
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
  const chartHeight = Math.max(430, 120 + Math.max(summary.sources.length, summary.uses.length) * 36);
  const centreHeight = chartHeight - 160;
  svg.setAttribute("viewBox", `0 0 1050 ${chartHeight}`);
  const scale = centreHeight / summary.chartTotal;
  const left = flowPositions(summary.sources, scale, chartHeight);
  const right = flowPositions(summary.uses, scale, chartHeight);
  const addText = (x, y, label, anchor = "start", className = "flow-svg-label") => {
    const node = svgElement("text", { x, y, "text-anchor": anchor, class: className });
    node.textContent = label;
    svg.append(node);
  };
  addText(218, 30, "PAY & MONEY IN", "end", "flow-svg-heading");
  addText(500, 30, "MONTHLY AVERAGE", "middle", "flow-svg-heading");
  addText(780, 30, "OUTGOINGS & SAVING", "start", "flow-svg-heading");
  let centreY = 80;
  for (const item of left) {
    const path = svgElement("path", { d: flowBand(230, item.y, 492, centreY, item.height), fill: flowColor(item), class: "flow-ribbon flow-ribbon-in" });
    const title = svgElement("title"); title.textContent = `${item.label}: ${money(item.amount)} per month`;
    path.append(title); svg.append(path);
    centreY += item.height;
  }
  centreY = 80;
  for (const item of right) {
    const path = svgElement("path", { d: flowBand(508, centreY, 750, item.y, item.height), fill: flowColor(item), class: "flow-ribbon flow-ribbon-out" });
    const title = svgElement("title"); title.textContent = `${item.label}: ${money(item.amount)} per month`;
    path.append(title); svg.append(path);
    centreY += item.height;
  }
  svg.append(svgElement("rect", { x: 492, y: 80, width: 16, height: centreHeight, rx: 6, fill: "#315b4d" }));
  for (const [items, x, labelX, anchor] of [[left, 230, 202, "end"], [right, 750, 780, "start"]]) {
    const labelY = labelPositions(items, chartHeight);
    items.forEach((item, index) => {
      svg.append(svgElement("rect", { x, y: item.y, width: 14, height: Math.max(3, item.height), rx: 3, fill: flowColor(item) }));
      const glyph = svgElement("g", { transform: `translate(${anchor === "end" ? 208 : 760} ${labelY[index] - 10}) scale(.66)`, fill: "none", stroke: flowColor(item), "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
      glyph.append(svgElement("path", { d: flowIconPath(item) })); svg.append(glyph);
      const chartName = item.key === "unallocated" ? "To assign" : item.key === "gap" ? "Gap" : item.kind === "tax" ? `${item.label.split(" ")[0]} tax` : item.kind === "nationalInsurance" ? `${item.label.split(" ")[0]} NI` : item.kind === "pensionContribution" ? `${item.label.split(" ")[0]} pension` : item.kind === "saving" ? `${item.label.split(" ")[0]} saving` : item.kind === "mortgage" ? "Mortgage" : item.kind === "rent" ? "Rent" : item.key === "homeBills" ? "Home & bills" : item.key === "everyday" ? "Everyday" : item.key === "other" ? "Other" : item.key === "pensionIncome" ? "Pension" : item.key === "otherIncome" ? "Other income" : item.key === "primaryPay" || item.key === "partnerPay" ? `${item.label.split("’")[0].split("'")[0]} gross` : item.label.length > 10 ? `${item.label.slice(0, 9)}…` : item.label;
      addText(labelX, labelY[index] + 5, `${chartName} · ${money(item.amount)}`, anchor);
    });
  }
}
function flowListItem(item, side) {
  const payOwner = item.key === "primaryPay" ? "primary" : item.key === "partnerPay" ? "partner" : "";
  const editable = payOwner || (side === "income" ? INCOME_FIELDS.some((field) => field.key === item.key) : SPENDING_FIELDS.some((field) => field.key === item.key));
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
    button.append(make("span", "flow-overview-kicker", detail.enteredTakeHome ? "Yearly pay · entered monthly take-home" : "Yearly pay · estimated monthly take-home"), make("strong", "", detail.person), make("span", "flow-overview-amount", `${money(detail.monthlyTakeHome)}/month`), make("span", "flow-overview-edit", "Edit pay →"));
    overview.append(button);
  }
  const regular = summary.uses.filter((item) => item.kind === "spending").reduce((sum, item) => sum + item.amount, 0);
  const spending = make("button", "flow-overview-card"); spending.type = "button"; spending.dataset.flowRegular = "spending";
  spending.append(make("span", "flow-overview-kicker", "Regular categories"), make("strong", "", "Everyday spending"), make("span", "flow-overview-amount", `${money(regular)}/month`), make("span", "flow-overview-edit", "Edit amounts →"));
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
  const plan = computeAllocationWaterfall(flowDraft, draft, { primary: draft.name, partner: draft.partnerName });
  const diagram = buildMonthlyFlowDiagram(flowDraft, draft, { primary: draft.name, partner: draft.partnerName });
  renderFlowTimeline();
  $("flow-income-total").textContent = money(summary.incomeTotal);
  $("flow-spending-total").textContent = money(summary.spendingTotal);
  $("flow-result-value").textContent = summary.hasEntries ? money(Math.abs(summary.remainder)) : "—";
  $("flow-result-label").textContent = !summary.hasEntries ? "Start with a monthly amount" : summary.remainder < 0 ? "More spent than recorded income" : summary.remainder === 0 ? "Income matches spending" : "Available after spending";
  const payEstimated = summary.payDetails.some((detail) => !detail.enteredTakeHome && detail.annualGross > 0);
  $("flow-result-context").textContent = !summary.hasEntries ? "Enter money in or spending below to see the flow." : summary.remainder < 0 ? "This gap is not assumed to be funded from your assets." : `${diagram.savingsAssigned ? `${money(diagram.savingsAssigned)} assigned to planned saving; no money is moved.` : "No saving destination is assumed."}${payEstimated ? " Pay is an estimate; use actual take-home for a more reliable figure." : ""}`;
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
  const destinations = $("flow-use-list"); destinations.replaceChildren(groupRow("Deductions, spending and saving"), ...diagram.uses.map((item) => flowListItem(item, "spending")));
  $("flow-table-scroll").hidden = !summary.hasEntries;
  $("flow-table-empty").hidden = summary.hasEntries;
  renderSankey(diagram);
  $("flow-payroll-note").hidden = !diagram.payrollEstimated;
  $("flow-saving-primary-label").textContent = `${draft.name || "Your"} planned saving`;
  $("flow-saving-partner-label").textContent = `${draft.partnerName || "Partner"} planned saving`;
  $("flow-saving-partner-row").hidden = !diagram.hasPartner;
  $("flow-savings-status").textContent = diagram.savingsUnfunded
    ? `${money(diagram.savingsUnfunded)} of your entered saving amounts exceeds this month’s remainder and is not shown as saved.`
    : diagram.savingsAvailable ? `${money(diagram.savingsAssigned)} assigned to planned saving · ${money(diagram.savingsAvailable - diagram.savingsAssigned)} still to assign.`
      : "No positive remainder to assign in this month.";
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
      const row = make("label", "flow-input-row");
      const name = make("span", "", label); name.id = `flow-${side}-${key}-label`;
      const moneyField = make("span", "flow-money-input");
      const input = make("input"); input.id = `flow-${side}-${key}`; input.type = "number"; input.min = "0"; input.max = "100000000"; input.step = "0.01"; input.inputMode = "decimal"; input.placeholder = "0";
      input.dataset.flowSide = side; input.dataset.flowKey = key;
      moneyField.append(make("span", "", "£"), input);
      row.append(name, moneyField); container.append(row);
    }
  }
}
function syncFlowInputs() {
  editingFlowEntryId = null;
  $("flow-dated-form").hidden = true;
  for (const input of document.querySelectorAll("[data-flow-side]")) {
    const value = flowDraft[input.dataset.flowSide][input.dataset.flowKey];
    input.value = value ? String(value) : "";
  }
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
  $("flow-saving-primary").value = flowDraft.savings?.primary || "";
  $("flow-saving-partner").value = flowDraft.savings?.partner || "";
}
function showScreen(screen) {
  $("canvas-screen").hidden = screen !== "assets";
  $("flow-screen").hidden = screen !== "flow";
  $("planning-screen").hidden = screen !== "planning";
  if (screen === "flow" || screen === "planning") {
    renderFlow();
    if (screen === "flow" && mode !== "example" && !summarizeMonthlyFlow(flowDraft, draft).hasEntries) { $("flow-editor").open = true; $("flow-pay-detail").open = true; }
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
for (const owner of ["primary", "partner"]) $(`flow-saving-${owner}`).addEventListener("input", (event) => {
  const raw = event.currentTarget.value.trim();
  const value = raw === "" ? 0 : Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100_000_000 || Math.abs(value * 100 - Math.round(value * 100)) > .001) {
    $("flow-savings-status").textContent = "Enter a monthly saving amount from £0 to £100,000,000, with no more than two decimal places.";
    return;
  }
  flowDraft.savings ||= { primary: 0, partner: 0 };
  flowDraft.savings[owner] = value;
  renderFlow();
});
function setFlowView(view) {
  const table = view === "table";
  $("flow-diagram-view").hidden = table;
  $("flow-table-view").hidden = !table;
  $("flow-view-diagram").setAttribute("aria-pressed", String(!table));
  $("flow-view-table").setAttribute("aria-pressed", String(table));
  $("flow-view-help").textContent = table
    ? "Exact monthly averages from the same entries, including estimated payroll deductions. Use Edit to change a figure."
    : "Gross pay flows through estimated deductions to spending and planned saving. Choose Table for exact amounts.";
}
$("flow-view-diagram").addEventListener("click", () => setFlowView("diagram"));
$("flow-view-table").addEventListener("click", () => setFlowView("table"));
$("flow-editor").addEventListener("input", (event) => {
  const input = event.target.closest("[data-flow-side], [data-flow-pay-owner]");
  if (!input) return;
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
  $("flow-editor").open = true;
  $(pay ? "flow-pay-detail" : "flow-spending-detail").open = true;
  const target = pay ? $(`flow-pay-${pay.dataset.flowPay}-annualGross`) : $("flow-spending-homeBills");
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
  if (saving) { $(`flow-saving-${saving.dataset.flowSaving}`).focus(); return; }
  const entry = event.target.closest("[data-flow-entry]");
  if (entry) { showDatedForm("income", entry.dataset.flowEntry, entry); return; }
  const pay = event.target.closest("[data-flow-pay]");
  if (pay) { $("flow-editor").open = true; $("flow-pay-detail").open = true; $(`flow-pay-${pay.dataset.flowPay}-annualTakeHome`).focus(); return; }
  const debt = event.target.closest("[data-flow-debt]");
  if (debt) { showScreen("assets"); returnToFlowAssetId = debt.dataset.flowDebt; showItemDialog("debt", debt.dataset.flowDebt, debt); return; }
  const asset = event.target.closest("[data-flow-asset]");
  if (asset) { editLinkedAsset(asset.dataset.flowAsset, asset); return; }
  const item = event.target.closest("[data-flow-focus]");
  if (!item) return;
  const [side, key] = item.dataset.flowFocus.split(":");
  $("flow-editor").open = true;
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
  panel.querySelector(".section-kicker").textContent = "Your regular amounts";
  $("flow-dated-title").textContent = "Build your monthly picture";
  panel.querySelector(".flow-dated-heading p:last-child").textContent = "Start with pay and regular spending. Edit a card to change its figures; the monthly flow above updates immediately.";
  const editor = $("flow-editor");
  editor.querySelector("summary").firstChild.textContent = "Edit pay and regular amounts ";
  const payDetail = document.createElement("details");
  payDetail.id = "flow-pay-detail";
  payDetail.className = "flow-editor-part";
  payDetail.innerHTML = "<summary>Pay and other money in <span>Yearly salary, pension contributions and regular income</span></summary>";
  const spendingDetail = document.createElement("details");
  spendingDetail.id = "flow-spending-detail";
  spendingDetail.className = "flow-editor-part";
  spendingDetail.innerHTML = "<summary>Regular spending <span>Monthly amounts by category</span></summary>";
  payDetail.addEventListener("toggle", () => { if (payDetail.open) spendingDetail.open = false; });
  spendingDetail.addEventListener("toggle", () => { if (spendingDetail.open) payDetail.open = false; });
  const grid = editor.querySelector(".flow-edit-grid");
  payDetail.append(editor.querySelector(".flow-pay-section"), grid.firstElementChild);
  spendingDetail.append(grid.firstElementChild);
  grid.replaceWith(payDetail, spendingDetail);
  $("flow-entry-overview").after(editor);

  const extras = document.createElement("details");
  extras.id = "flow-more-entries";
  extras.className = "flow-progressive";
  extras.innerHTML = '<summary><span><strong>Other income, expenses and property</strong><small>Add dated items or include recorded rent and mortgage payments</small></span><span class="flow-progressive-chevron" aria-hidden="true">⌄</span></summary><div class="flow-progressive-body"></div>';
  panel.after(extras);
  const extrasBody = extras.querySelector(".flow-progressive-body");
  extrasBody.append($("flow-dated-list"), $("flow-dated-empty"), $("flow-dated-form"), $("flow-link-panel"));
  $("flow-entry-overview").after(panel.querySelector(".flow-dated-actions"));
  const extrasIntro = document.createElement("p");
  extrasIntro.className = "flow-progressive-intro";
  extrasIntro.innerHTML = 'Entries active in <span id="flow-dated-asof">this month</span> affect the picture. Add a future start or end month, then visit it on the timeline above.';
  extrasBody.prepend(extrasIntro);
  panel.querySelector("#flow-dated-asof")?.remove();

  $("planning-content").append($("flow-allocation-panel"), $("flow-growth-panel"));
}

organizeFlowInputs();
setupFlowInputs();
syncFlowInputs();
render();
$("canvas-screen").hidden = false;
