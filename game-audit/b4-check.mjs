import {E,locations,history,Meter,observe,stats,save} from './lib/harness.mjs';
const meter=new Meter();
const directed=[];
const eraEffects=[];
for(const era of history.HISTORICAL_ERAS){
  const events=history.HISTORY_EVENTS.filter(event=>event.year>=era.startYear&&event.year<=era.endYear);
  const income=events.some(event=>Number.isFinite(event.effects?.incomeMultiplier)&&event.effects.incomeMultiplier!==1);
  const education=events.some(event=>Number.isFinite(event.effects?.educationAccess)&&event.effects.educationAccess!==0);
  // The engine derives moving costs from real living-cost and income channels.
  const migration=events.some(event=>event.effects?.livingCostMultiplier!==undefined||event.effects?.incomeMultiplier!==undefined);
  eraEffects.push({id:era.id,eventCount:events.length,income,education,migration});
  meter.check('ERA_EFFECT_DIVERSITY',income&&education&&migration,{era:era.id,eventCount:events.length,income,education,migration});
}
for(const event of history.HISTORY_EVENTS){
  const place=locations.find(location=>history.matchesHistoryLocation(event,location));
  meter.check('EVENT_HAS_MATCHING_RESIDENCE',!!place,{event:event.id});
  if(!place)continue;
  const life=E.createLife({location:place,locations,seed:'event-'+event.id,world:'past',birthYear:event.year});
  life.birthMonth=1;life.birthDay=1;E.startLife(life);
  E.processTimeline(life,1);
  const entry=life.log.find(x=>x.historicalEventId===event.id&&x.mechanicalEffect);
  meter.check('EVENT_DIRECTED_REACHABLE',!!entry,{event:event.id,place:place.id});
  meter.check('EVENT_RECORDED_RESIDENCE',entry?.historicalLocationId===place.id,{event:event.id,place:place.id,recorded:entry?.historicalLocationId},!!entry);
  meter.check('EVENT_DIRECTED_MECHANICAL',entry?.mechanicalEffect?.changed===true,{event:event.id,effect:entry?.mechanicalEffect},!!entry);
  directed.push({id:event.id,place:place.id,changed:entry?.mechanicalEffect?.changed??false});
}
const samples=Number(process.env.LIVES??500),strategies=E.AUTOPILOT_STRATEGIES;
const simulations={};
for(const strategy of strategies){
  const earned=[],ownedAt39=[],carAt39=[];let terminated=0;
  for(let i=0;i<samples;i++){
    const life=E.createLife({locations,seed:'autopilot-'+i,world:'past',birthYear:1990});
    E.startLife(life);E.setAutopilot(life,true,strategy);
    let guard=0,recorded=false;
    while(life.phase==='life'&&guard++<300){
      if(life.pending)E.autoChoose(life);
      else {if(life.age>=39&&!recorded){ownedAt39.push(life.assets.house>0?1:0);carAt39.push(life.assets.car>0?1:0);recorded=true;}E.advanceYear(life);}
    }
    if(life.phase==='dead')terminated++;
    earned.push(life.totals.earned);
  }
  simulations[strategy]={lives:samples,terminated,earned:stats(earned),housingAt39:{count:ownedAt39.reduce((a,b)=>a+b,0),denominator:ownedAt39.length,rate:ownedAt39.reduce((a,b)=>a+b,0)/Math.max(1,ownedAt39.length)},carsAt39:{count:carAt39.reduce((a,b)=>a+b,0),denominator:carAt39.length,rate:carAt39.reduce((a,b)=>a+b,0)/Math.max(1,carAt39.length)}};
  meter.check('AUTOPILOT_TERMINATES',terminated===samples,{strategy,terminated,samples});
  const h=simulations[strategy].housingAt39;
  meter.check('AUTOPILOT_HOUSING',h.denominator>=30&&h.rate>=.4&&h.rate<=.8,{strategy,...h});
}
const medians=Object.values(simulations).map(x=>x.earned.p50),spread=(Math.max(...medians)-Math.min(...medians))/Math.max(1,Math.min(...medians));
meter.check('AUTOPILOT_INCOME_SPREAD',spread<.2,{spread,medians});
const out={meta:{directedEvents:directed.length,autopilotLivesPerStrategy:samples,method:'era effect diversity, directed event year/location fixture plus matched-seed headless managed lives'},...meter.report(),eraEffects,directed,simulations,medianIncomeSpread:spread};
save('batch-assertions.json',out);
console.log(JSON.stringify({checks:out.checks,simulations,medianIncomeSpread:spread},null,2));
