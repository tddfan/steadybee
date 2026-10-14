import {
  ASSET_TYPES,
  DEBT_TYPES,
  createBlankDraft,
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
  { key: "pension", title: "Pension", barLabel: "Pension", subtitle: "Access depends on your rules", kinds: ["dc-pension"], color: "#5d4a81" },
  { key: "property", title: "Property", barLabel: "Property", subtitle: "Usually tied up in a home", kinds: ["home", "other-property"], color: "#9f6728" },
  { key: "possessions", title: "Possessions", barLabel: "Possessions", subtitle: "Usually sold to release value", kinds: ["car"], color: "#506e83" },
  { key: "other", title: "Other assets", barLabel: "Other", subtitle: "Access varies", kinds: ["other"], color: "#536b58" },
];
const debtGroups = [
  { key: "property", title: "Property borrowing", barLabel: "Mortgage", subtitle: "Mortgages", kinds: ["mortgage"], color: "#ad5331" },
  { key: "other", title: "Other borrowing", barLabel: "Other debt", subtitle: "Loans and cards", kinds: ["loan", "credit-card", "other"], color: "#95603b" },
];

let draft = createBlankDraft();
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
  $("net-worth").textContent = money(summary.netWorth);
  $("asset-count").textContent = countLabel(draft.assets.length, "asset");
  $("debt-count").textContent = countLabel(draft.debts.length, "debt");
  return summary;
}

function renderComposition(id, items, field, groups) {
  const box = $(id);
  box.replaceChildren();
  box.classList.toggle("is-empty", items.length === 0);
  if (!items.length) {
    box.setAttribute("aria-label", "Nothing entered yet");
    box.append(make("span", "composition-empty", "Nothing entered yet"));
    return;
  }
  const total = items.reduce((sum, item) => sum + item[field], 0);
  if (total === 0) {
    box.setAttribute("aria-label", "£0 entered so far");
    box.append(make("span", "composition-empty", "£0 entered so far"));
    return;
  }
  for (const group of groups) {
    const value = items.filter((item) => group.kinds.includes(item.kind)).reduce((sum, item) => sum + item[field], 0);
    if (value <= 0) continue;
    const segment = make("span", "composition-segment");
    segment.style.flexGrow = String(value);
    segment.style.backgroundColor = group.color;
    segment.title = `${group.title}: ${money(value)}`;
    segment.setAttribute("aria-hidden", "true");
    if (value / total >= 0.35) {
      segment.append(make("span", "segment-label", group.barLabel));
      segment.append(make("strong", "segment-value", money(value)));
    }
    box.append(segment);
  }
  box.setAttribute("aria-label", groups.map((group) => {
    const value = items.filter((item) => group.kinds.includes(item.kind)).reduce((sum, item) => sum + item[field], 0);
    return value ? `${group.title} ${money(value)}` : "";
  }).filter(Boolean).join("; "));
}

function renderAsset(asset, group, summary) {
  const card = make("div", "entry-card");
  card.dataset.assetId = asset.id;
  card.style.setProperty("--entry-color", group.color);
  const details = make("div", "entry-details");
  details.append(make("p", "entry-name", itemName(asset, ASSET_TYPES)));
  details.append(make("p", "entry-meta", ASSET_TYPES[asset.kind].label));
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
  $("person-heading").textContent = `${draft.name.trim() || "Your"}’s`;
  $("snapshot-description").textContent = `Age ${draft.age} · A snapshot from what you’ve entered. Add or change a piece whenever you like.`;
  renderComposition("asset-visual", draft.assets, "value", assetGroups);
  renderComposition("debt-visual", draft.debts, "balance", debtGroups);
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
  $("item-label").value = item?.label || "";
  $("item-amount").value = item ? String(type === "asset" ? item.value : item.balance) : "";
  $("item-interest-rate").value = item?.interestRate ?? "";
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
  if (dialogType === "asset") return { id: editingId || createId("asset"), kind, label, value: amount };
  const debt = { id: editingId || createId("debt"), kind, label, balance: amount };
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
  $("profile-dialog").showModal();
  $("profile-name").focus();
});
$("close-profile-button").addEventListener("click", () => $("profile-dialog").close());
$("profile-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const candidate = { ...draft, name: $("profile-name").value.trim(), age: Number($("profile-age").value) };
  if (!candidate.name) {
    $("profile-name").setCustomValidity("Enter a name or nickname.");
    $("profile-name").reportValidity();
    return;
  }
  const check = validateDraft(candidate);
  if (!check.valid) {
    const field = check.errors[0].path === "name" ? $("profile-name") : $("profile-age");
    field.setCustomValidity(check.errors[0].message);
    field.reportValidity();
    return;
  }
  draft = candidate;
  $("profile-dialog").close();
  render();
  announce("Name and age updated.");
});
for (const id of ["profile-name", "profile-age"]) $(id).addEventListener("input", () => $(id).setCustomValidity(""));

$("clear-button").addEventListener("click", () => $("clear-dialog").showModal());
for (const id of ["close-clear-button", "cancel-clear-button"]) $(id).addEventListener("click", () => $("clear-dialog").close());
$("confirm-clear-button").addEventListener("click", () => {
  draft = createBlankDraft();
  draggedDebtId = null;
  editingId = null;
  lastTrigger = null;
  $("clear-dialog").close();
  $("welcome-form").reset();
  $("profile-form").reset();
  $("item-form").reset();
  $("asset-list").replaceChildren();
  $("debt-list").replaceChildren();
  $("asset-visual").replaceChildren();
  $("debt-visual").replaceChildren();
  $("asset-visual").removeAttribute("aria-label");
  $("debt-visual").removeAttribute("aria-label");
  $("item-linked-asset").replaceChildren();
  $("item-kind").replaceChildren();
  $("asset-total").textContent = "£0";
  $("debt-total").textContent = "£0";
  $("net-worth").textContent = "£0";
  $("asset-count").textContent = "Nothing entered yet";
  $("debt-count").textContent = "Nothing entered yet";
  $("person-heading").textContent = "Your";
  $("snapshot-description").textContent = "A snapshot from what you’ve entered. Add or change a piece whenever you like.";
  $("canvas-screen").hidden = true;
  $("welcome-screen").hidden = false;
  $("person-name").focus();
  announce("Your name, age, assets and debts have been cleared from this tab.");
});
