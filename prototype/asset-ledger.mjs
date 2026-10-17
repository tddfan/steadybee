/** A present-day household balance sheet. No growth, income, tax or advice. */

export const ASSET_TYPES = Object.freeze({
  home: Object.freeze({ label: "Home", group: "property" }),
  "other-property": Object.freeze({ label: "Other property", group: "property" }),
  cash: Object.freeze({ label: "Cash", group: "available" }),
  isa: Object.freeze({ label: "ISA", group: "available" }),
  shares: Object.freeze({ label: "Shares", group: "investments" }),
  "dc-pension": Object.freeze({ label: "DC pension", group: "pension" }),
  car: Object.freeze({ label: "Car", group: "possessions" }),
  other: Object.freeze({ label: "Other asset", group: "other" }),
});

export const DEBT_TYPES = Object.freeze({
  mortgage: Object.freeze({ label: "Mortgage", group: "property" }),
  loan: Object.freeze({ label: "Loan", group: "other" }),
  "credit-card": Object.freeze({ label: "Credit card", group: "other" }),
  other: Object.freeze({ label: "Other debt", group: "other" }),
});

const MAX_ITEMS = 100;
const MAX_MONEY = 100_000_000_000;
let idSequence = 0;

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isBlank = (value) => value === undefined || value === null || value === "";
const isMoney = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= MAX_MONEY &&
  Math.abs(value * 100 - Math.round(value * 100)) < 0.001;
const pennies = (value) => Math.round(value * 100);
const pounds = (value) => value / 100;
export const ACCESS_BUCKETS = Object.freeze(["accessible", "pension", "illiquid", "review"]);
export const CONFIDENCE_LEVELS = Object.freeze(["exact", "estimate", "review"]);
export function accessBucket(asset) {
  if (["cash", "isa"].includes(asset.kind)) return "accessible";
  if (asset.kind === "dc-pension") return "pension";
  if (["home", "other-property", "car"].includes(asset.kind)) return "illiquid";
  return asset.accessBucket || "review";
}

export function createBlankDraft() {
  return { name: "", age: null, partnerName: "", assets: [], debts: [] };
}

/** Separate fictional UK household used by public product previews. */
export function createPublicDemoHousehold() {
  return {
    name: "Sam", age: 39, partnerName: "Priya", partnerAge: 37,
    assets: [
      { id: "demo-home", kind: "home", label: "Main home", value: 360_000, owner: "shared" },
      // The fictional example assumes the standard access age; real schemes may differ.
      { id: "demo-sam-pension", kind: "dc-pension", label: "Workplace pension", value: 48_000, owner: "primary", pensionAccessAge: 57 },
      { id: "demo-sam-isa", kind: "isa", label: "ISA", value: 12_000, owner: "primary" },
      { id: "demo-sam-cash", kind: "cash", label: "Savings", value: 8_000, owner: "primary" },
      { id: "demo-sam-car", kind: "car", label: "Car", value: 6_000, owner: "primary" },
      { id: "demo-priya-pension", kind: "dc-pension", label: "Workplace pension", value: 35_000, owner: "partner", pensionAccessAge: 57 },
      { id: "demo-priya-isa", kind: "isa", label: "ISA", value: 8_500, owner: "partner" },
      { id: "demo-priya-cash", kind: "cash", label: "Savings", value: 10_000, owner: "partner" },
      { id: "demo-priya-car", kind: "car", label: "Car", value: 5_000, owner: "partner" },
      { id: "demo-contents", kind: "other", label: "Household contents", value: 5_000, owner: "shared", accessBucket: "illiquid" },
      { id: "demo-shared-cash", kind: "cash", label: "Joint savings", value: 7_000, owner: "shared" },
    ],
    debts: [
      { id: "demo-mortgage", kind: "mortgage", label: "Home mortgage", balance: 235_000, interestRate: 4.3, remainingYears: 25, linkedAssetId: "demo-home", owner: "shared" },
    ],
  };
}

export function createId(prefix = "item") {
  const safePrefix = /^[a-z][a-z0-9-]*$/i.test(prefix) ? prefix : "item";
  return `${safePrefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${++idSequence}`}`;
}

/** Validate before presenting calculated totals or accepting a card. */
export function validateDraft(draft) {
  const errors = [];
  const error = (path, message) => errors.push({ path, message });
  if (!isRecord(draft)) {
    error("draft", "The asset picture is missing.");
    return { valid: false, errors };
  }

  if (typeof draft.name !== "string" || draft.name.length > 60)
    error("name", "Use a name of at most 60 characters.");
  if (!isBlank(draft.partnerName) && (typeof draft.partnerName !== "string" || draft.partnerName.length > 60))
    error("partnerName", "Use a partner name of at most 60 characters.");
  if (
    !isBlank(draft.age) &&
    (typeof draft.age !== "number" ||
      !Number.isInteger(draft.age) ||
      draft.age < 18 ||
      draft.age > 120)
  )
    error("age", "Enter a whole age from 18 to 120.");

  if (!isBlank(draft.partnerAge) && (!Number.isInteger(draft.partnerAge) || draft.partnerAge < 18 || draft.partnerAge > 120))
    error("partnerAge", "Enter a partner age from 18 to 120.");
  const assets = Array.isArray(draft.assets) ? draft.assets : [];
  const debts = Array.isArray(draft.debts) ? draft.debts : [];
  if (!Array.isArray(draft.assets)) error("assets", "Include an asset list.");
  else if (assets.length > MAX_ITEMS) error("assets", "Enter at most 100 assets.");
  if (!Array.isArray(draft.debts)) error("debts", "Include a debt list.");
  else if (debts.length > MAX_ITEMS) error("debts", "Enter at most 100 debts.");

  const ids = new Set();
  const checkSharedFields = (item, path) => {
    if (!isRecord(item)) {
      error(path, "Include an item.");
      return false;
    }
    if (
      typeof item.id !== "string" ||
      !item.id.trim() ||
      item.id.length > 128 ||
      ids.has(item.id)
    )
      error(`${path}.id`, "Give every item a unique ID.");
    else ids.add(item.id);
    if (
      !isBlank(item.label) &&
      (typeof item.label !== "string" || item.label.length > 80)
    )
      error(`${path}.label`, "Use a label of at most 80 characters.");
    if (!isBlank(item.owner) && !["primary", "partner", "shared"].includes(item.owner))
      error(`${path}.owner`, "Choose who owns or owes this item.");
    if (["partner", "shared"].includes(item.owner) && !(typeof draft.partnerName === "string" && draft.partnerName.trim()))
      error(`${path}.owner`, "Add a partner name before assigning items to a partner or both people.");
    return true;
  };

  assets.forEach((asset, index) => {
    const path = `assets[${index}]`;
    if (!checkSharedFields(asset, path)) return;
    if (!Object.hasOwn(ASSET_TYPES, asset.kind))
      error(`${path}.kind`, "Choose a listed asset type.");
    if (!isMoney(asset.value))
      error(`${path}.value`, "Enter a finite amount from £0 to £100 billion, to the penny.");
    if (!isBlank(asset.costBasis) && (asset.kind !== "shares" || !isMoney(asset.costBasis)))
      error(`${path}.costBasis`, "Enter the total share purchase cost as a non-negative amount.");
    if (!isBlank(asset.employeeScheme) && (asset.kind !== "shares" || asset.employeeScheme !== "saye"))
      error(`${path}.employeeScheme`, "Choose a supported employee share scheme.");
    if (!isBlank(asset.confidence) && !CONFIDENCE_LEVELS.includes(asset.confidence))
      error(`${path}.confidence`, "Choose exact, estimate, or needs review.");
    if (!isBlank(asset.accessBucket) &&
      (!["shares", "other"].includes(asset.kind) || !["accessible", "illiquid", "review"].includes(asset.accessBucket)))
      error(`${path}.accessBucket`, "Choose an access category for shares or other assets.");
    if (!isBlank(asset.pensionAccessAge) &&
      (asset.kind !== "dc-pension" || !Number.isInteger(asset.pensionAccessAge) || asset.pensionAccessAge < 18 || asset.pensionAccessAge > 100))
      error(`${path}.pensionAccessAge`, "Enter a scheme access age from 18 to 100.");
    if (!isBlank(asset.monthlyRent) &&
      (!isMoney(asset.monthlyRent) || !["home", "other-property"].includes(asset.kind)))
      error(`${path}.monthlyRent`, "Enter monthly rent for a property, from £0 to £100 billion.");
    if (!isBlank(asset.interestRate) &&
      (asset.kind !== "cash" || typeof asset.interestRate !== "number" ||
        !Number.isFinite(asset.interestRate) || asset.interestRate < 0 || asset.interestRate > 100))
      error(`${path}.interestRate`, "Enter a current cash rate from 0% to 100%.");
    if (!isBlank(asset.investmentLabel) &&
      (!["isa", "dc-pension"].includes(asset.kind) || typeof asset.investmentLabel !== "string" || asset.investmentLabel.length > 80))
      error(`${path}.investmentLabel`, "Use an investment description of at most 80 characters for an ISA or pension.");
  });

  debts.forEach((debt, index) => {
    const path = `debts[${index}]`;
    if (!checkSharedFields(debt, path)) return;
    if (!Object.hasOwn(DEBT_TYPES, debt.kind))
      error(`${path}.kind`, "Choose a listed debt type.");
    if (!isMoney(debt.balance))
      error(`${path}.balance`, "Enter a finite balance from £0 to £100 billion, to the penny.");
    if (!isBlank(debt.confidence) && !CONFIDENCE_LEVELS.includes(debt.confidence))
      error(`${path}.confidence`, "Choose exact, estimate, or needs review.");
    if (
      !isBlank(debt.interestRate) &&
      (typeof debt.interestRate !== "number" ||
        !Number.isFinite(debt.interestRate) ||
        debt.interestRate < 0 ||
        debt.interestRate > 100)
    )
      error(`${path}.interestRate`, "Enter a current rate from 0% to 100%.");
    if (
      !isBlank(debt.remainingYears) &&
      (typeof debt.remainingYears !== "number" ||
        !Number.isFinite(debt.remainingYears) ||
        debt.remainingYears <= 0 ||
        debt.remainingYears > 100)
    )
      error(`${path}.remainingYears`, "Enter more than 0 and up to 100 years remaining.");
    if (!isBlank(debt.monthlyPayment) &&
      (debt.kind !== "mortgage" || !isMoney(debt.monthlyPayment)))
      error(`${path}.monthlyPayment`, "Enter an explicit monthly mortgage payment, to the penny.");
    if (!isBlank(debt.linkedAssetId)) {
      const linked = assets.find((asset) => asset?.id === debt.linkedAssetId);
      if (!linked ||
        (debt.kind === "mortgage" &&
          !["home", "other-property"].includes(linked.kind)))
        error(`${path}.linkedAssetId`, "Link a mortgage to a property, or choose an existing asset.");
    }
  });

  return { valid: errors.length === 0, errors };
}

/** All totals use whole pennies; linked equity is a view, not an extra asset. */
export function summarizeDraft(draft) {
  const review = validateDraft(draft);
  if (!review.valid)
    throw new Error(`Invalid asset draft: ${review.errors[0].path}: ${review.errors[0].message}`);

  const assetTotal = draft.assets.reduce((sum, asset) => sum + pennies(asset.value), 0);
  const debtTotal = draft.debts.reduce((sum, debt) => sum + pennies(debt.balance), 0);
  const accessTotals = Object.fromEntries(ACCESS_BUCKETS.map((bucket) => [bucket,
    pounds(draft.assets.filter((asset) => accessBucket(asset) === bucket)
      .reduce((sum, asset) => sum + pennies(asset.value), 0)),
  ]));
  const assetGroups = Object.entries(ASSET_TYPES)
    .map(([kind, type]) => {
      const items = draft.assets.filter((asset) => asset.kind === kind);
      return {
        kind,
        label: type.label,
        total: pounds(items.reduce((sum, item) => sum + pennies(item.value), 0)),
        count: items.length,
      };
    })
    .filter((group) => group.count > 0);
  const debtGroups = Object.entries(DEBT_TYPES)
    .map(([kind, type]) => {
      const items = draft.debts.filter((debt) => debt.kind === kind);
      return {
        kind,
        label: type.label,
        total: pounds(items.reduce((sum, item) => sum + pennies(item.balance), 0)),
        count: items.length,
      };
    })
    .filter((group) => group.count > 0);
  const linkedEquity = draft.assets
    .filter((asset) => ["home", "other-property"].includes(asset.kind))
    .map((asset) => {
      const linkedDebt = draft.debts
        .filter((debt) => debt.linkedAssetId === asset.id)
        .reduce((sum, debt) => sum + pennies(debt.balance), 0);
      return {
        assetId: asset.id,
        assetValue: asset.value,
        linkedDebtTotal: pounds(linkedDebt),
        equity: pounds(pennies(asset.value) - linkedDebt),
      };
    });
  const ownership = Object.fromEntries(["primary", "partner", "shared"].map((owner) => {
    const ownedAssets = draft.assets.filter((asset) => (asset.owner || "primary") === owner);
    const ownedDebts = draft.debts.filter((debt) => (debt.owner || "primary") === owner);
    const ownedAssetPennies = ownedAssets.reduce((sum, asset) => sum + pennies(asset.value), 0);
    const ownedDebtPennies = ownedDebts.reduce((sum, debt) => sum + pennies(debt.balance), 0);
    return [owner, {
      assetTotal: pounds(ownedAssetPennies),
      debtTotal: pounds(ownedDebtPennies),
      netWorth: pounds(ownedAssetPennies - ownedDebtPennies),
      assetCount: ownedAssets.length,
      debtCount: ownedDebts.length,
    }];
  }));

  return {
    assetTotal: pounds(assetTotal),
    debtTotal: pounds(debtTotal),
    accessTotals,
    netWorth: pounds(assetTotal - debtTotal),
    assetGroups,
    debtGroups,
    linkedEquity,
    ownership,
  };
}
