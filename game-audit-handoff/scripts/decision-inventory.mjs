// Collect every presented choice before auto-selection, keeping the observed
// age/year envelope for each action+option variant.
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
await import(resolve(process.env.AUDIT_ENGINE || './current-engine.mjs'));
const E=globalThis.__ENGINE_SHIPPED__,T=x=>typeof x==='string'?x:x?.zhCN??'';
const N=Number(process.argv[2]||4000), rows=new Map(), actions=new Map();
for(let i=0;i<N;i++){
 const world=i%3===2?'now':'past',birthYear=world==='now'?2026:1950+(i*7)%66;
 const l=E.createLife({locations:E.locations,seed:'choice'+i,world,birthYear,paceMinutes:30});E.startLife(l);
 let guard=0;
 while(l.phase==='life'&&guard++<420){
  if(l.pending){const p=l.pending;
   actions.set(p.action,(actions.get(p.action)||0)+1);
   for(const o of p.options||[]){const key=JSON.stringify([p.action,o.id,T(o.label)]);
    let r=rows.get(key);if(!r)rows.set(key,r={action:p.action,optionId:o.id,label:T(o.label),description:T(o.description),count:0,minAge:l.age,maxAge:l.age,minYear:l.year,maxYear:l.year,regions:new Set(),exampleSeed:l.seed});
    r.count++;r.minAge=Math.min(r.minAge,l.age);r.maxAge=Math.max(r.maxAge,l.age);r.minYear=Math.min(r.minYear,l.year);r.maxYear=Math.max(r.maxYear,l.year);r.regions.add(l.location.region);
   }
   E.autoChoose(l);
  }else E.advanceYear(l);
 }
}
const out={lives:N,actions:Object.fromEntries([...actions].sort()),rows:[...rows.values()].sort((a,b)=>a.action.localeCompare(b.action)||a.optionId.localeCompare(b.optionId)||a.label.localeCompare(b.label)).map(r=>({...r,regions:[...r.regions].sort()}))};
writeFileSync(resolve(process.argv[3]||'out/decision-inventory.json'),JSON.stringify(out,null,2));
console.log('actions',actions.size,'option variants',rows.size);
