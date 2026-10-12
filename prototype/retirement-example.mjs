import { householdExample, monthlyDebtPayment } from './retirement-household.mjs';
/** User-supplied hypothetical, with unresolved values disclosed in the UI. */
export function householdBaseExample(){
 const legacy=householdExample();
 const asset=(id,label,type,owner,balance,rate,extra={})=>({id,label,type,owner,balance,rate,accessAge:type==='pension'?57:0,taxBasis:'net',taxRate:0,withdrawalTaxBasis:type==='pension'||id==='trading'?'excluded':'net',withdrawalTaxRate:0,wrapper:type==='pension'?'pension':id==='jemma-isa'?'isa':type==='property'?'property':'taxable',...extra});
 const flow=(id,label,type,owner,amount,frequency,startAge,endAge=110,extra={})=>({id,label,type,owner,amount,frequency,startAge,endAge,ongoing:endAge===110,growth:0,taxBasis:'net',taxRate:0,...extra});
 return {
  year:2026,inflation:2,
  people:[{id:'primary',name:'Alex',age:43,retireAge:68,stateAge:68,horizonAge:90,niYears:16},{id:'partner',name:'Jemma',age:42,retireAge:68,stateAge:68,horizonAge:90,niYears:17}],
  assets:[asset('cash','Alex’s cash','cash','primary',160000,4,{taxBasis:'excluded'}),asset('jemma-cash','Jemma’s cash','cash','partner',150000,4,{taxBasis:'excluded'}),asset('trading','Alex’s investments','investment','primary',230000,5),asset('jemma-isa','Jemma’s S&P ISA','investment','partner',160000,5),asset('alex-pot','Alex’s pension','pension','primary',490000,5),asset('jemma-pot','Jemma’s pension','pension','partner',220000,5),asset('employer','Alex’s employer shares','investment','primary',100000,5,{availableYear:2027,taxBasis:'excluded'}),asset('home','Home','property','joint',783000,2),asset('rental','Rental property','property','joint',200000,2),asset('other-property','Other property','property','joint',30000,2),asset('car','Car bought later','car','joint',0,-10),asset('bonds','Fixed-income assets','bonds','joint',0,3)],
  debts:[{id:'mortgage',label:'Home mortgage',type:'mortgage',propertyId:'home',balance:383000,rate:4.7,payment:monthlyDebtPayment(383000,4.7,21*12),monthly:true}],
  incomes:[
   flow('salary-a','Alex’s take-home pay','salary','primary',6500,'month',43,110,{growth:1}),
   flow('salary-j','Jemma’s take-home pay','salary','partner',5500,'month',42,110,{growth:3}),
   flow('bonus-a','Alex’s March bonus','bonus','primary',50000,'year',43,110,{growth:1,paymentMonth:3,taxBasis:'excluded'}),
   flow('bonus-j','Jemma’s March bonus','bonus','partner',25000,'year',42,110,{growth:3,paymentMonth:3,taxBasis:'excluded'}),
   flow('rent','Rental income','rent','primary',100,'month',43,110,{propertyId:'rental',taxBasis:'excluded'}),
   flow('inheritance','Expected inheritance','inheritance','primary',100000,'once',53,53,{paymentMonth:1}),
   flow('state-a','Alex’s State Pension','state','primary',0,'year',68,110,{growth:2}),
   flow('state-j','Jemma’s State Pension','state','partner',0,'year',68,110,{growth:2}),
  ],
  expenses:[
   flow('living','Everyday spending','regular','primary',3500,'month',43),
   flow('school','School fees','education','primary',20000,'year',43,50,{priceBasis:'future',changes:[{age:45,amount:30000}]}),
   flow('college','College fees','education','primary',30000,'year',50,55,{priceBasis:'future'}),
   flow('lease','Car lease','lease','primary',350,'month',43,46),
   flow('car-purchase','Buy a car','vehicle','primary',20000,'once',46,46,{priceBasis:'future',assetId:'car'}),
   flow('oneoff','Other one-off cost','oneoff','primary',10000,'once',45,45,{priceBasis:'future'}),
  ],
  employment:[{owner:'primary',year:2027,month:7,severance:110000,taxBasis:'excluded',taxRate:0,returnYears:0,returnPayPercent:100},{owner:'partner',year:2029,month:7,severance:80000,taxBasis:'excluded',taxRate:0,returnYears:0,returnPayPercent:100}],
  allocation:{fromId:'cash',toId:'trading',year:2027,percent:25},
  withdrawal:{owner:'household',order:'cash-first',maxPercent:100},
  settings:{...legacy.settings,earlyPrimary:55,earlyPartner:55,jobAge:44,jobYears:1,partTimeAnnual:39000,partTimePartnerAnnual:33000,partTimePartnerAge:50,partTimeDaysPrimary:3,partTimeDaysPartner:3,downsizeAge:60,payoffAge:50,withdrawAge:55,fixedAge:55,marketAge:50},
  assumptionNotes:[
   'Alex’s unclear savings phrase is interpreted as £230k investments plus £160k cash. The lease is £350/month; rent is £100/month before tax and costs.',
   'Home equity £400k plus mortgage £383k gives a £783k home value. Other properties are assumed mortgage-free.',
   'Bonuses, rent, employer-share proceeds and severance exclude tax until you enter take-home amounts or a deduction estimate. No tax rules are calculated.',
   'Model year starts January2026. Alex redundancy is July2027; Jemma July2029 is an assumed month. Neither returns to work unless edited. Redundancy applies only in the selected scenario.',
   'School fees: £20k for2years, then £30k for5years; college £30k for5years. Quoted future prices do not also receive inflation. The lease ends when the £20k car is bought in2029.',
   'NI years16/17 are recorded, not converted into entitlement. State Pension amounts start at £0 until official forecasts are entered. State age68 and pension access57 are editable assumptions, not verified dates.',
   'Starting authored nominal returns: investments/pensions5%, savings4%, property2%, fixed income3%. Edit each account. No extra pension contributions or property running costs are assumed.',
  ],
 };
}
