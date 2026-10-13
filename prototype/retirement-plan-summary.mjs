const money = value => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
}).format(value);

const amountWithFrequency = row => {
  const amount = money(row.amount);
  return row.frequency === 'month' ? `${amount}/mo`
    : row.frequency === 'year' ? `${amount}/yr` : `${amount} once`;
};

const amountWithTiming = (input, row) => {
  const amount = amountWithFrequency(row);
  const owner = input.people.find(person => person.id === row.owner) ?? input.people[0];
  if (!owner || row.startAge <= owner.age) return amount;
  return `${amount} · ${row.frequency === 'once' ? 'at' : 'from'} ${owner.name} ${row.startAge}`;
};

function preview(rows, amount, limit) {
  const items = rows.slice(0, limit).map(row => ({
    id: row.id, label: row.label, amount: amount(row),
  }));
  return { count: rows.length, items, moreCount: rows.length - items.length };
}

function workPreview(input, actions, person) {
  const primary = person.id === 'primary';
  const plannedAge = actions.early
    ? input.settings[primary ? 'earlyPrimary' : 'earlyPartner'] : person.retireAge;
  const plannedYear = input.year + plannedAge - person.age;
  const hasJobChange = actions[primary ? 'job' : 'jobPartner'];
  const event = hasJobChange
    ? input.employment?.find(item => item.owner === person.id) : undefined;

  if (event) {
    const eventAge = person.age + event.year - input.year;
    if (eventAge < plannedAge) {
      const returnAge = eventAge + event.returnYears;
      if (event.returnYears > 0 && returnAge < plannedAge) {
        return {
          id: person.id, name: person.name, age: plannedAge, year: plannedYear,
          mode: 'return',
          label: `${person.name}: redundancy at ${eventAge}, back at ${returnAge}; work ends at ${plannedAge}`,
        };
      }
      return {
        id: person.id, name: person.name, age: eventAge, year: event.year,
        mode: 'redundancy',
        label: `${person.name}: redundancy at ${eventAge} (${event.year})`,
      };
    }
  }

  // The generic household fixture models a temporary Alex income break without
  // a dated employment event. Keep the final work-end age distinct from the break.
  if (primary && hasJobChange && !event && input.settings?.jobAge < plannedAge) {
    const breakAge = input.settings.jobAge;
    return {
      id: person.id, name: person.name, age: plannedAge, year: plannedYear,
      mode: 'income-break',
      label: `${person.name}: income break at ${breakAge}; work ends at ${plannedAge}`,
    };
  }

  return {
    id: person.id, name: person.name, age: plannedAge, year: plannedYear,
    mode: 'work-end', label: `${person.name}: work ends at ${plannedAge} (${plannedYear})`,
  };
}

/** Compact, deterministic view of entered plan inputs and the first modelled year. */
export function planInputSummary(input, actions = {}, model = null, { previewLimit = 3 } = {}) {
  const limit = Math.max(0, Math.floor(previewLimit));
  const assets = input.assets ?? [];
  const debts = input.debts ?? [];
  const assetTotal = assets.reduce((sum, item) => sum + item.balance, 0);
  const debtTotal = debts.reduce((sum, item) => sum + item.balance, 0);
  const firstYear = model?.rows?.[0];
  return {
    starting: {
      assets: money(assetTotal), debts: money(debtTotal), net: money(assetTotal - debtTotal),
    },
    assets: preview([...assets].sort((a, b) => b.balance - a.balance), row => money(row.balance), limit),
    debts: preview([...debts].sort((a, b) => b.balance - a.balance), row => money(row.balance), limit),
    work: input.people.map(person => workPreview(input, actions, person)),
    cashflow: {
      year: firstYear?.year ?? input.year,
      incomeMonthly: firstYear ? `${money(firstYear.income / 12)}/mo` : '—',
      spendingMonthly: firstYear ? `${money((firstYear.spending + firstYear.payoff) / 12)}/mo` : '—',
      debtMonthly: firstYear && firstYear.spendingByCategory.debt > 0
        ? `${money(firstYear.spendingByCategory.debt / 12)}/mo` : null,
    },
    incomes: preview(input.incomes ?? [], row => amountWithTiming(input, row), limit),
    expenses: preview(input.expenses ?? [], row => amountWithTiming(input, row), limit),
    retirementBudgetMonthly: input.retirementBudget
      ? `${money(input.retirementBudget.monthly)}/mo` : '—',
    inflation: `${input.inflation}%`,
  };
}
