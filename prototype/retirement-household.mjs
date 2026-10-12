/** Fictional, annual household illustration. No tax, advice or probability model. */
const clone = value => structuredClone(value);
const sum = items => items.reduce((a,b)=>a+b,0);
const annual = row => row.amount * (row.frequency === 'month' ? 12 : 1);
const liquid = asset => ['cash','investment','bonds'].includes(asset.type);
const availableAt=(input,a,offset)=>input.year+offset>=(a.availableYear??input.year)&&(a.type!=='pension'||personFor(input,a.owner).age+offset>=a.accessAge);
const afterTax=(amount,item)=>amount*(item.taxBasis==='estimate'?1-(item.taxRate??0)/100:1);
const employed = (r,person,age,year,month,workEnd,event) => (r.frequency==='once'?age===r.startAge:age>=r.startAge&&(r.ongoing||age<r.endAge))&&age<workEnd&&(!event||(year+(month-1)/12<event.year+(event.month-1)/12)||(event.returnYears>0&&year+(month-1)/12>=event.year+(event.month-1)/12+event.returnYears));
const personFor = (input,owner) => input.people.find(p=>p.id===owner) ?? input.people[0];
export function householdExample() {
  return {
    year:2026, inflation:2,
    people:[{id:'primary',name:'Alex',age:57,retireAge:67,stateAge:67,horizonAge:90},{id:'partner',name:'Jemma',age:55,retireAge:67,stateAge:67,horizonAge:90}],
    assets:[
      {id:'cash',label:'Cash & savings',type:'cash',owner:'joint',balance:130000,rate:3,accessAge:0},
      {id:'trading',label:'Trading & ISAs',type:'investment',owner:'joint',balance:40000,rate:5,accessAge:0},
      {id:'alex-pot',label:'Alex’s pension',type:'pension',owner:'primary',balance:420000,rate:4,accessAge:60},
      {id:'jemma-pot',label:'Jemma’s pension',type:'pension',owner:'partner',balance:220000,rate:4,accessAge:60},
      {id:'home',label:'Home',type:'property',owner:'joint',balance:500000,rate:3,accessAge:0},
      {id:'car',label:'Car',type:'car',owner:'joint',balance:15000,rate:-10,accessAge:0},
      {id:'bonds',label:'Fixed-income assets',type:'bonds',owner:'joint',balance:0,rate:3,accessAge:0},
    ],
    debts:[
      {id:'mortgage',label:'Mortgage',type:'mortgage',balance:90000,rate:4.5,payment:800},
      {id:'car-loan',label:'Car finance',type:'loan',balance:8000,rate:7,payment:300},
      {id:'loan',label:'Other loan',type:'loan',balance:10000,rate:6,payment:200},
      {id:'credit',label:'Credit card',type:'loan',balance:2000,rate:20,payment:100},
    ],
    incomes:[
      {id:'salary-a',label:'Alex’s salary',type:'salary',owner:'primary',amount:42000,frequency:'year',startAge:57,endAge:100,growth:2},
      {id:'salary-j',label:'Jemma’s salary',type:'salary',owner:'partner',amount:24000,frequency:'year',startAge:55,endAge:100,growth:2},
      {id:'state-a',label:'Alex’s State Pension',type:'state',owner:'primary',amount:10000,frequency:'year',startAge:67,endAge:101,ongoing:true,growth:2},
      {id:'state-j',label:'Jemma’s State Pension',type:'state',owner:'partner',amount:10000,frequency:'year',startAge:67,endAge:101,ongoing:true,growth:2},
      {id:'db-a',label:'Alex’s DB pension',type:'pension',owner:'primary',amount:12000,frequency:'year',startAge:62,endAge:101,ongoing:true,growth:2},
      {id:'db-j',label:'Jemma’s DB pension',type:'pension',owner:'partner',amount:6000,frequency:'year',startAge:65,endAge:101,ongoing:true,growth:2},
    ],
    expenses:[
      {id:'living',label:'Everyday spending',type:'regular',owner:'primary',amount:2800,frequency:'month',startAge:57,endAge:101,ongoing:true,growth:0},
      {id:'lease',label:'Second car lease',type:'lease',owner:'primary',amount:400,frequency:'month',startAge:57,endAge:65,growth:0},
      {id:'save-a',label:'Alex’s pension saving',type:'saving',owner:'primary',amount:700,frequency:'month',startAge:57,endAge:67,growth:0},
      {id:'save-j',label:'Jemma’s pension saving',type:'saving',owner:'partner',amount:350,frequency:'month',startAge:55,endAge:67,growth:0},
    ],
    settings:{earlyPrimary:60,earlyPartner:62,jobAge:60,jobYears:2,partTimeAnnual:15000,downsizeAge:65,replacementPercent:70,movingCosts:20000,payoffAge:60,leaseMonthly:200,spendPercent:15,pensionMonthly:300,withdrawAge:65,withdrawAmount:20000,growthExtra:2,fixedPercent:50,fixedAge:60,legacyTarget:500000,marketAge:60,marketPercent:20},
  };
}
export function openingPicture(input) {
  const assets=sum(input.assets.map(a=>a.balance));const debt=sum(input.debts.map(d=>d.balance));
  return {assets,debt,net:assets-debt,accessible:sum(input.assets.filter(a=>(liquid(a)||a.type==='pension')&&availableAt(input,a,0)).map(a=>a.balance))};
}
function validate(input) {
  const numeric=(v,label,min=0,max=1e10)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`Complete ${label} with a value from ${min} to ${max}.`);};
  numeric(input.inflation,'inflation',0,15);
  for(const p of input.people) {if(p.niYears!==undefined){numeric(p.niYears,p.name+' NI years',0,60);if(!Number.isInteger(p.niYears))throw Error('Use whole NI qualifying years.');}numeric(p.age,p.name+' age',18,100);numeric(p.retireAge,p.name+' work-end age',18,100);numeric(p.stateAge,p.name+' pension start age',50,100);numeric(p.horizonAge,p.name+' horizon',p.age,105);if([p.age,p.retireAge,p.stateAge,p.horizonAge].some(value=>!Number.isInteger(value)))throw Error(`Use whole ages for ${p.name}.`);}
  for(const a of input.assets){numeric(a.balance,a.label+' balance');numeric(a.rate,a.label+' growth',-50,30);numeric(a.accessAge,a.label+' access age',0,100);}
  for(const d of input.debts){numeric(d.balance,d.label+' balance');numeric(d.rate,d.label+' interest',0,50);numeric(d.payment,d.label+' monthly payment');}
  for(const r of [...input.incomes,...input.expenses]){numeric(r.amount,r.label+' amount');numeric(r.startAge,r.label+' start',18,105);numeric(r.endAge,r.label+' end',r.startAge,110);numeric(r.growth,r.label+' growth',-20,20);if(!Number.isInteger(r.startAge)||!Number.isInteger(r.endAge))throw Error(`Use whole ages for ${r.label}.`);if(r.frequency!=='once'&&r.endAge===r.startAge)throw Error(`End ${r.label} after its start age.`);}
  for(const r of input.expenses)for(const c of r.changes??[]){numeric(c.age,r.label+' change age',r.startAge,105);numeric(c.amount,r.label+' changed amount');if(!Number.isInteger(c.age))throw Error('Use whole ages for spending changes.');}
  for(const item of [...input.assets,...input.incomes,...(input.employment??[])]){if(item.taxBasis&&!['net','excluded','estimate'].includes(item.taxBasis))throw Error('Select an amount tax basis.');if(item.taxBasis==='estimate')numeric(item.taxRate,'assumed tax deduction (%)',0,100);if(item.withdrawalTaxBasis==='estimate')numeric(item.withdrawalTaxRate,'assumed withdrawal deduction (%)',0,99);}
  for(const e of input.employment??[]){numeric(e.year,'redundancy year',input.year,input.year+80);numeric(e.month,'redundancy month',1,12);numeric(e.severance,'redundancy payment');numeric(e.returnYears,'years until return',0,40);if(e.returnPayPercent!==undefined)numeric(e.returnPayPercent,'new job pay (%)',0,200);if(!Number.isInteger(e.year)||!Number.isInteger(e.month)||!Number.isInteger(e.returnYears))throw Error('Use whole dates and years for redundancy.');}
  for(const a of input.assets)if(a.availableYear!==undefined){numeric(a.availableYear,a.label+' availability year',input.year,input.year+80);if(!Number.isInteger(a.availableYear))throw Error('Use a whole availability year.');}
  for(const r of [...input.incomes,...input.expenses])if(r.paymentMonth!==undefined){numeric(r.paymentMonth,r.label+' month',1,12);if(!Number.isInteger(r.paymentMonth))throw Error('Use a whole payment month.');}
  if(input.withdrawal){numeric(input.withdrawal.maxPercent,'withdrawal ceiling (%)',0,100);if(!['household','primary','partner'].includes(input.withdrawal.owner)||!['cash-first','investments-first','pension-first'].includes(input.withdrawal.order))throw Error('Select a withdrawal owner and order.');}
  if(input.allocation){numeric(input.allocation.year,'allocation year',input.year,input.year+80);numeric(input.allocation.percent,'allocation amount (%)',0,100);if(!Number.isInteger(input.allocation.year))throw Error('Use a whole allocation year.');}
  for(const key of ['partTimeDaysPrimary','partTimeDaysPartner'])if(input.settings[key]!==undefined)numeric(input.settings[key],key,0,5);
  if(input.settings.partTimePartnerAnnual!==undefined)numeric(input.settings.partTimePartnerAnnual,'Jemma part-time amount',0,1e7);
  if(input.settings.partTimePartnerAge!==undefined){numeric(input.settings.partTimePartnerAge,'Jemma part-time age',18,100);if(!Number.isInteger(input.settings.partTimePartnerAge))throw Error('Use a whole part-time age.');}
  const ranges={earlyPrimary:[18,100],earlyPartner:[18,100],jobAge:[18,100],jobYears:[1,20],partTimeAnnual:[0,100000],downsizeAge:[18,100],replacementPercent:[0,100],movingCosts:[0,1000000],payoffAge:[18,100],leaseMonthly:[0,10000],spendPercent:[0,100],pensionMonthly:[0,10000],withdrawAge:[18,100],withdrawAmount:[0,1e7],growthExtra:[0,10],fixedPercent:[0,100],fixedAge:[18,100],legacyTarget:[0,1e8],marketAge:[18,100],marketPercent:[0,100]};
  for(const [key,[min,max]] of Object.entries(ranges))numeric(input.settings[key],key,min,max);
  for(const key of ['earlyPrimary','earlyPartner','jobAge','jobYears','downsizeAge','payoffAge','withdrawAge','fixedAge','marketAge'])if(!Number.isInteger(input.settings[key]))throw Error(`Use a whole age/year for ${key}.`);
}
export function simulateHousehold(input, actions={}, stress=false) {
  validate(input);const assets=clone(input.assets),debts=clone(input.debts),s=input.settings;
  const horizon=Math.max(...input.people.map(p=>p.horizonAge-p.age));
  for(const [action,key] of [['downsize','downsizeAge'],['payoff','payoffAge'],['withdraw','withdrawAge'],['fixed','fixedAge'],['market','marketAge']])if(actions[action]&&(s[key]<input.people[0].age||s[key]>input.people[0].age+horizon))throw Error(`${action} must be within this planning horizon.`);
  if(actions.early&&(s.earlyPrimary<input.people[0].age||s.earlyPartner<input.people[1].age))throw Error('Work-end ages must not precede the current ages.');
  if(actions.job&&s.jobAge<input.people[0].age)throw Error('Income interruption must not precede the current age.');
  for(const r of [...input.expenses,...input.incomes].filter(r=>r.frequency==='once'&&r.amount>0)){const offset=r.startAge-personFor(input,r.owner).age;if(offset<0||offset>horizon)throw Error(`${r.label} is outside the current planning horizon.`);}
  const warnings=input.assets.filter(a=>a.withdrawalTaxBasis==='excluded').map(a=>`${a.label}: withdrawal tax excluded.`)
    .concat(input.assets.filter(a=>a.taxBasis==='excluded').map(a=>`${a.label}: return tax excluded.`))
    .concat([...input.incomes,...(input.employment??[]).filter(e=>actions[e.owner==='primary'?'job':'jobPartner'])].filter(r=>r.taxBasis==='excluded').map(r=>`${r.label??personFor(input,r.owner).name+' severance'}: income tax excluded.`));
  for(const r of input.incomes.filter(r=>r.type==='state'&&r.amount===0))warnings.push(`${r.label}: official forecast not entered.`);
  const rows=[],events=[{age:input.people[0].age+horizon,label:'Planning horizon'}];
  for(const a of input.assets)if(a.availableYear>input.year)events.push({age:input.people[0].age+a.availableYear-input.year,label:a.label+' available'});
  for(const r of input.expenses)for(const c of r.changes??[])events.push({age:input.people[0].age+c.age-personFor(input,r.owner).age,label:r.label+' changes'});
  for(const stream of input.incomes.filter(r=>r.type==='pension')){const owner=personFor(input,stream.owner);events.push({age:input.people[0].age+stream.startAge-owner.age,label:`${owner.name} DB / pension`});}let cumulativeGap=0;
  const workEnd=p=>actions.early? (p.id==='primary'?s.earlyPrimary:s.earlyPartner):p.retireAge;
  for(const p of input.people){events.push({age:input.people[0].age+workEnd(p)-p.age,label:`${p.name} stops work`});events.push({age:input.people[0].age+p.stateAge-p.age,label:`${p.name} State Pension`});}
  let withdrawalsByOwner={},withdrawalsByAccount={},netWithdrawalsByAccount={},withdrawalBudget=Infinity,withdrawalTax=0;
  const withdraw=(amount,offset,includePension=true,policy=true)=>{
    let remaining=policy?Math.min(amount,withdrawalBudget):amount,taken=0;
    const order=policy&&input.withdrawal?.order==='pension-first'?['pension','cash','bonds','investment']:policy&&input.withdrawal?.order==='investments-first'?['investment','cash','bonds','pension']:['cash','bonds','investment','pension'];
    for(const type of order.filter(t=>includePension||t!=='pension'))for(const a of assets.filter(a=>a.type===type)) {
      if(!availableAt(input,a,offset)||(policy&&input.withdrawal?.owner!=='household'&&input.withdrawal?.owner&&a.owner!==input.withdrawal.owner&&a.owner!=='joint'))continue;
      const fraction=a.withdrawalTaxBasis==='estimate'?1-a.withdrawalTaxRate/100:1;const n=Math.min(a.balance,remaining/fraction),net=n*fraction;a.balance-=n;remaining-=net;taken+=net;withdrawalTax+=n-net;withdrawalsByOwner[a.owner]=(withdrawalsByOwner[a.owner]??0)+n;withdrawalsByAccount[a.id]=(withdrawalsByAccount[a.id]??0)+n;netWithdrawalsByAccount[a.id]=(netWithdrawalsByAccount[a.id]??0)+net;
    }
    if(policy)withdrawalBudget-=taken;return taken;
  };
  for(let offset=0;offset<=horizon;offset++) {
    const age=input.people[0].age+offset,year=input.year+offset;
    const openingAssets=sum(assets.map(a=>a.balance)),openingDebt=sum(debts.map(d=>d.balance));
    withdrawalTax=0;withdrawalsByOwner={primary:0,partner:0,joint:0};withdrawalsByAccount={};netWithdrawalsByAccount={};withdrawalBudget=(input.withdrawal?.maxPercent??100)===100?Infinity:sum(assets.filter(a=>(liquid(a)||a.type==='pension')&&availableAt(input,a,offset)&&(!input.withdrawal||input.withdrawal.owner==='household'||a.owner===input.withdrawal.owner||a.owner==='joint')).map(a=>a.balance))*(input.withdrawal?.maxPercent??100)/100;
    let growth=0,growthTax=0,assetPurchased=0,incomeTax=0,marketLoss=0,debtInterest=0,propertyChange=0,homeCash=0,settlement=0,payoff=0,transfer=0;
    const sources={bonus:0,severance:0,inheritance:0,salary:0,rent:0,support:0,pension:0,state:0,other:0,assetRelease:0,withdrawals:0};
    for(const a of assets){const rate=a.rate+(actions.growth&&a.type==='investment'?s.growthExtra:0)-(stress&&['investment','pension','bonds'].includes(a.type)?2:0);const grossChange=a.balance*rate/100,change=grossChange>0?afterTax(grossChange,a):grossChange;growthTax+=grossChange-change;a.balance+=change;growth+=change;}
    for(const d of debts.filter(d=>!d.monthly)){const charge=d.balance*d.rate/100;d.balance+=charge;debtInterest+=charge;}
    if((actions.market||stress)&&age===(stress?Math.max(input.people[0].age,60):s.marketAge)) {
      for(const a of assets.filter(a=>['investment','pension','bonds'].includes(a.type))) {const loss=a.balance*(a.type==='bonds'?5:(stress?20:s.marketPercent))/100;a.balance-=loss;marketLoss+=loss;}
      events.push({age,label:`Market loss −${stress?20:s.marketPercent}%`});
    }
    const cash=assets.find(a=>a.type==='cash');if(!cash)throw Error('Keep a cash account for the household ledger.');
    if(actions.fixed&&age===s.fixedAge) {const target=assets.find(a=>a.type==='bonds');if(!target)throw Error('Keep a fixed-income account for this comparison.');for(const a of assets.filter(a=>a.type==='investment'&&availableAt(input,a,offset))){const moved=a.balance*s.fixedPercent/100;let destination=assets.find(b=>b.type==='bonds'&&b.owner===a.owner&&b.wrapper===a.wrapper);if(!destination){destination={...target,id:`fixed-${a.id}`,label:`${a.label} fixed income`,owner:a.owner,wrapper:a.wrapper,withdrawalTaxBasis:a.withdrawalTaxBasis,withdrawalTaxRate:a.withdrawalTaxRate,balance:0};assets.push(destination);}a.balance-=moved;destination.balance+=moved;transfer+=moved;}events.push({age,label:'Investment mix changes'});}
    if(actions.allocate&&year===input.allocation?.year){const choice=input.allocation,source=assets.find(a=>a.id===choice.fromId),target=assets.find(a=>a.id===choice.toId);if(!source||!target||source.type!=='cash'||target.type!=='investment'||source.owner!==target.owner||!availableAt(input,source,offset)||!availableAt(input,target,offset))throw Error('Choose available cash and investment accounts belonging to the same person.');const moved=source.balance*choice.percent/100;source.balance-=moved;target.balance+=moved;transfer+=moved;events.push({age,label:'Chosen cash / investment mix changes'});}
    if(actions.downsize&&age===s.downsizeAge) {
      const home=assets.find(a=>a.id==='home')??assets.find(a=>a.type==='property');if(!home||home.balance===0)throw Error('Enter a home value before downsizing.');
      const replace=home.balance*s.replacementPercent/100;settlement=sum(debts.filter(d=>d.type==='mortgage'&&(!d.propertyId||d.propertyId===(assets.find(a=>a.id==='home')??assets.find(a=>a.type==='property'))?.id)).map(d=>d.balance));
      homeCash=home.balance-replace-s.movingCosts-settlement;if(homeCash<0)throw Error('The home sale does not cover the replacement, mortgage and costs.');
      propertyChange=replace-home.balance;home.balance=replace;cash.balance+=homeCash;for(const d of debts.filter(d=>d.type==='mortgage'&&(!d.propertyId||d.propertyId===(assets.find(a=>a.id==='home')??assets.find(a=>a.type==='property'))?.id)))d.balance=0;events.push({age,label:'Downsize'});
    }
    if(actions.payoff&&age===s.payoffAge) {
      payoff=sum(debts.filter(d=>d.type==='mortgage'&&(!d.propertyId||d.propertyId===(assets.find(a=>a.id==='home')??assets.find(a=>a.type==='property'))?.id)).map(d=>d.balance));
      if(withdraw(payoff,offset,true,true)+.001<payoff)throw Error('Mortgage payoff exceeds selected accounts or the annual withdrawal ceiling after deduction estimates.');for(const d of debts.filter(d=>d.type==='mortgage'&&(!d.propertyId||d.propertyId===(assets.find(a=>a.id==='home')??assets.find(a=>a.type==='property'))?.id)))d.balance=0;events.push({age,label:'Mortgage repaid'});
    }
    let income=0,distributionTax=0;const releaseRequests=[];let parttimeRemaining=s.partTimeAnnual,partnerParttimeRemaining=s.partTimePartnerAnnual??33000;
    const incomeByOwner={primary:0,partner:0};
    for(const r of input.incomes) {
      const person=personFor(input,r.owner),ownAge=person.age+offset,start=r.type==='state'?person.stateAge:r.startAge;
      if(r.frequency==='once'?ownAge!==start:ownAge<start||(!r.ongoing&&ownAge>=r.endAge))continue;
      let amount=annual(r)*(1+r.growth/100)**offset,employmentFraction=1;
      if(['salary','bonus'].includes(r.type)) {
        const event=(input.employment??[]).find(e=>e.owner===person.id&&actions[person.id==='primary'?'job':'jobPartner']);
        if(r.type==='bonus'||r.frequency==='once'){
          if(!employed(r,person,ownAge,year,r.paymentMonth??3,workEnd(person),event))continue;if(event?.returnYears>0&&year+((r.paymentMonth??3)-1)/12>=event.year+(event.month-1)/12+event.returnYears)amount*=(event.returnPayPercent??100)/100;
        }else{
          if(ownAge>=workEnd(person))continue;
          if(event)employmentFraction=Array.from({length:12},(_,m)=>employed(r,person,ownAge,year,m+1,workEnd(person),event)?(event.returnYears>0&&year+m/12>=event.year+(event.month-1)/12+event.returnYears?(event.returnPayPercent??100)/100:1):0).reduce((a,b)=>a+b,0)/12;
          else if(actions.job&&person.id==='primary'&&ownAge>=s.jobAge&&ownAge<s.jobAge+s.jobYears)continue;
        }
        const parttime=person.id==='primary'?actions.parttime:actions.parttimePartner;
        const stepAge=person.id==='primary'?s.earlyPrimary:(s.partTimePartnerAge??50);
        if(parttime&&ownAge>=stepAge){
          const days=person.id==='primary'?s.partTimeDaysPrimary:s.partTimeDaysPartner;
          if(days!==undefined)amount*=days/5;
          else if(r.type==='bonus')amount*=.5;
          else if(person.id==='primary'){amount=Math.min(amount,parttimeRemaining);parttimeRemaining-=amount;}
          else {amount=Math.min(amount,partnerParttimeRemaining);partnerParttimeRemaining-=amount;}
        }
      }
      amount*=employmentFraction;const net=afterTax(amount,r);
      if(['dividend','sale'].includes(r.type)){releaseRequests.push({row:r,amount});continue;}
      incomeTax+=amount-net;
      income+=net;incomeByOwner[person.id]+=net;sources[r.type in sources?r.type:'other']+=net;
      if(r.frequency==='once')events.push({age,label:r.label});
    }
    for(const e of input.employment??[]){if(!actions[e.owner==='primary'?'job':'jobPartner']||e.year!==year)continue;const person=personFor(input,e.owner);if(!input.incomes.some(r=>r.owner===e.owner&&['salary','bonus'].includes(r.type)&&r.amount>0&&employed(r,person,person.age+offset,year,e.month,workEnd(person))))continue;const net=afterTax(e.severance,e);incomeTax+=e.severance-net;income+=net;incomeByOwner[e.owner]+=net;sources.severance+=net;events.push({age,label:personFor(input,e.owner).name+' redundancy'});}
    // A distribution/sale is an internal asset-to-cash transfer, not new income.
    let released=0;const releasesByCash={};
    for(const request of releaseRequests){let remaining=request.amount;for(const a of assets.filter(a=>a.type==='investment'&&availableAt(input,a,offset)&&(!request.row.assetId||a.id===request.row.assetId)&&(a.owner===request.row.owner||a.owner==='joint'))){const moved=Math.min(a.balance,remaining),net=afterTax(moved,request.row);a.balance-=moved;const account=assets.find(c=>c.type==='cash'&&c.owner===request.row.owner)??cash;account.balance+=net;releasesByCash[account.id]=(releasesByCash[account.id]??0)+net;remaining-=moved;released+=net;distributionTax+=moved-net;}}
    let spending=0,oneOff=0,savingGoal=0;const purchases=[];const savingGoals={primary:0,partner:0};
    for(const r of input.expenses) {
      const person=personFor(input,r.owner),ownAge=person.age+offset;
      if(r.frequency==='once'?ownAge!==r.startAge:ownAge<r.startAge||(!r.ongoing&&ownAge>=r.endAge))continue;
      const priceGrowth=r.priceBasis!=='future'&&['regular','oneoff','education','vehicle'].includes(r.type)?input.inflation:0;
      const change=(r.changes??[]).filter(c=>c.age<=ownAge).sort((a,b)=>b.age-a.age)[0];
      let amount=(change?change.amount*(r.frequency==='month'?12:1):annual(r))*(1+(r.growth+priceGrowth+(stress&&r.type!=='saving'?2:0)+(actions.inflation&&r.type!=='saving'?2:0))/100)**offset;
      if(r.type==='saving'){if(ownAge<workEnd(person)){savingGoal+=amount;savingGoals[person.id]+=amount;}continue;}
      if(actions.lease&&r.type==='lease')amount=Math.min(amount,s.leaseMonthly*12);
      if(actions.spend&&r.type==='regular')amount*=1-s.spendPercent/100;
      spending+=amount;if(r.frequency==='once'){oneOff+=amount;events.push({age,label:r.label});if(r.type==='vehicle')purchases.push({assetId:r.assetId,amount});}
    }
    if(actions.withdraw&&age===s.withdrawAge){spending+=s.withdrawAmount;oneOff+=s.withdrawAmount;events.push({age,label:'One-off withdrawal budget'});}
    if(actions.pension&&age<workEnd(input.people[0])){savingGoal+=s.pensionMonthly*12;savingGoals.primary+=s.pensionMonthly*12;}
    const monthlyQuotes=new Map(debts.filter(d=>d.monthly).map(d=>[d.id,amortiseYear(d.balance,d.rate,d.payment)]));
    const scheduled=sum(debts.map(d=>d.monthly?monthlyQuotes.get(d.id).paid:Math.min(d.balance,d.payment*12)));
    const previousNetWithdrawals={...netWithdrawalsByAccount};
    const need=spending+scheduled,deficit=Math.max(0,need-income),funded=withdraw(deficit,offset);
    const available=income+funded;
    // Debt payments are funded first. Unpaid interest stays in the debt balance.
    let paymentBudget=Math.min(available,scheduled),debtPaid=0;
    for(const d of debts){const wasPositive=d.balance>0.01,budget=Math.min(d.monthly?monthlyQuotes.get(d.id).paid:Math.min(d.balance,d.payment*12),paymentBudget);let pay;
      if(d.monthly){const quote=monthlyQuotes.get(d.id),actual=budget+1e-7>=quote.paid?quote:amortiseYear(d.balance,d.rate,budget/12);debtInterest+=actual.interest;d.balance=actual.balance;pay=actual.paid;}else{pay=budget;d.balance-=pay;}
      paymentBudget-=pay;debtPaid+=pay;if(wasPositive&&d.balance<0.01)events.push({age,label:d.label+' ends'});
    }
    const fundedSpending=Math.min(spending,Math.max(0,available-debtPaid));
    for(const purchase of purchases){const vehicle=assets.find(a=>a.id===purchase.assetId);if(!vehicle)throw Error('Select a vehicle asset for the car purchase.');const value=purchase.amount*(spending>0?fundedSpending/spending:0);vehicle.balance+=value;assetPurchased+=value;}
    const gap=Math.max(0,need-debtPaid-fundedSpending);cumulativeGap+=gap;
    const surplus=Math.max(0,income-need),pensionSaving=Math.min(surplus,savingGoal);
    const pensionSavingByOwner={};
    for(const person of input.people){const saving=savingGoal>0?pensionSaving*savingGoals[person.id]/savingGoal:0;pensionSavingByOwner[person.id]=saving;const pot=assets.find(a=>a.type==='pension'&&a.owner===person.id);if(saving>0&&!pot)throw Error(`Enter a ${person.name} pension pot to receive pension saving.`);if(pot)pot.balance+=saving;}
    const remainingSurplus=surplus-pensionSaving;for(const person of input.people){const account=assets.find(a=>a.type==='cash'&&a.owner===person.id)??cash;account.balance+=remainingSurplus*(income>0?incomeByOwner[person.id]/income:0);}
    sources.assetRelease=sum(Object.entries(releasesByCash).map(([id,value])=>Math.min(value,(netWithdrawalsByAccount[id]??0)-(previousNetWithdrawals[id]??0))));sources.withdrawals=funded-sources.assetRelease;
    const closingAssets=sum(assets.map(a=>a.balance)),closingDebt=sum(debts.map(d=>d.balance));
    rows.push({accountLabels:Object.fromEntries(assets.map(a=>[a.id,a.label])),withdrawalsByOwner,withdrawalsByAccount,withdrawalTax,assetPurchased,incomeTax:incomeTax+distributionTax,growthTax,debtBalances:Object.fromEntries(debts.map(d=>[d.id,d.balance])),year,primaryAge:age,partnerAge:input.people[1].age+offset,openingAssets,openingDebt,growth,marketLoss,propertyChange,homeCash,settlement: settlement+payoff,payoff,debtInterest,debtPaid,closingAssets,closingDebt,netWealth:closingAssets-closingDebt,accessible:sum(assets.filter(a=>(liquid(a)||a.type==='pension')&&availableAt(input,a,offset)).map(a=>a.balance)),financialAssets:sum(assets.filter(a=>liquid(a)||a.type==='pension').map(a=>a.balance)),vehicleValue:sum(assets.filter(a=>a.type==='car').map(a=>a.balance)),propertyValue:sum(assets.filter(a=>a.type==='property').map(a=>a.balance)),income,releasedFromInvestments:released,spending:need,oneOff,gap,cumulativeGap,sources,pensionSaving,pensionSavingByOwner,unfundedSaving:Math.max(0,savingGoal-pensionSaving),additions:surplus+homeCash,withdrawals:sum(Object.values(withdrawalsByAccount))+distributionTax,transfer});
  }
  return {rows,events,warnings,firstGap:rows.find(r=>r.gap>0.01)??null,final:rows.at(-1),opening:openingPicture(input)};
}

/** Preserve annual budgets, including every future replacement amount. */
export function convertStreamFrequency(row,next) {
 const previous=row.frequency;
 if(previous!==next&&previous!=='once'&&next!=='once'){
  const factor=(previous==='month'?12:1)/(next==='month'?12:1);
  row.amount*=factor;for(const change of row.changes??[])change.amount*=factor;
 }
 if(next==='once')row.changes=[];
 row.frequency=next;
}
/** Monthly equivalent of level annual payments, with interest before payment. */
export function paymentForDebtEnd(balance,rate,years) {
 if(!Number.isFinite(balance)||balance<0||!Number.isFinite(rate)||rate<0||!Number.isInteger(years)||years<1)throw Error('Enter a valid debt balance, rate and end year.');
 const r=rate/100;return (r===0?balance/years:balance*r/(1-(1+r)**(-years)))/12;
}

export function monthlyDebtPayment(balance,rate,months){
 if(!Number.isInteger(months)||months<1||balance<0||rate<0)throw Error('Enter a valid monthly loan term.');const r=rate/1200;return r===0?balance/months:balance*r/(1-(1+r)**(-months));
}
function amortiseYear(balance,rate,payment){let paid=0,interest=0;for(let m=0;m<12;m++){const charge=balance*rate/1200;interest+=charge;balance+=charge;const amount=Math.min(balance,payment);balance-=amount;paid+=amount;}return {balance,paid,interest};}
