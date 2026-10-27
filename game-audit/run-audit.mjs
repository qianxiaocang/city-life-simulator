import {E,locations,law,society,history,load,Meter,drive,stats,save,text} from './lib/harness.mjs';
const {matchesHistoryLocation}=history;
const N=Number(process.env.N??12000),meter=new Meter(),t0=Date.now();
const seen={birth:new Map(),history:new Map(),culture:new Map(),jobs:new Map(),actions:new Map()};
const add=(map,id)=>map.set(id,(map.get(id)||0)+1);
for(let i=0;i<N;i++){
 const world=i%5===0?'past':i%7===0?'future':'now';
 const birthYear=world==='past'?[1950,1955,1958,1961,1965,1968,1971,1975,1978,1982,1986,1990,1995,2000,2005,2010,2015,2020][i%18]:2026;
 let l;
 try{l=E.createLife({locations,seed:'a'+i,world,birthYear});
 add(seen.birth,l.born.id);
 meter.push('profile.lifeExpectancy@'+l.born.region+'@'+birthYear,l.profile.lifeExpectancy);
 meter.push('profile.typicalIncome@'+l.born.region,l.profile.typicalIncome);
 meter.push('siblings@'+birthYear,l.family.siblings.length);
 meter.push('motherAge@'+birthYear,l.family.mother.age);
 drive(l,meter,{onStep:l=>{if(l.pending)add(seen.actions,l.pending.action);if(l.job)add(seen.jobs,l.job.id);}});
 meter.check('ENGINE_THROW',true,{seed:l.seed});
 }catch(error){meter.check('ENGINE_THROW',false,{seed:'a'+i,error:String(error)});continue;}
 meter.push('deathAge@'+l.born.region,l.age);meter.push('deathAge@'+birthYear,l.age);
 meter.push('netWorthLifetimeRatio',E.netWorth(l)/Math.max(1,l.totals.earned));
 if(l.totals.earned>0)meter.push('spendLifetimeRatio',l.totals.spent/l.totals.earned);
 for(const person of [l.family.mother,l.family.father])if(!person.alive)meter.push((person===l.family.mother?'mother':'father')+'DeathAge@'+birthYear,person.age);
 for(const child of l.family.children){meter.push('childDeathBefore5@'+(child.birthYear??l.year-child.age),!child.alive&&child.age<5?1:0);meter.check('CHILD_AGE_VALID',child.age>=0&&Number.isFinite(child.age),{seed:l.seed,childAge:child.age});}
 const allHistory=new Map(history.HISTORY_EVENTS.map(x=>[x.id,x]));
 const culturalPerLife=new Set();
 for(const entry of l.log){
  if(entry.type==='choice')for(const event of society.CULTURAL_EVENTS)if(text(entry.text).startsWith(text(event.title)+'：')||text(entry.text).startsWith(text(event.title)+':'))culturalPerLife.add(event.id);
  if(!entry.historicalEventId)continue;
  const event=allHistory.get(entry.historicalEventId);add(seen.history,entry.historicalEventId);
  meter.check('HISTORY_KNOWN',!!event,{seed:l.seed,id:entry.historicalEventId});if(!event)continue;
  meter.check('HISTORY_TIMING',entry.year===event.year,{seed:l.seed,id:event.id,year:entry.year});
  const place=locations.find(x=>x.id===(entry.locationId||entry.historicalLocationId));
  meter.check('HISTORY_REGION',place&&matchesHistoryLocation(event,place),{seed:l.seed,id:event.id,place:place?.id},!!place);
  meter.check('HISTORY_HAS_EFFECT_FIELD',Object.keys(event.effects||{}).some(k=>event.effects[k]!==0),{seed:l.seed,id:event.id},entry.historicalOutcome===undefined);
  meter.check('HISTORY_MECHANICAL',entry.mechanicalEffect?.changed,{seed:l.seed,id:event.id},entry.historicalOutcome===undefined&&!!entry.mechanicalEffect);
  meter.check('HISTORY_SOURCE',event.sourceIds?.length>0,{id:event.id});
 }
 for(const id of culturalPerLife)add(seen.culture,id);
 // Undefined historical meeting dates cannot be manufactured from elapsed yearsTogether.
 meter.check('CASHFLOW_LEDGER',Math.abs(l.accounts?.reconciliationError||0)<.01,{seed:l.seed,error:l.accounts?.reconciliationError},!!l.accounts);
}
const result={meta:{lives:N,seconds:(Date.now()-t0)/1000,source:process.env.GAME_SRC,generatedAt:new Date().toISOString(),method:'Engine headless simulation; autoChoose + work focus. Not browser clicks. Every mutating engine call is observed.'},...meter.report(),coverage:{locations:locations.length,born:seen.birth.size,historyTotal:history.HISTORY_EVENTS.length,historyFired:seen.history.size,historyNeverFired:history.HISTORY_EVENTS.filter(e=>!seen.history.has(e.id)).map(e=>e.id),jobsTotal:society.CHINA_JOBS.length,jobsNeverTaken:society.CHINA_JOBS.filter(j=>!seen.jobs.has(j.id)).map(j=>j.id),cultural:Object.fromEntries(society.CULTURAL_EVENTS.map(event=>[event.id,{count:seen.culture.get(event.id)||0,denominator:N,rate:(seen.culture.get(event.id)||0)/N}])),actions:Object.fromEntries(seen.actions),distinctBirthWeights:new Set(locations.map(x=>x.weight)).size,populationRecorded:locations.filter(x=>x.population>0).length}};
save('audit-results.json',result);
console.log(JSON.stringify(result.meta));
for(const [code,c]of Object.entries(result.checks))console.log(`${c.status.padEnd(11)} ${String(c.failed).padStart(6)} / ${String(c.denominator).padStart(8)} | unsupported ${c.unsupported} | ${code}`);
console.log('Coverage:',JSON.stringify(result.coverage));
