import test from 'node:test';
import assert from 'node:assert/strict';
import {LIFE_DECISION_TOPICS,offerLifeDecision,resolveLifeDecision,notifyLifeMilestone,lifeDecisionYear} from '../app/life-decisions.js';
import {homeTerms,ensureEconomyState,getEconomyShopItems,purchaseEconomyItem} from '../app/economy.js';
import {reconcile} from '../app/accounting.js';
const T=s=>({zhCN:s,zhTW:s,en:s});
function fixture(overrides={}){
  const life={id:'choices',phase:'life',age:30,year:2026,birthYear:1996,money:2e6,income:500000,everWorked:true,classRank:2,
    location:{id:'now',region:'mainland',name:T('成都市')},born:{id:'born'},urban:true,
    profile:{typicalIncome:50000,developmentIncomeIndex:1},job:{salary:500000},school:null,retired:false,
    assets:{house:0,car:0,retirement:0},family:{mother:{alive:true,age:60},father:{alive:true,age:62},partner:null,children:[]},
    flags:{},totals:{earned:0,spent:0,charity:0},stats:{health:60,happiness:60,knowledge:60,relationships:60},log:[],logSequence:0,...overrides};
  ensureEconomyState(life);return life;
}
function env({reject=false}={}){return {
  option:(id,label,description,autoWeight)=>({id,label,description,autoWeight}),
  decision(life,action,title,description,options,data){if(reject)return false;life.pending={action,title,description,options,data};return true;},
  integer:(_life,min)=>min,
  effects(life,fx){for(const [k,v] of Object.entries(fx||{}))life.stats[k]=(life.stats[k]||0)+v;},
  log(life,text,type='life',fx){const entry={text,type,age:life.age,year:life.year};life.log.unshift(entry);this.effects(life,fx);return entry;}
};}
function focus(life,topic){life.lifeDecisions??={};life.lifeDecisions.offerCounts=Object.fromEntries(LIFE_DECISION_TOPICS.map(x=>[x,x===topic?0:99]));}
function offer(life,topic,e=env()){focus(life,topic);assert.equal(offerLifeDecision(life,e),true);assert.equal(life.pending.data.scenario,topic);return life.pending;}
function resolve(life,id,e=env()){const p=life.pending;assert.ok(p.options.some(o=>o.id===id),`missing ${id}`);life.pending=null;assert.equal(resolveLifeDecision(life,p,id,e),true);}

test('home choice compares outright purchase and mortgage without buying both',()=>{
  const life=fixture(),terms=homeTerms(life),p=offer(life,'home');
  assert.deepEqual(p.options.map(o=>o.id),['cash','mortgage','save']);
  resolve(life,'cash');
  assert.equal(life.assets.house,terms.totalPrice);assert.equal(life.loans.mortgage.balance,0);
  assert.equal(life.money,2e6-terms.totalPrice);assert.ok(Math.abs(reconcile(life))<.01);
  life.age+=5;life.year+=5;focus(life,'home');offerLifeDecision(life,env());
  assert.notEqual(life.pending.data.scenario,'home');
});
test('insufficient outright funds can still permit a checked down payment',()=>{
  const life=fixture(),terms=homeTerms(life);life.money=terms.down;
  // Start the accounting baseline after intentionally constructing this balance.
  delete life.accounts;ensureEconomyState(life);
  const p=offer(life,'home');assert.deepEqual(p.options.map(o=>o.id),['mortgage','save']);
  resolve(life,'mortgage');
  assert.equal(life.money,0);assert.equal(life.assets.house,terms.totalPrice);assert.equal(life.loans.mortgage.balance,terms.principal);
  assert.ok(Math.abs(reconcile(life))<.01);
});
test('no income or savings never offers an unfunded purchase or creates consumer debt',()=>{
  const life=fixture({money:0,job:null,income:0,everWorked:false,classRank:1});
  focus(life,'home');offerLifeDecision(life,env());assert.notEqual(life.pending?.data.scenario,'home');
  life.pending=null;focus(life,'car');offerLifeDecision(life,env());assert.notEqual(life.pending?.data.scenario,'car');
  assert.equal(life.money,0);assert.equal(life.debt,0);assert.equal(life.assets.house,0);
});
test('car has an explicit public transport alternative and stale purchases do not award a car',()=>{
  const life=fixture();const p=offer(life,'car');assert.ok(p.options.some(o=>o.id==='buy'));assert.ok(p.options.some(o=>o.id==='transit'));
  life.money=0;const happy=life.stats.happiness;resolve(life,'buy');
  assert.equal(life.assets.car,0);assert.equal(life.stats.happiness,happy);assert.equal(life.debt,0);
});
test('pet adoption has real annual costs, no duplicate annual charge and no repeat adoption',()=>{
  const life=fixture();offer(life,'pet');resolve(life,'cat');
  assert.equal(life.lifeDecisions.pet.kind,'cat');const first=life.money;
  life.age++;life.year++;lifeDecisionYear(life,env());const after=life.money;
  assert.equal(first-after,900);lifeDecisionYear(life,env());assert.equal(life.money,after);
  life.age+=8;life.year+=8;life.money=0;lifeDecisionYear(life,env());
  assert.equal(life.lifeDecisions.pet.inHome,false);assert.equal(life.money,0);
  focus(life,'pet');offerLifeDecision(life,env());assert.notEqual(life.pending?.data.scenario,'pet');
});
test('wedding celebration is separate, optional, once per marriage and grants no gift income',()=>{
  const partner={alive:true,married:true,marriedYear:2026,name:T('伴侣')};
  const life=fixture({family:{mother:{alive:true},father:{alive:true},partner,children:[]}});
  assert.equal(notifyLifeMilestone(life,'marriage'),true);assert.equal(notifyLifeMilestone(life,'marriage'),false);
  const p=offer(life,'wedding');assert.ok(p.options.some(o=>o.id==='quiet'));
  const before=life.money;resolve(life,'quiet');assert.equal(life.money,before);assert.equal(partner.married,true);
  assert.equal(notifyLifeMilestone(life,'marriage'),false);assert.ok(life.lifeDecisions.completed[p.data.occasionKey]);
  assert.ok(!getEconomyShopItems(life).some(item=>item.id==='wedding'));
  assert.equal(purchaseEconomyItem(life,'wedding',env()),false);
  assert.equal(life.money,before);
});
test('a legacy wedding purchase cannot be charged again by the new marriage occasion',()=>{
  const life=fixture();life.family.partner={alive:true,married:true,marriedYear:life.year,name:T('伴侣')};
  life.flags['purchase-wedding']=life.age;life.owns.push('wedding');
  assert.equal(notifyLifeMilestone(life,'marriage'),false);
  assert.equal(life.lifeDecisions.occasions.length,0);
});
test('hundred-day occasions belong to a specific living child and expire instead of appearing years later',()=>{
  const child={alive:true,name:T('小安'),birthYear:2026,age:0};
  const life=fixture();life.family.children=[child];notifyLifeMilestone(life,'child',{child});
  assert.equal(notifyLifeMilestone(life,'child',{child}),false);offer(life,'baby-banquet');
  assert.ok(life.pending.title.zhCN.includes('小安'));resolve(life,'photo');
  const second={alive:true,name:T('小宁'),birthYear:2028,age:0};life.age+=2;life.year+=2;life.family.children.push(second);
  assert.equal(notifyLifeMilestone(life,'child',{child:second}),true);
  life.age+=2;life.year+=2;child.age=4;second.age=2;focus(life,'gift');offerLifeDecision(life,env());
  assert.notEqual(life.pending.data.scenario,'baby-banquet');
});
test('a delayed hundred-day celebration is explicitly belated',()=>{
  const life=fixture(),child={alive:true,name:T('小安'),birthYear:life.year,age:0};
  life.family.children=[child];notifyLifeMilestone(life,'child',{child});
  life.age++;life.year++;child.age++;
  offer(life,'baby-banquet');assert.ok(life.pending.title.zhCN.includes('补记'));assert.ok(life.pending.description.zhCN.includes('此前'));
});
test('driving offers exclude children, older beginners and an existing learner',()=>{
  for(const patch of [{age:12},{age:66},{lifeDecisions:{drivingAssessmentAge:31}},{lifeDecisions:{drivingQualified:true}}]){
    const life=fixture(patch);focus(life,'driving');offerLifeDecision(life,env());assert.notEqual(life.pending?.data.scenario,'driving');
  }
  const learner=fixture();offer(learner,'driving');resolve(learner,'learn');
  assert.equal(learner.lifeDecisions.drivingAssessmentAge,31);
  learner.age+=6;learner.year+=6;focus(learner,'driving');offerLifeDecision(learner,env());assert.notEqual(learner.pending?.data.scenario,'driving');
});
test('selective admission celebration requires real university enrollment and can use eligible family support',()=>{
  const life=fixture({age:18,year:2026,money:0,everWorked:false,job:null,income:0,classRank:4});
  assert.equal(notifyLifeMilestone(life,'admission',{school:{stage:'university',admissionTier:'public-bachelor'}}),false);
  life.school={stage:'university',admissionTier:'research-public',startedAt:18,label:T('重点本科')};
  assert.equal(notifyLifeMilestone(life,'admission',{school:life.school}),true);
  offer(life,'admission-banquet');assert.ok(life.pending.options.some(o=>o.id==='meal'));
  resolve(life,'meal');assert.equal(life.money,0);assert.equal(life.debt,0);assert.ok(life.flags.familyAidUsed>0);
});
test('declining a recurring topic respects its multi-year cooldown',()=>{
  const life=fixture();offer(life,'gift');resolve(life,'help');
  life.age++;life.year++;focus(life,'gift');offerLifeDecision(life,env());assert.notEqual(life.pending.data.scenario,'gift');
  life.pending=null;life.age+=4;life.year+=4;offer(life,'gift');
});
test('a full decision budget does not consume a milestone or its cooldown',()=>{
  const life=fixture();life.family.partner={alive:true,married:true,marriedYear:life.year,name:T('伴侣')};
  assert.equal(offerLifeDecision(life,env({reject:true})),false);
  assert.equal(life.lifeDecisions.occasions[0].offered,undefined);assert.equal(life.lifeDecisions.lastOffered.wedding,undefined);
  assert.equal(offerLifeDecision(life,env()),true);assert.equal(life.pending.data.scenario,'wedding');
});
test('era gates exclude mortgages before market access and motor cars before their modeled adoption',()=>{
  const early=fixture({year:1982,age:30,birthYear:1952});const p=offer(early,'home');
  assert.equal(p.options.some(o=>o.id==='mortgage'),false);early.pending=null;focus(early,'car');offerLifeDecision(early,env());
  assert.notEqual(early.pending.data.scenario,'car');
  const young=fixture({age:10,year:1970,everWorked:false,job:null});assert.equal(offerLifeDecision(young,env()),false);
});
test('all sixteen topics have translated, distinct and affordable ways to choose',()=>{
  for(const topic of LIFE_DECISION_TOPICS){
    const life=fixture();life.family.partner={alive:true,married:true,marriedYear:2020,name:T('伴侣')};
    life.family.children=[{alive:true,age:8,name:T('小安'),birthYear:2018}];
    if(topic==='retirement-hobby')life.retired=true;
    if(topic==='wedding')notifyLifeMilestone(life,'marriage');
    if(topic==='baby-banquet'){life.family.children[0].age=0;notifyLifeMilestone(life,'child',{child:life.family.children[0]});}
    if(topic==='admission-banquet'){life.school={stage:'university',admissionTier:'research-public',startedAt:life.age,label:T('本科')};notifyLifeMilestone(life,'admission',{school:life.school});}
    const p=offer(life,topic);
    assert.ok(p.options.length>=2,topic);assert.equal(new Set(p.options.map(o=>o.id)).size,p.options.length);
    for(const text of [p.title,p.description,...p.options.flatMap(o=>[o.label,o.description])])for(const lang of ['zhCN','zhTW','en'])assert.ok(text[lang]?.length>0,`${topic} ${lang}`);
    assert.ok(p.data.options.some(o=>o.cost===0),`${topic} free alternative`);
  }
});
