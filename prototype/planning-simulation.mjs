/** Conditional Monte Carlo illustration. No allocation calibration or outcome guarantee. */
import { projectPlan } from './planning.mjs?v=20261022insights2';
const percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b),at=(sorted.length-1)*p,lo=Math.floor(at),hi=Math.ceil(at);return Math.round((sorted[lo]+(sorted[hi]-sorted[lo])*(at-lo))*100)/100;};
function randomNormal(seed){let state=seed>>>0;const uniform=()=>{state=(state+0x6D2B79F5)>>>0;let x=state;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;};return ()=>Math.sqrt(-2*Math.log(Math.max(Number.EPSILON,uniform())))*Math.cos(2*Math.PI*uniform());}
export function simulateOutcomes(flow,holdings,options={},settings={},progress=()=>{}){
 const {paths=200,volatility,seed=20261017}=settings;
 if(!Number.isInteger(paths)||paths<1||paths>500||!Number.isFinite(volatility)||volatility<0||volatility>40||!Number.isInteger(seed)||seed<0||seed>4294967295)throw new RangeError('Use 1–500 paths, volatility from 0–40%, and a whole-number seed.');
 const baseline=projectPlan(flow,holdings,options),years=baseline.assumptions.years,sigma=volatility/100,normal=randomNormal(seed),series=new Map();let covered=0,firstGap=null;
 for(let run=0;run<paths;run++){
  const investmentReturns={isa:[],pension:[],shares:[]};
  for(let year=0;year<years;year++){const z=normal();for(const key of Object.keys(investmentReturns)){const mean=baseline.assumptions.growth[key]/100;investmentReturns[key].push((Math.exp(Math.log1p(mean)-sigma*sigma/2+sigma*z)-1)*100);}}
  const projection=projectPlan(flow,holdings,{...options,investmentReturns});if(!projection.firstUnfundedMonth)covered++;else if(!firstGap||projection.firstUnfundedMonth<firstGap)firstGap=projection.firstUnfundedMonth;
  for(let i=0;i<projection.months.length;i++){const month=projection.months[i];if(i!==projection.months.length-1 && projection.months[i+1].month.slice(0,4)===month.month.slice(0,4))continue;const year=month.month.slice(0,4);if(!series.has(year))series.set(year,[]);series.get(year).push(month.withdrawableAssets/month.deflator);}
  if((run+1)%5===0||run===paths-1)progress(run+1,paths);
 }
 return {paths,covered,coveragePercent:covered/paths*100,volatility,seed,firstGap,endMonth:baseline.endMonth,unmodelledDebt:baseline.unmodelledDebt,years:[...series].map(([year,values])=>({year,p10:percentile(values,.1),p50:percentile(values,.5),p90:percentile(values,.9)}))};
}
