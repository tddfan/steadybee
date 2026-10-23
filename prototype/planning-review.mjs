function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}

/** A compact comparison marker, not an authentication or security check. */
export function startingPictureKey(holdings,flow){
  // Browsing another month does not change the recorded opening picture.
  const {asOfMonth,...recordedFlow}=flow;
  const text=JSON.stringify(stable({holdings,flow:recordedFlow}));
  let hash=0xcbf29ce484222325n;
  for(let i=0;i<text.length;i++)hash=BigInt.asUintN(64,(hash^BigInt(text.charCodeAt(i)))*0x100000001b3n);
  return hash.toString(16).padStart(16,'0');
}
