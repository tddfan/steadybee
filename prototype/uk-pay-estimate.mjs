/** Annualised 2026–27 England/Wales/Northern Ireland illustration; not PAYE or tax advice.
 * Sources: https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past
 * https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027
 * Pension assumption: net pay arrangement, before Income Tax but after employee NI.
 */
const roundMoney = (value) => Math.round(value * 100) / 100;
function money(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100_000_000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.001)
    throw new RangeError(`${label} must be a non-negative annual amount to the penny.`);
  return value;
}
function rate(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100)
    throw new RangeError(`${label} must be from 0% to 100%.`);
  return value;
}
const band = (amount, lower, upper) => Math.max(0, Math.min(amount, upper) - lower);

export function estimateUkTakeHome2026({ baseSalary = 0, bonus = 0, employeePensionAmount = 0, employeePensionRate = 0, employerPensionAmount = 0, employerPensionRate = 0, employeeNIExempt = false }) {
  if (typeof employeeNIExempt !== "boolean") throw new RangeError("NI exemption must be true or false.");
  money(baseSalary, "Base salary"); money(bonus, "Bonus");
  money(employeePensionAmount, "Employee pension amount"); money(employerPensionAmount, "Employer pension amount");
  rate(employeePensionRate, "Employee pension rate"); rate(employerPensionRate, "Employer pension rate");
  if (employeePensionAmount && employeePensionRate) throw new RangeError("Use either an employee pension amount or a rate.");
  if (employerPensionAmount && employerPensionRate) throw new RangeError("Use either an employer pension amount or a rate.");
  const grossPay = roundMoney(baseSalary + bonus);
  const employeePension = roundMoney(employeePensionRate ? baseSalary * employeePensionRate / 100 : employeePensionAmount);
  const employerPension = roundMoney(employerPensionRate ? baseSalary * employerPensionRate / 100 : employerPensionAmount);
  if (employeePension > grossPay) throw new RangeError("Employee pension contribution cannot exceed gross pay in this estimate.");
  const adjustedIncome = grossPay - employeePension;
  const personalAllowance = roundMoney(Math.max(0, 12570 - Math.max(0, adjustedIncome - 100000) / 2));
  const taxableIncome = Math.max(0, adjustedIncome - personalAllowance);
  const incomeTax = roundMoney(band(taxableIncome, 0, 37700) * .2 + band(taxableIncome, 37700, 125140) * .4 + Math.max(0, taxableIncome - 125140) * .45);
  const employeeNI = employeeNIExempt ? 0 : roundMoney(band(grossPay, 12570, 50270) * .08 + Math.max(0, grossPay - 50270) * .02);
  const takeHome = roundMoney(grossPay - employeePension - incomeTax - employeeNI);
  return { grossPay, employeePension, employerPension, personalAllowance, incomeTax, employeeNI, takeHome };
}
