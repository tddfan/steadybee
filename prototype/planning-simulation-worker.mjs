import { simulateOutcomes } from './planning-simulation.mjs?v=20261022couple1';
self.onmessage=({data})=>{
 try {const result=simulateOutcomes(data.flow,data.holdings,data.options,data.settings,(done,total)=>self.postMessage({type:'progress',done,total}));self.postMessage({type:'result',result});}
 catch(error){self.postMessage({type:'error',message:error.message});}
};
