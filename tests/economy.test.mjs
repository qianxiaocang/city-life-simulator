import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureEconomyState,economyYear,getEconomyShopItems,purchaseEconomyItem,spend,canBorrowHousing} from '../app/economy.js';
const tri=s=>({zhCN:s,zhTW:s,en:s});
function person(age=50){return {age,alive:true,name:tri('Test')};}
function make(overrides={}){
  return {
    id:'life-economy',version:1,age:20,year:2026,birthYear:2006,phase:'life',classRank:1,
    location:{id:'cn-test',region:'mainland',prosperity:.5,name:tri('测试城')},
    profile:{typicalIncome:60000},stats:{health:70,happiness:60,knowledge:60,relationships:60},
    money:0,income:0,assets:{house:0,car:0},debt:0,investment:'deposit',job:null,lastJob:null,
    school:null,continuingEducation:null,education:'high',retired:false,flags:{},owns:[],hobbies:[],
    totals:{earned:0,spent:0,charity:0},family:{mother:person(),father:person(),partner:null,children:[],siblings:[]},
    ...overrides
  };
}
const env={
  normal:()=>0,chance:()=>false,integer:(_life,a)=>a,
  effects:(life,fx)=>{for(const [key,value]of Object.entries(fx))life.stats[key]=Math.max(0,Math.min(100,life.stats[key]+value));},
  log:(life,text,type)=>{(life.events??=[]).push({text,type});}
};
test('optional spending cannot create negative cash or debt before work',()=>{
  const life=make({money:100});
  assert.equal(spend(life,101),false);
  assert.equal(life.money,100);assert.equal(life.debt,0);
  assert.equal(spend(life,100),true);assert.equal(life.money,0);
  assert.equal(spend(life,-5),false);
  economyYear(life,env);
  assert.ok(life.money>=0);assert.equal(life.debt,0);
  assert.equal(life.lastCashflow.borrowing,0);
});
test('legacy negative cash is not silently converted to new unsecured loans',()=>{
  const life=make({money:-10000,debt:5000});
  ensureEconomyState(life);
  assert.equal(life.money,0);assert.equal(life.debt,0);
  assert.equal(life.flags.legacyUnsecuredBalanceCleared,true);
});
test('legacy student aliases migrate once and a stale alias cannot restore repaid principal',()=>{
  const legacy=make({studentLoan:{balance:12000,borrowedByYear:{2024:12000},approved:true}});
  ensureEconomyState(legacy);
  assert.equal(legacy.debt,12000);assert.equal(legacy.studentLoan,legacy.loans.student);
  const restored=make({studentLoan:{balance:12000,borrowedByYear:{2024:12000}},loans:{student:{balance:3000,borrowedByYear:{2024:12000},graduationYear:2025}}});
  ensureEconomyState(restored);
  assert.equal(restored.debt,3000);assert.equal(restored.studentLoan.balance,3000);
  restored.loans.student.balance=0;ensureEconomyState(restored);
  assert.equal(restored.debt,0);assert.equal(restored.studentLoan.balance,0);
});
test('minor pupils receive household or guardian subsistence despite zero tuition contribution',()=>{
  for(const stage of ['primary','junior','high','vocational']){
    const life=make({age:stage==='primary'?8:16,money:0,school:{stage,endsAt:18,annualTuition:stage==='high'?1500:0,livingCost:0,familyContribution:0,loanApproved:false}});
    economyYear(life,env);
    assert.equal(life.lastCashflow.unmetLiving,0,stage);
    assert.equal(life.lastCashflow.unfundedEducation,0,stage);
    assert.ok(life.lastCashflow.familySupport>0,stage);
    assert.equal(life.debt,0,stage);
  }
  const orphan=make({age:8,school:{stage:'primary',annualTuition:0,livingCost:0,familyContribution:0},family:{mother:null,father:null,partner:null,children:[],siblings:[]}});
  economyYear(orphan,env);
  assert.equal(orphan.lastCashflow.unmetLiving,0);
  assert.ok(orphan.lastCashflow.basicRelief>0);
  assert.equal(orphan.debt,0);
});
test('historical public higher education does not turn zero publicly covered living costs into personal fees',()=>{
  const life=make({year:1975,money:0,school:{stage:'university',endsAt:23,annualTuition:0,livingCost:0,publicSupport:true,familyContribution:0,scholarship:0,loanApproved:false}});
  economyYear(life,env);
  assert.equal(life.lastCashflow.living,0);
  assert.equal(life.lastCashflow.unmetLiving,0);
  assert.equal(life.lastCashflow.education,0);
  assert.equal(life.debt,0);
});
test('student borrowing covers only actual gap, uses aid and family first, and respects annual cap',()=>{
  const life=make({classRank:3,money:1000,school:{stage:'university',endsAt:23,annualTuition:10000,livingCost:6000,familyContribution:6000,scholarship:2000,loanApproved:true,financialNeed:true,studyRegion:'mainland'}});
  economyYear(life,env);
  assert.equal(life.lastCashflow.borrowing,7000);
  assert.equal(life.debt,7000);
  assert.equal(life.money,0);
  assert.equal(life.loans.student.borrowedByYear[2026],7000);
  const before=JSON.stringify(life);economyYear(life,env);assert.equal(JSON.stringify(life),before);
  const poor=make({school:{stage:'university',endsAt:23,annualTuition:30000,livingCost:8000,familyContribution:0,scholarship:0,loanApproved:true,financialNeed:true,studyRegion:'mainland'}});
  economyYear(poor,env);
  assert.equal(poor.lastCashflow.borrowing,20000);
  assert.equal(poor.debt,20000);assert.ok(poor.money>=0);
  assert.equal(poor.lastCashflow.unfundedEducation,10000);
});
test('unaffordable secondary tuition is not disguised as a child living subsidy or consumer debt',()=>{
  const life=make({age:16,school:{stage:'high',endsAt:18,annualTuition:50000,livingCost:0,familyContribution:50000},log:[]});
  economyYear(life,env);
  assert.equal(life.lastCashflow.familySupport,3600);
  assert.equal(life.lastCashflow.education,3600);
  assert.equal(life.lastCashflow.unfundedEducation,46400);
  assert.equal(life.lastCashflow.unmetLiving,0);
  assert.equal(life.debt,0);
  assert.ok(life.events.some(entry=>entry.text.zhCN.includes('原生家庭承担')));
});
test('working adults pay most of a supported expense themselves and lose support when parents are gone',()=>{
  const worker=make({age:27,classRank:4,money:10000,job:{salary:100000,years:1},log:[],logSequence:0});
  assert.equal(spend(worker,1000,'health'),true);
  assert.equal(worker.money,9200);
  assert.equal(worker.accounts.reconciliationError,0);
  assert.ok(worker.log.some(entry=>entry.text.zhCN.includes('原生家庭资助 ¥200')));
  const alone=make({age:27,classRank:4,money:10000,job:{salary:100000,years:1},family:{mother:null,father:null,partner:null,children:[],siblings:[]},log:[],logSequence:0});
  assert.equal(spend(alone,1000,'health'),true);
  assert.equal(alone.money,9000);
  assert.equal(alone.log.some(entry=>entry.text.zhCN.includes('原生家庭资助')),false);
});
test('unfunded academic years survive a later cleared tuition gap and are recorded once per year',()=>{
  const life=make({school:{stage:'university',endsAt:24,annualTuition:30000,livingCost:8000,familyContribution:0,scholarship:0,loanApproved:true,financialNeed:true,studyRegion:'mainland'}});
  economyYear(life,env);
  assert.equal(life.school.unfundedAcademicYears,1);
  assert.equal(life.school.lastUnfundedYear,2026);
  economyYear(life,env);
  assert.equal(life.school.unfundedAcademicYears,1);
  life.year=2027;life.age=21;life.money=100000;
  economyYear(life,env);
  assert.equal(life.school.fundingGap,0);
  assert.equal(life.school.unfundedAcademicYears,1,'paying the next year cannot silently complete a previously unfunded course year');
  const minor=make({age:15,school:{stage:'junior',endsAt:16,annualTuition:10000,livingCost:0,familyContribution:0}});
  economyYear(minor,env);
  assert.equal(minor.school.unfundedAcademicYears,undefined);
});
test('unapproved or ineligible school costs do not turn into debt',()=>{
  for(const school of [
    {stage:'high',annualTuition:50000,livingCost:6000,familyContribution:0,loanApproved:true,financialNeed:true},
    {stage:'university',annualTuition:50000,livingCost:6000,familyContribution:0,loanApproved:false,financialNeed:true},
    {stage:'university',annualTuition:50000,livingCost:6000,familyContribution:0,loanApproved:true,financialNeed:false}
  ]){
    const life=make({school});economyYear(life,env);
    assert.equal(life.debt,0);assert.ok(life.money>=0);
  }
  const beforePolicy=make({year:1998,school:{stage:'university',annualTuition:10000,livingCost:5000,familyContribution:0,loanApproved:true,financialNeed:true}});
  economyYear(beforePolicy,env);assert.equal(beforePolicy.debt,0);
});
test('in-school subsidy and graduate repayment remain separate from ordinary debt',()=>{
  const life=make({school:{stage:'university',endsAt:23,annualTuition:10000,livingCost:6000,familyContribution:0,scholarship:0,loanApproved:true,financialNeed:true}});
  economyYear(life,env);assert.equal(life.debt,16000);
  assert.equal(life.loans.student.capitalizedInterest||0,0);
  life.year++;life.age++;life.school=null;life.job={salary:120000,years:0};life.money=10000;
  economyYear(life,env);
  assert.ok(life.lastCashflow.studentRepayment>0);
  assert.equal(life.loans.student.balance,16000); // first graduate year pays interest, no principal yet
  assert.ok(life.money>=0);
});
test('housing requires adulthood, a job, enough down payment and repayment capacity',()=>{
  const unemployed=make({age:30,money:1e7});
  assert.equal(canBorrowHousing(unemployed,100000,10000),false);
  assert.equal(purchaseEconomyItem(unemployed,'house',env),false);
  assert.equal(purchaseEconomyItem(unemployed,'house-cash',env),true);
  assert.equal(unemployed.debt,0);
  const worker=make({age:30,money:1e6,job:{salary:180000,years:2},everWorked:true});
  assert.equal(purchaseEconomyItem(worker,'house',env),true);
  assert.ok(worker.assets.house>0);assert.ok(worker.loans.mortgage.balance>0);
  assert.equal(worker.debt,Math.round(worker.loans.mortgage.balance));
  assert.equal(canBorrowHousing(make({age:17,job:{salary:200000},everWorked:true}),100000,1000),false);
  assert.equal(canBorrowHousing(make({year:1997,age:30,job:{salary:200000},everWorked:true}),100000,1000),false);
});
test('mainland investment and durable-goods availability follows calendar years',()=>{
  const ids=year=>getEconomyShopItems(make({year,age:30,money:1e8,job:{salary:100000},everWorked:true})).map(x=>x.id);
  const early=ids(1950);
  for(const id of ['phone','computer','car','appliances','house','invest-stock','invest-bond','invest-fund'])assert.ok(!early.includes(id),id);
  assert.ok(early.includes('furniture'));assert.ok(early.includes('invest-deposit'));
  assert.ok(ids(1981).includes('invest-bond'));assert.ok(!ids(1989).includes('invest-stock'));
  assert.ok(ids(1990).includes('invest-stock'));assert.ok(!ids(1997).includes('invest-fund'));
  assert.ok(ids(1998).includes('invest-fund'));
  const life=make({age:30,money:1e6,job:{salary:100000},everWorked:true});
  assert.equal(purchaseEconomyItem(life,'furniture',env),true);
  assert.equal(purchaseEconomyItem(life,'furniture',env),false);
  life.age+=6;life.year+=6;
  assert.equal(purchaseEconomyItem(life,'furniture',env),true);
});
test('continuing education keeps a three-year commitment and does not grant an instant degree',()=>{
  const life=make({age:30,money:1e6,job:{salary:100000},everWorked:true});
  assert.equal(purchaseEconomyItem(life,'adultstudy',env),true);
  assert.equal(life.education,'high');assert.equal(life.continuingEducation.endsAt,33);
  assert.equal(purchaseEconomyItem(life,'adultstudy',env),false);
});
test('communication devices change by era and early mobile access is not nationwide in 1987',()=>{
  const device=(year,name='测试城')=>getEconomyShopItems(make({year,age:30,money:1e8,location:{id:'cn-test',region:'mainland',prosperity:.5,name:tri(name)}})).find(x=>x.id==='phone');
  assert.equal(device(1984),undefined);
  assert.match(device(1985).name.zhCN,/固定电话/);
  assert.match(device(1987).name.zhCN,/固定电话/);
  assert.match(device(1987,'广州').name.zhCN,/早期移动电话/);
  assert.match(device(1995).name.zhCN,/早期移动电话/);
  assert.match(device(2000).name.zhCN,/功能手机/);
  assert.match(device(2010).name.zhCN,/智能手机/);
  assert.ok(device(1987,'广州').cost>device(2010).cost);
});
test('car ownership adds modeled operating costs and loan deadlines fit the total-term model',()=>{
  const a=make({age:35,money:100000,job:{salary:120000}}),b=JSON.parse(JSON.stringify(a));
  b.assets.car=60000;
  economyYear(a,env);economyYear(b,env);
  assert.ok(b.lastCashflow.living>a.lastCashflow.living);
  assert.equal(b.lastCashflow.carRunningCost,2100);
  const graduate=make({year:2031,age:25,money:100000,job:{salary:120000},loans:{student:{balance:60000,borrowedByYear:{2022:15000},firstBorrowedYear:2022,originalStudyYears:4,graduationYear:2026}}});
  economyYear(graduate,env);
  assert.equal(graduate.loans.student.modelGraceYears,5);
  assert.equal(graduate.loans.student.modelRepaymentDeadline,2041);
  assert.ok(graduate.loans.student.balance<60000);
});
test('mortgage and student debt both reduce only through explicit servicing, never negative cash',()=>{
  const life=make({age:45,money:0,assets:{house:400000,car:0},loans:{student:{balance:5000,borrowedByYear:{},graduationYear:2015},mortgage:{balance:200000,rate:.04,annualPayment:16000,remainingYears:20}}});
  economyYear(life,env);
  assert.ok(life.money>=0);assert.ok(life.debt>0);
  assert.equal(life.debt,Math.round(life.loans.student.balance+life.loans.mortgage.balance));
  assert.ok(life.loans.mortgage.arrears>0);
});
test('calendar shocks affect income, living costs and investment without invented borrowing',()=>{
  const a=make({age:30,money:100000,job:{salary:100000},everWorked:true});
  const b=JSON.parse(JSON.stringify(a));
  economyYear(a,env);
  economyYear(b,{...env,context:{incomeMultiplier:.8,livingCostMultiplier:1.2,investmentReturnShock:-.2}});
  assert.ok(a.lastCashflow.income>b.lastCashflow.income);
  assert.ok(a.lastCashflow.housing<b.lastCashflow.housing,'the same housing basket costs more; total consumption may adjust to lost income');
  assert.ok(a.money>b.money);assert.equal(b.debt,0);
});
test('existing workers follow the historical income model before experience growth',()=>{
  const life=make({age:30,year:1980,money:100000,profile:{typicalIncome:30000},job:{salary:36000,years:1,marketIncomeReference:30000}});
  economyYear(life,env);
  assert.equal(life.job.salary,Math.round(36000*1.015));
  const salary=life.job.salary;
  life.year++;life.age++;life.profile.typicalIncome=45000;
  economyYear(life,env);
  assert.equal(life.job.salary,Math.round(salary*1.5*1.015));
  assert.equal(life.job.marketIncomeReference,45000);
  assert.equal(life.lastCashflow.grossEmploymentIncome,life.job.salary);
  assert.ok(life.lastCashflow.employmentIncome<life.job.salary,'take-home pay deducts modeled tax');
  const afterGrowth=life.job.salary;
  life.year++;life.age++;life.profile.typicalIncome=30000;
  economyYear(life,env);
  assert.equal(life.job.salary,Math.round(afterGrowth*(30000/45000)*1.015));
  assert.equal(life.job.marketIncomeReference,30000);
});
test('legacy wages establish a current baseline without catch-up and pension income is independent',()=>{
  for(const missing of [undefined,0,NaN,-1]){
    const worker=make({age:50,profile:{typicalIncome:120000},job:{salary:30000,years:1,marketIncomeReference:missing}});
    economyYear(worker,env);
    assert.equal(worker.job.salary,Math.round(30000*1.015));
    assert.equal(worker.job.marketIncomeReference,120000);
    const before=worker.job.salary;
    economyYear(worker,env);
    assert.equal(worker.job.salary,before);
  }
  const retiree=make({age:70,retired:true,pension:24000,basicSupport:3000,profile:{typicalIncome:120000},lastJob:{salary:60000,marketIncomeReference:30000}});
  economyYear(retiree,env);
  assert.equal(retiree.income,27000);
  assert.equal(retiree.pension,24000);
  assert.equal(retiree.basicSupport,3000);
  assert.equal(retiree.lastJob.marketIncomeReference,30000);
  retiree.year++;retiree.age++;retiree.profile.typicalIncome=180000;
  economyYear(retiree,env);
  assert.equal(retiree.income,27000);
});
