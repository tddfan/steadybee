/** Optional 2026–27 State Pension illustration. Qualifying years are assumptions, not a DWP entitlement check.
 * https://www.gov.uk/government/publications/your-new-state-pension-explained/your-state-pension-explained
 */
import { estimateUkTakeHome2026 } from './uk-pay-estimate.mjs?v=20261022savingstax1';
export const FULL_STATE_PENSION_WEEKLY_2026 = 241.30;
const round = value => Math.round(value * 100) / 100;
const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const months = value => { const [y,m]=value.split('-').map(Number); return y*12+m; };
export function estimateStatePension(input, referenceMonth, employmentIncome = 0) {
  const { qualifyingYears, startMonth = '', qualifyingUntil = '', mode = 'record', weeklyForecast = null, otherTaxableIncome = 0 } = input;
  if(!Number.isInteger(qualifyingYears) || qualifyingYears < 0 || qualifyingYears > 60) throw new RangeError('Qualifying years must be a whole number from 0 to 60.');
  if(!validMonth(referenceMonth) || (startMonth && !validMonth(startMonth)) || (qualifyingUntil && !validMonth(qualifyingUntil))) throw new RangeError('Enter a valid assessment, pension start and qualifying-until month.');
  if(!['record','official','simplified'].includes(mode)) throw new RangeError('Choose a State Pension estimate basis.');
  if(mode !== 'record' && !startMonth) throw new RangeError('Add the State Pension start month from your GOV.UK forecast.');
  if(!Number.isFinite(otherTaxableIncome) || otherTaxableIncome < 0 || otherTaxableIncome > 100000000) throw new RangeError('Other annual taxable income must be non-negative.');
  const until = qualifyingUntil ? (startMonth && startMonth < qualifyingUntil ? startMonth : qualifyingUntil) : null;
  const futureYears = until ? Math.max(0,Math.floor((months(until)-months(referenceMonth))/12)) : 0;
  const totalYears = qualifyingYears + futureYears;
  let annualGross = null;
  if(mode === 'simplified') annualGross = totalYears < 10 ? 0 : round(FULL_STATE_PENSION_WEEKLY_2026 * 52 * Math.min(35,totalYears) / 35);
  if(mode === 'official') {
    if(typeof weeklyForecast !== 'number' || !Number.isFinite(weeklyForecast) || weeklyForecast < 0 || weeklyForecast > 10000) throw new RangeError('Enter the weekly amount from your official forecast.');
    annualGross = round(weeklyForecast * 52);
  }
  const other = round(otherTaxableIncome + employmentIncome);
  const annualTax = annualGross === null ? null : round(estimateUkTakeHome2026({baseSalary:round(other+annualGross)}).incomeTax - estimateUkTakeHome2026({baseSalary:other}).incomeTax);
  return { ...input, mode, startMonth:startMonth || null, qualifyingYears, futureYears, totalYears, annualGross, annualTax, monthlyNet:annualGross === null ? null : round((annualGross-annualTax)/12), referenceMonth, taxableIncomeAssumed:other };
}

/** Resolve an NI record into an illustration without inventing recorded years.
 * Ages only give an approximate start month; an entered official date wins.
 */
export function resolveStatePensionInput(input, flow, holdings, owner) {
  if (!input) return null;
  const reference = flow.timelineStartMonth || flow.asOfMonth;
  const age = owner === 'primary' ? holdings.age : holdings.partnerAge;
  const pensionAge = Number(reference.slice(0, 4)) - age >= 1978 ? 68 : 67;
  const offset = Number.isFinite(age) ? Math.max(0, (pensionAge - age) * 12) : null;
  const [year, month] = reference.split('-').map(Number);
  const startMonth = input.startMonth || (offset === null ? '' : new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7));
  const pay = flow.pay[owner];
  const employed = (pay.annualGross || pay.annualTakeHome || 0) > 0;
  const qualifyingUntil = input.assumeFutureYears === false ? '' : input.qualifyingUntil || (employed ? pay.endDate || startMonth : '');
  return {...input, mode: input.mode === 'official' ? 'official' : startMonth ? 'simplified' : 'record', startMonth, qualifyingUntil, approximateStart: !input.startMonth};
}
