/** Named scenario settings only: household facts remain shared by the picture. */
export const MAX_EXPERIMENTS=12;
export function saveExperiment(entries,name,state,{id=crypto.randomUUID(),createdAt=new Date().toISOString()}={}){
 const title=typeof name==='string' ? name.trim() : '';
 if(!title||title.length>60)throw new RangeError('Use a name from 1 to 60 characters.');
 if(entries.length>=MAX_EXPERIMENTS)throw new RangeError('Keep up to 12 saved scenarios. Delete one before saving another.');
 if(entries.some(item=>item.name.toLocaleLowerCase()===title.toLocaleLowerCase()))throw new RangeError('Choose a different name for this scenario.');
 return [...structuredClone(entries),{id,name:title,createdAt,state:structuredClone(state)}];
}
export function renameExperiment(entries,id,name){const title=typeof name==='string'?name.trim():'';if(!title||title.length>60)throw new RangeError('Use a name from 1 to 60 characters.');if(entries.some(item=>item.id!==id&&item.name.toLocaleLowerCase()===title.toLocaleLowerCase()))throw new RangeError('Choose a different name for this scenario.');return entries.map(item=>({...structuredClone(item),...(item.id===id?{name:title}:{})}));}
export function removeExperiment(entries,id){return structuredClone(entries.filter(item=>item.id!==id));}
