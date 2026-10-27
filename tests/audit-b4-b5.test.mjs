import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../app/engine.js';
import {locations} from '../app/data/locations.js';
import {retirementFor,resolveCareerDecision,retireWithContributions,employmentAllowed} from '../app/career.js';
import {changeAsset,reconcile,bookNetWorth} from '../app/accounting.js';
import {HISTORY_EVENTS,matchesHistoryLocation} from '../app/data/history.js';

const at=region=>locations.find(x=>x.region===region);
const make=(region='mainland',seed='audit')=>E.createLife({locations,location:at(region),seed,birthYear:1975,world:'past'});

test('retirement choice rechecks the current jurisdiction and clears a stale deferral',()=>{
  const l=make('mainland','stale-retirement');E.startLife(l);l.age=50;l.year=2025;l.sex='female';l.birthMonth=1;
  l.job={id:'factory-operator',sector:'private',retirementCategory:'worker',salary:50000};
  const former=retirementFor(l);
  l.location=at('taiwan');l.job={id:'teacher',sector:'public-institution',retirementCategory:'professional',salary:60000};
  l.flags.retirementOffered=true;l.flags.retirementDeferredUntil=2025;
  const logs=[];const pending={action:'retirement-law',data:{rule:former,flexible:false}};
  assert.equal(resolveCareerDecision(l,pending,'retire',{log:(_l,text)=>logs.push(text)}),true);
  assert.equal(l.retired,false);assert.equal(l.flags.retirementOffered,false);
  assert.equal(l.flags.retirementDeferredUntil,undefined);assert.equal(l.retirementRule.jurisdiction,'taiwan');
  assert.equal(logs.length,1);
});

test('regional employment minima are playable only after schooling and without hazardous minor work',()=>{
  const l=make('hongkong','local-employment');E.startLife(l);l.age=15;l.year=1990;l.education='junior';l.school=null;
  assert.equal(employmentAllowed(l,{hazardous:false}),true);
  assert.equal(employmentAllowed(l,{hazardous:true}),false);
  l.school={stage:'high'};assert.equal(employmentAllowed(l,{hazardous:false}),false);
});

test('Hong Kong MPF balance is an asset withdrawal, never an invented annual pension',()=>{
  const l=make('hongkong','mpf');E.startLife(l);l.age=65;l.year=2040;l.job={id:'office-assistant',sector:'private',salary:100000};l.contributionYears=30;
  changeAsset(l,'retirement',120000,'test-model-balance');const nw=bookNetWorth(l);
  retireWithContributions(l,{log:()=>({})});
  assert.equal(l.pension,0);assert.equal(l.mpfWithdrawal,120000);assert.equal(l.money,120000);
  assert.equal(l.assets.retirement,0);assert.equal(bookNetWorth(l),nw);assert.ok(Math.abs(reconcile(l))<.01);
});

test('all curated events declare a matching place and record a mechanical state difference',()=>{
  for(const event of HISTORY_EVENTS){
    const place=locations.find(x=>matchesHistoryLocation(event,x));assert.ok(place,event.id);
    const life=E.createLife({locations,location:place,seed:`history-${event.id}`,birthYear:event.year,world:'past'});
    life.birthMonth=1;life.birthDay=1;E.startLife(life);E.processTimeline(life,1);
    const entry=life.log.find(x=>x.historicalEventId===event.id&&x.mechanicalEffect);
    assert.ok(entry,event.id);assert.equal(entry.historicalLocationId,place.id,event.id);
    assert.equal(entry.mechanicalEffect.changed,true,event.id);
  }
});

test('reflecting stores supplied words while a different response chooses rest',()=>{
  const a=make('mainland','reflect-branch');E.startLife(a);a.age=30;a.year=2005;
  a.pending={action:'reflect',title:{zhCN:'暂停片刻',zhTW:'暫停片刻',en:'Reflect'},description:{zhCN:'想法',zhTW:'想法',en:'Thought'},options:[{id:'write',label:{zhCN:'写',zhTW:'寫',en:'Write'}},{id:'continue',label:{zhCN:'继续',zhTW:'繼續',en:'Continue'}}],data:{}};
  const b=structuredClone(a);
  assert.equal(E.choose(a,'write','我想珍惜家人'),true);
  assert.equal(E.choose(b,'continue'),true);
  assert.equal(a.journal[0].text,'我想珍惜家人');assert.equal(b.journal.length,0);
  assert.ok(a.totals.learning>b.totals.learning);assert.ok(b.totals.health>a.totals.health);
  assert.equal(a.mortalityRisk.budget,b.mortalityRisk.budget);
});
