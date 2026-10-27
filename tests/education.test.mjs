import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureEducationState, educationMilestones, resolveEducationDecision, finishEducation } from '../app/education.js';
import { economyYear } from '../app/economy.js';

const T=(zhCN,zhTW=zhCN,en=zhCN)=>({zhCN,zhTW,en});
function fixture(overrides={}) {
  return {phase:'life',age:18,year:2026,education:'high',focus:'study',talent:.5,classRank:2,money:0,debt:0,location:{region:'mainland',name:T('成都市')},profile:{typicalIncome:50000},stats:{knowledge:70,relationships:60},family:{mother:{alive:true},father:{alive:true},children:[]},flags:{},pending:null,pendingQueue:[],log:[],...overrides};
}
function environment({normal=0,approved=true}={}) {
  return {
    normal:()=>normal,chance:()=>approved,
    option:(id,label,description,autoWeight)=>({id,label,description,autoWeight}),
    decision:(life,action,title,description,options,data={},kind='choice')=>{
      const pending={id:action+'-'+life.age,action,title,description,options,data,kind};
      if(life.pending)life.pendingQueue.push(pending);else life.pending=pending;
    },
    log:(life,text,type,changes)=>life.log.push({text,type,changes}),
    effects:(life,changes)=>{for(const [key,change]of Object.entries(changes))life.stats[key]=(life.stats[key]||0)+change;},
    offerWork:life=>{life.workOffered=(life.workOffered||0)+1;},
    spend:()=>{throw new Error('Education must leave actual payments to the annual economy settlement.');},
  };
}
function decide(life,id,env) {
  const pending=life.pending;
  assert.ok(pending?.options.some(option=>option.id===id),'option '+id+' must be offered');
  life.pending=null;
  assert.equal(resolveEducationDecision(life,pending,id,env),true);
  life.pending ||= life.pendingQueue.shift() || null;
  return life.pending;
}
function graduate(life,stage,env) {
  ensureEducationState(life);
  life.school={stage,endsAt:life.age,label:T(stage)};
  assert.equal(finishEducation(life,env),true);
  educationMilestones(life,env);
}

test('primary and junior school complete nine years; high school depends on assessment',()=>{
  const env=environment(),life=fixture({age:6,year:2017,education:'preschool',stats:{knowledge:30,relationships:50}});
  educationMilestones(life,env);
  assert.equal(life.school.stage,'primary');
  assert.equal(life.school.endsAt,12);
  life.age=12;life.year=2023;
  finishEducation(life,env);educationMilestones(life,env);
  assert.equal(life.school.stage,'junior');
  assert.equal(life.school.endsAt,15);
  life.age=15;life.year=2026;
  finishEducation(life,env);educationMilestones(life,env);
  assert.equal(life.educationState.completedCompulsory,true);
  assert.equal(life.education,'junior');
  assert.equal(life.pending.action,'edu-secondary');
  assert.deepEqual(life.pending.data.programs.map(program=>program.stage),['vocational']);
  decide(life,'school-0',env);
  assert.equal(life.school.stage,'vocational');
  assert.equal(life.school.livingCost,0);
  assert.equal(life.school.loanApproved,false);
  assert.equal(life.debt,0);
});

test('low and high examination results lead to different eligible offers, not random degrees',()=>{
  const env=environment();
  const low=fixture({stats:{knowledge:10,relationships:50},talent:0});
  graduate(low,'high',env);
  assert.equal(low.pending.data.score,25);
  assert.deepEqual(low.pending.data.programs.map(program=>[program.stage,program.ownership]),[['associate','private']]);
  decide(low,'program-0',env);
  assert.equal(low.pending.action,'edu-funding');
  assert.equal(low.pending.options.some(option=>option.id==='cheaper'),false,'lower fees must not bypass the public-college score requirement');
  assert.equal(low.school,null);
  const high=fixture({stats:{knowledge:96,relationships:50},talent:1});
  graduate(high,'high',env);
  assert.ok(high.pending.data.score>=85);
  assert.equal(high.pending.data.programs[0].admissionTier,'research-public');
  assert.equal(high.pending.data.programs.length,5);
  assert.equal(high.education,'high');
});

test('student-loan approval creates an annual funding plan, not an immediate full-course debt',()=>{
  const env=environment(),life=fixture();
  graduate(life,'high',env);
  const index=life.pending.data.programs.findIndex(program=>program.stage==='university'&&program.ownership==='public');
  decide(life,'program-'+index,env);
  assert.ok(life.pending.options.some(option=>option.id==='loan'));
  decide(life,'loan',env);
  assert.equal(life.school.loanApproved,true);
  assert.equal(life.school.financialNeed,true);
  assert.equal(life.school.loanCap,20000);
  assert.equal(life.studentLoan.balance,0);
  assert.equal(life.money,0);
  assert.equal(life.school.endsAt,22);
  assert.equal(life.education,'high');
  life.studentLoan.balance=15000;life.age=22;life.year=2030;
  assert.equal(finishEducation(life,env),true);
  educationMilestones(life,env);
  assert.equal(life.education,'university');
  assert.equal(life.studentLoan.graduationYear,2030);
  assert.equal(life.previousSchool.stage,'university');
  assert.equal(life.pending.action,'edu-postgraduate');
});

test('unaffordable private tuition cannot exceed the loan cap; a cheaper eligible route remains available',()=>{
  const env=environment(),life=fixture({classRank:1});
  graduate(life,'high',env);
  const privateIndex=life.pending.data.programs.findIndex(program=>program.stage==='university'&&program.ownership==='private');
  decide(life,'program-'+privateIndex,env);
  assert.ok(life.pending.data.gap>life.pending.data.policy.annualCap);
  assert.equal(life.pending.options.some(option=>option.id==='loan'),false);
  assert.ok(life.pending.options.some(option=>option.id==='aid'));
  decide(life,'cheaper',env);
  assert.equal(life.pending.data.program.stage,'associate');
  assert.ok(life.pending.options.some(option=>option.id==='loan'));
  assert.equal(life.debt,0);
});

test('failed loan review cannot be retried indefinitely and does not remove the aid route',()=>{
  const env=environment(),life=fixture();
  graduate(life,'high',env);decide(life,'program-0',env);
  env.chance=()=>false;decide(life,'loan',env);
  assert.equal(life.school,null);
  assert.equal(life.studentLoan,undefined);
  assert.equal(life.pending.options.some(option=>option.id==='loan'),false);
  assert.ok(life.pending.options.some(option=>option.id==='aid'));
  decide(life,'aid',env);
  assert.equal(life.pending.options.some(option=>option.id==='aid'),false);
  assert.equal(life.pending.options.some(option=>option.id==='loan'),false);
  decide(life,'work',env);
  assert.equal(life.pending,null);
  assert.equal(life.workOffered,1);
});

test('family funding checks affordability without double-charging; graduation follows course duration',()=>{
  const env=environment(),life=fixture({money:15000,classRank:3,age:21});
  graduate(life,'high',env);decide(life,'program-0',env);decide(life,'family',env);
  assert.equal(life.money,15000);
  assert.equal(life.school.endsAt,25);
  life.age=22;
  assert.equal(finishEducation(life,env),false);
  assert.equal(life.education,'high');
  life.age=25;life.year+=4;
  assert.equal(finishEducation(life,env),true);
  educationMilestones(life,env);
  const pendingCount=life.pendingQueue.length;
  educationMilestones(life,env);
  assert.equal(life.pendingQueue.length,pendingCount,'graduation options are offered once');
});

test('historical admissions suspend examinations and reopen routes in 1977',()=>{
  const env=environment(),suspended=fixture({year:1967});
  graduate(suspended,'high',env);
  assert.equal(suspended.pending.action,'edu-suspended');
  assert.equal(suspended.educationState.exams.length,0);
  decide(suspended,'work',env);
  suspended.age=21;suspended.year=1970;
  educationMilestones(suspended,env);
  assert.equal(suspended.pending.action,'edu-recommendation');
  assert.equal(suspended.pending.data.eligible,true);
  const young=fixture({year:1973,age:18});
  graduate(young,'high',env);
  assert.equal(young.pending.action,'edu-recommendation');
  assert.equal(young.pending.options.some(option=>option.id==='recommend'),false);
  const restored=fixture({year:1977,age:29,education:'high'});
  educationMilestones(restored,env);
  assert.equal(restored.pending.action,'edu-college');
  assert.equal(restored.pending.data.route,'gaokao');
  decide(restored,'program-0',env);
  assert.equal(restored.pending.options.some(option=>option.id==='loan'),false);
  decide(restored,'family',env);
  assert.equal(restored.school.annualTuition,0);
  assert.equal(restored.school.endsAt,33);
});

test('non-mainland assessments do not claim mainland examination or loan entitlements',()=>{
  const env=environment(),life=fixture({location:{region:'taiwan',name:T('臺北市')}});
  graduate(life,'high',env);
  assert.equal(life.pending.data.route,'local-assessment');
  assert.equal(life.educationState.exams[0].kind,'local-assessment');
  decide(life,'program-0',env);
  assert.equal(life.pending.data.policy.available,false);
  assert.equal(life.pending.options.some(option=>option.id==='loan'),false);
});

test('legacy pending choices reopen assessment and all state remains serializable with three languages',()=>{
  const env=environment(),life=fixture({flags:{repeatExam:19}});
  assert.equal(resolveEducationDecision(life,{action:'university'},'apply',env),true);
  assert.equal(life.pending.action,'edu-college');
  assert.equal(life.flags.repeatExam,undefined);
  assert.equal(life.educationState.repeatUntil,19);
  const restored=JSON.parse(JSON.stringify(life));
  assert.deepEqual(restored.pending,life.pending);
  for(const item of [life.pending.title,life.pending.description,...life.pending.options.flatMap(option=>[option.label,option.description])]) {
    assert.equal(typeof item.zhCN,'string');assert.equal(typeof item.zhTW,'string');assert.equal(typeof item.en,'string');
  }
  assert.equal(resolveEducationDecision(life,{action:'romance'},'date',env),false);
});

test('an unfunded higher-education year postpones graduation and permits funded return after work',()=>{
  const env=environment(),life=fixture({classRank:5});
  graduate(life,'high',env);decide(life,'program-0',env);decide(life,'family',env);
  life.classRank=1;life.profile.typicalIncome=1000;life.money=0;
  life.age=22;life.year=2030;
  life.school.fundingGap=5000;life.school.unfundedAcademicYears=1;life.school.lastUnfundedYear=2029;
  assert.equal(finishEducation(life,env),false);
  assert.equal(life.education,'high','unpaid tuition cannot award a bachelor’s degree');
  assert.equal(life.school.endsAt,23);
  assert.equal(life.school.delayedAcademicYears,1);
  assert.equal(life.school.completedAcademicYears,3);
  assert.equal(life.pending.action,'edu-funding');
  assert.equal(life.pending.data.program.duration,1);
  const count=life.pendingQueue.length;
  finishEducation(life,env);
  assert.equal(life.school.endsAt,23,'the same annual funding gap cannot delay graduation twice');
  assert.equal(life.pendingQueue.length,count);
  decide(life,'work',env);
  assert.equal(life.school,null);
  assert.equal(life.educationState.suspendedStudy.remainingYears,1);
  assert.equal(life.debt,0);
  life.age=23;life.year=2031;life.money=30000;
  educationMilestones(life,env);
  assert.equal(life.pending.action,'edu-funding');
  assert.ok(life.pending.options.some(option=>option.id==='family'));
  decide(life,'family',env);
  assert.equal(life.school.endsAt,24);
  assert.equal(life.school.creditedAcademicYears,3);
  assert.equal(life.school.loanApproved,false);
  assert.equal(life.educationState.suspendedStudy,null);
  assert.equal(life.money,30000,'return funding is paid once by annual settlement');
  life.age=24;life.year=2032;
  assert.equal(finishEducation(life,env),true);
  assert.equal(life.education,'university');
  assert.equal(life.previousSchool.completedAcademicYears,4);
});

test('a tuition gap before the planned final year triggers review immediately, while living hardship alone does not',()=>{
  const env=environment(),life=fixture({classRank:5});
  graduate(life,'high',env);decide(life,'program-0',env);decide(life,'family',env);
  life.age=19;life.year=2027;life.school.fundingGap=6000;life.school.unfundedAcademicYears=1;
  finishEducation(life,env);
  assert.equal(life.school.endsAt,23);
  assert.equal(life.school.completedAcademicYears,0);
  assert.equal(life.pending.action,'edu-funding');
  const unaffected=fixture({age:22,year:2030,school:{stage:'university',startedAt:18,endsAt:22,label:T('大学'),fundingGap:0},flags:{materialHardship:true}});
  assert.equal(finishEducation(unaffected,env),true);
  assert.equal(unaffected.education,'university');
  const minor=fixture({age:15,school:{stage:'junior',endsAt:15,label:T('初中'),fundingGap:100}});
  assert.equal(finishEducation(minor,env),true,'compulsory education does not use this higher-education funding rule');
});

test('a deferred initial offer can be reconsidered with savings and awarded aid is shown in the funding plan',()=>{
  const env=environment(),life=fixture({classRank:1});
  graduate(life,'high',env);decide(life,'program-0',env);decide(life,'aid',env);
  assert.ok(life.pending.data.program.scholarship>0);
  for(const lang of ['zhCN','zhTW','en'])assert.ok(life.pending.description[lang].includes(Math.round(life.pending.data.program.scholarship).toLocaleString('en-US')));
  decide(life,'work',env);
  assert.equal(life.educationState.suspendedStudy.remainingYears,4);
  life.age=19;life.year=2027;life.money=50000;
  educationMilestones(life,env);decide(life,'family',env);
  assert.equal(life.school.endsAt,23);
  assert.equal(life.school.creditedAcademicYears,0,'a year spent working is not an academic credit');
});

test('actual annual loan-cap shortfall prevents a degree even after the monetary gap is cleared',()=>{
  const env=environment(),life=fixture({age:21,year:2029,profile:{typicalIncome:1000},school:{stage:'university',startedAt:18,endsAt:22,annualTuition:30000,livingCost:8000,label:T('民办本科'),ownership:'private',familyContribution:0,scholarship:0,loanApproved:true,financialNeed:true,studyRegion:'mainland',examScore:70}});
  economyYear(life,env);
  assert.equal(life.school.fundingGap,10000);
  assert.equal(life.school.unfundedAcademicYears,1);
  assert.equal(life.debt,20000,'only the explicitly approved student loan is debt');
  assert.equal(life.money,0);
  life.school.fundingGap=0;
  life.age=22;life.year=2030;
  assert.equal(finishEducation(life,env),false);
  assert.equal(life.school.endsAt,23);
  assert.equal(life.education,'high');
  assert.equal(life.pending.action,'edu-funding');
  assert.ok(life.pending.options.some(option=>option.id==='cheaper'));
  decide(life,'cheaper',env);
  assert.equal(life.pending.data.program.stage,'associate');
  assert.equal(life.pending.data.program.duration,1,'credit transfer is a bounded, explicit game recovery route');
});
