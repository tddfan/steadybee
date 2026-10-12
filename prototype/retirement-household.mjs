/** Fictional, annual household illustration. No tax, advice or probability model. */
const clone = value => structuredClone(value);
const sum = items => items.reduce((a,b)=>a+b,0);
const annual = row => row.amount * (row.frequency === 'month' ? 12 : 1);
const liquid = asset => ['cash','investment','bonds'].includes(asset.type);
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
      {id:'state-a',label:'Alex’s State Pension',type:'state',owner:'primary',amount:10000,frequency:'year',startAge:67,endAge:101,growth:2},
      {id:'state-j',label:'Jemma’s State Pension',type:'state',owner:'partner',amount:10000,frequency:'year',startAge:67,endAge:101,growth:2},
      {id:'db-a',label:'Alex’s DB pension',type:'pension',owner:'primary',amount:12000,frequency:'year',startAge:62,endAge:101,growth:2},
      {id:'db-j',label:'Jemma’s DB pension',type:'pension',owner:'partner',amount:6000,frequency:'year',startAge:65,endAge:101,growth:2},
    ],
    expenses:[
      {id:'living',label:'Everyday spending',type:'regular',owner:'primary',amount:2800,frequency:'month',startAge:57,endAge:101,growth:0},
      {id:'lease',label:'Second car lease',type:'lease',owner:'primary',amount:400,frequency:'month',startAge:57,endAge:65,growth:0},
      {id:'save-a',label:'Alex’s pension saving',type:'saving',owner:'primary',amount:700,frequency:'month',startAge:57,endAge:67,growth:0},
      {id:'save-j',label:'Jemma’s pension saving',type:'saving',owner:'partner',amount:350,frequency:'month',startAge:55,endAge:67,growth:0},
    ],
    settings:{earlyPrimary:60,earlyPartner:62,jobAge:60,jobYears:2,partTimeAnnual:15000,downsizeAge:65,replacementPercent:70,movingCosts:20000,payoffAge:60,leaseMonthly:200,spendPercent:15,pensionMonthly:300,withdrawAge:65,withdrawAmount:20000,growthExtra:2,fixedPercent:50,fixedAge:60,legacyTarget:500000,marketAge:60,marketPercent:20},
  };
}
export function openingPicture(input) {
  const assets=sum(input.assets.map(a=>a.balance));const debt=sum(input.debts.map(d=>d.balance));
  return {assets,debt,net:assets-debt,accessible:sum(input.assets.filter(a=>liquid(a)||(a.type==='pension'&&personFor(input,a.owner).age>=a.accessAge)).map(a=>a.balance))};
}
function validate(input) {
  const numeric=(v,label,min=0,max=1e10)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`Complete ${label} with a value from ${min} to ${max}.`);};
  numeric(input.inflation,'inflation',0,15);
  for(const p of input.people) {numeric(p.age,p.name+' age',18,100);numeric(p.retireAge,p.name+' work-end age',18,100);numeric(p.stateAge,p.name+' pension start age',50,100);numeric(p.horizonAge,p.name+' horizon',p.age,105);if([p.age,p.retireAge,p.stateAge,p.horizonAge].some(value=>!Number.isInteger(value)))throw Error(`Use whole ages for ${p.name}.`);}
  for(const a of input.assets){numeric(a.balance,a.label+' balance');numeric(a.rate,a.label+' growth',-50,30);numeric(a.accessAge,a.label+' access age',0,100);}
  for(const d of input.debts){numeric(d.balance,d.label+' balance');numeric(d.rate,d.label+' interest',0,50);numeric(d.payment,d.label+' monthly payment');}
  for(const r of [...input.incomes,...input.expenses]){numeric(r.amount,r.label+' amount');numeric(r.startAge,r.label+' start',18,105);numeric(r.endAge,r.label+' end',r.startAge,110);numeric(r.growth,r.label+' growth',-20,20);if(!Number.isInteger(r.startAge)||!Number.isInteger(r.endAge))throw Error(`Use whole ages for ${r.label}.`);if(r.frequency!=='once'&&r.endAge===r.startAge)throw Error(`End ${r.label} after its start age.`);}
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
  for(const r of input.expenses.filter(r=>r.frequency==='once'&&r.amount>0)){const offset=r.startAge-personFor(input,r.owner).age;if(offset<0||offset>horizon)throw Error(`${r.label} is outside the current planning horizon.`);}
  const rows=[],events=[];
  for(const stream of input.incomes.filter(r=>r.type==='pension')){const owner=personFor(input,stream.owner);events.push({age:input.people[0].age+stream.startAge-owner.age,label:`${owner.name} DB / pension`});}let cumulativeGap=0;
  const workEnd=p=>actions.early? (p.id==='primary'?s.earlyPrimary:s.earlyPartner):p.retireAge;
  for(const p of input.people){events.push({age:input.people[0].age+workEnd(p)-p.age,label:`${p.name} stops work`});events.push({age:input.people[0].age+p.stateAge-p.age,label:`${p.name} State Pension`});}
  const withdraw=(amount,offset,includePension=true)=>{
    let remaining=amount,taken=0;
    for(const type of ['cash','bonds','investment',...(includePension?['pension']:[])])for(const a of assets.filter(a=>a.type===type)) {
      if(a.type==='pension'&&personFor(input,a.owner).age+offset<a.accessAge)continue;
      const n=Math.min(a.balance,remaining);a.balance-=n;remaining-=n;taken+=n;
    }
    return taken;
  };
  for(let offset=0;offset<=horizon;offset++) {
    const age=input.people[0].age+offset,year=input.year+offset;
    const openingAssets=sum(assets.map(a=>a.balance)),openingDebt=sum(debts.map(d=>d.balance));
    let growth=0,marketLoss=0,debtInterest=0,propertyChange=0,homeCash=0,settlement=0,payoff=0,transfer=0;
    const sources={salary:0,rent:0,support:0,pension:0,state:0,other:0,assetRelease:0,withdrawals:0};
    for(const a of assets){const rate=a.rate+(actions.growth&&a.type==='investment'?s.growthExtra:0)-(stress&&['investment','pension','bonds'].includes(a.type)?2:0);const change=a.balance*rate/100;a.balance+=change;growth+=change;}
    for(const d of debts){const charge=d.balance*d.rate/100;d.balance+=charge;debtInterest+=charge;}
    if((actions.market||stress)&&age===(stress?Math.max(input.people[0].age,60):s.marketAge)) {
      for(const a of assets.filter(a=>['investment','pension','bonds'].includes(a.type))) {const loss=a.balance*(a.type==='bonds'?5:(stress?20:s.marketPercent))/100;a.balance-=loss;marketLoss+=loss;}
      events.push({age,label:`Market loss −${stress?20:s.marketPercent}%`});
    }
    const cash=assets.find(a=>a.type==='cash');if(!cash)throw Error('Keep a cash account for the household ledger.');
    if(actions.fixed&&age===s.fixedAge) {const target=assets.find(a=>a.type==='bonds');if(!target)throw Error('Keep a fixed-income account for this comparison.');for(const a of assets.filter(a=>a.type==='investment')){const moved=a.balance*s.fixedPercent/100;a.balance-=moved;target.balance+=moved;transfer+=moved;}events.push({age,label:'Investment mix changes'});}
    if(actions.downsize&&age===s.downsizeAge) {
      const home=assets.find(a=>a.type==='property');if(!home||home.balance===0)throw Error('Enter a home value before downsizing.');
      const replace=home.balance*s.replacementPercent/100;settlement=sum(debts.filter(d=>d.type==='mortgage').map(d=>d.balance));
      homeCash=home.balance-replace-s.movingCosts-settlement;if(homeCash<0)throw Error('The home sale does not cover the replacement, mortgage and costs.');
      propertyChange=replace-home.balance;home.balance=replace;cash.balance+=homeCash;for(const d of debts.filter(d=>d.type==='mortgage'))d.balance=0;events.push({age,label:'Downsize'});
    }
    if(actions.payoff&&age===s.payoffAge) {
      payoff=sum(debts.filter(d=>d.type==='mortgage').map(d=>d.balance));
      if(sum(assets.filter(liquid).map(a=>a.balance))+0.001<payoff)throw Error('Mortgage payoff exceeds accessible savings/investments.');
      withdraw(payoff,offset,false);for(const d of debts.filter(d=>d.type==='mortgage'))d.balance=0;events.push({age,label:'Mortgage repaid'});
    }
    let income=0,requestedRelease=0,parttimeRemaining=s.partTimeAnnual;
    for(const r of input.incomes) {
      const person=personFor(input,r.owner),ownAge=person.age+offset,start=r.type==='state'?person.stateAge:r.startAge;
      if(ownAge<start||ownAge>=r.endAge)continue;
      let amount=annual(r)*(1+r.growth/100)**offset;
      if(r.type==='salary') {
        if(ownAge>=workEnd(person))continue;
        if(actions.job&&person.id==='primary'&&ownAge>=s.jobAge&&ownAge<s.jobAge+s.jobYears)continue;
        if(actions.parttime&&person.id==='primary'&&ownAge>=s.earlyPrimary){amount=Math.min(amount,parttimeRemaining);parttimeRemaining-=amount;}
      }
      if(['dividend','sale'].includes(r.type)){requestedRelease+=amount;continue;}
      income+=amount;sources[r.type in sources?r.type:'other']+=amount;
    }
    // A distribution/sale is an internal asset-to-cash transfer, not new income.
    let released=0;for(const a of assets.filter(a=>a.type==='investment')){const moved=Math.min(a.balance,requestedRelease-released);a.balance-=moved;cash.balance+=moved;released+=moved;}
    let spending=0,oneOff=0,savingGoal=0;const savingGoals={primary:0,partner:0};
    for(const r of input.expenses) {
      const person=personFor(input,r.owner),ownAge=person.age+offset;
      if(r.frequency==='once'?ownAge!==r.startAge:ownAge<r.startAge||ownAge>=r.endAge)continue;
      const priceGrowth=['regular','oneoff'].includes(r.type)?input.inflation:0;
      let amount=annual(r)*(1+(r.growth+priceGrowth+(stress&&r.type!=='saving'?2:0)+(actions.inflation&&r.type!=='saving'?2:0))/100)**offset;
      if(r.type==='saving'){if(ownAge<workEnd(person)){savingGoal+=amount;savingGoals[person.id]+=amount;}continue;}
      if(actions.lease&&r.type==='lease')amount=Math.min(amount,s.leaseMonthly*12);
      if(actions.spend&&r.type==='regular')amount*=1-s.spendPercent/100;
      spending+=amount;if(r.frequency==='once')oneOff+=amount;
    }
    if(actions.withdraw&&age===s.withdrawAge){spending+=s.withdrawAmount;oneOff+=s.withdrawAmount;events.push({age,label:'One-off withdrawal budget'});}
    if(actions.pension&&age<workEnd(input.people[0])){savingGoal+=s.pensionMonthly*12;savingGoals.primary+=s.pensionMonthly*12;}
    const scheduled=sum(debts.map(d=>Math.min(d.balance,d.payment*12)));
    const need=spending+scheduled,deficit=Math.max(0,need-income),funded=withdraw(deficit,offset);
    const available=income+funded;
    // Debt payments are funded first. Unpaid interest stays in the debt balance.
    let paymentBudget=Math.min(available,scheduled),debtPaid=0;
    for(const d of debts){const pay=Math.min(d.balance,d.payment*12,paymentBudget);d.balance-=pay;paymentBudget-=pay;debtPaid+=pay;}
    const fundedSpending=Math.min(spending,Math.max(0,available-debtPaid));
    const gap=Math.max(0,need-debtPaid-fundedSpending);cumulativeGap+=gap;
    const surplus=Math.max(0,income-need),pensionSaving=Math.min(surplus,savingGoal);
    const pensionSavingByOwner={};
    for(const person of input.people){const saving=savingGoal>0?pensionSaving*savingGoals[person.id]/savingGoal:0;pensionSavingByOwner[person.id]=saving;const pot=assets.find(a=>a.type==='pension'&&a.owner===person.id);if(saving>0&&!pot)throw Error(`Enter a ${person.name} pension pot to receive pension saving.`);if(pot)pot.balance+=saving;}
    cash.balance+=surplus-pensionSaving;
    sources.assetRelease=Math.min(released,funded);sources.withdrawals=funded-sources.assetRelease;
    const closingAssets=sum(assets.map(a=>a.balance)),closingDebt=sum(debts.map(d=>d.balance));
    rows.push({year,primaryAge:age,partnerAge:input.people[1].age+offset,openingAssets,openingDebt,growth,marketLoss,propertyChange,homeCash,settlement: settlement+payoff,payoff,debtInterest,debtPaid,closingAssets,closingDebt,netWealth:closingAssets-closingDebt,accessible:sum(assets.filter(a=>liquid(a)||(a.type==='pension'&&personFor(input,a.owner).age+offset>=a.accessAge)).map(a=>a.balance)),propertyValue:sum(assets.filter(a=>a.type==='property').map(a=>a.balance)),income,releasedFromInvestments:released,spending:need,oneOff,gap,cumulativeGap,sources,pensionSaving,pensionSavingByOwner,unfundedSaving:Math.max(0,savingGoal-pensionSaving),additions:surplus+homeCash,withdrawals:funded+payoff,transfer});
  }
  return {rows,events,firstGap:rows.find(r=>r.gap>0.01)??null,final:rows.at(-1),opening:openingPicture(input)};
}
