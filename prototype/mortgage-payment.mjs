/** Level monthly capital-and-interest repayment with a constant annual interest rate.
 * This is an illustrative payment, not a lender quote or a future rate forecast.
 */
export function estimateRepaymentMortgagePayment({ balance, annualRate, remainingYears }) {
  if (typeof balance !== "number" || !Number.isFinite(balance) || balance < 0 || balance > 100_000_000_000)
    throw new RangeError("Mortgage balance must be a non-negative finite amount.");
  if (annualRate === undefined || remainingYears === undefined) return null;
  if (typeof annualRate !== "number" || !Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100)
    throw new RangeError("Mortgage annual rate must be from 0% to 100%.");
  if (typeof remainingYears !== "number" || !Number.isFinite(remainingYears) || remainingYears <= 0 || remainingYears > 100)
    throw new RangeError("Mortgage term must be more than 0 and up to 100 years.");
  const months = Math.max(1, Math.round(remainingYears * 12));
  const monthlyRate = annualRate / 1200;
  const payment = monthlyRate === 0 ? balance / months : balance * monthlyRate / (1 - (1 + monthlyRate) ** -months);
  return Math.round(payment * 100) / 100;
}
