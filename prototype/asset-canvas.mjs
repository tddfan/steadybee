import {
  ASSET_TYPES,
  DEBT_TYPES,
  createBlankDraft,
  createAlexExample,
  createId,
  summarizeDraft,
  validateDraft,
} from "./asset-ledger.mjs";

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

const assetGroups = [
  { key: "available", title: "Available savings", barLabel: "Available", subtitle: "Cash and ISA", kinds: ["cash", "isa"], color: "#17674f" },
  { key: "investments", title: "Shares", subtitle: "Sale rules may vary", kinds: ["shares"], color: "#326b80" },
  { key: "pension", title: "Pension", barLabel: "Pension", subtitle: "Access depends on your rules", kinds: ["dc-pension"], color: "#5d4a81" },
  { key: "property", title: "Property", barLabel: "Property", subtitle: "Usually tied up in a home", kinds: ["home", "other-property"], color: "#9f6728" },
  { key: "possessions", title: "Possessions", barLabel: "Possessions", subtitle: "Usually sold to release value", kinds: ["car"], color: "#506e83" },
  { key: "other", title: "Other assets", barLabel: "Other", subtitle: "Access varies", kinds: ["other"], color: "#536b58" },
];
const debtGroups = [
  { key: "property", title: "Property borrowing", barLabel: "Mortgage", subtitle: "Mortgages", kinds: ["mortgage"], color: "#ad5331" },
  { key: "other", title: "Other borrowing", barLabel: "Other debt", subtitle: "Loans and cards", kinds: ["loan", "credit-card", "other"], color: "#95603b" },
];

let draft = createAlexExample();
let mode = "example";
let dialogType = null;
let editingId = null;
let draggedDebtId = null;
let lastTrigger = null;

function announce(message) { $("live-message").textContent = message; }
function itemName(item, types) { return item.label?.trim() || types[item.kind].label; }
function countLabel(count, noun) { return count ? `${count} ${noun}${count === 1 ? "" : "s"} entered` : "Nothing entered yet"; }

function setTotals() {
  const summary = summarizeDraft(draft);
  $("asset-total").textContent = money(summary.assetTotal);
  $("debt-total").textContent = money(summary.debtTotal);
  const netWorthText = money(summary.netWorth);
  $("net-worth").textContent = netWorthText;
  $("net-worth").style.fontSize = netWorthText.length > 15 ? "1.12rem" : netWorthText.length > 11 ? "1.4rem" : "";
  $("asset-count").textContent = countLabel(draft.assets.length, "asset");
  $("debt-count").textContent = countLabel(draft.debts.length, "debt");
  return summary;
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
  return notes.join(" · ");
}
function debtContext(debt) {
  const notes = [];
  if (debt.interestRate !== undefined) notes.push(`${plain(debt.interestRate)}% mortgage rate`);
  if (debt.remainingYears !== undefined) notes.push(`${plain(debt.remainingYears)} years left`);
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
function renderOrbit(summary) {
  const container = $("orbit-items");
  container.replaceChildren();
  for (const owner of ["primary", "partner", "shared"]) {
    if (owner !== "primary" && !draft.partnerName?.trim()) continue;
    const subtotal = summary.ownership[owner];
    const assets = draft.assets.filter((asset) => (asset.owner || "primary") === owner);
    const debts = draft.debts.filter((debt) => (debt.owner || "primary") === owner);
    const entries = [
      ...assets.flatMap((item) => [
        { type: "asset", item },
        ...debts.filter((debt) => debt.linkedAssetId === item.id).map((debt) => ({ type: "debt", item: debt })),
      ]),
      ...debts.filter((debt) => !assets.some((asset) => asset.id === debt.linkedAssetId)).map((item) => ({ type: "debt", item })),
    ];
    const group = make("section", `owner-cluster owner-cluster-${owner}`);
    group.dataset.ownerGroup = owner;
    group.setAttribute("aria-label", `${ownerName(owner)}: ${money(subtotal.assetTotal)} assets, ${money(subtotal.debtTotal)} debt, ${money(subtotal.netWorth)} net`);
    const header = make("div", "owner-cluster-heading");
    header.append(make("h2", "owner-cluster-title", ownerName(owner)));
    header.append(make("strong", "owner-cluster-net", money(subtotal.netWorth)));
    header.append(make("span", "owner-cluster-detail", `net · ${subtotal.assetCount} asset${subtotal.assetCount === 1 ? "" : "s"}${subtotal.debtCount ? ` · ${subtotal.debtCount} debt${subtotal.debtCount === 1 ? "" : "s"}` : ""}`));
    const nodes = make("div", "owner-nodes");
    for (const { type, item } of entries) {
      const types = type === "asset" ? ASSET_TYPES : DEBT_TYPES;
      const value = type === "asset" ? item.value : item.balance;
      const context = type === "asset" ? assetContext(item) : debtContext(item);
      const button = make("button", `orbit-card orbit-${type} orbit-owner-${owner}`);
      button.type = "button";
      button.dataset.orbitType = type;
      button.dataset.orbitId = item.id;
      button.setAttribute("aria-label", `Edit ${ownerName(owner)} ${itemName(item, types)}, ${type === "debt" ? "debt " : "asset "}${money(value)}${context ? `, ${context}` : ""}`);
      const pictogram = make("span", "orbit-icon");
      pictogram.append(icon(item.kind));
      const words = make("span", "orbit-words");
      words.append(make("span", "orbit-name", itemName(item, types)));
      words.append(make("strong", "orbit-value", `${type === "debt" ? "−" : ""}${compactMoney(value)}`));
      button.append(pictogram, words);
      nodes.append(button);
    }
    if (!entries.length) nodes.append(make("p", "orbit-empty", owner === "primary" ? "Add an asset or debt below to begin." : "No items yet."));
    group.append(header, nodes, make("span", "flow-arrow", "→"));
    container.append(group);
  }
}

function renderAsset(asset, group, summary) {
  const card = make("div", "entry-card");
  card.dataset.assetId = asset.id;
  card.style.setProperty("--entry-color", group.color);
  const details = make("div", "entry-details");
  details.append(make("p", "entry-name", itemName(asset, ASSET_TYPES)));
  details.append(make("p", "entry-meta", ASSET_TYPES[asset.kind].label));
  details.append(make("p", "entry-meta", `Owner: ${ownerName(asset.owner)}`));
  if (assetContext(asset)) details.append(make("p", "entry-extra", assetContext(asset)));
  const equity = summary.linkedEquity.find((row) => row.assetId === asset.id);
  if (equity?.linkedDebtTotal > 0) {
    details.append(make("p", "entry-extra", `Equity after linked debt: ${money(equity.equity)}`));
  }
  const side = make("div", "entry-side");
  side.append(make("strong", "entry-amount", money(asset.value)));
  const edit = make("button", "entry-edit", "Edit");
  edit.type = "button";
  edit.dataset.editAsset = asset.id;
  edit.setAttribute("aria-label", `Edit ${itemName(asset, ASSET_TYPES)}`);
  side.append(edit);
  card.append(details, side);
  if (["home", "other-property"].includes(asset.kind)) {
    card.addEventListener("dragover", (event) => {
      if (!draggedDebtId) return;
      event.preventDefault();
      card.classList.add("is-drop-target");
    });
    card.addEventListener("dragleave", () => card.classList.remove("is-drop-target"));
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("is-drop-target");
      const debt = draft.debts.find((entry) => entry.id === draggedDebtId);
      draggedDebtId = null;
      if (!debt || debt.kind !== "mortgage") return;
      debt.linkedAssetId = asset.id;
      render();
      announce(`${itemName(debt, DEBT_TYPES)} linked to ${itemName(asset, ASSET_TYPES)}. Totals have not changed.`);
    });
  }
  return card;
}

function renderDebt(debt, group) {
  const card = make("div", "entry-card");
  card.dataset.debtId = debt.id;
  card.style.setProperty("--entry-color", group.color);
  const details = make("div", "entry-details");
  details.append(make("p", "entry-name", itemName(debt, DEBT_TYPES)));
  let meta = DEBT_TYPES[debt.kind].label;
  if (debt.interestRate !== undefined) meta += ` · ${plain(debt.interestRate)}% current rate`;
  if (debt.remainingYears !== undefined) meta += ` · ${plain(debt.remainingYears)} years left`;
  details.append(make("p", "entry-meta", meta));
  details.append(make("p", "entry-meta", `Responsibility: ${ownerName(debt.owner)}`));
  const linked = draft.assets.find((asset) => asset.id === debt.linkedAssetId);
  if (linked) details.append(make("p", "entry-extra", `Linked to ${itemName(linked, ASSET_TYPES)}`));
  const side = make("div", "entry-side");
  side.append(make("strong", "entry-amount", money(debt.balance)));
  const edit = make("button", "entry-edit", "Edit");
  edit.type = "button";
  edit.dataset.editDebt = debt.id;
  edit.setAttribute("aria-label", `Edit ${itemName(debt, DEBT_TYPES)}`);
  side.append(edit);
  card.append(details, side);
  if (debt.kind === "mortgage" && draft.assets.some((asset) => ["home", "other-property"].includes(asset.kind))) {
    card.draggable = true;
    card.title = "Drag onto a property to link, or use Edit";
    card.addEventListener("dragstart", (event) => {
      draggedDebtId = debt.id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", debt.id);
      card.classList.add("is-dragging");
    });
    card.addEventListener("dragend", () => {
      draggedDebtId = null;
      card.classList.remove("is-dragging");
      document.querySelectorAll(".is-drop-target").forEach((target) => target.classList.remove("is-drop-target"));
    });
  }
  return card;
}

function renderList(id, items, groups, summary, type) {
  const list = $(id);
  list.replaceChildren();
  if (!items.length) {
    const empty = make("div", "empty-state");
    empty.append(make("span", "empty-icon", type === "asset" ? "＋" : "−"));
    empty.append(make("strong", "empty-title", type === "asset" ? "Your picture starts here" : "No debts entered yet"));
    empty.append(make("p", "", type === "asset" ? "Add a home, savings, pension or something else you own." : "Add a mortgage, loan or other amount you owe."));
    list.append(empty);
    return;
  }
  for (const group of groups) {
    const members = items.filter((item) => group.kinds.includes(item.kind));
    if (!members.length) continue;
    const section = make("section", "entry-group");
    const heading = make("div", "entry-group-heading");
    heading.append(make("span", "", group.title));
    heading.append(make("span", "group-subtitle", group.subtitle));
    const stack = make("div", "entry-stack");
    for (const item of members) stack.append(type === "asset" ? renderAsset(item, group, summary) : renderDebt(item, group));
    section.append(heading, stack);
    list.append(section);
  }
}

function render() {
  const summary = setTotals();
  $("person-heading").textContent = `${draft.name.trim() || "Your"}${draft.partnerName?.trim() ? ` & ${draft.partnerName.trim()}` : ""}’s`;
  $("snapshot-description").textContent = `${draft.name}, age ${draft.age}${draft.partnerName?.trim() ? ` · ${draft.partnerName.trim()}` : ""} · ${mode === "example" ? "Editable fictional example" : "Your entries"}. Tap a point to see or change its details.`;
  $("example-badge").textContent = mode === "example" ? "Fictional example · edit anything" : "Your money picture";
  $("start-own-button").hidden = mode !== "example";
  $("reset-example-button").hidden = mode !== "example";
  renderOrbit(summary);
  renderList("asset-list", draft.assets, assetGroups, summary, "asset");
  renderList("debt-list", draft.debts, debtGroups, summary, "debt");
  $("link-tip").hidden = !(draft.debts.some((debt) => debt.kind === "mortgage") && draft.assets.some((asset) => ["home", "other-property"].includes(asset.kind)));
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
  $("item-amount-label").textContent = dialogType === "asset" ? "What is it worth today?" : "How much is still owed?";
  $("item-amount-help").textContent = dialogType === "asset" ? "Use the current value, not what you originally paid." : "Enter the outstanding balance, not the original loan or monthly payment.";
  if (dialogType === "debt") populateLinks(selectedLink);
}

function showItemDialog(type, id = null, trigger = null) {
  dialogType = type;
  editingId = id;
  lastTrigger = trigger;
  const item = id ? draft[type === "asset" ? "assets" : "debts"].find((entry) => entry.id === id) : null;
  $("item-form").reset();
  $("item-error").hidden = true;
  $("item-error").textContent = "";
  $("item-dialog-kicker").textContent = item ? "Edit a piece" : "A new piece";
  $("item-dialog-title").textContent = `${item ? "Edit" : "Add"} ${type === "asset" ? "an asset" : "a debt"}`;
  $("save-item-button").textContent = item ? "Save changes" : "Add to my picture";
  $("delete-item-button").hidden = !item;
  populateKinds(type, item?.kind);
  populateOwners(type, item?.owner);
  $("item-label").value = item?.label || "";
  $("item-amount").value = item ? String(type === "asset" ? item.value : item.balance) : "";
  $("item-interest-rate").value = type === "debt" ? item?.interestRate ?? "" : "";
  $("item-monthly-rent").value = item?.monthlyRent ?? "";
  $("item-cash-rate").value = type === "asset" ? item?.interestRate ?? "" : "";
  $("item-investment-label").value = item?.investmentLabel ?? "";
  $("item-remaining-years").value = item?.remainingYears ?? "";
  $("mortgage-fields").open = Boolean(item?.interestRate !== undefined || item?.remainingYears !== undefined);
  updateDialogFields(item?.linkedAssetId);
  $("item-dialog").showModal();
  $("item-kind").focus();
}

function itemFromForm() {
  const kind = $("item-kind").value;
  const label = $("item-label").value.trim();
  const rawAmount = $("item-amount").value.trim();
  if (!kind) throw new Error("Choose what kind of item this is.");
  if (!rawAmount) throw new Error(dialogType === "asset" ? "Enter its current value." : "Enter the balance still owed.");
  const amount = Number(rawAmount);
  if (dialogType === "asset") {
    const asset = { id: editingId || createId("asset"), kind, label, value: amount, owner: $("item-owner").value || "primary" };
    if (!$("rent-field").hidden && $("item-monthly-rent").value.trim()) asset.monthlyRent = Number($("item-monthly-rent").value);
    if (!$("cash-rate-field").hidden && $("item-cash-rate").value.trim()) asset.interestRate = Number($("item-cash-rate").value);
    if (!$("investment-field").hidden && $("item-investment-label").value.trim()) asset.investmentLabel = $("item-investment-label").value.trim();
    return asset;
  }
  const debt = { id: editingId || createId("debt"), kind, label, balance: amount, owner: $("item-owner").value || "primary" };
  if (kind === "mortgage") {
    if ($("item-interest-rate").value.trim()) debt.interestRate = Number($("item-interest-rate").value);
    if ($("item-remaining-years").value.trim()) debt.remainingYears = Number($("item-remaining-years").value);
  }
  if (!$("debt-link-field").hidden && $("item-linked-asset").value) debt.linkedAssetId = $("item-linked-asset").value;
  return debt;
}

function restoreFocus() { if (lastTrigger?.isConnected) lastTrigger.focus(); else $(dialogType === "asset" ? "add-asset-button" : "add-debt-button").focus(); }

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

$("add-asset-button").addEventListener("click", (event) => showItemDialog("asset", null, event.currentTarget));
$("add-debt-button").addEventListener("click", (event) => showItemDialog("debt", null, event.currentTarget));
$("asset-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-asset]");
  if (button) showItemDialog("asset", button.dataset.editAsset, button);
});
$("debt-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-debt]");
  if (button) showItemDialog("debt", button.dataset.editDebt, button);
});
$("orbit-items").addEventListener("click", (event) => {
  const button = event.target.closest("[data-orbit-id]");
  if (button) showItemDialog(button.dataset.orbitType, button.dataset.orbitId, button);
});
$("item-kind").addEventListener("change", () => updateDialogFields());
$("close-item-button").addEventListener("click", () => $("item-dialog").close());
$("item-dialog").addEventListener("close", restoreFocus);
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
  render();
  announce("Alex and Gemma’s fictional example has been reset.");
});
for (const id of ["close-clear-button", "cancel-clear-button"]) $(id).addEventListener("click", () => $("clear-dialog").close());
$("confirm-clear-button").addEventListener("click", () => {
  draft = createBlankDraft();
  mode = "personal";
  draggedDebtId = null;
  editingId = null;
  lastTrigger = null;
  $("clear-dialog").close();
  $("welcome-form").reset();
  $("profile-form").reset();
  $("item-form").reset();
  $("asset-list").replaceChildren();
  $("debt-list").replaceChildren();
  $("orbit-items").replaceChildren();
  $("item-linked-asset").replaceChildren();
  $("item-kind").replaceChildren();
  $("item-owner").replaceChildren();
  $("asset-total").textContent = "£0";
  $("debt-total").textContent = "£0";
  $("net-worth").textContent = "£0";
  $("asset-count").textContent = "Nothing entered yet";
  $("debt-count").textContent = "Nothing entered yet";
  $("person-heading").textContent = "Your";
  $("example-badge").textContent = "Your money picture";
  $("snapshot-description").textContent = "A snapshot from what you’ve entered. Add or change a piece whenever you like.";
  $("canvas-screen").hidden = true;
  $("welcome-screen").hidden = false;
  $("person-name").focus();
  announce("Your name, age, assets and debts have been cleared from this tab.");
});

render();
$("canvas-screen").hidden = false;
