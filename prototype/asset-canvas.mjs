import {
  ASSET_TYPES,
  ACCESS_BUCKETS,
  DEBT_TYPES,
  accessBucket,
  createBlankDraft,
  createPublicDemoHousehold,
  createId,
  summarizeDraft,
  validateDraft,
} from "./asset-ledger.mjs?v=20261022cashflow2";
import { INCOME_FIELDS, SPENDING_FIELDS, createBlankMonthlyFlow, createExampleMonthlyFlow, summarizeMonthlyFlow, buildMonthlyFlowDiagram, monthlyFlowEvents, computeAllocationWaterfall, projectTaxYearSaving, ISA_ALLOWANCE_2026_27, DEFAULT_RESERVE_MONTHS } from "./monthly-flow.mjs?v=20261022insights1";
import { mountAccountStorage } from './account-storage.mjs?v=20261022insights1';
import {removePartnerFromPicture} from './household-profile.mjs?v=20261022insights1';
import {mountInsights} from "./insights-view.mjs?v=20261022insights1";
import { mountInheritance } from "./inheritance-view.mjs?v=20261022insights1";
import { mountPlanning } from "./planning-view.mjs?v=20261022insights1";
import { estimateStatePension, resolveStatePensionInput } from "./state-pension.mjs?v=20261022insights1";
import { estimateRepaymentMortgagePayment } from "./mortgage-payment.mjs?v=20261022cashflow2";
import { enableGroupedNumberInput, formatGroupedNumberInputs, groupedNumberValue } from "./grouped-number-input.mjs?v=20261022grouped1";

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

let draft = createPublicDemoHousehold();
let flowDraft = createExampleMonthlyFlow();
let planningController = null;
let inheritanceController = null;
let insightsController = null;
let mode = "example";
let dialogType = null;
let editingId = null;
let lastTrigger = null;
let returnToFlowAssetId = null;
let editingFlowEntryId = null;
let flowEntryTrigger = null;
let flowDatedRequireStart = false;
let flowChartPath = [];
let chartView = "type";
let chartSelection = null;
let holdingsOwner = "all";
let savingPeriod = "month";

function announce(message) { $("live-message").textContent = message; }
function itemName(item, types) { return item.label?.trim() || types[item.kind].label; }
function countLabel(count) { return `(${count})`; }

function setTotals() {
  const summary = summarizeDraft(draft);
  $("asset-total").textContent = money(summary.assetTotal);
  $("debt-total").textContent = `${summary.debtTotal ? "−" : ""}${money(summary.debtTotal)}`;
  $("accessible-total").textContent = money(summary.accessTotals.accessible);
  const netWorthText = money(summary.netWorth);
  $("net-worth").textContent = netWorthText;
  $("net-worth").style.fontSize = netWorthText.length > 15 ? "1.12rem" : netWorthText.length > 11 ? "1.4rem" : "";
  $("asset-count").textContent = `${draft.assets.length} ${draft.assets.length===1 ? "asset" : "assets"} entered`;
  $("debt-count").textContent = `${draft.debts.length} ${draft.debts.length===1 && draft.debts[0].kind==="mortgage" ? "mortgage" : draft.debts.length===1 ? "debt" : "debts"}`;
  $("accessible-caption").textContent = draft.assets.some(asset=>!["cash","isa"].includes(asset.kind) && accessBucket(asset)==="accessible") ? "Confirmed-access assets" : "Cash & ISAs";
  return summary;
}

const chartColours = ["#1F7A68", "#7C5CBF", "#C58B3B", "#007AFF", "#60A894", "#A18BCD", "#8E8E93", "#CC6600"];
const chartViews = {
  owner: { title: "Assets by person", context: "Select a category to view its assets." },
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
  $("chart-context").textContent = chartViews[chartView].context;
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
  if (asset.kind === "dc-pension") notes.push(asset.pensionAccessAge ? `Scheme access age ${asset.pensionAccessAge}` : "Plan uses 55 through Mar 2028, then 57");
  if (accessBucket(asset) === "review") notes.push("Access rules to confirm");
  return notes.join(" · ");
}
function debtContext(debt) {
  const notes = [];
  if (debt.interestRate !== undefined) notes.push(`${plain(debt.interestRate)}% mortgage rate`);
  if (debt.remainingYears !== undefined) notes.push(`${plain(debt.remainingYears)} years left`);
  if (debt.monthlyPayment !== undefined) notes.push(`${money(debt.monthlyPayment)}/month payment`);
  else if (debt.kind === "mortgage") {
    const estimate = estimateRepaymentMortgagePayment({ balance: debt.balance, annualRate: debt.interestRate, remainingYears: debt.remainingYears, mortgageType: debt.mortgageType });
    if (estimate !== null) notes.push(`Estimated ${money(estimate)}/month ${debt.mortgageType === "interest-only" ? "interest-only" : "repayment"}`);
    else notes.push("Add monthly payment details");
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
  return accessBucket(asset) === "review";
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
    button.append(icon(asset.kind), make("span", "", `${ownerName(asset.owner)} · ${itemName(asset, ASSET_TYPES)}`), make("small", "", "Confirm access or sale rules →"));
    list.append(button);
  }
}
function renderOrbit(summary) {
  const owners = ["all", "primary", ...(draft.partnerName?.trim() ? ["partner", "shared"] : [])];
  if (!owners.includes(holdingsOwner)) holdingsOwner = "all";
  const filters = $("holdings-owner-filter");
  filters.replaceChildren();
  for (const owner of owners) {
    const button = make("button", "holdings-owner-button", owner === "all" ? "All" : ownerName(owner));
    button.type = "button"; button.dataset.holdingsOwner = owner;
    button.setAttribute("aria-pressed", String(holdingsOwner === owner));
    filters.append(button);
  }
  $("people-title").textContent = holdingsOwner === "all" ? "All items" : holdingsOwner === "shared" ? "Shared items" : `${ownerName(holdingsOwner)}’s items`;
  const selected = holdingsOwner === "all" ? summary : summary.ownership[holdingsOwner];
  $("holdings-subtotal").textContent = holdingsOwner === "all" ? "" : `${ownerName(holdingsOwner)} · net worth ${money(selected.netWorth)}`;
  const container = $("orbit-items"); container.replaceChildren();
  let count = 0;
  for (const [type, entries, types, title] of [["asset", draft.assets, ASSET_TYPES, "Assets"], ["debt", draft.debts, DEBT_TYPES, "Debt"]]) {
    const items = entries.filter(item => holdingsOwner === "all" || (item.owner || "primary") === holdingsOwner)
      .toSorted((a, b) => (type === "asset" ? b.value - a.value : b.balance - a.balance));
    count += items.length;
    if (!items.length) continue;
    const section = make("section", "holdings-section");
    const heading = make("div", "holdings-section-heading");
    const label = make("h3", "", title); label.append(make("small", "", String(items.length)));
    heading.append(label, make("strong", "", money(items.reduce((sum, item) => sum + (type === "asset" ? item.value : item.balance), 0))));
    const list=make("div","asset-grouped-list");list.setAttribute("role","list");list.setAttribute("aria-label",title);
    for(const item of items) {
      const owner=item.owner || "primary",value=type==='asset' ? item.value : item.balance;
      const linkedAsset=type==='debt' ? draft.assets.find(asset=>asset.id===item.linkedAssetId) : null;
      const access=type==='debt' ? (linkedAsset ? itemName(linkedAsset,ASSET_TYPES) : 'Debt') : item.kind==='dc-pension' ? (item.pensionAccessAge ? `Age ${item.pensionAccessAge}+` : '55 → 57') : ({accessible:'Available',pension:'Pension',illiquid:'Needs sale',review:'Check access'})[accessBucket(item)];
      const review=type==='asset' && needsAccessReview(item);
      const row=make('button',`holding-row asset-row owner-${owner}${type==='debt' ? ' is-debt' : ''}`);row.type='button';row.dataset.orbitType=type;row.dataset.orbitId=item.id;
      row.setAttribute('aria-label',`Edit ${ownerName(owner)} ${itemName(item,types)}, ${money(value)}${review ? `, ${access}` : ''}${item.confidence==='review' ? ', review value' : ''}`);
      const pictogram=make('span','asset-icon');pictogram.setAttribute('aria-hidden','true');pictogram.append(icon(item.kind));
      const content=make('span','asset-row-content'),nameLine=make('span','asset-name-line');nameLine.append(make('strong','holding-name',itemName(item,types)));
      const ownerPill=make('span',`asset-owner-pill owner-${owner}`,ownerName(owner));ownerPill.hidden=holdingsOwner!=='all';nameLine.append(ownerPill);content.append(nameLine);
      const linkedDebts=type==='asset' ? draft.debts.filter(debt=>debt.linkedAssetId===item.id) : [];
      if(linkedDebts.length){const balance=linkedDebts.reduce((sum,debt)=>sum+debt.balance,0);content.append(make('span','asset-equity-pill',`${linkedDebts.length===1 && linkedDebts[0].kind==='mortgage' ? 'Linked mortgage' : 'Linked debt'}: −${money(balance)} → ${money(item.value-balance)} net equity`));}
      const figures=make('span','asset-row-figures');figures.append(make('strong','asset-row-value',`${type==='debt' ? '−' : ''}${money(value)}`),make('span',`asset-status ${review ? 'is-warning' : access==='Available' ? 'is-available' : 'is-neutral'}`,`${review ? '⚠ ' : ''}${access}`));
      if(item.confidence==='review')figures.append(make('span','asset-status is-warning','⚠ Review value'));
      const chevron=make('span','row-chevron','›');chevron.setAttribute('aria-hidden','true');row.append(pictogram,content,figures,chevron);
      const listItem=make('div','asset-list-item');listItem.setAttribute('role','listitem');listItem.append(row);list.append(listItem);
    }
    section.append(heading,list);container.append(section);
  }
  if (!count) container.append(make("p", "holdings-empty", "No items yet."));
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
  $("snapshot-description").textContent = [draft.name && `${draft.name}${draft.age ? `, ${draft.age}` : ""}`, draft.partnerName && `${draft.partnerName}${draft.partnerAge ? `, ${draft.partnerAge}` : ""}`].filter(Boolean).join(" · ");
  $("example-badge").textContent = mode === "example" ? "Fictional example" : "Your household";
  $("start-own-button").hidden = mode !== "example";
  $("reset-example-button").hidden = mode !== "example";
  $("asset-breakdown").hidden = draft.assets.length === 0;
  $("asset-records").hidden = !hasItems && mode !== "example";
  $("asset-records").querySelector(".holdings-add-actions").hidden = !hasItems && mode !== "example";
  renderAccessReview();
  renderOrbit(summary);
  renderFlow();
}

const flowColors = {
  primaryPay:'#1F7A68',partnerPay:'#7C5CBF',pensionIncome:'#7C5CBF',otherIncome:'#C58B3B',
  homeBills:'#C58B3B',everyday:'#C58B3B',transport:'#C58B3B',lifestyle:'#C58B3B',other:'#8E8E93',
  rent:'#C58B3B',mortgage:'#FF3B30',datedIncome:'#1F7A68',datedSpending:'#FF3B30',
  tax:'#FF3B30',nationalInsurance:'#FF3B30',pensionContribution:'#7C5CBF',saving:'#1F7A68',
  unallocated:'#8E8E93',gap:'#FF3B30','cash-reserve':'#1F7A68','isa-primary':'#1F7A68','isa-partner':'#7C5CBF',trading:'#C58B3B'
};
const svgNS = "http://www.w3.org/2000/svg";
function svgElement(tag, attributes = {}) {
  const node = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}
function flowColor(item) {
  if (["mortgage", "datedSpending", "spending"].includes(item.kind)) return "#FF3B30";
  if(item.kind==="saving")return item.key?.startsWith("partner") || item.owner==="partner" ? "#7C5CBF" : "#1F7A68";
  return flowColors[item.bucket] || flowColors[item.key] || flowColors[item.kind] || "#8E8E93";
}
function flowIconPath(item) {
  if (item.kind === "tax" || item.kind === "nationalInsurance") return "M5 3h14v18H5zM8 8h8M8 12h8M8 16h5";
  if (item.kind === "pensionContribution" || item.key === "pensionIncome") return iconPaths["dc-pension"];
  if (item.kind === "saving" || item.kind === "unallocated") return iconPaths.cash;
  if (item.kind === "mortgage" || item.key === "homeBills") return iconPaths.home;
  if (item.kind === "rent") return iconPaths["other-property"];
  if (["transport", "carPayment"].includes(item.key)) return iconPaths.car;
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
function labelPositions(items, chartHeight, minGap = 38) {
  const labels = items.map((item) => item.y + item.height / 2);
  for (let index = 1; index < labels.length; index++) labels[index] = Math.max(labels[index], labels[index - 1] + minGap);
  const excess = labels.at(-1) - (chartHeight - 48);
  if (excess > 0) for (let index = 0; index < labels.length; index++) labels[index] -= excess;
  return labels;
}
function editFlowEntry(item, side) {
  if (item.kind === "gap") return;
  if (item.kind === "statePension") { openStatePension(item.owner || item.key.split(":")[1]); return; }
  if (item.kind === "saving") { $("flow-allocation-panel").scrollIntoView({block:"start",behavior:"smooth"}); return; }
  if (["datedIncome", "datedSpending"].includes(item.kind)) { showDatedForm(side, item.key.slice(6)); return; }
  if (item.kind === "rent") { editLinkedAsset(item.key.slice(5), $("flow-sankey")); return; }
  if (item.kind === "mortgage") { showScreen("assets"); returnToFlowAssetId = item.key.slice(9); showItemDialog("debt", item.key.slice(9), $("flow-sankey")); return; }
  const owner = item.key === "primaryPay" ? "primary" : item.key === "partnerPay" ? "partner" : null;
  const detail = $(side === "income" ? "flow-pay-detail" : "flow-spending-detail");
  detail.open = true;
  openFlowEditor(side, owner);
  const target = owner ? $(`flow-pay-${owner}-annualGross`) : item.key?.startsWith("custom:")
    ? [...document.querySelectorAll("[data-flow-custom-spending-amount]")].find((input) => input.dataset.flowCustomSpendingAmount === item.key.slice(7))
    : $(`flow-${side}-${item.key}`);
  target?.focus();
}
function renderPhoneSankey(summary) {
  const svg=$("flow-sankey-mobile");svg.replaceChildren();svg.hidden=!summary.hasEntries;if(!summary.hasEntries)return;
  const width=Math.max(200,Math.round(svg.parentElement.clientWidth)),outputs=[...summary.deductions,...summary.uses],height=Math.max(640,outputs.length*65+100),top=60,bottom=height-30;
  const total=Math.max(1,summary.sources.reduce((sum,item)=>sum+item.amount,0),outputs.reduce((sum,item)=>sum+item.amount,0));
  const scale=(bottom-top-(outputs.length-1)*42)/total;
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const title=svgElement('title');title.textContent='Gross income splits into deductions, spending and saving';svg.append(title);
  const text=(x,y,value,cls='flow-phone-label')=>{const node=svgElement('text',{x,y,class:cls});node.textContent=value;svg.append(node);};
  const sourceX=Math.max(95,width*.27),hubX=Math.max(sourceX+24,width*.41),outX=Math.max(hubX+28,width*.59),labelX=outX+16;
  text(4,23,'Money in');text(labelX,23,'Where it goes');
  const link=(x1,y1,x2,y2,h,item,side)=>{const path=svgElement('path',{d:flowBand(x1,y1,x2,y2,Math.max(.7,h)),fill:flowColor(item),opacity:'.38',stroke:'#fffefa','stroke-width':1});svg.append(path);};
  const label=(x,y,item,side)=>{const group=svgElement('g',{role:side ? 'button' : 'img',...(side ? {tabindex:0} : {}),'aria-label':`${side ? 'Edit ' : ''}${item.label}: ${money(item.amount)} monthly`});group.append(svgElement('rect',{x:x-3,y:y-24,width:134,height:49,fill:'transparent'}));const name=svgElement('text',{x,y:y-5,class:'flow-phone-label'});const short=item.key==='everyday' ? 'Living costs' : / savings$/.test(item.label) ? item.label.replace(/ savings$/,' saving') : item.kind==='mortgage' ? 'Mortgage' : item.key==='taxNI' || /Income Tax/.test(item.label) ? 'Tax & NI' : /Employee pensions/.test(item.label) ? 'Work pension' : /^School fees/.test(item.label) ? 'School fees' : item.label;const limit=Math.max(9,Math.floor((width-x-4)/7.1));name.textContent=short.length>limit ? short.slice(0,limit-1)+'…' : short;const amount=svgElement('text',{x,y:y+16,class:'flow-phone-value'});amount.textContent=money(item.amount);group.append(name,amount);if(side){group.addEventListener('click',()=>editFlowEntry(item,side));group.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();editFlowEntry(item,side);}});}svg.append(group);};
  const hubY=top+(bottom-top-total*scale)/2;
  let cursor=hubY,y=top;
  // Ribbons are painted before labels so all amounts remain readable.
  const sourceRows=summary.sources.map(item=>{const h=item.amount*scale,row={item,y,h};y+=h+58;return row;});
  const sourceHeight=sourceRows.length ? sourceRows.at(-1).y+sourceRows.at(-1).h-top : 0,offset=Math.max(0,(bottom-top-sourceHeight)/2);
  for(const row of sourceRows){row.y+=offset;link(sourceX+10,row.y,hubX,cursor,row.h,row.item,'income');cursor+=row.h;}
  cursor=hubY;y=top;const outputRows=[];
  for(const item of outputs){const h=item.amount*scale;link(hubX+12,cursor,outX,y,h,item);outputRows.push({item,y,h});cursor+=h;y+=h+42;}
  svg.append(svgElement('rect',{x:hubX,y:hubY,width:12,height:Math.max(1,total*scale),rx:3,fill:'#8E8E93'}));
  for(const row of sourceRows){svg.append(svgElement('rect',{x:sourceX,y:row.y,width:10,height:Math.max(2,row.h),fill:flowColor(row.item),rx:2}));const pay=summary.payDetails.find(detail=>`${detail.owner}Pay`===row.item.key);label(3,row.y+row.h/2,pay ? {...row.item,label:`${pay.person} pay`} : row.item,row.item.kind==='gap' ? null : 'income');}
  for(const row of outputRows){svg.append(svgElement('rect',{x:outX,y:row.y,width:10,height:Math.max(2,row.h),fill:flowColor(row.item),rx:2}));label(labelX,row.y+row.h/2,row.item,summary.deductions.includes(row.item) ? null : 'spending');}
}
function renderSankey(summary) {
  renderPhoneSankey(summary);
  const svg = $("flow-sankey");
  [...svg.children].filter((child) => !["title", "desc"].includes(child.tagName.toLowerCase())).forEach((child) => child.remove());
  svg.setAttribute("role","group");
  svg.hidden = !summary.hasEntries; $("flow-empty").hidden = summary.hasEntries;
  if (!summary.hasEntries) return;
  const width = 1400, height = Math.max(800, summary.uses.length * 65 + 160), top = 100, bottom = height - 45;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const gap = 42, nodeWidth = 16;
  const scale = (bottom - top - Math.max(summary.sources.length, summary.uses.length) * gap) / Math.max(1, summary.chartTotal);
  const x = { source: 260, gross: 490, cut: 735, net: 880, out: 1100 };
  const entered = new Set(summary.payDetails.filter((detail) => detail.enteredTakeHome).map((detail) => `${detail.owner}Pay`));
  const isPayroll = (item) => ["primaryPay", "partnerPay"].includes(item.key) && !entered.has(item.key);
  const payroll = summary.sources.filter(isPayroll), direct = summary.sources.filter((item) => !isPayroll(item));
  const gross = payroll.reduce((sum, item) => sum + item.amount, 0);
  const deductions = summary.deductions.reduce((sum, item) => sum + item.amount, 0);
  const payrollNet = Math.max(0, gross - deductions), net = summary.uses.reduce((sum, item) => sum + item.amount, 0);
  const grossH = gross * scale, netH = net * scale;
  const grossY = top + (bottom - top - grossH) * .45;
  const netY = bottom - netH - 25;
  const stack = (items, start, spacing) => { let y = start; return items.map((item) => { const row = { ...item, y, height: item.amount * scale }; y += row.height + spacing; return row; }); };
  const sourcesH = summary.sources.reduce((sum,item) => sum + item.amount * scale,0) + (summary.sources.length - 1) * gap;
  const sources = stack([...payroll, ...direct], top + (bottom - top - sourcesH) / 2, gap);
  let directY = bottom;
  for (const row of sources.filter((item)=>!isPayroll(item)).reverse()) { row.y=directY-row.height; directY=row.y-gap; }
  const usesH = netH + (summary.uses.length - 1) * gap;
  const uses = stack(summary.uses, top + (bottom - top - usesH) / 2, gap);
  const cuts = stack(summary.deductions, top, 32);
  const paths = svgElement("g", { class: "flow-paths" }); svg.append(paths);
  const text = (px, py, value, anchor = "start", cls = "flow-svg-label") => { const node = svgElement("text", { x: px, y: py, "text-anchor": anchor, class: cls }); node.textContent = value; svg.append(node); return node; };
  for(const [x,label,width] of [[140,'INCOME',120],[700,'DEDUCTIONS → TAKE-HOME',290],[1210,'SPENDING & SAVING',230]]) {
    svg.append(svgElement('rect',{x:x-width/2,y:10,width,height:34,rx:8,fill:'#F2F2F7'}));text(x,32,label,'middle','flow-svg-heading');
  }


  const ribbon = (x1, y1, x2, y2, h, color, item, side) => {
    const path = svgElement("path", { d: flowBand(x1,y1,x2,y2,h), fill: color, class: `flow-ribbon flow-curved-ribbon${item.kind === "gap" ? " flow-ribbon-gap" : ""}` });
    if (h < 3) { path.style.strokeWidth = "0"; path.style.opacity = ".9"; }
    const title = svgElement("title"); title.textContent = `${item.label}: ${money(item.amount)} per month`; path.append(title);
    if (side) { path.dataset.flowKey = item.key; path.addEventListener("click", () => editFlowEntry(item, side)); }
    paths.append(path);
  };
  const node = (px, row, color, side) => {
    const group = svgElement("g", { class: side ? "flow-chart-target" : "" });
    group.append(svgElement("rect", { x:px, y:row.y, width:nodeWidth, height:Math.max(3,row.height), rx:3, fill:color }));
    if (side) { group.setAttribute("role","presentation"); group.setAttribute("aria-label",`Edit ${row.label}, ${money(row.amount)} per month`); group.addEventListener("click",()=>editFlowEntry(row,side)); group.addEventListener("keydown",(event)=>{ if (["Enter"," "].includes(event.key)) { event.preventDefault(); editFlowEntry(row,side); } }); }
    svg.append(group); return group;
  };
  const label = (px, cy, name, amount, anchor, row, side) => {
    const group = svgElement("g", { class: "flow-chart-target", role:"button", tabindex:0, "aria-label":`Edit ${name}, ${money(amount)} per month` });
    if (row.kind === "gap") { group.setAttribute("role","img"); group.removeAttribute("tabindex"); group.setAttribute("aria-label",`${name}: ${money(amount)} not covered by recorded income`); }
    const title = svgElement("text",{x:px,y:cy-4,"text-anchor":anchor,class:"flow-svg-label"}); title.textContent=name.length > 29 ? `${name.slice(0,27)}…` : name;
    const value = svgElement("text",{x:px,y:cy+19,"text-anchor":anchor,class:"flow-svg-value"}); value.textContent=money(amount);
    group.append(title,value); group.addEventListener("click",()=>editFlowEntry(row,side)); group.addEventListener("keydown",(event)=>{if (["Enter"," "].includes(event.key)){event.preventDefault();editFlowEntry(row,side);}}); svg.append(group);
  };
  let grossCursor = grossY, directCursor = netY + payrollNet * scale;
  for (const row of sources) {
    const color = flowColor(row);
    if (isPayroll(row)) { ribbon(x.source+nodeWidth,row.y,x.gross,grossCursor,row.height,color,row,"income"); grossCursor+=row.height; }
    else { ribbon(x.source+nodeWidth,row.y,x.net,directCursor,row.height,color,row,"income"); directCursor+=row.height; }
    node(x.source,row,color,"income");
    const person = summary.payDetails.find((detail)=>`${detail.owner}Pay`===row.key);
    label(x.source-18,row.y+row.height/2,person ? `${person.person} · ${entered.has(row.key)?"take-home":"gross pay"}` : row.label,row.amount,"end",row,"income");
  }
  if (gross > 0) {
    node(x.gross,{y:grossY,height:grossH},"#647a70");
    text(x.gross-5,grossY-35,"Combined pay","middle","flow-svg-caption");
    text(x.gross-5,grossY-12,money(gross),"middle","flow-svg-value");
    let cutCursor = grossY;
    for (const row of cuts) { ribbon(x.gross+nodeWidth,cutCursor,x.cut,row.y,row.height,flowColor(row),row); node(x.cut,row,flowColor(row)); text(x.cut+27,row.y+row.height/2-4,row.label,"start","flow-svg-label"); text(x.cut+27,row.y+row.height/2+19,money(row.amount),"start","flow-svg-value"); cutCursor+=row.height; }
    if (payrollNet>0) ribbon(x.gross+nodeWidth,cutCursor,x.net,netY,payrollNet*scale,"#4f9a80",{label:"Take-home pay",amount:payrollNet});
  }
  node(x.net,{y:netY,height:netH},"#28745f");
  text(x.net+8,netY-37,"Available this month","middle","flow-svg-caption");
  text(x.net+8,netY-14,money(net),"middle","flow-svg-value");
  let outCursor=netY;
  for (const row of uses) { ribbon(x.net+nodeWidth,outCursor,x.out,row.y,row.height,flowColor(row),row,"spending"); node(x.out,row,flowColor(row),"spending"); label(x.out+27,row.y+row.height/2,row.label.replace(/ estimated payment$/, ""),row.amount,"start",row,"spending"); outCursor+=row.height; }
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
    { label: "Everyday", color: "#c2935d", test: (item) => item.key === "everyday" },
    { label: "Car payments", color: "#967c64", test: (item) => item.key === "carPayment" },
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
    ["Everyday", (item) => item.key === "everyday"],
    ["Car payments", (item) => item.key === "carPayment"],
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
  if (editable || item.kind === "saving" || item.kind === "rent" || item.kind === "mortgage" || item.kind === "datedIncome" || item.kind === "datedSpending" || item.kind === "statePension") {
    const button = make("button", "flow-table-edit", "Edit");
    button.type = "button";
    button.setAttribute("aria-label", `Edit ${item.label}`);
    if (item.kind === "statePension") button.dataset.flowStatePension = item.owner;
    else if (payOwner) button.dataset.flowPay = payOwner;
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
  const groups = [["Income", summary.sources.filter((item)=>item.kind!=="gap"), "income"], ["Spending", summary.uses.filter((item)=>item.kind!=="unallocated"), "spending"]];
  for (const [title, items, side] of groups) {
    const column = make("section","flow-entry-column"); column.append(make("h3","",title));
    for (const item of items) {
      const row = make("button","flow-entry-row"); row.type="button";
      if(item.key.startsWith("entry:"))row.dataset.flowScheduleEntry=item.key.slice(6);
      const compactName=item.key==='primaryPay' ? `${draft.name || 'Your'} take-home` : item.key==='partnerPay' ? `${draft.partnerName || 'Partner'} take-home` : item.label.replace(/ estimated payment$/, '');
      const name=make("span","flow-entry-name",compactName);name.title=item.label;
      if (["rent","mortgage"].includes(item.kind)) name.append(make("small","flow-linked-badge","Linked"));
      const dated=summary.entryDetails.find((entry)=>`entry:${entry.id}`===item.key);
      if(dated) name.append(make("small","",`${dated.startMonth ? `From ${flowMonthLabel(dated.startMonth)}` : "Already started"}${dated.endMonth ? ` · until ${flowMonthLabel(dated.endMonth)}` : " · ongoing"}`));
      row.setAttribute("aria-label",`Edit ${item.label}, ${money(item.amount)}`);
      row.append(name,make("span","flow-entry-money",money(item.amount)),make("span","flow-entry-arrow","›"));
      row.addEventListener("click",()=>editFlowEntry(item,side)); column.append(row);
    }
    if (!items.length) column.append(make("p","flow-entry-empty",`No ${title.toLowerCase()} yet.`));
    if(side === "income") { const pay = make("button","flow-entry-add","Salary & pensions"); pay.type="button"; pay.addEventListener("click",()=>openFlowEditor("income")); column.append(pay); }
    const add = make("button","flow-entry-add",side === "income" ? "+ Other income" : "+ Add expense"); add.type="button"; add.addEventListener("click",()=>showDatedForm(side,null,add)); column.append(add);
    if(side === "spending") { const categories = make("button","flow-entry-add","Manage categories"); categories.type="button"; categories.addEventListener("click",()=>openFlowEditor("spending")); column.append(categories); }
    overview.append(column);
  }
  $("flow-dated-asof").textContent = flowMonthLabel(summary.asOfMonth);
  $("flow-dated-empty").hidden = true;
  const list = $("flow-dated-list"); list.replaceChildren();
  const upcoming=summary.entryDetails.filter((entry)=>entry.status === "future");
  if(!upcoming.length) list.append(make("p","flow-future-empty","No scheduled changes."));
  const past = document.createElement("details"); past.className="flow-past-entries"; const pastSummary=make("summary","","Past entries"); past.append(pastSummary);
  for (const entry of summary.entryDetails.filter((entry)=>entry.status !== "active")) {
    const row = make("button", "flow-dated-row"); row.type = "button"; row.dataset.flowEntry = entry.id;
    const main = make("span", "flow-dated-row-main");
    main.append(make("strong", "", entry.label), make("small", "", `${entry.startMonth ? flowMonthLabel(entry.startMonth) : "Now"}${entry.endMonth ? ` – ${flowMonthLabel(entry.endMonth)}` : entry.frequency === "once" ? "" : " onward"}`));
    row.setAttribute("aria-label",`Edit ${entry.label}`);
    row.append(main, make("span", "flow-dated-row-amount", entry.frequency === "once" ? money(entry.amount) : `${money(entry.monthlyAmount)}/mo`), make("span","flow-edit-label","›"));
    (entry.status === "ended" ? past : list).append(row);
  }
  if(past.children.length > 1) list.append(past);
}
function renderAllocationOverview(plan) {
  $("flow-allocation-enabled").checked = plan.enabled;
  $("flow-allocation-settings").hidden = false;
  $("flow-allocation-context").textContent = "";
  $("flow-isa-primary-label").textContent = `${plan.summary.payDetails[0].person} · ISA paid in this tax year`;
  $("flow-isa-partner-label").textContent = `${plan.summary.payDetails[1].person} · ISA paid in this tax year`;
  $("flow-isa-used-partner-row").hidden = !plan.hasPartner;
  const steps = $("flow-allocation-steps"); steps.replaceChildren();
  if(!plan.enabled) {
    const start=make("button","heading-action","Set saving order");start.type="button";
    start.addEventListener("click",()=>{document.querySelector('.flow-routing-settings').open=true;$("flow-allocation-enabled").focus();});
    steps.append(start);return;
  }
  const projection=projectTaxYearSaving(flowDraft,draft,{primary:draft.name,partner:draft.partnerName});
  const toolbar=make("div","flow-saving-period");toolbar.setAttribute("role","group");toolbar.setAttribute("aria-label","Saving period");
  for(const [value,label] of [["month","This month"],["taxYear",`To ${flowMonthLabel(projection.endMonth)}`]]) {
    const button=make("button","",label);button.type="button";button.dataset.savingPeriod=value;button.setAttribute("aria-pressed",String(savingPeriod===value));toolbar.append(button);
  }
  steps.append(toolbar);
  for(const person of plan.people) {
    const total=projection.people.find(item=>item.owner===person.owner);
    const card=make("section","flow-person-route");card.append(make("h3","",person.person));
    const route=make("ol","saving-route");route.setAttribute("aria-label",`${person.person} saving destinations`);
    for(const [title,key] of [["Cash","cash"],["ISA","isa"],["General","general"]]) {
      const amount=savingPeriod==='month' ? person[key] : total[key];
      const node=make("li",`saving-route-node${amount>0 ? " has-deposit" : ""}`);
      const figure=make("strong","",new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(amount));figure.title=money(amount);figure.setAttribute('aria-label',money(amount));
      node.append(make("span","saving-route-label",title),figure);
      const depositTotal=savingPeriod==='month' ? person.monthlySaving : total.cash+total.isa+total.general;
      const progress=make("progress");progress.max=Math.max(1,depositTotal);progress.value=amount;
      progress.setAttribute("aria-label",`${depositTotal ? Math.round(amount/depositTotal*100) : 0}% of ${person.person} saving to ${title}`);node.append(progress);
      if(key==='cash')node.title=`${money(person.currentCash)} already held; ${money(person.reserveTarget)} reserve target`;
      if(key==='isa')node.title=`${money(person.isaHeadroom)} ISA allowance remaining at the selected month`;
      if(route.children.length){const arrow=make("span","route-arrow","→");arrow.setAttribute("aria-hidden","true");node.append(arrow);}
      route.append(node);
    }
    card.append(route);steps.append(card);
  }
  const gaps=projection.months.filter(item=>item.shortfall>0).length;
  const explanation=make("details","flow-route-note");explanation.setAttribute("aria-label","About saving calculations");explanation.append(make("summary","", "i"),make("p","",`New deposits from ${flowMonthLabel(projection.startMonth)} to ${flowMonthLabel(projection.endMonth)}, with no growth or inflation. Cash fills the ${plan.reserveMonths}-month reserve, then each person’s ISA, then their general account. Bars show each destination’s share of new deposits in the selected period. Figures round to whole pounds; exact amounts are available on hover. Existing investments are not reinvested. April’s tax-year boundary is not split within the month.${gaps ? ` ${gaps} month(s) have a shortfall; withdrawals are not modelled.` : ""} Illustration, not advice. Current rules, subject to change.`));explanation.querySelector("summary").setAttribute("aria-label","About saving calculations");steps.append(explanation);
}

function renderFlowTimeline() {
  const start = flowDraft.timelineStartMonth || flowDraft.asOfMonth;
  $("flow-month").min = start;
  $("flow-month").value = flowDraft.asOfMonth;
  if ($("flow-time-slider")) { const [sy,sm]=start.split("-").map(Number); const [y,m]=flowDraft.asOfMonth.split("-").map(Number); $("flow-time-slider").value=(y-sy)*12+m-sm; $("flow-time-slider").setAttribute("aria-valuetext",flowMonthLabel(flowDraft.asOfMonth)); }
  const grouped = new Map();
  for (const event of monthlyFlowEvents(flowDraft, draft, { primary: draft.name, partner: draft.partnerName })) {
    if (!grouped.has(event.month)) grouped.set(event.month, []);
    grouped.get(event.month).push(event.label);
  }
  const startIndex=Number(start.slice(0,4))*12+Number(start.slice(5));
  const lastIndex=Math.max(startIndex+360,Number(flowDraft.asOfMonth.slice(0,4))*12+Number(flowDraft.asOfMonth.slice(5)),...[...grouped.keys()].map(month=>Number(month.slice(0,4))*12+Number(month.slice(5))));
  const horizon=lastIndex-startIndex;
  $("flow-time-slider").max=horizon;
  const rail = $("flow-timeline-events"); rail.replaceChildren();
  for (const [month, labels] of grouped) {
    const button = make("button", "flow-timeline-event"); button.type = "button"; button.dataset.flowMonth = month;
    button.setAttribute("aria-pressed", String(month === flowDraft.asOfMonth));
    button.setAttribute("aria-label", `${flowMonthLabel(month)}: ${labels.join("; ")}`);
    button.title = `${flowMonthLabel(month)}: ${labels.join("; ")}`;
    const [sy,sm]=start.split("-").map(Number), [y,m]=month.split("-").map(Number);
    button.style.left = `${Math.max(0,Math.min(100,((y-sy)*12+m-sm)/horizon*100))}%`;
    button.append(make("span", "flow-timeline-dot"), make("strong", "", flowMonthLabel(month)), make("small", "", labels.join(" · ")));
    rail.append(button);
  }
  const picker=$("flow-event-select");picker.replaceChildren(new Option('Choose a change',''));
  for(const [month,labels] of grouped)picker.add(new Option(`${flowMonthLabel(month)} · ${labels.join(' / ')}`,month));
  picker.value='';
  $('flow-selected-month').textContent=flowMonthLabel(flowDraft.asOfMonth);
  const scale=$("flow-timeline-scale"); scale.replaceChildren();
  for(const offset of [0,Math.round(horizon/2),horizon]) {
    const tick=make("span","",String(Math.floor((startIndex-1+offset)/12)));scale.append(tick);
  }
  const selectedIndex=Number(flowDraft.asOfMonth.slice(0,4))*12+Number(flowDraft.asOfMonth.slice(5));
  $("flow-time-slider").value=selectedIndex-startIndex;$("flow-time-slider").style.setProperty("--range-progress",`${(selectedIndex-startIndex)/horizon*100}%`);
  $("flow-timeline-now").disabled=flowDraft.asOfMonth===start;
}
function renderFlow() {
  if (!flowDraft.mortgageInclusionConfigured && draft.debts.some(debt => debt.kind === "mortgage")) flowDraft.includeLinkedMortgage = true;
  const summary = summarizeMonthlyFlow(flowDraft, draft, { primary: draft.name, partner: draft.partnerName });
  renderCustomSpendingInputs();
  const plan = computeAllocationWaterfall(flowDraft, draft, { primary: draft.name, partner: draft.partnerName });
  const diagram = buildMonthlyFlowDiagram(flowDraft, draft, { primary: draft.name, partner: draft.partnerName });
  renderFlowTimeline();
  const moneyIn=diagram.sources.filter(item=>item.kind!=="gap").reduce((sum,item)=>sum+item.amount,0),deductions=diagram.deductions.reduce((sum,item)=>sum+item.amount,0);
  $("flow-kpi-income").textContent=money(moneyIn);$("flow-kpi-income-label").textContent=diagram.payrollEstimated ? "Combined income" : "Household income";
  $("flow-kpi-income-caption").textContent=diagram.payrollEstimated ? "Before modelled deductions" : "After any entered tax";
  $("flow-kpi-deductions").textContent=`${deductions ? '−' : ''}${money(deductions)}`;$("flow-kpi-spending").textContent=`${summary.spendingTotal ? '−' : ''}${money(summary.spendingTotal)}`;
  $("flow-kpi-saving").textContent=`${summary.remainder>0 ? '+' : summary.remainder<0 ? '−' : ''}${money(Math.abs(summary.remainder))}`;$("flow-kpi-saving-label").textContent=summary.remainder<0 ? 'Monthly shortfall' : 'Monthly savings surplus';
  $("flow-kpi-saving").closest('.bento-kpi').classList.toggle('is-shortfall',summary.remainder<0);$("flow-kpis").hidden=!summary.hasEntries;
  let taxFlags=$('flow-tax-flags');if(!taxFlags){taxFlags=make('div','flow-tax-flags');taxFlags.id='flow-tax-flags';$('flow-kpis').after(taxFlags);}taxFlags.replaceChildren();
  for(const pay of summary.payDetails.filter(item=>item.active && !item.enteredTakeHome && item.estimate.personalAllowance<12570)){
    const flag=make('details','pay-tax-flag'),adjusted=pay.annualGross-pay.employeePension;
    flag.append(make('summary','',`${pay.person}: Personal Allowance ${pay.estimate.personalAllowance===0 ? 'fully tapered' : 'reduced'} ⓘ`));
    const text=make('p','',`Pay-only estimate: ${money(adjusted)}/year after modelled employee pensions; Personal Allowance ${money(pay.estimate.personalAllowance)}. Allowance falls £1 per £2 of adjusted net income above £100,000. Other income, reliefs and pension arrangements can change your actual figure. `),link=make('a','','HMRC rules ↗');link.href='https://www.gov.uk/guidance/adjusted-net-income';link.target='_blank';link.rel='noopener noreferrer';text.append(link);flag.append(text);taxFlags.append(flag);
  }
  taxFlags.hidden=!taxFlags.children.length;
  $("flow-income-total").textContent = money(summary.incomeTotal);
  $("flow-spending-total").textContent = money(summary.spendingTotal);
  $("flow-result-value").textContent = summary.hasEntries ? money(Math.abs(summary.remainder)) : "—";
  $("flow-result-label").textContent = !summary.hasEntries ? "Start with a monthly amount" : summary.remainder < 0 ? "More spent than recorded income" : summary.remainder === 0 ? "Income matches spending" : "Monthly saving";
  const payEstimated = summary.payDetails.some((detail) => !detail.enteredTakeHome && detail.annualGross > 0);
  $("flow-result-context").textContent = !summary.hasEntries ? "Enter income or spending below." : summary.remainder < 0 ? "This gap is not assumed to be funded from assets." : `Shown as saving, split ${diagram.primaryShare.toFixed(1)}% / ${(100 - diagram.primaryShare).toFixed(1)}%; no money moves.${payEstimated ? " Pay is estimated." : ""}`;
  $("flow-result-value").classList.toggle("is-gap", summary.remainder < 0);
  for (const detail of summary.payDetails) {
    $(`flow-pay-${detail.owner}-name`).textContent = detail.person;
    $(`flow-pay-${detail.owner}-monthly`).textContent = !detail.active ? `Pay ends after ${flowMonthLabel(detail.endDate)} · not in this month` : detail.annualTakeHome ? `${detail.enteredTakeHome ? "Entered" : "Estimated"} take-home ${money(detail.annualTakeHome)}/year · ${money(detail.monthlyTakeHome)}/month in this picture` : "Enter yearly salary or actual take-home pay to start.";
    $(`flow-pay-${detail.owner}-tax`).textContent = detail.annualGross ? `Rough 2026–27 estimate: Income Tax ${money(detail.estimate.incomeTax)}, employee NI ${money(detail.estimate.employeeNI)}, employee pension ${money(detail.employeePension)}${detail.employerPension ? `, employer pension ${money(detail.employerPension)}` : ""} per year. Employer pension is outside take-home pay.` : "";
    const baseSalary = flowDraft.pay[detail.owner].annualGross || 0;
    for (const [kind, label] of [["employee", "Your pension"], ["employer", "Employer pension"]]) {
      const rate = flowDraft.pay[detail.owner][`${kind}PensionRate`] || 0;
      const amount = flowDraft.pay[detail.owner][`${kind}Pension`] || 0;
      const amountNote = $(`flow-pay-${detail.owner}-${kind}-amount-equivalent`);
      const rateNote = $(`flow-pay-${detail.owner}-${kind}-rate-equivalent`);
      amountNote.textContent = rate ? `Calculated: ${money(baseSalary * rate / 100)} per year` : "";
      rateNote.textContent = amount ? baseSalary ? `Calculated: ${plain(amount / baseSalary * 100)}% of base pay` : "Enter base salary to calculate the percentage" : "";
      amountNote.hidden = !rate;
      rateNote.hidden = !amount;
      amountNote.setAttribute("aria-label", `${label} yearly amount calculated from percentage`);
      rateNote.setAttribute("aria-label", `${label} percentage calculated from yearly amount`);
    }
  }
  $("flow-include-rent").checked = flowDraft.includeLinkedRent;
  $("flow-include-mortgage").checked = flowDraft.includeLinkedMortgage;
  const missingMortgages = draft.debts.filter(debt => debt.kind === "mortgage" && !summary.linkedMortgages.some(item => item.id === debt.id));
  $("flow-link-panel").hidden = summary.linkedRents.length === 0 && summary.linkedMortgages.length === 0 && !missingMortgages.length;
  $("flow-rent-toggle-row").hidden = summary.linkedRents.length === 0;
  $("flow-mortgage-toggle-row").hidden = summary.linkedMortgages.length === 0 && !missingMortgages.length;
  $("flow-link-description").textContent = "Recorded rent and mortgage payments can flow into this picture. A repayment estimate needs the balance, current rate and remaining term; enter your actual payment to replace it.";
  const propertySummary = $("flow-property-summary");
  const rentTotal = summary.linkedRents.reduce((sum,item)=>sum+item.amount,0);
  const mortgageTotal = summary.linkedMortgages.reduce((sum,item)=>sum+item.amount,0);
  propertySummary.textContent = [summary.linkedRents.length ? `Rent ${money(rentTotal)}/month${flowDraft.includeLinkedRent ? " · included" : " · not included"}` : "", summary.linkedMortgages.length ? `Mortgage ${money(mortgageTotal)}/month${flowDraft.includeLinkedMortgage ? " · included" : " · not included"}` : ""].filter(Boolean).join(" · ") || "No linked property payments";
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
  for (const mortgage of missingMortgages) {
    const row = make("button", "flow-rent-row"); row.type = "button"; row.dataset.flowDebt = mortgage.id;
    row.append(make("span", "", mortgage.label || "Mortgage"), make("strong", "", "Payment details needed"), make("span", "flow-rent-edit", "Add payment →"));
    mortgages.append(row);
  }
  if (missingMortgages.length) propertySummary.textContent = `${missingMortgages.length} mortgage payment${missingMortgages.length === 1 ? "" : "s"} to add`;
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
  $("flow-split-summary").textContent = `${draft.name || "First person"} ${diagram.primaryShare.toFixed(1)}% · ${draft.partnerName || "Partner"} ${(100 - diagram.primaryShare).toFixed(1)}%`;
  $("flow-primary-share").closest("label").firstChild.textContent=`${draft.name || "First person"} share of saving `;
  $("flow-primary-share").setAttribute("aria-label", `${draft.name || "First person"} share of saving, percent`);
  renderAllocationOverview(plan);

  renderDatedEntries(summary);
  renderStatePensionRecords(summary);
  if (!$("planning-screen").hidden) planningController?.refresh();
  if (!$("inheritance-screen").hidden) inheritanceController?.refresh();
  document.dispatchEvent(new Event("picture-updated"));
  formatGroupedNumberInputs();
}
function setupFlowInputs() {
  for (const owner of ["primary", "partner"]) {
    const card = make("fieldset", "flow-pay-card");
    const legend = make("legend"); legend.id = `flow-pay-${owner}-name`; legend.textContent = owner === "primary" ? "Your pay" : "Partner's pay";
    card.append(legend);
    for (const [key, label] of [["annualGross", "Yearly base salary"], ["annualBonus", "Yearly bonus"], ["employeePensionRate", "Your pension (% of base pay)"], ["employeePension", "Your pension (yearly amount)"], ["employerPensionRate", "Employer pension (% of base pay)"], ["employerPension", "Employer pension (yearly amount)"], ["annualTakeHome", "Actual take-home (yearly)"]]) {
      const row = make("label", "flow-input-row"); row.append(make("span", "", label));
      if (["employeePensionRate", "employeePension", "employerPensionRate", "employerPension"].includes(key)) row.classList.add("flow-pension-row");
      const wrapper = make("span", "flow-money-input"); const input = make("input");
      const percent = key.endsWith("Rate");
      input.type = "number"; input.min = "0"; input.max = percent ? "100" : "100000000"; input.step = "0.01"; input.inputMode = "decimal"; input.placeholder = key === "annualTakeHome" ? "Use estimate" : "0";
      if (!percent) enableGroupedNumberInput(input);
      input.dataset.flowPayOwner = owner; input.dataset.flowPayKey = key; input.id = `flow-pay-${owner}-${key}`;
      wrapper.append(make("span", "", percent ? "%" : "£"), input); row.append(wrapper); card.append(row);
      if (["employeePensionRate", "employeePension", "employerPensionRate", "employerPension"].includes(key)) {
        const kind = key.startsWith("employee") ? "employee" : "employer";
        const note = make("small", "flow-pension-equivalent");
        note.id = `flow-pay-${owner}-${kind}-${key.endsWith("Rate") ? "rate" : "amount"}-equivalent`;
        note.hidden = true;
        row.append(note);
      }
    }
    const dateRow = make("label", "flow-input-row", ""); dateRow.classList.add("flow-pension-row"); dateRow.append(make("span", "", "Last month you expect to receive pay"));
    const date = make("input", "flow-date-input"); date.type = "month"; date.dataset.flowPayOwner = owner; date.dataset.flowPayKey = "endDate"; date.id = `flow-pay-${owner}-endDate`; dateRow.append(date); card.append(dateRow);
    dateRow.append(make("small", "flow-pension-equivalent", "Pay is included through this month and stops the following month."));
    const niDetails=make('details','flow-ni-details'),niLabel=make('label','flow-input-row'),niDate=make('input','flow-date-input');
    niDetails.append(make('summary','','NI exemption date (optional)'));niLabel.append(make('span','','State Pension age reached in'));niDate.type='month';niDate.id=`flow-pay-${owner}-niExemptFrom`;niDate.dataset.flowPayOwner=owner;niDate.dataset.flowPayKey='niExemptFrom';niLabel.append(niDate);niDetails.append(niLabel,make('small','','Leave blank to estimate from age. This is when you reach State Pension age, even if you claim it later.'));card.append(niDetails);
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
      const input = make("input"); input.id = `flow-${side}-${key}`; input.type = "number"; input.min = "0"; input.max = "100000000"; input.step = "0.01"; input.inputMode = "decimal"; input.placeholder = "0"; enableGroupedNumberInput(input);
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
  const customAmount = make("input"); customAmount.id = "flow-custom-spending-new-amount"; customAmount.type = "number"; customAmount.min = "0"; customAmount.max = "100000000"; customAmount.step = "0.01"; customAmount.inputMode = "decimal"; customAmount.value = "0"; enableGroupedNumberInput(customAmount);
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
    const amount = make("input"); amount.type = "number"; amount.min = "0"; amount.max = "100000000"; amount.step = "0.01"; amount.inputMode = "decimal"; amount.value = category.amount ? String(category.amount) : ""; enableGroupedNumberInput(amount);
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
  $("flow-dated-form").hidden = true; $("flow-dated-dialog").close();
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
  formatGroupedNumberInputs();
}
function showScreen(screen, {updateHistory=true} = {}) {
  $("welcome-screen").hidden=true;
  if(updateHistory && location.hash!==`#${screen}`)history.pushState(null,"",`#${screen}`);
  $("canvas-screen").hidden = screen !== "assets";
  $("flow-screen").hidden = screen !== "flow";
  $("planning-screen").hidden = screen !== "planning";
  $("inheritance-screen").hidden = screen !== "inheritance";
  $("insights-screen").hidden = screen !== "insights";
  if(screen==="insights")insightsController?.refresh();
  if(screen==="inheritance")inheritanceController?.refresh();
  if (screen === "flow" || screen === "planning") {
    renderFlow();
  }
  (screen === "insights" ? $("insights-title") : screen === "inheritance" ? $("inheritance-title") : screen === "flow" ? $("flow-title") : screen === "planning" ? $("planning-title") : $("canvas-title")).focus();
  window.scrollTo({ top: 0, behavior: "instant" });
  revealCurrentSection();
}
function revealCurrentSection(){
  for(const nav of document.querySelectorAll('.picture-steps')){
    if(!nav.getClientRects().length)continue;const active=nav.querySelector('[aria-current]');
    if(active)nav.scrollLeft=Math.max(0,active.offsetLeft+active.offsetWidth-nav.clientWidth+8);
  }
}
window.addEventListener('resize',revealCurrentSection);

function populateKinds(type, selected = "") {
  const select = $("item-kind");
  select.replaceChildren();
  const prompt = new Option(type === "asset" ? "Choose an asset" : "Choose a debt", "", true, !selected);
  prompt.disabled = true;
  select.add(prompt);
  for (const [kind, info] of Object.entries(type === "asset" ? ASSET_TYPES : DEBT_TYPES)) {
    select.add(new Option(kind === "dc-pension" ? "Pension pot" : info.label, kind, false, kind === selected));
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
  $("item-owner-label").textContent = type === "asset" ? "Owner" : "Owed by";
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
  const placeholders = {home:"Our home","other-property":"Rental property",cash:"Savings account",isa:"ISA account",shares:"Employer shares","dc-pension":"Workplace pension",car:"Family car",mortgage:"Home mortgage",loan:"Personal loan","credit-card":"Credit card"};
  $("item-label").placeholder = placeholders[$("item-kind").value] || "Account or item name";
  const mortgage = dialogType === "debt" && $("item-kind").value === "mortgage";
  $("mortgage-fields").hidden = !mortgage;
  $("rent-field").hidden = dialogType !== "asset" || !["home", "other-property"].includes($("item-kind").value);
  $("cash-rate-field").hidden = dialogType !== "asset" || $("item-kind").value !== "cash";
  $("investment-field").hidden = dialogType !== "asset" || !["isa", "dc-pension"].includes($("item-kind").value);
  $("access-bucket-field").hidden = dialogType !== "asset" || !["shares", "other"].includes($("item-kind").value);
  $("share-tax-fields").hidden = dialogType !== "asset" || $("item-kind").value !== "shares";
  $("pension-access-field").hidden = dialogType !== "asset" || $("item-kind").value !== "dc-pension";
  if (!$("pension-access-field").hidden) $("item-additional").open = true;
  $("item-amount-label").textContent = dialogType === "asset" ? "Current value" : "Balance owed";

  if (dialogType === "debt") populateLinks(selectedLink);
  updateEquityPreview();
}

function updateEquityPreview() {
  const debt = editingId && dialogType === "asset" ? draft.debts.filter(item => item.linkedAssetId === editingId).reduce((sum, item) => sum + item.balance, 0) : 0;
  const note = $("item-equity"), value = groupedNumberValue($("item-amount"));
  note.hidden = !debt || !$("item-amount").value || !Number.isFinite(value);
  note.textContent = note.hidden ? "" : `Linked debt ${money(debt)} · Equity ${money(value - debt)}`;
}
$("item-amount").addEventListener("input", updateEquityPreview);

function showItemDialog(type, id = null, trigger = null, initialKind = "", initialOwner = "primary") {
  dialogType = type;
  editingId = id;
  lastTrigger = trigger;
  const item = id ? draft[type === "asset" ? "assets" : "debts"].find((entry) => entry.id === id) : null;
  $("item-form").reset();
  $("item-error").hidden = true;
  $("item-error").textContent = "";
  $("item-additional").open = Boolean(item?.kind === "dc-pension" && trigger?.dataset?.reviewId);
  $("item-dialog-title").textContent = `${item ? "Edit" : "Add"} ${type === "asset" ? "an asset" : "a debt"}`;
  $("save-item-button").textContent = item ? "Save changes" : type === "asset" ? "Add asset" : "Add debt";
  $("delete-item-button").hidden = !item;
  populateKinds(type, item?.kind || initialKind);
  populateOwners(type, item?.owner || initialOwner);
  $("item-label").value = item?.label || "";
  $("item-amount").value = item ? String(type === "asset" ? item.value : item.balance) : "";
  $("item-interest-rate").value = type === "debt" ? item?.interestRate ?? "" : "";
  $("item-mortgage-type").value = item?.mortgageType || "repayment";
  $("item-monthly-payment").value = type === "debt" ? item?.monthlyPayment ?? "" : "";
  $("item-monthly-rent").value = item?.monthlyRent ?? "";
  $("item-cash-rate").value = type === "asset" ? item?.interestRate ?? "" : "";
  $("item-investment-label").value = item?.investmentLabel ?? "";
  $("item-remaining-years").value = item?.remainingYears ?? "";
  $("item-confidence").value = item?.confidence || "estimate";
  $("item-access-bucket").value = item?.accessBucket || "review";
  $("item-share-cost").value = item?.costBasis ?? "";
  $("item-share-scheme").value = item?.employeeScheme || "";
  $("item-pension-access-age").value = item?.pensionAccessAge ?? "";
  formatGroupedNumberInputs($("item-form"));
  $("mortgage-fields").open = true;
  updateDialogFields(item?.linkedAssetId);
  $("item-dialog").showModal();
  $(item?.kind === "dc-pension" && trigger?.dataset?.reviewId ? "item-pension-access-age" : item || initialKind ? "item-amount" : "item-kind").focus();
}

function itemFromForm() {
  const kind = $("item-kind").value;
  const label = $("item-label").value.trim();
  const rawAmount = $("item-amount").value.replace(/,/g, "").trim();
  if (!kind) throw new Error("Choose what kind of item this is.");
  if (!rawAmount) throw new Error(dialogType === "asset" ? "Enter its current value." : "Enter the balance still owed.");
  const amount = Number(rawAmount);
  if (dialogType === "asset") {
    const asset = { id: editingId || createId("asset"), kind, label, value: amount, owner: $("item-owner").value || "primary", confidence: $("item-confidence").value };
    if (!$("share-tax-fields").hidden) {
      if ($("item-share-cost").value.trim()) asset.costBasis = groupedNumberValue($("item-share-cost"));
      if ($("item-share-scheme").value) asset.employeeScheme = $("item-share-scheme").value;
    }
    if (!$("access-bucket-field").hidden) asset.accessBucket = $("item-access-bucket").value;
    if (!$("pension-access-field").hidden && $("item-pension-access-age").value.trim()) asset.pensionAccessAge = Number($("item-pension-access-age").value);
    if (!$("rent-field").hidden && $("item-monthly-rent").value.trim()) asset.monthlyRent = groupedNumberValue($("item-monthly-rent"));
    if (!$("cash-rate-field").hidden && $("item-cash-rate").value.trim()) asset.interestRate = Number($("item-cash-rate").value);
    if (!$("investment-field").hidden && $("item-investment-label").value.trim()) asset.investmentLabel = $("item-investment-label").value.trim();
    return asset;
  }
  const debt = { id: editingId || createId("debt"), kind, label, balance: amount, owner: $("item-owner").value || "primary", confidence: $("item-confidence").value };
  if (kind === "mortgage") {
    debt.mortgageType = $("item-mortgage-type").value;
    if ($("item-interest-rate").value.trim()) debt.interestRate = Number($("item-interest-rate").value);
    if ($("item-remaining-years").value.trim()) debt.remainingYears = Number($("item-remaining-years").value);
    if ($("item-monthly-payment").value.trim()) debt.monthlyPayment = groupedNumberValue($("item-monthly-payment"));
    if (debt.monthlyPayment === undefined && (debt.interestRate === undefined || (debt.mortgageType === "repayment" && debt.remainingYears === undefined))) throw new Error("Enter your monthly mortgage payment, or add the interest rate and remaining term so we can calculate it.");
  }
  if (!$("debt-link-field").hidden && $("item-linked-asset").value) debt.linkedAssetId = $("item-linked-asset").value;
  return debt;
}

function restoreFocus() {
  const fallback = draft.assets.length + draft.debts.length ? $("asset-add") : $("first-piece-add");
  const target = lastTrigger?.isConnected && lastTrigger.getClientRects().length ? lastTrigger : document.querySelector(`[data-orbit-id="${editingId}"]`) || fallback;
  target.focus();
}

$("welcome-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const partnerName = $("welcome-partner-name").value.trim();
  const candidate = { ...draft, name: $("person-name").value.trim(), age: Number($("person-age").value), partnerName, partnerAge: partnerName && $("welcome-partner-age").value !== "" ? Number($("welcome-partner-age").value) : null };
  if (!candidate.name) { $("person-name").setCustomValidity("Enter a name or nickname."); $("person-name").reportValidity(); return; }
  const validation = validateDraft(candidate);
  if (!validation.valid) { const field = $(({name:"person-name",age:"person-age",partnerName:"welcome-partner-name",partnerAge:"welcome-partner-age"})[validation.errors[0].path] || "person-age");field.setCustomValidity(validation.errors[0].message);field.reportValidity();return; }
  draft = candidate;
  const setupUrl=new URL(location.href);setupUrl.searchParams.delete("start");setupUrl.searchParams.delete("example");history.replaceState(null,"",setupUrl);
  mode = "personal";
  $("welcome-screen").hidden = true;
  $("canvas-screen").hidden = false;
  render();
  $("canvas-title").focus?.();
  announce(`${draft.name}’s picture is ready. No assets or debts entered yet.`);
});
for (const id of ["person-name", "person-age", "welcome-partner-name", "welcome-partner-age"]) $(id).addEventListener("input", () => $(id).setCustomValidity(""));

$("first-piece-add").addEventListener("click", event => showItemDialog("asset", null, event.currentTarget));
$("first-debt-add").addEventListener("click", event => showItemDialog("debt", null, event.currentTarget));
for (const [id, type] of [["asset-add", "asset"], ["debt-add", "debt"]]) $(id).addEventListener("click", event => showItemDialog(type, null, event.currentTarget, "", holdingsOwner === "all" ? "primary" : holdingsOwner));
$("holdings-owner-filter").addEventListener("click", event => {
  const button = event.target.closest("[data-holdings-owner]"); if (!button) return;
  holdingsOwner = button.dataset.holdingsOwner;
  if (chartView === "owner") chartSelection = holdingsOwner === "all" ? null : holdingsOwner;
  const summary = summarizeDraft(draft); renderChart(summary); renderOrbit(summary);
  $("holdings-owner-filter").querySelector(`[data-holdings-owner="${holdingsOwner}"]`)?.focus();
});
$("first-piece").addEventListener("click", (event) => {
  const choice = event.target.closest("[data-first-kind]");
  if (choice) showItemDialog("asset", null, choice, choice.dataset.firstKind);
  const debtChoice=event.target.closest("[data-first-debt-kind]");
  if(debtChoice)showItemDialog("debt",null,debtChoice,debtChoice.dataset.firstDebtKind);
});
for (const id of ["step-to-flow", "continue-flow", "planning-to-flow"]) $(id).addEventListener("click", () => showScreen("flow"));
for (const id of ["step-to-assets", "planning-to-assets"]) $(id).addEventListener("click", () => showScreen("assets"));
for (const id of ["assets-to-planning", "flow-to-planning", "continue-planning"]) $(id).addEventListener("click", () => showScreen("planning"));
$("flow-date-mode").addEventListener("click",()=>{
  const timeline=$("flow-date-mode").getAttribute("aria-expanded")!=="true";
  $("flow-date-mode").setAttribute("aria-expanded",String(timeline));$("flow-date-mode").textContent=timeline ? "Calendar" : "Timeline";
  $("flow-time-track").hidden=!timeline;document.querySelector(".flow-timeline-footer").hidden=!timeline;$("flow-month").closest("label").hidden=timeline;$("flow-selected-month").hidden=!timeline;
});
$("flow-allocation-steps").addEventListener("click",event=>{const button=event.target.closest('[data-saving-period]');if(button){savingPeriod=button.dataset.savingPeriod;renderAllocationOverview(computeAllocationWaterfall(flowDraft,draft,{primary:draft.name,partner:draft.partnerName}));}});
$("flow-timeline-now").addEventListener("click",()=>{flowDraft.asOfMonth=flowDraft.timelineStartMonth || flowDraft.asOfMonth;renderFlow();});
$("flow-event-select").addEventListener("change",event=>{if(event.target.value){flowDraft.asOfMonth=event.target.value;renderFlow();}});
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
  document.querySelector(".flow-experimental").open=false;
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
  if(view==="diagram")renderPhoneSankey(buildMonthlyFlowDiagram(flowDraft,draft,{primary:draft.name,partner:draft.partnerName}));
  $("flow-view-diagram").setAttribute("aria-pressed", String(view === "diagram"));
  $("flow-view-bridge").setAttribute("aria-pressed", String(bridge));
  $("flow-view-sunburst").setAttribute("aria-pressed", String(sunburst));
  $("flow-view-treemap").setAttribute("aria-pressed", String(treemap));
  $("flow-view-donut").setAttribute("aria-pressed", String(donut));
  $("flow-view-table").setAttribute("aria-pressed", String(table));
  $("flow-units").textContent = "£ / month";
}
$("flow-view-diagram").addEventListener("click", () => setFlowView("diagram"));
$("flow-chart-add-income").addEventListener("click", () => openFlowEditor("income"));
$("flow-chart-add-expense").addEventListener("click", event => showDatedForm("spending", null, event.currentTarget));
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
    const value = input.value.trim() ? groupedNumberValue(input) : 0;
    if (!category || !Number.isFinite(value) || value < 0 || value > 100_000_000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.001) return;
    category.amount = value;
    renderFlow(); return;
  }
  if (["endDate","niExemptFrom"].includes(input.dataset.flowPayKey)) { flowDraft.pay[input.dataset.flowPayOwner][input.dataset.flowPayKey] = input.value; renderFlow(); return; }
  const value = input.value.trim() === "" ? (input.dataset.flowPayKey === "annualTakeHome" ? null : 0) : (input.dataset.flowPayKey?.endsWith("Rate") ? Number(input.value) : groupedNumberValue(input));
  const maximum = input.dataset.flowPayKey?.endsWith("Rate") ? 100 : 100_000_000;
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > maximum || Math.abs(value * 100 - Math.round(value * 100)) > 0.001)) {
    $("flow-input-error").textContent = maximum === 100 ? "Enter a pension contribution rate from 0% to 100%." : "Enter an amount from £0 to £100,000,000, with no more than two decimal places.";
    $("flow-input-error").hidden = false;
    return;
  }
  $("flow-input-error").hidden = true;
  if (input.dataset.flowPayOwner) {
    const owner=input.dataset.flowPayOwner,key=input.dataset.flowPayKey,card=input.closest('.flow-pay-card');
    if(value && ['employeePension','employeePensionRate','employerPension','employerPensionRate'].includes(key)){const paired=key.endsWith('Rate')?key.slice(0,-4):`${key}Rate`;$(`flow-pay-${owner}-${paired}`).value='';}
    const candidate={...flowDraft.pay[owner]};
    for(const field of document.querySelectorAll(`[data-flow-pay-owner="${owner}"]`)){const fieldKey=field.dataset.flowPayKey;candidate[fieldKey]=['endDate','niExemptFrom'].includes(fieldKey)?field.value:field.value===''?(fieldKey==='annualTakeHome'?null:0):(fieldKey.endsWith('Rate')?Number(field.value):groupedNumberValue(field));}
    let notice=card.querySelector('.pay-edit-error');if(!notice){notice=make('p','form-error pay-edit-error');notice.setAttribute('role','alert');card.append(notice);}
    try{summarizeMonthlyFlow({...flowDraft,pay:{...flowDraft.pay,[owner]:candidate}},draft);flowDraft.pay[owner]=candidate;notice.hidden=true;for(const field of card.querySelectorAll('[aria-invalid]'))field.removeAttribute('aria-invalid');}
    catch(error){notice.textContent=`Not applied: ${error.message} Correct the pay or pension amount to continue.`;notice.hidden=false;input.setAttribute('aria-invalid','true');return;}
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
  const amount = groupedNumberValue($("flow-custom-spending-new-amount"));
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
    const value = raw === "" ? null : (integer ? Number(raw) : groupedNumberValue(event.currentTarget));
    if (raw !== "" && (!Number.isFinite(value) || value < 0 || (integer && (value > 24 || !Number.isInteger(value))) || (!integer && (value > 100000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.001)))) {
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
  flowDraft.mortgageInclusionConfigured = true;
  renderFlow();
});
function showDatedForm(side, id = null, trigger = null) {
  const entry = flowDraft.datedEntries.find((item) => item.id === id);
  flowDatedRequireStart = entry?.label === "State Pension";
  editingFlowEntryId = entry?.id || null;
  flowEntryTrigger = trigger;
  $("flow-dated-replaces").replaceChildren(new Option("Choose an expense", ""), ...[...SPENDING_FIELDS.map(field=>({key:field.key,label:flowDraft.spendingLabels?.[field.key] || field.label})),...(flowDraft.customSpending || []).map(item=>({key:`custom:${item.id}`,label:item.label}))].map(item=>new Option(item.label,item.key)));
  $("flow-dated-replaces").value=entry?.replacesKey || "";
  $("flow-dated-replaces-row").hidden=!entry?.replacesKey;
  $("flow-dated-side").value = entry?.side || side;
  $("flow-dated-label").value = entry?.label || "";
  $("flow-dated-amount").value = entry?.amount ?? "";
  formatGroupedNumberInputs($("flow-dated-form"));
  $("flow-dated-frequency").value = entry?.frequency || "monthly";
  $("flow-dated-start").value = entry ? entry.startMonth || "" : flowDraft.asOfMonth;
  $("flow-dated-end").value = entry?.endMonth || "";
  syncDatedFrequency();
  $("flow-dated-start").required = flowDatedRequireStart;
  if (flowDatedRequireStart) $("flow-dated-start-hint").textContent = "Required";
  $("flow-dated-form-title").textContent = `${entry ? "Edit" : "Add"} ${$("flow-dated-side").value === "income" ? "income" : "expense"}`;
  $("flow-dated-delete").hidden = !entry;
  $("flow-dated-error").hidden = true;
  $("flow-dated-form").hidden = false;
  if(!$("flow-dated-dialog").open)$("flow-dated-dialog").showModal();
  syncDatedAmountLabel();
  $("flow-dated-label").focus();
  $("flow-dated-form").scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
$("flow-add-income").addEventListener("click", (event) => showDatedForm("income", null, event.currentTarget));
$("flow-add-expense").addEventListener("click", (event) => showDatedForm("spending", null, event.currentTarget));
$("flow-add-state-pension").addEventListener("click",()=>openStatePension("primary"));
function syncDatedAmountLabel(){
  $("flow-dated-amount").closest("label").firstChild.textContent=$("flow-dated-side").value==="income"?"Amount received after tax (£)":"Amount paid (£)";
}
$("flow-dated-side").addEventListener("change", () => {
  syncDatedAmountLabel();
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
$("flow-dated-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const amount = groupedNumberValue($("flow-dated-amount"));
    if (!$("flow-dated-label").value.trim() || !$("flow-dated-amount").value.trim() || !Number.isFinite(amount) || amount <= 0 || amount > 100_000_000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.001)
      throw new RangeError("Give this entry a name and an amount from £0.01 to £100,000,000.");
    if (flowDatedRequireStart && !$("flow-dated-start").value) throw new RangeError("Choose the month when State Pension begins.");
    const entry = { id: editingFlowEntryId || createId("entry"), side: $("flow-dated-side").value, label: $("flow-dated-label").value.trim(), amount, frequency: $("flow-dated-frequency").value, startMonth: $("flow-dated-start").value, endMonth: $("flow-dated-end").value };
    if(!$("flow-dated-replaces-row").hidden) {
      if(!$("flow-dated-replaces").value || entry.side !== "spending" || entry.frequency !== "monthly") throw new RangeError("Choose an expense and a monthly amount for a spending change.");
      entry.replacesKey=$("flow-dated-replaces").value;
    }
    const entries = flowDraft.datedEntries.filter((item) => item.id !== editingFlowEntryId).concat(entry);
    summarizeMonthlyFlow({ ...flowDraft, datedEntries: entries }, draft);
    flowDraft.datedEntries = entries;
    editingFlowEntryId = null;
    $("flow-dated-form").hidden = true; $("flow-dated-dialog").close();
    renderFlow();
    document.querySelector(`#flow-dated-list [data-flow-entry="${entry.id}"], [data-flow-schedule-entry="${entry.id}"]`)?.focus();
    announce(`${entry.label} saved to income and spending.`);
  } catch (error) {
    $("flow-dated-error").textContent = error.message;
    $("flow-dated-error").hidden = false;
  }
});
$("flow-dated-cancel").addEventListener("click", () => {
  $("flow-dated-form").hidden = true; $("flow-dated-dialog").close();
  if (flowEntryTrigger?.isConnected) flowEntryTrigger.focus();
});
$("flow-dated-delete").addEventListener("click", () => {
  if (!editingFlowEntryId) return;
  flowDraft.datedEntries = flowDraft.datedEntries.filter((entry) => entry.id !== editingFlowEntryId);
  editingFlowEntryId = null;
  $("flow-dated-form").hidden = true; $("flow-dated-dialog").close();
  renderFlow();
  $("flow-add-expense").focus();
  announce("Dated entry removed from the picture.");
});
function editLinkedAsset(id, trigger) {
  const asset = draft.assets.find((entry) => entry.id === id);
  if (!asset) return;
  holdingsOwner = asset.owner || "primary";
  renderOrbit(summarizeDraft(draft));
  showScreen("assets");
  returnToFlowAssetId = id;
  showItemDialog("asset", id, trigger);
}
for (const id of ["flow-source-list", "flow-use-list", "flow-rent-list", "flow-mortgage-list"]) $(id).addEventListener("click", (event) => {
  const state = event.target.closest("[data-flow-state-pension]"); if(state) { openStatePension(state.dataset.flowStatePension); return; }
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
$("access-review-items").addEventListener("click", (event) => {
  const button = event.target.closest("[data-review-id]");
  if (button) showItemDialog("asset", button.dataset.reviewId, button);
});
$("orbit-items").addEventListener("click", event => {
  const row = event.target.closest("[data-orbit-id]");
  if (row) showItemDialog(row.dataset.orbitType, row.dataset.orbitId, row.matches("button") ? row : row.querySelector("button"));
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
  if (chartView === "owner") holdingsOwner = chartSelection || "all";
  renderChart(summarizeDraft(draft));
  const scrollBehaviour = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  if (chartView === "owner") {
    renderOrbit(summarizeDraft(draft));
    if (chartSelection) document.querySelector(".holdings-panel")?.scrollIntoView({ block: "start", behavior: scrollBehaviour });
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
    if (item.kind === "mortgage") flowDraft.includeLinkedMortgage = true;
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
  $("profile-partner-age").value = draft.partnerAge ?? "";
  $("profile-partner-fields").hidden=!draft.partnerName;$("profile-add-partner").hidden=Boolean(draft.partnerName);
  $("profile-remove-partner").hidden=!draft.partnerName;$("profile-error").hidden=true;$("profile-removal-note").hidden=true;
  $("profile-dialog").showModal();
  $("profile-name").focus();
});
$("close-profile-button").addEventListener("click", () => $("profile-dialog").close());
$("profile-add-partner").addEventListener("click",()=>{$("profile-partner-fields").hidden=false;$("profile-add-partner").hidden=true;$("profile-partner").focus();});
$("profile-remove-partner").addEventListener("click",()=>{
  try{removePartnerFromPicture(draft,flowDraft,planningController.snapshot());}
  catch(e){$("profile-error").textContent=e.message;$("profile-error").hidden=false;return;}
  $("profile-partner").value='';$("profile-partner-age").value='';$("profile-partner-fields").hidden=true;$("profile-remove-partner").hidden=true;$("profile-add-partner").hidden=false;$("profile-removal-note").hidden=false;$("profile-error").hidden=true;
});
$("profile-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const candidate = { ...draft, name: $("profile-name").value.trim(), age: Number($("profile-age").value), partnerName: $("profile-partner").value.trim(), partnerAge: $("profile-partner").value.trim() && $("profile-partner-age").value!=="" ? Number($("profile-partner-age").value) : null };
  let removed=null;
  if(draft.partnerName && !candidate.partnerName){
    try{removed=removePartnerFromPicture(draft,flowDraft,planningController.snapshot());}
    catch(e){$("profile-error").textContent=e.message;$("profile-error").hidden=false;return;}
    if($("profile-removal-note").hidden && !window.confirm('Remove this partner and their pay, State Pension and partner-specific scenario settings? Assets and debts are kept.'))return;
  }
  if (!candidate.name) {
    $("profile-name").setCustomValidity("Enter a name or nickname.");
    $("profile-name").reportValidity();
    return;
  }
  const check = validateDraft(candidate);
  if (!check.valid) {
    const field = check.errors[0].path === "name" ? $("profile-name") : check.errors[0].path === "age" ? $("profile-age") : check.errors[0].path === "partnerAge" ? $("profile-partner-age") : $("profile-partner");
    field.setCustomValidity(check.errors[0].message);
    field.reportValidity();
    return;
  }
  draft = candidate;
  if(removed){flowDraft=removed.flow;planningController.restore(removed.planning);}
  syncFlowInputs();
  $("profile-dialog").close();
  render();
  announce("People in the picture updated.");
});
for (const id of ["profile-name", "profile-age", "profile-partner", "profile-partner-age"]) $(id).addEventListener("input", () => $(id).setCustomValidity(""));

$("clear-button").addEventListener("click", () => $("clear-dialog").showModal());
document.querySelector(".heading-utilities").addEventListener("click", (event) => {
  if (event.target.closest("button")) event.currentTarget.open = false;
});
const headerDisclosures = document.querySelectorAll(".storage-status, .heading-utilities");
document.addEventListener("click", (event) => {
  for (const disclosure of headerDisclosures) {
    if (!disclosure.contains(event.target)) disclosure.open = false;
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  for (const disclosure of headerDisclosures) {
    if (disclosure.open) {
      disclosure.open = false;
      disclosure.querySelector("summary").focus();
    }
  }
});
$("start-own-button").addEventListener("click", startBlankPicture);
$("reset-example-button").addEventListener("click", () => {
  accountController.detach();
  const sampleUrl=new URL(location.href);sampleUrl.searchParams.delete("start");sampleUrl.searchParams.set("example","1");history.replaceState(null,"",sampleUrl);
  mode="example";
  planningController.restore(null);
  draft = createPublicDemoHousehold();
  flowDraft = createExampleMonthlyFlow();
  inheritanceController.restore(null);
  insightsController.restore(null);
  syncFlowInputs();
  chartSelection = null;
  holdingsOwner = "all";
  render();
  announce("The fictional household example has been reset.");
});
for (const id of ["close-clear-button", "cancel-clear-button"]) $(id).addEventListener("click", () => $("clear-dialog").close());
function startBlankPicture() {
  accountController.detach();
  const setupUrl=new URL(location.href);setupUrl.searchParams.delete("example");setupUrl.searchParams.set("start","own");setupUrl.hash="assets";history.replaceState(null,"",setupUrl);
  showBlankPicture();
  document.dispatchEvent(new Event("picture-updated"));
}
function showBlankPicture() {
  draft = createBlankDraft();
  flowDraft = createBlankMonthlyFlow();
  planningController.restore(null);
  inheritanceController?.restore(null);
  insightsController?.restore(null);
  $("insights-screen").hidden=true;
  $("inheritance-screen").hidden=true;
  syncFlowInputs();
  mode = "personal";
  editingId = null;
  lastTrigger = null;
  returnToFlowAssetId = null;
  chartSelection = null;
  holdingsOwner = "all";
  $("clear-dialog").close();
  $("welcome-form").reset();
  $("welcome-partner").open = false;
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
  $("item-linked-asset").replaceChildren();
  $("item-kind").replaceChildren();
  $("item-owner").replaceChildren();
  $("asset-total").textContent = "£0";
  $("debt-total").textContent = "£0";
  $("net-worth").textContent = "£0";
  $("accessible-total").textContent = "£0";
  $("asset-count").textContent = "None entered";
  $("debt-count").textContent = "None entered";
  $("example-badge").textContent = "Your money picture";
  $("snapshot-description").textContent = "A snapshot from what you’ve entered. Add or change a piece whenever you like.";
  $("canvas-screen").hidden = true;
  $("flow-screen").hidden = true;
  $("planning-screen").hidden = true;
  $("welcome-screen").hidden = false;
  $("person-name").focus();
  announce("Ready for your household details.");
}
$("confirm-clear-button").addEventListener("click", startBlankPicture);

function openFlowEditor(side, owner = null) {
  const dialog = $("flow-edit-dialog");
  $("flow-pay-detail").hidden = side !== "income";
  $("flow-spending-detail").hidden = side !== "spending";
  $(side === "income" ? "flow-pay-detail" : "flow-spending-detail").open = true;
  document.querySelectorAll(".flow-pay-card").forEach((card,index)=>{ card.hidden=(index === 1 && !draft.partnerName) || (Boolean(owner) && index !== (owner === "primary" ? 0 : 1)); });
  $("flow-income-inputs").closest("fieldset").hidden = Boolean(owner);
  $("flow-pay-detail").querySelector(".flow-input-guidance").hidden = Boolean(owner);
  $("flow-edit-title").textContent = side === "spending" ? "Spending categories" : owner ? `${owner === "primary" ? draft.name : draft.partnerName} · pay and pension` : "Pay and other income";
  if (!dialog.open) dialog.showModal();
}
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

  const inputPanel = $("flow-input-shortcuts");
  inputPanel.before(document.querySelector(".flow-map-panel"));
  $("flow-diagram-view").after($("flow-split"));
  inputPanel.querySelector(".flow-input-heading").innerHTML = '<div><h2 id="flow-input-title">Entries</h2></div>';
  const dialog = document.createElement("dialog"); dialog.id="flow-edit-dialog"; dialog.className="flow-edit-dialog"; dialog.setAttribute("aria-labelledby","flow-edit-title");
  const dialogHeading = make("div","flow-dialog-heading"); const dialogTitle = make("h2","","Edit entry"); dialogTitle.id="flow-edit-title";
  const done = make("button","heading-action heading-action-secondary","Done"); done.type="button"; done.addEventListener("click",()=>{const invalid=dialog.querySelector('[aria-invalid="true"]');if(invalid){invalid.focus();return;}dialog.close();}); dialogHeading.append(dialogTitle,done);
  dialog.append(dialogHeading,editor); document.body.append(dialog); editorHeading.remove();
  dialog.addEventListener("close",()=>{payDetail.open=false;spendingDetail.open=false;syncFlowInputs();for(const x of dialog.querySelectorAll('[aria-invalid]'))x.removeAttribute('aria-invalid');for(const x of dialog.querySelectorAll('.pay-edit-error'))x.hidden=true;});
  for (const [detail,side] of [[payDetail,"income"],[spendingDetail,"spending"]]) detail.addEventListener("toggle",()=>{if(detail.open && !dialog.open)openFlowEditor(side);});
  const futureHeading=make("div","flow-scheduled-heading"); futureHeading.append(make("h3","","Scheduled"));
  const planFuture=make("button","flow-entry-add","+ Add future entry"); planFuture.type="button";
  planFuture.addEventListener("click",()=>$("flow-event-dialog").showModal());
  futureHeading.append(planFuture);
  const pensionRecords=make("section","flow-state-records"); pensionRecords.id="flow-state-records";
  inputPanel.append(pensionRecords,$("flow-dated-form"),futureHeading,$("flow-dated-list"),$("flow-dated-empty"));
  const datedDialog=document.createElement("dialog"); datedDialog.id="flow-dated-dialog"; datedDialog.className="flow-edit-dialog"; datedDialog.setAttribute("aria-labelledby","flow-dated-form-title"); datedDialog.append($("flow-dated-form"));document.body.append(datedDialog);
  datedDialog.addEventListener("close",()=>{$("flow-dated-form").hidden=true;});
  const property = document.createElement("details"); property.id="flow-more-entries"; property.className="flow-property-details"; property.innerHTML='<summary><span>Property cash flows<small id="flow-property-summary">Linked rent and mortgage amounts</small></span><span aria-hidden="true">⌄</span></summary>';
  extras.removeAttribute("id"); property.append($("flow-link-panel")); inputPanel.append(property);
  const actions=panel.querySelector(".flow-dated-actions") || extras.querySelector(".flow-dated-actions");
  actions.hidden=true; inputPanel.append(actions); panel.hidden=true; extras.hidden=true;
  inputPanel.append(extrasIntro); extrasIntro.hidden=true;
  $("flow-heading-copy")?.remove();
  const recordPair=make('div','flow-record-pair'),scheduledCard=make('section','flow-scheduled-card');scheduledCard.id='flow-scheduled-card';
  pensionRecords.before(recordPair);scheduledCard.append(futureHeading,$('flow-dated-list'),$('flow-dated-empty'));recordPair.append(pensionRecords,scheduledCard);
  document.querySelector(".flow-map-heading > div:first-child").append($("flow-view-help"));
  const timeline = $("flow-month").closest(".flow-timeline");
  const slider=make("input","flow-time-slider"); slider.id="flow-time-slider"; slider.type="range"; slider.min="0"; slider.max="360"; slider.step="1"; slider.setAttribute("aria-label","Month on timeline");
  slider.addEventListener("input",()=>{const start=flowDraft.timelineStartMonth || flowDraft.asOfMonth; const [year,month]=start.split("-").map(Number);const date=new Date(Date.UTC(year,month-1+Number(slider.value),1));flowDraft.asOfMonth=date.toISOString().slice(0,7);renderFlow();});
  timeline.querySelector(".flow-time-track").prepend(slider);
  const allocationPanel=$("flow-allocation-panel");
  $("flow-allocation-title").textContent="Where your saving goes";
  allocationPanel.querySelector(".section-kicker").textContent="Your chosen order";
  const settings=document.createElement("section"); settings.className="flow-routing-settings"; settings.innerHTML="<div class=\"saving-settings-heading\"><h3>Saving settings</h3></div>";
  settings.append($("flow-split"),allocationPanel.querySelector(".flow-allocation-toggle"),$("flow-allocation-settings"));allocationPanel.append(settings);
  const splitOld=$('flow-split'),split=document.createElement('section');split.id=splitOld.id;split.className=splitOld.className;while(splitOld.firstChild)split.append(splitOld.firstChild);splitOld.replaceWith(split);const splitSummary=$('flow-split-summary'),splitTitle=make('h4','',splitSummary.textContent);splitTitle.id=splitSummary.id;splitSummary.replaceWith(splitTitle);
  const info=make('details','saving-settings-info');info.innerHTML='<summary aria-label="About saving settings">i</summary><div class="saving-settings-info-body"></div>';const infoBody=info.querySelector('div');infoBody.append($('flow-split-help'),allocationPanel.querySelector('.flow-allocation-note'),allocationPanel.querySelector('.flow-allocation-source'));settings.querySelector('.saving-settings-heading').append(info);
  const toggle=allocationPanel.querySelector('.flow-allocation-toggle');toggle.lastChild.textContent=' Route new savings: cash → ISA → general';
  for(const small of $('flow-allocation-settings').querySelectorAll('label > small'))small.hidden=true;
  $('flow-reserve-months').closest('label').firstChild.textContent='Cash reserve · months ';
  $('flow-isa-allowance').closest('label').firstChild.textContent='Annual ISA limit · £ ';
  $('flow-trading-label').closest('label').firstChild.textContent='General account name ';
  allocationPanel.append(settings); inputPanel.after(allocationPanel);
  $("flow-split").classList.add("flow-routing-split");
  $("planning-content").append($("flow-growth-panel"));
  planningController = mountPlanning($("planning-content"), () => ({flow: flowDraft, holdings: draft, mode, editPension: (owner) => { showScreen("flow"); openStatePension(owner); }}));
}

function statePensionInput() {
  return {assumeFutureYears:$("flow-state-continue").checked,qualifyingYears:Number($("flow-state-years").value),assessmentMonth:$("flow-state-assessment").value,startMonth:$("flow-state-start").value,qualifyingUntil:$("flow-state-continue").checked ? $("flow-state-until").value : "",mode:$("flow-state-mode").value,weeklyForecast:$("flow-state-weekly").value === "" ? null : groupedNumberValue($("flow-state-weekly")),otherTaxableIncome:groupedNumberValue($("flow-state-other")) || 0};
}
function previewStatePension() {
  const input=resolveStatePensionInput(statePensionInput(),flowDraft,draft,$("flow-state-owner").value);
  $("flow-state-until-row").hidden=!$("flow-state-continue").checked;
  $("flow-state-weekly-row").hidden=input.mode !== "official";
  $("flow-state-other-row").hidden=input.mode === "record";
  $("flow-state-years").required=input.mode!=="official";
  if(input.mode!=="official" && !$("flow-state-years").value) { $("flow-state-preview").textContent="Add qualifying years from your NI record to start."; return; }
  try {
    const owner=$("flow-state-owner").value;
    const summary=summarizeMonthlyFlow({...flowDraft,asOfMonth:input.startMonth || flowDraft.asOfMonth},draft,{primary:draft.name,partner:draft.partnerName});
    const pay=summary.payDetails.find(item=>item.owner === owner);
    const result=estimateStatePension(input,input.assessmentMonth,pay.active ? Math.max(0,pay.annualGross-pay.employeePension) : 0);
    $("flow-state-preview").textContent=`${input.mode==='official' ? 'Official forecast.' : `${result.qualifyingYears} recorded + ${result.futureYears} assumed future years = ${result.totalYears} projected qualifying years.`}${result.annualGross === null ? " Add an official forecast or choose a simplified illustration to include an amount in the timeline." : ` ${money(result.annualGross)}/year before tax; ${money(result.annualTax)} illustrative Income Tax; ${money(result.monthlyNet)}/month after estimated tax from ${flowMonthLabel(result.startMonth)}.`}`;
  } catch(error) { $("flow-state-preview").textContent=error.message; }
}
function openStatePension(owner="primary") {
  const input=resolveStatePensionInput(flowDraft.statePensions?.[owner],flowDraft,draft,owner);
  $("flow-state-owner").replaceChildren(new Option(draft.name || "You","primary"),...(draft.partnerName ? [new Option(draft.partnerName,"partner")] : []));
  $("flow-state-owner").value=owner;
  $("flow-state-title").textContent=`${owner === "primary" ? draft.name || "Your" : draft.partnerName || "Partner"} · State Pension`;
  $("flow-state-years").value=input?.qualifyingYears ?? "";
  $("flow-state-assessment").value=input?.assessmentMonth || flowDraft.timelineStartMonth;
  $("flow-state-start").value=input?.startMonth || resolveStatePensionInput({qualifyingYears:0},flowDraft,draft,owner).startMonth;
  $("flow-state-continue").checked=input?.assumeFutureYears !== false && Boolean(input?.qualifyingUntil || flowDraft.pay[owner].endDate || flowDraft.pay[owner].annualGross || flowDraft.pay[owner].annualTakeHome);
  $("flow-state-until").value=input?.qualifyingUntil || flowDraft.pay[owner].endDate || $("flow-state-start").value;
  $("flow-state-mode").value=input?.mode || "simplified";
  $("flow-state-weekly").value=input?.weeklyForecast ?? "";
  $("flow-state-other").value=input?.otherTaxableIncome ?? 0;
  formatGroupedNumberInputs($("flow-state-form"));
  $("flow-state-remove").hidden=!input; $("flow-state-error").hidden=true;
  previewStatePension();
  if(!$("flow-state-dialog").open) $("flow-state-dialog").showModal();
  $("flow-state-years").focus();
}
function renderStatePensionRecords(summary) {
  const root=$("flow-state-records");root.replaceChildren(make("h3","","State Pension"));
  for(const owner of draft.partnerName ? ["primary","partner"] : ["primary"]) {
    const detail=summary.statePensionDetails.find(item=>item.owner===owner),person=owner==='primary' ? draft.name || 'You' : draft.partnerName;
    const row=make("button","flow-state-record");row.type="button";row.dataset.flowStateOwner=owner;row.setAttribute('aria-label',`Edit ${person} State Pension`);
    row.append(make("span","pension-person",person));
    if (detail) row.title = `${detail.qualifyingYears} recorded + ${detail.futureYears} assumed future qualifying years${detail.approximateStart ? "; approximate start from age" : ""}. Edit to review assumptions.`;
    const hasForecast=detail?.annualGross!==null && detail?.annualGross!==undefined;
    row.append(make("span","pension-amount",hasForecast ? `${money(detail.annualGross / 12)}/mo gross · ${detail.mode === 'official' ? 'Forecast' : 'NI estimate'}${detail.startMonth ? ` · ${flowMonthLabel(detail.startMonth)}` : ''}` : '—'));
    if(hasForecast && !detail.startMonth) {
      const flag=make('span','pension-flag',hasForecast ? '⚠ Start date needed' : '⚠ Forecast needed · Add estimate');flag.title=hasForecast ? 'Start month missing' : 'Forecast not added; excluded from income';row.append(flag);
    }
    row.append(make("span","flow-edit-label","›"));row.addEventListener("click",()=>openStatePension(owner));
    const shell=make('div','pension-record-shell');shell.append(row);
    if(!hasForecast){row.querySelector('.flow-edit-label').textContent='Add estimate ›';const link=make('a','pension-forecast-link','Get GOV.UK forecast ↗');link.href='https://www.gov.uk/check-state-pension';link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',`Get ${person} State Pension forecast on GOV.UK (opens in a new tab)`);shell.append(link);}
    root.append(shell);
  }
}

$("flow-state-close").addEventListener("click",()=>$("flow-state-dialog").close());
$("flow-state-owner").addEventListener("change",()=>openStatePension($("flow-state-owner").value));
$("flow-state-form").addEventListener("input",previewStatePension);
$("flow-state-form").addEventListener("change",previewStatePension);
$("flow-state-form").addEventListener("submit",event=>{
  event.preventDefault();
  try {
    const weeklyRaw=$("flow-state-weekly").value.trim(),weekly=groupedNumberValue($("flow-state-weekly")),otherIncome=groupedNumberValue($("flow-state-other"));
    if(weeklyRaw && (!Number.isFinite(weekly) || weekly<0 || weekly>10000 || Math.abs(weekly*100-Math.round(weekly*100))>0.001))throw new RangeError("Enter a weekly forecast from £0 to £10,000, with up to two decimal places.");
    if(!Number.isFinite(otherIncome)||otherIncome<0||otherIncome>100_000_000||Math.abs(otherIncome*100-Math.round(otherIncome*100))>0.001)throw new RangeError("Enter other taxable income from £0 to £100,000,000, with up to two decimal places.");
    if($("flow-state-mode").value!=="official" && !$("flow-state-years").value) throw new RangeError("Enter qualifying NI years, including zero if none are recorded.");
    if($("flow-state-continue").checked && !$("flow-state-until").value) throw new RangeError("Choose the last month of assumed qualifying years.");
    const owner=$("flow-state-owner").value, input=statePensionInput();
    estimateStatePension(input,input.assessmentMonth);
    const proposed={...(flowDraft.statePensions || {}),[owner]:input};
    summarizeMonthlyFlow({...flowDraft,statePensions:proposed},draft,{primary:draft.name,partner:draft.partnerName});
    flowDraft.statePensions=proposed;$("flow-state-dialog").close();renderFlow();document.querySelector(`[data-flow-state-owner="${owner}"]`)?.focus();announce("State Pension details saved. Future qualifying years remain an assumption.");
  } catch(error) { $("flow-state-error").textContent=error.message;$("flow-state-error").hidden=false; }
});
$("flow-state-remove").addEventListener("click",()=>{flowDraft.statePensions[$("flow-state-owner").value]=null;$("flow-state-dialog").close();renderFlow();});
$("flow-event-close").addEventListener("click",()=>$("flow-event-dialog").close());
$("flow-event-dialog").addEventListener("click",event=>{
  const choice=event.target.closest("[data-flow-event]");if(!choice)return;
  $("flow-event-dialog").close();
  const kind=choice.dataset.flowEvent;
  if(kind === "pension") {openStatePension("primary");return;}
  showDatedForm(["income","windfall"].includes(kind) ? "income" : "spending",null,document.querySelector(".flow-scheduled-heading button"));
  const [year,month]=flowDraft.asOfMonth.split("-").map(Number);
  $("flow-dated-start").value=new Date(Date.UTC(year,month,1)).toISOString().slice(0,7);
  if(["cost","windfall"].includes(kind)) {$("flow-dated-frequency").value="once";syncDatedFrequency();}
  if(kind === "change") {$("flow-dated-replaces-row").hidden=false;$("flow-dated-form-title").textContent="Change future spending";$("flow-dated-replaces").focus();}
});
$("flow-dated-replaces").addEventListener("change",()=>{
  const option=$("flow-dated-replaces").selectedOptions[0]; if(option?.value)$("flow-dated-label").value=`${option.textContent} (new amount)`;
});

setupFlowInputs();
inheritanceController=mountInheritance($("inheritance-content"),()=>({holdings:draft,flow:flowDraft,planning:planningController.snapshot()}));
insightsController=mountInsights($("insights-content"),()=>({holdings:draft,flow:flowDraft,planning:planningController.snapshot()}),{showSection:showScreen,applyScenario:value=>planningController.applyScenario(value),undoScenario:()=>planningController.undoScenario(),saveScenario:(name,value)=>planningController.saveScenario(name,value)});
document.querySelectorAll("[data-open-insights]").forEach(button=>button.addEventListener("click",()=>showScreen("insights")));
$("insights-screen").querySelectorAll("[data-section]").forEach(button=>button.addEventListener("click",()=>showScreen(button.dataset.section)));
document.querySelectorAll("[data-open-inheritance]").forEach(button=>button.addEventListener("click",()=>showScreen("inheritance")));
$("inheritance-screen").querySelectorAll("[data-section]").forEach(button=>button.addEventListener("click",()=>showScreen(button.dataset.section)));
syncFlowInputs();
render();
$("canvas-screen").hidden = false;

window.addEventListener('popstate',()=>{const section=location.hash.slice(1);if(['assets','flow','planning','inheritance','insights'].includes(section))showScreen(section,{updateHistory:false});});

if(['flow','planning','inheritance','insights'].includes(location.hash.slice(1)))showScreen(location.hash.slice(1));

let flowResizeTimer;window.addEventListener('resize',()=>{clearTimeout(flowResizeTimer);flowResizeTimer=setTimeout(()=>{if(!$("flow-screen").hidden)renderPhoneSankey(buildMonthlyFlowDiagram(flowDraft,draft,{primary:draft.name,partner:draft.partnerName}));},100);});

const entryParams=new URLSearchParams(location.search);
const restoreAccountDefault=entryParams.get('example')!=='1'&&entryParams.get('start')!=='own';
const accountController=mountAccountStorage({
  button:$('account-button'),
  editPeople:()=>$('edit-profile-button').click(),
  startHousehold:startBlankPicture,
  restoreOnLogin:()=>restoreAccountDefault,
  getPicture:()=>({version:1,example:mode==='example',holdings:structuredClone(draft),flow:structuredClone(flowDraft),planning:planningController.snapshot(),inheritance:inheritanceController.snapshot(),insights:insightsController.snapshot()}),
  restorePicture:picture=>{
    const section=location.hash.slice(1);
    draft=structuredClone(picture.holdings);flowDraft=structuredClone(picture.flow);mode='personal';chartSelection=null;holdingsOwner="all";
    planningController.restore(picture.planning);inheritanceController.restore(picture.inheritance);insightsController.restore(picture.insights);syncFlowInputs();render();showScreen(['assets','flow','planning','inheritance','insights'].includes(section)?section:'assets');
    if(!draft.name.trim() || draft.age==null){$('canvas-screen').hidden=true;$('flow-screen').hidden=true;$('planning-screen').hidden=true;$('inheritance-screen').hidden=true;$('insights-screen').hidden=true;$('welcome-screen').hidden=false;}
    announce('Saved account picture restored. Review your starting figures before planning.');
  },
  onEmpty:({forceReset=false}={})=>{
    if(forceReset){showBlankPicture();return;}
    const untouchedPublicExample=JSON.stringify(draft)===JSON.stringify(createPublicDemoHousehold())&&JSON.stringify(flowDraft)===JSON.stringify(createExampleMonthlyFlow());
    if(mode==='example'&&untouchedPublicExample)showBlankPicture();
    else if(mode==='example'){mode='personal';render();}
  },
});

if(entryParams.get('start')==='own')startBlankPicture();
if(entryParams.get('account')==='1'){
  const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('account');history.replaceState(history.state,'',cleanUrl);
  accountController.open();
}
