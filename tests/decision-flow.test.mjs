import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,startLife,advanceYear,autoChoose,choose,setAutopilot,ensureModelState} from '../app/engine.js';
import {loanPolicyInModelUnits} from '../app/data/money-basis.js';
import {studentLoanPolicy} from '../app/data/china-law.js';
const T=(zhCN)=>({zhCN,zhTW:zhCN,en:zhCN});
const locations=[
  {id:'110100',region:'mainland',name:{zhCN:'北京市',zhTW:'北京市',en:'Beijing'},prosperity:.9,weight:1},
  {id:'510100',region:'mainland',name:{zhCN:'成都市',zhTW:'成都市',en:'Chengdu'},prosperity:.7,weight:1},
];
const make=(seed,birthYear=2008)=>startLife(createLife({seed,birthYear,world:'past',locations,location:locations[0]}));
const prompt=(action,options=['continue'],data={})=>({id:action,action,title:T(action),description:T('说明'),kind:'choice',options:options.map(id=>({id,label:T(id)})),data});

test('complete automated lives across eras never present or answer more than two choices at one age',()=>{
  let answered=0,deferred=0;const actions=new Set();
  for(const birthYear of [1950,1965,1977,1990,2006,2026])for(let seed=0;seed<10;seed++){
    const life=make(`choice-flow-${birthYear}-${seed}`,birthYear),seen=new Set(),presented={};
    setAutopilot(life,true,'balanced');
    let iterations=0;
    for(;iterations<1500&&life.phase!=='dead';iterations++){
      if(life.pending){
        const key=life.pending.id;
        if(!seen.has(key)){seen.add(key);presented[life.age]=(presented[life.age]||0)+1;}
        assert.ok(presented[life.age]<=2,`${life.seed}: age ${life.age}, prompt ${life.pending.action}`);
        actions.add(life.pending.action);assert.equal(autoChoose(life),true);answered++;
      }else advanceYear(life);
      deferred+=life.pendingQueue.some(value=>value.notBeforeAge>life.age)?1:0;
      for(const [age,count] of Object.entries(life.decisionState.presentedByAge))assert.ok(count<=2,`${life.seed}: recorded ${count} prompts at ${age}`);
    }
    assert.equal(life.phase,'dead',`${life.seed} stalled at age ${life.age}`);
    const logged={};for(const row of life.log)if(row.type==='choice')logged[row.age]=(logged[row.age]||0)+1;
    assert.ok(Object.values(logged).every(count=>count<=2),`${life.seed}: excessive choice logs`);
  }
  // Positive controls: the cap is exercised while full lives and funding chains run.
  assert.ok(answered>500,`Only ${answered} choices observed`);
  assert.ok(deferred>0,'No delayed required plan was observed');
  assert.ok(actions.has('edu-funding'));assert.ok(actions.has('career-offer'));
});

function delayedFunding(year=2026){
  const life=make('delayed-funding-'+year,year-18);
  Object.assign(life,{age:18,year,education:'high',school:null,money:0,classRank:5});
  life.mortalityRisk.budget=1000;
  life.decisionState.presentedByAge[18]=2;
  const program={stage:'university',ownership:'public',label:T('公办本科'),duration:4,annualTuition:6000,livingCost:12000,familyContribution:999999,financialNeed:false,examScore:90};
  life.pendingQueue=[{...prompt('edu-funding',['family'],{program,gap:0,policy:{available:false,annualCap:0}}),scheduledAtAge:18,notBeforeAge:19}];
  return life;
}

test('deferred funding recalculates lost family support and cannot grant an unfunded degree',()=>{
  const life=delayedFunding();
  life.family.mother.alive=false;life.family.father.alive=false;
  advanceYear(life);
  assert.equal(life.age,19);assert.equal(life.pending.action,'edu-funding');
  assert.equal(life.pending.data.program.familyContribution,0);
  assert.ok(life.pending.data.gap>0);assert.ok(!life.pending.options.some(option=>option.id==='family'));
  assert.equal(choose(life,'family'),false);
  assert.equal(life.school,null);assert.equal(life.education,'high');assert.equal(life.loans.student.balance,0);
  assert.equal(choose(life,'work'),true);
  assert.equal(life.education,'high');assert.equal(life.school,null);
});

test('cross-year funding refreshes the student-loan policy before offering a loan',()=>{
  const life=delayedFunding(1998);
  life.family.mother.alive=false;life.family.father.alive=false;
  advanceYear(life);
  const pending=life.pending;
  assert.equal(life.year,1999);assert.equal(pending.action,'edu-funding');
  const expected=loanPolicyInModelUnits(studentLoanPolicy(1999,'university','mainland',{cityName:'北京市'}),1999);
  assert.equal(pending.data.policy.available,expected.available);
  assert.equal(pending.data.policy.annualCap,expected.annualCap);
  assert.equal(pending.options.some(option=>option.id==='loan'),expected.available&&pending.data.gap>0&&pending.data.gap<=expected.annualCap);
  assert.equal(life.education,'high');assert.equal(life.school,null);assert.equal(life.loans.student.balance,0);
});

test('legacy excess choices never silently marry the player or purchase a home',()=>{
  const life=make('legacy-consent',2000);life.age=26;life.year=2026;life.money=1000000;
  life.family.partner={alive:true,married:false,age:26,name:T('伴侣')};
  life.log.push({type:'choice',age:26,text:T('已有选择一')},{type:'choice',age:26,text:T('已有选择二')});
  delete life.decisionState;
  life.pending=prompt('marriage',['marry','wait']);
  life.pendingQueue=[prompt('life-home',['cash','mortgage','wait'])];
  const money=life.money;
  assert.equal(choose(life,'marry'),false);
  ensureModelState(life);
  assert.equal(life.pending,null);assert.equal(life.family.partner.married,false);
  assert.equal(life.flags.marriageCount||0,0);assert.equal(life.assets.house,0);assert.equal(life.loans.mortgage.balance,0);
  assert.equal(life.money,money);assert.equal(life.log.filter(row=>row.type==='choice'&&row.age===26).length,2);
});
