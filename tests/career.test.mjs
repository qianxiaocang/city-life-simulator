import test from 'node:test';
import assert from 'node:assert/strict';
import { CHINA_JOBS } from '../app/data/china-society.js';
import { ensureCareerState, employmentAllowed, candidateCareers, offerCareers, acceptCareer, resolveCareerDecision, careerYear, retirementFor, retirementMilestone, retireWithContributions } from '../app/career.js';

const T=value=>({zhCN:value,zhTW:value,en:value});
function fixture(overrides={}) {
  return {phase:'life',age:27,year:2026,birthYear:1999,birthMonth:1,sex:'male',education:'university',school:null,job:null,retired:false,location:{region:'mainland',name:T('北京市')},urban:true,profile:{typicalIncome:60000},stats:{knowledge:100,health:80,happiness:70,relationships:70},family:{children:[]},flags:{},qualifications:{},contributionYears:0,pending:null,pendingQueue:[],log:[],...overrides};
}
function environment({passes=true}={}) {
  return {normal:()=>0,chance:()=>passes,integer:(_life,min)=>min,
    option:(id,label,description,autoWeight)=>({id,label,description,autoWeight}),
    log:(life,text,type,effects)=>{const entry={text,type,effects};life.log.push(entry);return entry;},
    effects:()=>{},spend:()=>true,
    decision:(life,action,title,description,options,data)=>{
      const value={action,title,description,options,data};
      if(life.pending)life.pendingQueue.push(value);else life.pending=value;
    },
  };
}
const civilPost=()=>({...CHINA_JOBS.find(job=>job.id==='civil-clerk'),salary:70000});
const offeredCivil=life=>candidateCareers(life).filter(job=>job.entry==='civil-exam');
function applyForCivilService(life,env) {
  assert.equal(offerCareers(life,env),true);
  const pending=life.pending;
  const index=pending.data.jobs.findIndex(job=>job.entry==='civil-exam');
  assert.ok(index>=0);
  life.pending=null;
  assert.equal(resolveCareerDecision(life,pending,'career-'+index,env),true);
  return life.careerPreparation;
}

test('civil-service posts require preparation, an assessment result and explicit acceptance',()=>{
  const env=environment(),life=fixture();
  ensureCareerState(life);
  assert.equal(acceptCareer(life,civilPost(),env),false);
  assert.equal(life.job,null);
  const preparation=applyForCivilService(life,env);
  assert.equal(preparation.gate,'civil-exam');
  assert.equal(preparation.examYear,2027);
  assert.equal(life.job,null);
  careerYear(life,env);
  assert.equal(life.pending,null,'the result must wait for the following assessment year');
  life.year=2027;life.age=28;careerYear(life,env);
  assert.equal(life.pending.action,'career-result');
  assert.equal(life.pending.data.passed,true);
  assert.equal(life.job,null,'passing does not accept the post automatically');
  assert.equal(life.qualifications[preparation.job.id],undefined);
  const result=life.pending;life.pending=null;
  resolveCareerDecision(life,result,'accept',env);
  assert.equal(life.job.id,preparation.job.id);
  assert.equal(life.qualifications[preparation.job.id],true);
  assert.equal(life.everWorked,true);
});

test('failed civil-service assessment cannot grant a qualification or a post',()=>{
  const env=environment({passes:false}),life=fixture();
  applyForCivilService(life,env);
  life.year++;life.age++;careerYear(life,env);
  assert.equal(life.pending.data.passed,false);
  assert.deepEqual(life.pending.options.map(option=>option.id),['continue']);
  resolveCareerDecision(life,life.pending,'continue',env);
  assert.equal(life.job,null);
  assert.deepEqual(life.qualifications,{});
});

test('2026 civil-service age relaxation is limited to current graduating postgraduate cohorts',()=>{
  assert.ok(offeredCivil(fixture({age:38})).length);
  assert.equal(offeredCivil(fixture({age:39})).length,0);
  assert.ok(offeredCivil(fixture({age:43,education:'masters',educationState:{graduationAge:43}})).length);
  assert.equal(offeredCivil(fixture({age:44,education:'masters',educationState:{graduationAge:44}})).length,0);
  assert.equal(offeredCivil(fixture({age:43,education:'masters',educationState:{graduationAge:30}})).length,0);
  assert.ok(offeredCivil(fixture({year:2025,age:35})).length);
  assert.equal(offeredCivil(fixture({year:2025,age:36})).length,0);
});

test('registration-age eligibility survives the modeled next-year examination',()=>{
  for(const applicant of [{age:38,education:'university'},{age:43,education:'masters',educationState:{graduationAge:43}}]) {
    const life=fixture(applicant),env=environment();
    applyForCivilService(life,env);
    life.year++;life.age++;careerYear(life,env);
    assert.equal(life.pending?.data.passed,true,'an applicant eligible at registration must not age out during modeled preparation');
    const result=life.pending;life.pending=null;
    resolveCareerDecision(life,result,'accept',env);
    assert.ok(life.job,'the same registration age must apply when accepting the assessment result');
  }
});

test('ordinary employment protects under-sixteens, unfinished compulsory education and enrolled students',()=>{
  assert.equal(employmentAllowed(fixture({age:15,education:'junior'})),false);
  assert.equal(employmentAllowed(fixture({age:16,education:'junior'})),true);
  assert.equal(employmentAllowed(fixture({age:20,education:'primary'})),false);
  assert.equal(employmentAllowed(fixture({age:20,education:'high',school:{stage:'university'}})),false);
  assert.equal(employmentAllowed(fixture({age:17,education:'junior'}),{hazardous:true}),false);
  assert.equal(employmentAllowed(fixture({age:18,education:'junior'}),{hazardous:true}),true);
  const life=fixture({age:20,education:'primary'});
  assert.deepEqual(candidateCareers(life),[]);
  assert.equal(offerCareers(life,environment()),false);
  assert.equal(acceptCareer(life,civilPost(),environment()),false);
});

test('male and female retirement decisions trigger in their precise reform month',()=>{
  const cases=[
    {sex:'male',birthYear:1965,birthMonth:1,age:60,retirementCategory:'worker',month:2,ageMonths:721},
    {sex:'male',birthYear:1965,birthMonth:5,age:60,retirementCategory:'worker',month:7,ageMonths:722},
    {sex:'female',birthYear:1975,birthMonth:3,age:50,retirementCategory:'worker',month:5,ageMonths:602},
    {sex:'female',birthYear:1970,birthMonth:1,age:55,retirementCategory:'professional',month:2,ageMonths:661},
  ];
  for(const item of cases) {
    const env=environment(),life=fixture({...item,year:2025,job:{id:'modeled-retirement-job',name:T('工作'),salary:60000,sector:'private',retirementCategory:item.retirementCategory}});
    assert.equal(retirementFor(life).ageMonths,item.ageMonths);
    const fraction=(item.month-1)/12;
    assert.equal(retirementMilestone(life,fraction-.00001,env),false);
    assert.equal(retirementMilestone(life,fraction,env),true);
    assert.equal(life.pending.action,'retirement-law');
    assert.equal(life.pending.data.rule.retirementMonth,item.month);
    assert.equal(retirementMilestone(life,1,env),false,'do not repeat a retirement offer');
  }
});

test('retirement alone cannot create an employee pension without enough contribution years',()=>{
  const env=environment();
  const noContributions=fixture({age:63,contributionYears:0,job:civilPost()});
  retireWithContributions(noContributions,env);
  assert.equal(noContributions.pension,0);
  assert.ok(noContributions.basicSupport>0);
  assert.equal(noContributions.retired,true);
  assert.equal(noContributions.job,null);
  const sufficient=fixture({age:63,contributionYears:15,job:civilPost()});
  retireWithContributions(sufficient,env);
  assert.ok(sufficient.pension>0);
  assert.equal(sufficient.basicSupport,0);
  const raisedThreshold=fixture({age:63,year:2039,contributionYears:19,job:civilPost()});
  retireWithContributions(raisedThreshold,env);
  assert.equal(raisedThreshold.pension,0);
});
