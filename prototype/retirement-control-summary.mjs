const money = value => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
}).format(value);

/** Display summaries use validated inputs and calculated starting-year figures. */
export function controlSummaries(input, actions, model, scenario) {
  const saved = `${scenario.name} · ${scenario.savedCount} saved this session`;
  if (!model) return Object.fromEntries([
    'adjustment', 'work', 'income', 'spending', 'changes', 'transfers',
    'assumptions', 'withdrawal',
  ].map(key => [key, 'Complete the figures']).concat([['saved', saved]]));

  const now = model.rows[0];
  const work = input.people.map(person => {
    const primary = person.id === 'primary';
    if (actions[primary ? 'job' : 'jobPartner']) {
      const event = input.employment?.find(item => item.owner === person.id);
      return `${person.name}: redundancy${event ? ` set for ${event.year}` : ' selected'}`;
    }
    const age = actions.early
      ? input.settings[primary ? 'earlyPrimary' : 'earlyPartner'] : person.retireAge;
    return `${person.name}: work ends at ${age}`;
  }).join(' · ');
  const owner = input.withdrawal.owner === 'household' ? 'Both people'
    : input.people.find(person => person.id === input.withdrawal.owner)?.name ?? input.withdrawal.owner;
  const order = {
    'cash-first': 'Cash → investments → pensions',
    'investments-first': 'Investments → cash → pensions',
    'pension-first': 'Accessible pensions → cash → investments',
  }[input.withdrawal.order];
  const moves = input.moves?.length ?? 0;
  return {
    adjustment: `${now.year} averages: income ${money(now.income / 12)}/mo · spending ${money((now.spending + now.payoff) / 12)}/mo`,
    work,
    income: `Starting ${now.year} average · ${input.incomes.length} scheduled entries`,
    spending: `Starting ${now.year} average · Includes debt payments`,
    changes: scenario.changes.length ? scenario.changes.join(' · ') : 'No added scenario options',
    transfers: `Cash target ${money(input.savings.cashTarget)} · ${moves ? `${moves} money move${moves === 1 ? '' : 's'}` : 'No money moves'}`,
    assumptions: `Inflation ${input.inflation}% · Plan ends at ${input.people[0].name} ${model.final.primaryAge} / ${input.people[1].name} ${model.final.partnerAge}`,
    withdrawal: `${owner} · ${order} · Up to ${input.withdrawal.maxPercent}%/year`,
    saved,
  };
}
