/** 2026–27 England/Wales/NI annual tax illustration; thresholds held fixed in projections.
 * https://www.gov.uk/apply-tax-free-interest-on-savings/how-much-is-tax-free
 * https://www.gov.uk/capital-gains-tax/rates
 * Savings nil-rate bands still occupy income-tax bands. No dividends or relief extensions.
 */
const round=value=>Math.round(value*100)/100;
const allowance=income=>Math.max(0,12570-Math.max(0,income-100000)/2);
const bands=taxable=>Math.min(taxable,37700)*.2+Math.max(0,Math.min(taxable,125140)-37700)*.4+Math.max(0,taxable-125140)*.45;
function check(...values){if(values.some(value=>!Number.isFinite(value)||value<0))throw new RangeError('Tax inputs must be non-negative finite annual amounts.');}
export function incomeTaxWithSavings(otherIncome,interest=0) {
  check(otherIncome,interest);
  const total=otherIncome+interest,pa=allowance(total),otherTaxable=Math.max(0,otherIncome-pa);
  const savingsTaxable=Math.max(0,interest-Math.max(0,pa-otherIncome));
  const startingRate=Math.max(0,5000-otherTaxable);
  const psa=total>125140 ? 0 : total>50270 ? 500 : 1000;
  const nilRate=Math.min(savingsTaxable,startingRate+psa);
  return round(bands(otherTaxable)+bands(otherTaxable+savingsTaxable)-bands(otherTaxable+nilRate));
}
/** Extra tax attributable to interest, including any loss of Personal Allowance. */
export function savingsTax(otherIncome,interest) {
  return round(incomeTaxWithSavings(otherIncome,interest)-incomeTaxWithSavings(otherIncome));
}
/** Cumulative tax on this tax year's realised gains; income is gross after pension relief. */
export function capitalGainsTax(gains,income) {
  check(gains,income);
  const taxable=Math.max(0,gains-3000),room=Math.max(0,37700-Math.max(0,income-allowance(income)));
  return round(Math.min(taxable,room)*.18+Math.max(0,taxable-room)*.24);
}
