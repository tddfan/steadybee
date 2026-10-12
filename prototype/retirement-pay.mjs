/** Payroll illustration. Payslip net or flat user deductions, never statutory tax rules. */
const annual = row => row.amount*(row.frequency==='month'?12:1);
const finite=(value,label,min=0,max=1e10)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`Complete ${label} with a value from ${min} to ${max}.`);};
export function payrollFlow(row,adjustedPay,growth=1){
 const p=row.pension??{},basis=row.taxBasis??'net',full=annual(row)*growth,scale=full>0?adjustedPay/full:0;
 if(basis==='payslip'&&annual(row)===0&&row.takeHomeAmount>0)throw Error(`${row.label}: positive take-home pay requires positive gross pay.`);
 const grossKnown=basis!=='net',method=p.method??(basis==='net'||basis==='payslip'?'included':'after-tax');
 if(!['included','sacrifice','net-pay','after-tax'].includes(method))throw Error('Select how employee pension contributions are deducted.');
 if(p.basis&&!['full','custom'].includes(p.basis))throw Error('Select a pensionable pay basis.');
 const pensionable=basis==='net'||p.basis==='custom'?(p.pensionableAnnual??0)*growth*scale:adjustedPay;
 finite(pensionable,row.label+' pensionable pay');if(basis==='net'&&adjustedPay>0&&pensionable===0&&['employee','employer'].some(kind=>(p[kind+'Mode']??'percent')==='percent'&&(p[kind+'Percent']??0)>0))throw Error('Enter annual pensionable pay to use contribution percentages with take-home pay.');
 const contribution=kind=>{const mode=p[kind+'Mode']??'percent';if(!['percent','annual'].includes(mode))throw Error('Select pension percentage or annual amount.');if(mode==='annual'){finite(p[kind+'Annual']??0,row.label+' '+kind+' contribution');return (p[kind+'Annual']??0)*scale;}finite(p[kind+'Percent']??0,row.label+' '+kind+' contribution (%)',0,100);return pensionable*(p[kind+'Percent']??0)/100;};
 const employee=contribution('employee'),employer=contribution('employer');
 if(grossKnown&&employee>adjustedPay+.001)throw Error(`${row.label}: employee pension contribution exceeds gross pay.`);
 const netFrom=amount=>basis==='estimate'?amount*(1-row.taxRate/100):amount;
 let net,deductions=0;
 if(basis==='payslip'){
  finite(row.takeHomeAmount,row.label+' payslip take-home');const payslip=row.takeHomeAmount*(row.frequency==='month'?12:1)*growth*scale;
  if(!['included','after-tax'].includes(method))throw Error('Use already-deducted or after-tax contributions with payslip take-home.');
  net=method==='after-tax'?payslip-employee:payslip;
  deductions=adjustedPay-payslip-(method==='included'?employee:0);
  if(deductions<-.001)throw Error(`${row.label}: take-home and deducted pension exceed gross pay.`);
 }else if(method==='sacrifice'||method==='net-pay'){
  if(basis==='net')throw Error('Enter gross pay for before-tax pension deductions.');const taxable=adjustedPay-employee;net=netFrom(taxable);deductions=taxable-net;
 }else{
  if(method==='included'&&basis!=='net'&&employee>0)throw Error('Already-deducted contributions require take-home pay or a payslip amount.');
  const before=netFrom(adjustedPay);net=before-(method==='after-tax'?employee:0);deductions=grossKnown?adjustedPay-before:0;
 }
 if(net<-.001)throw Error(`${row.label}: employee pension contribution exceeds available take-home pay.`);
 return {net:Math.max(0,net),employee,employer,deductions:Math.max(0,deductions),gross:grossKnown?adjustedPay:null};
}
