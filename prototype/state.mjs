/** Personal information only. This module never calculates retirement outcomes. */
export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = "steadybee:personal-draft:v1";

const STATUSES = new Set(["provided", "estimated", "unknown"]);
const ROUTES = new Set(["dc", "income", "retired"]);
const SCOPES = new Set(["individual", "household"]);
const OVERRIDES = {
  retirementAge: [18, 100, true],
  partnerRetirementAge: [18, 100, true],
  monthlySpending: [0, 1_000_000],
  monthlyContributions: [0, 1_000_000],
  partTimeAnnual: [0, 10_000_000],
  partTimeEndAge: [18, 100, true],
  majorCost: [0, 100_000_000],
  majorCostAge: [18, 100, true],
};
let sequence = 0;
const clone = (value) => JSON.parse(JSON.stringify(value));
const id = (prefix) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${++sequence}`}`;
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function field(value = null, status = "provided") {
  return value === null || value === undefined || value === ""
    ? { value: null, status: "unknown" }
    : { value, status };
}

export function valueOf(value) {
  return isObject(value) &&
    value.status !== "unknown" &&
    Number.isFinite(value.value)
    ? value.value
    : null;
}

function emptyProfile(route) {
  return {
    age: field(),
    targetRetirementAge: field(),
    pensionTotal: field(),
    nonPensionTotal: field(),
    annualPensionIncome: field(),
    monthlySpending: field(),
    retirementStatus: route === "retired" ? "already-retired" : "working",
    incomeBasis: "unknown",
    savingsAccessibility: route === "dc" ? "unknown" : "accessible",
  };
}

export function createDraft(route = "dc", scope = "individual") {
  if (!ROUTES.has(route)) throw new Error("Unsupported setup route.");
  if (!SCOPES.has(scope)) throw new Error("Unsupported planning scope.");
  return {
    schemaVersion: SCHEMA_VERSION,
    draftId: id("draft"),
    mode: "personal-draft",
    revision: 1,
    updatedAt: new Date().toISOString(),
    route,
    planningScope: scope,
    spendingBasis: scope,
    householdStatus: scope === "household" ? "pending" : "individual",
    profile: emptyProfile(route),
    partner: null,
    details: {
      monthlyContributions: field(),
      employerIncluded: null,
      pensionAccessAge: field(),
      incomeStreams: [],
      cashTotal: field(),
      investedTotal: field(),
      housingIncluded: null,
      majorCosts: [],
      accountsComplete: false,
      accessReviewed: false,
      costsReviewed: false,
    },
    accounts: [],
    scenarios: [],
    selectedScenarioIds: [],
    reviewHistory: [],
    consent: { deviceSave: false },
    ui: {
      activeView: "setup",
      dismissedDetailIds: [],
      selectedScenarioId: null,
    },
  };
}

function unsafeKeys(value, depth = 0) {
  if (depth > 20) return true;
  if (!value || typeof value !== "object") return false;
  for (const key of Object.keys(value)) {
    if (
      ["__proto__", "prototype", "constructor"].includes(key) ||
      unsafeKeys(value[key], depth + 1)
    )
      return true;
  }
  return false;
}

export function validateDraft(draft) {
  const errors = [],
    warnings = [];
  const error = (path, message) => errors.push({ path, message });
  const warn = (path, message) => warnings.push({ path, message });
  const text = (value, path, maximum = 160) => {
    if (typeof value !== "string" || value.length > maximum)
      error(path, `Use text of at most ${maximum} characters.`);
  };
  const numeric = (
    value,
    path,
    min = 0,
    max = 100_000_000,
    integer = false,
  ) => {
    if (!isObject(value) || !STATUSES.has(value.status)) {
      error(
        path,
        "Include a number and its provided, estimated or unknown status.",
      );
      return;
    }
    if (value.status === "unknown") {
      if (value.value !== null)
        error(path, "An unknown amount must remain null.");
      return;
    }
    if (
      typeof value.value !== "number" ||
      !Number.isFinite(value.value) ||
      value.value < min ||
      value.value > max ||
      (integer && !Number.isInteger(value.value))
    ) {
      error(
        path,
        `Enter ${integer ? "a whole number" : "a number"} between ${min} and ${max}, or mark it unknown.`,
      );
    }
  };
  const person = (profile, path) => {
    if (!isObject(profile)) {
      error(path, "The person profile is missing.");
      return;
    }
    numeric(profile.age, `${path}.age`, 18, 100, true);
    numeric(
      profile.targetRetirementAge,
      `${path}.targetRetirementAge`,
      18,
      100,
      true,
    );
    for (const key of [
      "pensionTotal",
      "nonPensionTotal",
      "annualPensionIncome",
      "monthlySpending",
    ])
      numeric(profile[key], `${path}.${key}`);
    if (!["working", "already-retired"].includes(profile.retirementStatus))
      error(`${path}.retirementStatus`, "Choose working or already retired.");
    if (!["gross", "net", "unknown"].includes(profile.incomeBasis))
      error(`${path}.incomeBasis`, "Label income as gross, net or unknown.");
    const age = valueOf(profile.age),
      retirement = valueOf(profile.targetRetirementAge);
    if (age !== null && retirement !== null) {
      if (profile.retirementStatus === "working" && retirement < age)
        error(
          `${path}.targetRetirementAge`,
          "A future retirement age cannot precede your current age.",
        );
      if (profile.retirementStatus === "already-retired" && retirement > age)
        error(
          `${path}.targetRetirementAge`,
          "A past retirement age cannot be later than your current age.",
        );
    }
    if (valueOf(profile.monthlySpending) === 0)
      warn(
        `${path}.monthlySpending`,
        "Confirm that £0 per month is intentional.",
      );
    if ((valueOf(profile.monthlySpending) || 0) > 20_000)
      warn(
        `${path}.monthlySpending`,
        "Confirm this amount is monthly, rather than annual.",
      );
  };
  const list = (value, path, max = 100) => {
    if (!Array.isArray(value) || value.length > max) {
      error(path, `Use an array with at most ${max} entries.`);
      return [];
    }
    return value;
  };
  const uniqueIds = (items, path) => {
    const seen = new Set();
    items.forEach((item, index) => {
      if (!isObject(item)) {
        error(`${path}.${index}`, "Invalid row.");
        return;
      }
      text(item.id, `${path}.${index}.id`, 100);
      if (seen.has(item.id))
        error(`${path}.${index}.id`, "Each row needs a unique identifier.");
      seen.add(item.id);
    });
  };

  if (!isObject(draft) || unsafeKeys(draft))
    return {
      valid: false,
      errors: [
        { path: "draft", message: "Invalid or unsafe draft structure." },
      ],
      warnings,
    };
  if (draft.schemaVersion !== SCHEMA_VERSION)
    error(
      "schemaVersion",
      "This saved draft uses an unsupported format. Keep the original file for recovery.",
    );
  text(draft.draftId, "draftId", 100);
  if (draft.mode !== "personal-draft")
    error("mode", "Only personal information drafts may be restored here.");
  if (!Number.isSafeInteger(draft.revision) || draft.revision < 1)
    error("revision", "Invalid baseline revision.");
  if (
    typeof draft.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(draft.updatedAt))
  )
    error("updatedAt", "Invalid draft date.");
  if (!ROUTES.has(draft.route)) error("route", "Unknown setup route.");
  if (!SCOPES.has(draft.planningScope))
    error("planningScope", "Choose individual or household.");
  if (!SCOPES.has(draft.spendingBasis))
    error(
      "spendingBasis",
      "Record whether spending is individual or household.",
    );
  if (!["individual", "pending", "confirmed"].includes(draft.householdStatus))
    error("householdStatus", "Invalid household status.");
  person(draft.profile, "profile");
  if (draft.partner !== null) person(draft.partner, "partner");
  if (
    draft.planningScope === "household" &&
    draft.partner === null &&
    draft.householdStatus === "confirmed"
  )
    error(
      "householdStatus",
      "A household cannot be complete while partner information is missing.",
    );
  if (
    draft.planningScope === "household" &&
    draft.spendingBasis !== "household"
  )
    warn(
      "spendingBasis",
      "Your spending target is per person. Confirm a shared target before a household comparison.",
    );

  if (!isObject(draft.details)) error("details", "Detail groups are missing.");
  else {
    for (const key of ["monthlyContributions", "cashTotal", "investedTotal"])
      numeric(draft.details[key], `details.${key}`);
    numeric(
      draft.details.pensionAccessAge,
      "details.pensionAccessAge",
      18,
      100,
      true,
    );
    for (const key of ["housingIncluded", "employerIncluded"])
      if (![null, true, false].includes(draft.details[key]))
        error(`details.${key}`, "Use yes, no or unknown.");
    const streams = list(
      draft.details.incomeStreams,
      "details.incomeStreams",
      30,
    );
    uniqueIds(streams, "details.incomeStreams");
    streams.forEach((stream, i) => {
      if (!isObject(stream)) return;
      const path = `details.incomeStreams.${i}`;
      if (!["primary", "partner"].includes(stream.owner))
        error(`${path}.owner`, "Income belongs to a named person.");
      if (!["db", "state", "other"].includes(stream.type))
        error(`${path}.type`, "Unknown income source type.");
      text(stream.label, `${path}.label`);
      numeric(stream.annualAmount, `${path}.annualAmount`);
      numeric(stream.startAge, `${path}.startAge`, 18, 100, true);
      numeric(stream.endAge, `${path}.endAge`, 18, 120, true);
      if (!["gross", "net", "unknown"].includes(stream.incomeBasis))
        error(`${path}.incomeBasis`, "Label annual income as gross or net.");
      const start = valueOf(stream.startAge),
        end = valueOf(stream.endAge);
      if (start !== null && end !== null && end < start)
        error(`${path}.endAge`, "Income cannot end before it starts.");
    });
    const costs = list(draft.details.majorCosts, "details.majorCosts", 30);
    uniqueIds(costs, "details.majorCosts");
    costs.forEach((cost, i) => {
      if (!isObject(cost)) return;
      text(cost.label, `details.majorCosts.${i}.label`);
      numeric(cost.amount, `details.majorCosts.${i}.amount`);
      numeric(cost.age, `details.majorCosts.${i}.age`, 18, 100, true);
      if (!["primary", "partner", "household"].includes(cost.owner))
        error(
          `details.majorCosts.${i}.owner`,
          "Record whose age dates this cost.",
        );
    });
  }

  const accounts = list(draft.accounts, "accounts");
  uniqueIds(accounts, "accounts");
  accounts.forEach((account, i) => {
    if (!isObject(account)) return;
    const path = `accounts.${i}`;
    text(account.name, `${path}.name`);
    if (!["primary", "partner", "joint"].includes(account.owner))
      error(`${path}.owner`, "Record primary, partner or joint ownership.");
    if (!["pension", "cash", "investment", "other"].includes(account.type))
      error(`${path}.type`, "Unknown account type.");
    numeric(account.balance, `${path}.balance`);
    if (account.accessAge !== undefined)
      numeric(account.accessAge, `${path}.accessAge`, 18, 100, true);
    if (account.type === "pension" && account.owner === "joint")
      error(`${path}.owner`, "A pension pot belongs to one person.");
    if (account.owner === "partner" && draft.partner === null)
      warn(
        `${path}.owner`,
        "Partner account retained; add partner context before treating the household as complete.",
      );
  });
  const scenarios = list(draft.scenarios, "scenarios", 2);
  uniqueIds(scenarios, "scenarios");
  scenarios.forEach((scenario, i) => {
    if (!isObject(scenario)) return;
    text(scenario.name, `scenarios.${i}.name`, 80);
    if (
      !Number.isSafeInteger(scenario.baseRevision) ||
      scenario.baseRevision < 1 ||
      scenario.baseRevision > draft.revision
    )
      error(
        `scenarios.${i}.baseRevision`,
        "Invalid scenario baseline revision.",
      );
    if (scenario.baseRevision !== draft.revision && scenario.stale !== true)
      error(
        `scenarios.${i}.stale`,
        "A comparison from an older baseline must be marked out of date.",
      );
    try {
      normaliseOverrides(scenario.overrides);
    } catch (issue) {
      error(`scenarios.${i}.overrides`, issue.message);
    }
  });
  const selected = list(draft.selectedScenarioIds, "selectedScenarioIds", 2);
  selected.forEach((scenarioId, i) => {
    if (!scenarios.some((item) => item?.id === scenarioId))
      error(`selectedScenarioIds.${i}`, "Selected scenario does not exist.");
  });
  const history = list(draft.reviewHistory, "reviewHistory", 20);
  history.forEach((item, i) => {
    if (
      !isObject(item) ||
      !Number.isSafeInteger(item.revision) ||
      item.revision < 1 ||
      item.revision >= draft.revision ||
      !Number.isFinite(Date.parse(item.at))
    ) {
      error(`reviewHistory.${i}`, "Invalid review-history entry.");
      return;
    }
    person(item.profile, `reviewHistory.${i}.profile`);
    if (item.partner !== null)
      person(item.partner, `reviewHistory.${i}.partner`);
  });
  if (!isObject(draft.consent) || typeof draft.consent.deviceSave !== "boolean")
    error(
      "consent.deviceSave",
      "Record an explicit yes or no for device saving.",
    );
  if (!isObject(draft.ui)) error("ui", "Invalid view state.");
  else {
    text(draft.ui.activeView, "ui.activeView", 80);
    list(draft.ui.dismissedDetailIds, "ui.dismissedDetailIds", 20).forEach(
      (detailId, i) => text(detailId, `ui.dismissedDetailIds.${i}`, 80),
    );
  }
  return { valid: errors.length === 0, errors, warnings };
}

function incomeContext(profile, streams = []) {
  const amount = valueOf(profile?.annualPensionIncome);
  const hasAmount =
    amount !== null ||
    streams.some((stream) => valueOf(stream.annualAmount) !== null);
  const hasDates = streams.some(
    (stream) =>
      valueOf(stream.annualAmount) !== null &&
      valueOf(stream.startAge) !== null,
  );
  const explicitlyNoIncome =
    amount === 0 &&
    streams.every((stream) => valueOf(stream.annualAmount) === 0);
  return {
    hasAmount,
    hasDates,
    needsDetail: !hasAmount || (!hasDates && !explicitlyNoIncome),
  };
}

function householdContextComplete(draft) {
  if (draft.planningScope === "individual") return true;
  if (
    !draft.partner ||
    draft.householdStatus !== "confirmed" ||
    draft.spendingBasis !== "household" ||
    valueOf(draft.profile.monthlySpending) === null
  )
    return false;
  return [
    ["primary", draft.profile],
    ["partner", draft.partner],
  ].every(([owner, profile]) => {
    if (
      valueOf(profile.age) === null ||
      valueOf(profile.nonPensionTotal) === null
    )
      return false;
    if (
      profile.retirementStatus === "working" &&
      valueOf(profile.targetRetirementAge) === null
    )
      return false;
    if (draft.route === "dc") return valueOf(profile.pensionTotal) !== null;
    const streams = draft.details.incomeStreams.filter(
      (stream) => stream.owner === owner,
    );
    return !incomeContext(profile, streams).needsDetail;
  });
}

export function getNextDetail(draft) {
  const p = draft.profile || {},
    d = draft.details || {};
  const primaryIncome = incomeContext(
    p,
    (d.incomeStreams || []).filter((stream) => stream.owner === "primary"),
  );
  const age = valueOf(p.age),
    retirementAge = valueOf(p.targetRetirementAge),
    accessAge = valueOf(d.pensionAccessAge);
  const pensionBalance = valueOf(p.pensionTotal);
  const investedPensionRelevant =
    (pensionBalance !== null && pensionBalance > 0) ||
    (draft.route === "dc" && pensionBalance !== 0);
  let card;
  if (draft.planningScope === "household" && !householdContextComplete(draft)) {
    card = {
      id: "partner",
      title: "Complete your shared picture",
      question:
        "What is your partner planning, and is this your shared spending target?",
      why: "Your information alone cannot describe both people’s retirement.",
      group: "partner",
    };
  } else if (
    (draft.route === "income" ||
      draft.route === "retired" ||
      p.retirementStatus === "already-retired" ||
      pensionBalance === 0) &&
    primaryIncome.needsDetail
  ) {
    card = {
      id: "income",
      title: "Add your expected income",
      question:
        "What pension or other income do you expect, and when does it start?",
      why: "An annual pension income is different from an invested pension pot.",
      group: "income",
    };
  } else if (
    investedPensionRelevant &&
    retirementAge !== null &&
    accessAge !== null &&
    retirementAge < accessAge &&
    !d.accessReviewed
  ) {
    card = {
      id: "access",
      title: "Money before your pension starts",
      question:
        "Which savings can you use between retirement and pension access?",
      why: "A large pension pot may still be inaccessible during those years.",
      group: "access",
    };
  } else if (
    p.retirementStatus === "already-retired" &&
    investedPensionRelevant &&
    accessAge === null
  ) {
    card = {
      id: "access",
      title: "When your invested pension is accessible",
      question: "At what age can you use your invested pension pot?",
      why: "This date belongs to the invested pot, separately from promised pension income.",
      group: "access",
    };
  } else if (p.retirementStatus === "already-retired") {
    card = {
      id: "costs",
      title: "Spending that changes over time",
      question: "Does your monthly target include housing and any major costs?",
      why: "Dated costs and housing payments help describe the spending you actually need.",
      group: "costs",
    };
    if (d.costsReviewed) return null;
  } else if (
    draft.route === "dc" &&
    valueOf(d.monthlyContributions) === null &&
    age !== null
  ) {
    card = {
      id: "contributions",
      title: "What goes into your pension?",
      question: "How much is added each month, including your employer?",
      why: "Contributions and their end date describe what changes before retirement.",
      group: "contributions",
    };
  } else if (primaryIncome.needsDetail) {
    card = {
      id: "income",
      title: "Income and start dates",
      question:
        "What income starts later, and at what age does each source start?",
      why: "An aggregate amount alone does not describe the income timeline.",
      group: "income",
    };
  } else if (investedPensionRelevant && accessAge === null) {
    card = {
      id: "access",
      title: "When your invested pension is accessible",
      question: "At what age can you use your invested pension pot?",
      why: "Income start dates do not establish when an invested pot can be accessed.",
      group: "access",
    };
  } else if (
    valueOf(d.cashTotal) === null ||
    valueOf(d.investedTotal) === null
  ) {
    card = {
      id: "money",
      title: "Separate cash and investments",
      question:
        "How much of your other savings is cash, and how much is invested?",
      why: "This clarifies your existing total rather than adding money a second time.",
      group: "money",
    };
  } else return null;
  return (draft.ui?.dismissedDetailIds || []).includes(card.id) ? null : card;
}

function knownTotal(values) {
  const numbers = values.map(valueOf).filter((value) => value !== null);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) : null;
}

export function summariseDraft(draft) {
  const people = [{ owner: "primary", label: "You", profile: draft.profile }];
  if (draft.planningScope === "household" && draft.partner)
    people.push({ owner: "partner", label: "Partner", profile: draft.partner });
  const pension = knownTotal(
    people.map((person) => person.profile.pensionTotal),
  );
  const nonPension = knownTotal(
    people.map((person) => person.profile.nonPensionTotal),
  );
  const annualPensionIncome = knownTotal(
    people.map((person) => person.profile.annualPensionIncome),
  );
  const householdReady = householdContextComplete(draft);
  const totals = {
    pension,
    nonPension,
    annualPensionIncome,
    combined:
      pension === null && nonPension === null
        ? null
        : (pension || 0) + (nonPension || 0),
    pensionComplete:
      householdReady &&
      people.every((person) => valueOf(person.profile.pensionTotal) !== null),
    nonPensionComplete:
      householdReady &&
      people.every(
        (person) => valueOf(person.profile.nonPensionTotal) !== null,
      ),
  };
  const missing = [],
    timeline = [];
  const year = new Date(draft.updatedAt).getUTCFullYear();
  const labels = {
    age: "Current age",
    targetRetirementAge: "Retirement age",
    pensionTotal: "Invested pension pot",
    nonPensionTotal: "Other savings and investments",
    monthlySpending: "Monthly retirement spending",
  };
  for (const person of people) {
    for (const [key, label] of Object.entries(labels)) {
      if (key === "monthlySpending" && person.owner === "partner") continue;
      if (
        key === "targetRetirementAge" &&
        person.profile.retirementStatus === "already-retired"
      )
        continue;
      if (key === "pensionTotal" && draft.route !== "dc") continue;
      if (valueOf(person.profile[key]) === null)
        missing.push({
          id: `${person.owner}.${key}`,
          label: `${person.label}: ${label}`,
        });
    }
    if (
      draft.route !== "dc" &&
      valueOf(person.profile.annualPensionIncome) === null
    )
      missing.push({
        id: `${person.owner}.annualPensionIncome`,
        label: `${person.label}: pension income`,
      });
    const streams = draft.details.incomeStreams.filter(
      (stream) => stream.owner === person.owner,
    );
    const income = incomeContext(person.profile, streams);
    if (income.hasAmount && income.needsDetail)
      missing.push({
        id: `${person.owner}.incomeDates`,
        label: `${person.label}: income source and start dates`,
      });
    if (
      valueOf(person.profile.annualPensionIncome) !== null &&
      person.profile.incomeBasis === "unknown"
    )
      missing.push({
        id: `${person.owner}.incomeBasis`,
        label: `${person.label}: whether income is before or after tax`,
      });
    const age = valueOf(person.profile.age),
      retirement = valueOf(person.profile.targetRetirementAge);
    if (age !== null && retirement !== null)
      timeline.push({
        owner: person.owner,
        type: "retirement",
        age: retirement,
        year: year + retirement - age,
        label: `${person.label} ${person.profile.retirementStatus === "already-retired" ? "retired" : "retires"} at ${retirement}`,
      });
  }
  for (const stream of draft.details.incomeStreams) {
    const owner = people.find((person) => person.owner === stream.owner),
      current = valueOf(owner?.profile.age),
      start = valueOf(stream.startAge);
    if (current !== null && start !== null && owner)
      timeline.push({
        owner: stream.owner,
        type: "income-start",
        age: start,
        year: year + start - current,
        label: `${stream.label} starts at ${start}`,
        incomeBasis: stream.incomeBasis,
        annualAmount: valueOf(stream.annualAmount),
      });
  }
  if (draft.planningScope === "household" && !draft.partner)
    missing.unshift({
      id: "partner",
      label: "Partner information and shared spending basis",
    });
  if (draft.details.housingIncluded === null)
    missing.push({
      id: "housing",
      label: "Whether housing and debt payments are included in spending",
    });
  if (
    valueOf(draft.details.pensionAccessAge) === null &&
    valueOf(draft.profile.pensionTotal) !== null
  )
    missing.push({
      id: "pensionAccessAge",
      label: "When your invested pension can be accessed",
    });
  const activeAccounts = draft.accounts.filter(
    (account) =>
      account.owner !== "partner" ||
      (draft.planningScope === "household" && draft.partner !== null),
  );
  const accountTotals = {
    pension: knownTotal(
      activeAccounts
        .filter((account) => account.type === "pension")
        .map((account) => account.balance),
    ),
    nonPension: knownTotal(
      activeAccounts
        .filter((account) => account.type !== "pension")
        .map((account) => account.balance),
    ),
  };
  const reconciliation = [];
  for (const group of ["pension", "nonPension"]) {
    if (accountTotals[group] !== null)
      reconciliation.push({
        group,
        enteredTotal: totals[group],
        accountTotal: accountTotals[group],
        difference:
          totals[group] === null ? null : accountTotals[group] - totals[group],
        message:
          "Account detail describes the entered total; it is not added to it.",
      });
  }
  const cash = valueOf(draft.details.cashTotal),
    invested = valueOf(draft.details.investedTotal);
  if (cash !== null && invested !== null)
    reconciliation.push({
      group: "moneySplit",
      enteredTotal: nonPension,
      accountTotal: cash + invested,
      difference: nonPension === null ? null : cash + invested - nonPension,
      message: "Cash plus investments should reconcile with other savings.",
    });
  const allFields = people.flatMap((person) =>
    Object.values(person.profile).filter(isObject),
  );
  return {
    mode: "personal-draft",
    totals,
    accountTotals,
    reconciliation,
    missing,
    timeline: timeline.sort((a, b) => a.year - b.year),
    householdIncomplete: draft.planningScope === "household" && !householdReady,
    providedFields: allFields.filter((item) => item.status === "provided")
      .length,
    estimatedFields: allFields.filter((item) => item.status === "estimated")
      .length,
    unknownFields: allFields.filter((item) => item.status === "unknown").length,
    monthlySpending: valueOf(draft.profile.monthlySpending),
    spendingBasis: draft.spendingBasis,
    revision: draft.revision,
    updatedAt: draft.updatedAt,
    forecastStatus: "unavailable",
    note: "This is your entered information. Personal retirement calculations are not connected in this prototype.",
  };
}

export function normaliseOverrides(overrides = {}) {
  if (!isObject(overrides) || unsafeKeys(overrides))
    throw new Error("Invalid scenario overrides.");
  const result = {};
  for (const [originalKey, value] of Object.entries(overrides)) {
    const key =
      originalKey === "targetRetirementAge" ? "retirementAge" : originalKey;
    const spec = OVERRIDES[key];
    if (!spec) throw new Error(`Unsupported scenario field: ${originalKey}.`);
    if (key in result && result[key] !== value)
      throw new Error("Conflicting retirement-age overrides.");
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < spec[0] ||
      value > spec[1] ||
      (spec[2] && !Number.isInteger(value))
    )
      throw new Error(`Invalid value for ${key}.`);
    result[key] = value;
  }
  if (
    result.partTimeAnnual > 0 &&
    result.partTimeEndAge !== undefined &&
    result.retirementAge !== undefined &&
    result.partTimeEndAge <= result.retirementAge
  )
    throw new Error("Part-time income must end after retirement.");
  return result;
}

export function createScenario(draft, name, overrides = {}) {
  if (draft.scenarios.length >= 2)
    throw new Error(
      "Keep at most two alternatives beside the baseline in this prototype.",
    );
  if (typeof name !== "string" || !name.trim() || name.length > 80)
    throw new Error("Give this alternative a name of 1–80 characters.");
  const clean = normaliseOverrides(overrides);
  const age = valueOf(draft.profile.age),
    partnerAge = valueOf(draft.partner?.age);
  if (
    clean.retirementAge !== undefined &&
    age !== null &&
    draft.profile.retirementStatus === "working" &&
    clean.retirementAge < age
  )
    throw new Error("Retirement cannot precede your current age.");
  if (clean.partnerRetirementAge !== undefined && !draft.partner)
    throw new Error("Add your partner before changing their retirement date.");
  if (
    clean.partnerRetirementAge !== undefined &&
    partnerAge !== null &&
    clean.partnerRetirementAge < partnerAge
  )
    throw new Error("Partner retirement cannot precede their current age.");
  return {
    id: id("scenario"),
    name: name.trim(),
    baseRevision: draft.revision,
    overrides: clean,
    stale: false,
    createdAt: new Date().toISOString(),
  };
}

function merge(target, patch) {
  const result = clone(target);
  for (const [key, value] of Object.entries(patch)) {
    result[key] =
      isObject(value) && isObject(result[key])
        ? merge(result[key], value)
        : clone(value);
  }
  return result;
}

export function updateBaseline(draft, patch) {
  if (!isObject(patch) || unsafeKeys(patch))
    throw new Error("Invalid baseline edit.");
  const allowed = [
    "profile",
    "partner",
    "details",
    "accounts",
    "planningScope",
    "spendingBasis",
    "householdStatus",
    "route",
  ];
  if (Object.keys(patch).some((key) => !allowed.includes(key)))
    throw new Error("Only baseline information may be edited here.");
  const next = merge(draft, patch);
  next.revision = draft.revision + 1;
  next.updatedAt = new Date().toISOString();
  next.scenarios = next.scenarios.map((scenario) => ({
    ...scenario,
    stale: true,
  }));
  next.reviewHistory = [
    ...draft.reviewHistory,
    {
      at: draft.updatedAt,
      revision: draft.revision,
      route: draft.route,
      planningScope: draft.planningScope,
      spendingBasis: draft.spendingBasis,
      householdStatus: draft.householdStatus,
      profile: clone(draft.profile),
      partner: clone(draft.partner),
      details: clone(draft.details),
      accounts: clone(draft.accounts),
    },
  ].slice(-20);
  const validation = validateDraft(next);
  if (!validation.valid)
    throw new Error(validation.errors.map((issue) => issue.message).join(" "));
  return next;
}

export function serialise(draft) {
  const validation = validateDraft(draft);
  if (!validation.valid)
    throw new Error(
      `Draft cannot be saved: ${validation.errors.map((issue) => issue.message).join(" ")}`,
    );
  return JSON.stringify(draft, null, 2);
}

export function parseSaved(text) {
  if (typeof text !== "string" || text.length > 1_000_000)
    return {
      ok: false,
      draft: null,
      error: "The saved draft is absent or too large. Keep the original file.",
    };
  let draft;
  try {
    draft = JSON.parse(text);
  } catch {
    return {
      ok: false,
      draft: null,
      error: "This file is not a valid saved draft. Keep the original file.",
    };
  }
  const validation = validateDraft(draft);
  if (!validation.valid)
    return {
      ok: false,
      draft: null,
      error: validation.errors
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" "),
      errors: validation.errors,
    };
  return { ok: true, draft, error: null, warnings: validation.warnings };
}
