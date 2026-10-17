import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ASSET_TYPES,
  accessBucket,
  DEBT_TYPES,
  createBlankDraft,
  createPublicDemoHousehold,
  createId,
  summarizeDraft,
  validateDraft,
} from "../prototype/asset-ledger.mjs";

function filledDraft() {
  return {
    name: "Sam",
    age: 52,
    assets: [
      { id: "home-1", kind: "home", label: "My home", value: 480_000 },
      { id: "isa-1", kind: "isa", label: "Stocks and shares ISA", value: 35_000 },
      { id: "car-1", kind: "car", label: "Car", value: 9_000 },
    ],
    debts: [
      {
        id: "mortgage-1",
        kind: "mortgage",
        label: "Home mortgage",
        balance: 190_000,
        interestRate: 4.5,
        remainingYears: 17,
        linkedAssetId: "home-1",
      },
    ],
  };
}

test("blank draft supports an honest zero-entered state", () => {
  const draft = createBlankDraft();
  assert.deepEqual(draft, { name: "", age: null, partnerName: "", assets: [], debts: [] });
  assert.deepEqual(validateDraft(draft), { valid: true, errors: [] });
  assert.deepEqual(summarizeDraft(draft), {
    assetTotal: 0,
    debtTotal: 0,
    accessTotals: { accessible: 0, pension: 0, illiquid: 0, review: 0 },
    netWorth: 0,
    assetGroups: [],
    debtGroups: [],
    linkedEquity: [],
    ownership: Object.fromEntries(["primary", "partner", "shared"].map((owner) => [owner, { assetTotal: 0, debtTotal: 0, netWorth: 0, assetCount: 0, debtCount: 0 }])),
  });
});

test("the public fictional household reconciles shared items once", () => {
  const example = createPublicDemoHousehold();
  assert.equal(example.age, 39);
  assert.equal(example.partnerName, "Priya");
  assert.deepEqual(validateDraft(example), { valid: true, errors: [] });
  const result = summarizeDraft(example);
  assert.equal(result.assetTotal, 504_500);
  assert.equal(result.debtTotal, 235_000);
  assert.equal(result.netWorth, 269_500);
  assert.deepEqual(result.accessTotals, { accessible: 45_500, pension: 83_000, illiquid: 376_000, review: 0 });
  assert.equal(example.assets.length, 11);
  assert.deepEqual(example.assets.filter((asset) => asset.kind === "dc-pension").map((asset) => asset.pensionAccessAge), [57, 57]);
  assert.equal(example.assets.find((asset) => asset.id === "demo-home").owner, "shared");
  assert.equal(example.debts[0].owner, "shared");
  assert.deepEqual(example.assets.filter((asset) => asset.owner === "partner").map((asset) => asset.value), [35_000, 8_500, 10_000, 5_000]);
  assert.equal(result.linkedEquity.find((entry) => entry.assetId === "demo-home").equity, 125_000);
  assert.deepEqual(result.ownership, {
    primary: { assetTotal: 74_000, debtTotal: 0, netWorth: 74_000, assetCount: 4, debtCount: 0 },
    partner: { assetTotal: 58_500, debtTotal: 0, netWorth: 58_500, assetCount: 4, debtCount: 0 },
    shared: { assetTotal: 372_000, debtTotal: 235_000, netWorth: 137_000, assetCount: 3, debtCount: 1 },
  });
  example.assets[0].value = 1;
  assert.equal(createPublicDemoHousehold().assets[0].value, 360_000);
});

test("ownership labels do not change value and partner items require a partner", () => {
  const draft = createPublicDemoHousehold();
  const before = summarizeDraft(draft);
  draft.assets.find((asset) => asset.id === "demo-sam-pension").owner = "partner";
  const after = summarizeDraft(draft);
  assert.equal(after.netWorth, before.netWorth);
  assert.equal(after.ownership.primary.netWorth, before.ownership.primary.netWorth - 48_000);
  assert.equal(after.ownership.partner.netWorth, before.ownership.partner.netWorth + 48_000);
  draft.partnerName = "";
  assert.ok(validateDraft(draft).errors.some((error) => error.path.endsWith(".owner")));
  draft.partnerName = 12;
  assert.ok(validateDraft(draft).errors.some((error) => error.path === "partnerName"));
});

test("shares require access review until explicitly classified, and confidence is validated", () => {
  const draft = createPublicDemoHousehold();
  draft.assets.push({ id: "test-shares", kind: "shares", value: 2_000, accessBucket: "illiquid", owner: "primary" });
  const shares = draft.assets.find((asset) => asset.kind === "shares");
  assert.equal(accessBucket(shares), "illiquid");
  delete shares.accessBucket;
  assert.equal(accessBucket(shares), "review");
  shares.accessBucket = "accessible";
  shares.confidence = "exact";
  assert.equal(summarizeDraft(draft).accessTotals.accessible, 47_500);
  shares.accessBucket = "pension";
  assert.ok(validateDraft(draft).errors.some((error) => error.path.endsWith("accessBucket")));
  shares.accessBucket = "review";
  shares.confidence = "uncertain";
  assert.ok(validateDraft(draft).errors.some((error) => error.path.endsWith("confidence")));
});

test("known item kinds have clear labels and asset-access groups", () => {
  assert.deepEqual(Object.keys(ASSET_TYPES), [
    "home", "other-property", "cash", "isa", "shares", "dc-pension", "car", "other",
  ]);
  assert.deepEqual(Object.keys(DEBT_TYPES), ["mortgage", "loan", "credit-card", "other"]);
  assert.equal(ASSET_TYPES.cash.group, "available");
  assert.equal(ASSET_TYPES.isa.group, "available");
  assert.equal(ASSET_TYPES.shares.group, "investments");
  assert.equal(ASSET_TYPES["dc-pension"].group, "pension");
  assert.equal(ASSET_TYPES.home.group, "property");
  assert.equal(ASSET_TYPES.car.group, "possessions");
});

test("assets, debts, and a linked mortgage reconcile without double counting", () => {
  const draft = filledDraft();
  const before = structuredClone(draft);
  const result = summarizeDraft(draft);
  assert.equal(result.assetTotal, 524_000);
  assert.equal(result.debtTotal, 190_000);
  assert.equal(result.netWorth, 334_000);
  assert.deepEqual(result.linkedEquity, [{
    assetId: "home-1", assetValue: 480_000, linkedDebtTotal: 190_000, equity: 290_000,
  }]);
  assert.equal(result.assetGroups.reduce((sum, group) => sum + group.total, 0), result.assetTotal);
  assert.equal(result.debtGroups.reduce((sum, group) => sum + group.total, 0), result.debtTotal);
  assert.deepEqual(draft, before);
});

test("multiple mortgages link to one property and an unlinked debt stays in total debt", () => {
  const draft = filledDraft();
  draft.debts.push(
    { id: "second-charge", kind: "mortgage", label: "Second charge", balance: 20_000, linkedAssetId: "home-1" },
    { id: "loan-1", kind: "loan", label: "Personal loan", balance: 5_000 },
  );
  const result = summarizeDraft(draft);
  assert.equal(result.debtTotal, 215_000);
  assert.equal(result.netWorth, 309_000);
  assert.equal(result.linkedEquity[0].linkedDebtTotal, 210_000);
  assert.equal(result.linkedEquity[0].equity, 270_000);
});

test("the snapshot supports negative equity and zero-value items", () => {
  const draft = filledDraft();
  draft.assets[0].value = 100_000;
  draft.assets[1].value = 0;
  draft.debts[0].balance = 190_000;
  const result = summarizeDraft(draft);
  assert.equal(result.linkedEquity[0].equity, -90_000);
  assert.equal(result.netWorth, -81_000);
  assert.equal(result.assetGroups.find((group) => group.kind === "isa").count, 1);
});

test("money totals preserve pennies", () => {
  const draft = createBlankDraft();
  draft.assets.push(
    { id: "cash-1", kind: "cash", value: 0.1 },
    { id: "cash-2", kind: "cash", value: 0.2 },
  );
  draft.debts.push({ id: "debt-1", kind: "other", balance: 0.05 });
  const result = summarizeDraft(draft);
  assert.equal(result.assetTotal, 0.3);
  assert.equal(result.debtTotal, 0.05);
  assert.equal(result.netWorth, 0.25);
});

test("invalid money, rates, terms, and profile values are rejected", () => {
  const cases = [
    ["assets[0].value", (draft) => { draft.assets[0].value = -1; }],
    ["assets[0].value", (draft) => { draft.assets[0].value = Number.POSITIVE_INFINITY; }],
    ["assets[0].value", (draft) => { draft.assets[0].value = "480000"; }],
    ["assets[0].value", (draft) => { draft.assets[0].value = 12.345; }],
    ["debts[0].balance", (draft) => { draft.debts[0].balance = Number.NaN; }],
    ["debts[0].interestRate", (draft) => { draft.debts[0].interestRate = -0.1; }],
    ["debts[0].interestRate", (draft) => { draft.debts[0].interestRate = 101; }],
    ["debts[0].remainingYears", (draft) => { draft.debts[0].remainingYears = 0; }],
    ["debts[0].remainingYears", (draft) => { draft.debts[0].remainingYears = 101; }],
    ["age", (draft) => { draft.age = 50.5; }],
    ["age", (draft) => { draft.age = 121; }],
    ["assets[0].monthlyRent", (draft) => { draft.assets[0].monthlyRent = -1; }],
    ["assets[1].interestRate", (draft) => { draft.assets[1].interestRate = 4; }],
    ["assets[1].investmentLabel", (draft) => { draft.assets[1].investmentLabel = "a".repeat(81); }],
    ["assets[0].owner", (draft) => { draft.assets[0].owner = "someone else"; }],
    ["assets[0].owner", (draft) => { draft.assets[0].owner = "shared"; }],
  ];
  for (const [path, mutate] of cases) {
    const draft = filledDraft();
    mutate(draft);
    assert.equal(validateDraft(draft).valid, false, path);
    assert.ok(validateDraft(draft).errors.some((error) => error.path === path), path);
    assert.throws(() => summarizeDraft(draft), /invalid/i, path);
  }
});

test("duplicate IDs, missing links, and non-property mortgage links are rejected", () => {
  const cases = [
    ["debts[0].id", (draft) => { draft.debts[0].id = "home-1"; }],
    ["debts[0].linkedAssetId", (draft) => { draft.debts[0].linkedAssetId = "missing"; }],
    ["debts[0].linkedAssetId", (draft) => { draft.debts[0].linkedAssetId = "isa-1"; }],
    ["assets[0].kind", (draft) => { draft.assets[0].kind = "fund"; }],
  ];
  for (const [path, mutate] of cases) {
    const draft = filledDraft();
    mutate(draft);
    assert.ok(validateDraft(draft).errors.some((error) => error.path === path), path);
  }
});

test("item IDs are usable and unique for newly added cards", () => {
  const a = createId("asset");
  const b = createId("asset");
  assert.match(a, /^asset-/);
  assert.notEqual(a, b);
});
test('SAYE purchase cost is recorded separately from current market value and validated',()=>{
  const draft=createPublicDemoHousehold(),shares={id:'test-shares',kind:'shares',value:2_000,costBasis:1_500,employeeScheme:'saye',owner:'primary'};draft.assets.push(shares);
  assert.equal(shares.value,2_000);assert.equal(shares.costBasis,1_500);assert.equal(shares.employeeScheme,'saye');
  shares.costBasis=-1;assert.ok(validateDraft(draft).errors.some(error=>error.path.endsWith('.costBasis')));
});
