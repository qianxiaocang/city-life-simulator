// Deterministic positive controls on the exact seed/world/birth-year tuples in FIX-BRIEF.
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
await import(resolve(process.env.AUDIT_ENGINE || './shipped/engine-shipped.mjs'));
const E=globalThis.__ENGINE_SHIPPED__;
const T=x=>typeof x==='string'?x:x?.zhCN||'';
const cases={
 'L10K-01':[['w0','past',1950]],
 'L10K-02':[['w120','past',1950]],
 'L10K-03':[['w13','now',2026],['w38','now',2026],['w50','now',2026]],
 'L10K-04':[['w0','past',1950],['w13','now',2026],['w19','now',2026],['w22','now',2026]],
 'L10K-05':[['w54','past',1985],['w67','now',2026],['w102','past',2000],['w108','past',1961]],
 'L10K-06':[['w4','now',2026],['w5','now',2026],['w9','now',2026],['w13','now',2026]],
 'L10K-07':[['w156','past',1972],['w180','past',1950],['w216','past',1972],['w288','past',1961]],
 'L10K-08':[['w664','now',2026],['w4184','now',2026],['w8787','now',2026],['w11835','now',2026]],
 'L10K-09':[['w1686','past',1972],['w2190','past',1950],['w3414','past',1985],['w13026','past',1972]],
 'L10K-10':[['w7','now',2026],['w12','past',2000],['w21','now',2026],['w24','past',1985]],
 'L10K-11':[['w4854','past',1985],['w9024','past',1985],['w12892','now',2026],['w17274','past',1985]],
};
const catalog=new Map(E.HISTORY_EVENTS?.map(x=>[x.id,x])||[]);
function run(seed,world,birthYear){
 const l=E.createLife({locations:E.locations,seed,world,birthYear,paceMinutes:30}); E.startLife(l);
 const decisions=[];let guard=0;
 while(l.phase==='life'&&guard++<450){
  if(l.pending){const p=l.pending,labels=p.options?.map(o=>T(o.label))||[];
   if(p.action==='move')decisions.push({action:'move',age:l.age,year:l.year,labels,duplicate:labels.length!==new Set(labels).size});
   E.autoChoose(l);
  }else E.advanceYear(l);
 }
 const hist=l.log.filter(x=>x.historicalEventId);
 const family=[l.name,l.family.mother?.name,l.family.father?.name,l.family.partner?.name].filter(Boolean);
 const given=x=>T(x).slice(1);
 const badChildren=l.family.children.filter(c=>family.some(p=>T(p)===T(c.name)||given(p)===given(c.name)));
 const lateBirths=l.sex==='female'?l.family.children.filter(c=>c.birthYear-l.birthYear>49):[];
 const firstEdu={};for(const y of l.years||[])if(y.education&&!Object.hasOwn(firstEdu,y.education))firstEdu[y.education]=y.age;
 const moves=decisions.filter(x=>x.duplicate);
 const wrongRegion=hist.filter(x=>{const e=catalog.get(x.historicalEventId),region=E.locations.find(p=>p.id===x.historicalLocationId)?.region;return e?.regions?.length&&region&&!e.regions.includes(region)&&!e.regions.includes('all');});
 const historyGrammar=hist.filter(x=>/开始发生了|通过发生了|结束发生了|扩大发生了|恢复发生了/.test(T(x.text)));
 return {seed,world,birthYear,sex:l.sex,region:l.location.region,deathAge:l.death?.age,historyGrammar:historyGrammar.map(x=>T(x.text).slice(0,100)),wrongRegion:wrongRegion.map(x=>({id:x.historicalEventId,regions:catalog.get(x.historicalEventId)?.regions,location:E.locations.find(p=>p.id===x.historicalLocationId)?.region})),workHistory:(l.workHistory||[]).map(x=>({age:x.age,year:x.year,job:x.id})),retirementRule:l.retirementRule,retireAge:l.years?.find(y=>!y.job&&y.age>45)?.age,contributionYears:l.contributionYears,badChildren:badChildren.map(c=>T(c.name)),netWorth:E.netWorth(l),typicalIncome:l.profile?.typicalIncome,siblings:l.family.siblings.length,duplicateMoves:moves,firstEdu,lateBirths:lateBirths.map(c=>({name:T(c.name),atAge:c.birthYear-l.birthYear})),children:l.family.children.map(c=>({name:T(c.name),birthYear:c.birthYear}))};
}
const out={engine:process.env.AUDIT_ENGINE||'snapshot',cases:{}};
for(const [id,rows] of Object.entries(cases))out.cases[id]=rows.map(x=>run(...x));
writeFileSync(resolve(process.argv[2]||'out/seed-replay.json'),JSON.stringify(out,null,2));
console.log('wrote seed replay');
