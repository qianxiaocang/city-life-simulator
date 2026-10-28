import {writeFileSync} from 'node:fs';
await import('../shipped/engine-shipped.mjs');
const before=globalThis.__ENGINE_SHIPPED__;
await import('../current-engine.mjs');
const after=globalThis.__ENGINE_SHIPPED__;
function run(E,seed,world,birthYear){
  const l=E.createLife({locations:E.locations,seed,world,birthYear});E.startLife(l);
  const transitions=[];let prev=l.retired,guard=0;
  while(l.phase==='life'&&guard++<420){
    if(l.pending)E.autoChoose(l);else E.advanceYear(l);
    if(l.retired&&!prev)transitions.push({age:l.age,year:l.year,rule:l.retirementRule?.ageMonths/12??null,category:l.retirementRule?.category??null,statutory:l.retirementRule?.statutory??false,effective:l.retirementEffectiveDate??null});
    prev=l.retired;
  }
  return {seed,world,birthYear,sex:l.sex,region:l.location.region,contributionYears:l.contributionYears,transitions,workHistory:(l.workHistory||[]).map(x=>({age:x.age,year:x.year,id:x.id})),deathAge:l.death?.age};
}
const cases=[['st70','past',1949+(70*7)%67],['st93','past',1949+(93*7)%67],['st613','past',1949+(613*7)%67],['st3260','now',2026],['st1201','past',1955]];
const rows=cases.map(x=>({case:x.join('@'),before:run(before,...x),after:run(after,...x)}));
writeFileSync('out/retire-controls.json',JSON.stringify(rows,null,2));
console.log('wrote out/retire-controls.json');
