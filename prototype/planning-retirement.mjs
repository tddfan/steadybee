/** Materialise the retirement years shown by Planning before projecting or saving. */
export function resolveRetirementYears(flow, holdings, retirementYears = {}) {
  const startYear = Number((flow.timelineStartMonth || flow.asOfMonth).slice(0, 4));
  return Object.fromEntries((holdings.partnerName ? ['primary', 'partner'] : ['primary']).map(owner => [
    owner, retirementYears[owner] ?? (Number(flow.pay[owner].endDate?.slice(0, 4)) || startYear + 20),
  ]));
}
