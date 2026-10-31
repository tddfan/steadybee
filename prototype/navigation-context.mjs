/** Each primary destination retains its own reading position. */
export function createNavigationContext(){
 let current=null;const positions=new Map();
 return {visit(destination,scrollY=0){if(current)positions.set(current,Math.max(0,scrollY));current=destination;return positions.get(destination)??0;},get current(){return current;}};
}
