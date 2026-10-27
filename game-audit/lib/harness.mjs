import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
export const source=resolve(fileURLToPath(new URL('../',import.meta.url)),process.env.GAME_SRC||'../app');
export const load=path=>import(pathToFileURL(resolve(source,path)).href);
export const E=await load('engine.js');
export const {locations}=await load('data/locations.js');
export const law=await load('data/china-law.js');
export const society=await load('data/china-society.js');
export const history=await load('data/history.js');
export const text=v=>typeof v==='string'?v:v?.zhCN||'';
export const rank={preschool:0,primary:1,junior:2,vocational:3,high:3,associate:3.5,university:4,masters:5,doctorate:6};
export function save(name,value){const dir=resolve(process.env.AUDIT_OUT||'.');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,name),JSON.stringify(value,null,2)+'\n');}
export function stats(values){const a=values.filter(Number.isFinite).sort((a,b)=>a-b);const q=p=>a[Math.min(a.length-1,Math.floor(a.length*p))]??null;return {n:a.length,mean:a.length?a.reduce((s,v)=>s+v,0)/a.length:null,min:a[0]??null,p10:q(.1),p50:q(.5),p90:q(.9),p95:q(.95),max:a.at(-1)??null};}
export function snapshot(l){return {age:l.age,year:l.year,region:l.location.region,jobId:l.job?.id,retired:!!l.retired,pension:l.pension||0,married:!!l.family.partner?.married,partnerId:text(l.family.partner?.name),children:l.family.children.length,schoolEntries:l.schoolHistory?.length||0,phase:l.phase,logSequence:l.logSequence};}
export class Meter{
 constructor(){this.hiredLives=new WeakSet();this.checks={};this.metrics={};this.calls={};this.samples={};}
 check(code,pass,payload,eligible=true){const c=this.checks[code]??={passed:0,failed:0,denominator:0,unsupported:0};if(!eligible){c.unsupported++;return;}c.denominator++;if(pass)c.passed++;else{c.failed++;const s=this.samples[code]??=[];if(s.length<4)s.push(payload);}}
 push(key,value){if(Number.isFinite(value))(this.metrics[key]??=[]).push(value);}
 report(){return {checks:Object.fromEntries(Object.entries(this.checks).map(([k,v])=>[k,{...v,status:v.denominator?(v.failed?'FAIL':'PASS'):'NOT_CHECKED',failureRate:v.denominator?v.failed/v.denominator:null,samples:this.samples[k]||[]}])) ,aggregates:Object.fromEntries(Object.entries(this.metrics).map(([k,v])=>[k,stats(v)])),engineCalls:this.calls};}
}
/** All mutations in a driven lifetime must pass this boundary, including choose/focus/shop. */
export function observe(l,m,method,...args){
 if((method==='choose'||method==='autoChoose')&&l.pending){
  const p=l.pending;
  m.check('DECISION_NONEMPTY',p.options.length>0,{seed:l.seed,action:p.action});
  m.check('DECISION_UNIQUE_OPTIONS',new Set(p.options.map(x=>x.id)).size===p.options.length,{seed:l.seed,action:p.action});
  for(const option of p.options)m.check('OPTION_DESCRIPTION',!!text(option.description),{seed:l.seed,action:p.action,option:option.id});
 }
 const before=snapshot(l);const result=E[method](l,...args);m.calls[method]=(m.calls[method]||0)+1;diffTransitions(l,before,m);return result;}
export function diffTransitions(l,b,m){
 const s=snapshot(l),region=l.location.region,seed=l.seed;
 if(s.jobId&&s.jobId!==b.jobId){
  const job=l.job,minimum=law.legalEmploymentAge(region,l.year);
  m.check('EMPLOYMENT_AGE',minimum!==null&&l.age>=minimum,{seed,age:l.age,region,minimum},minimum!==null);
  m.check('JOB_MIN_YEAR',l.year>=(job.minYear??-Infinity),{seed,job:job.id,year:l.year});
  m.check('JOB_MIN_AGE',l.age>=(job.minAge??0),{seed,job:job.id,age:l.age});
  m.check('JOB_EDUCATION',rank[l.education]>=(job.educationRank??0),{seed,job:job.id,education:l.education});
  if(!m.hiredLives.has(l)){m.hiredLives.add(l);m.push('firstJobAge',l.age);}m.push('jobSalaryRatio',job.salary/l.profile.typicalIncome);
 }
 if(s.retired&&!b.retired){
  m.push('retirementAge',l.age);
  const category=l.lastJob?.retirementCategory||'worker';
  const rule=law.retirementRule({birthYear:l.birthYear,birthMonth:l.birthMonth,sex:l.sex,category,region,year:l.year});
  const month=(l.year-l.birthYear)*12+(l.uiProgress??1)*12-(l.birthMonth-1);
  m.check('RETIREMENT_AGE',!rule||month+.01>=rule.ageMonths,{seed,age:l.age,month,rule},!!rule&&rule.statutory!==false);
 }
 if(s.pension>0&&b.pension<=0){
  const min=law.pensionMinimumYears(l.year,region);
  m.check('PENSION_MIN_CONTRIBUTIONS',min!==null&&l.contributionYears>=min,{seed,region,contributions:l.contributionYears,minimum:min},min!==null);
  // A local pension is legitimate only when its own explicit jurisdiction is recorded.
  m.check('PENSION_JURISDICTION',region==='mainland'||l.pensionJurisdiction===region,{seed,region,jurisdiction:l.pensionJurisdiction});
  const salary=l.lastJob?.salary||0;if(salary)m.push('pensionReplacement',s.pension/salary);
 }
 if(s.married&&!b.married){
  const minimum=law.legalMarriageAge(l.sex,region,l.year),partner=law.legalMarriageAge(l.sex==='male'?'female':'male',region,l.year);
  m.check('MARRIAGE_HAS_LAW',minimum!==null&&partner!==null,{seed,region,year:l.year});
  m.check('MARRIAGE_AGE',l.age>=minimum&&l.family.partner.age>=partner,{seed,age:l.age,partnerAge:l.family.partner.age,minimum,partner},minimum!==null&&partner!==null);
  m.push(l.flags?.marriageCount>1?'remarriageAge':'firstMarriageAge',l.age);
 }
 if(s.children>b.children)for(const child of l.family.children.slice(b.children)){
  const momAge=l.sex==='female'?l.age:l.family.partner?.age;
  m.push('maternalAgeAtBirth',momAge);
  m.check('BIRTH_UNDER_50',momAge<50,{seed,momAge});
  const meeting=l.family.partner?.sinceYear;
  m.check('BIRTH_AFTER_RELATIONSHIP',meeting!==undefined&&meeting<=l.year,{seed,meeting,year:l.year},meeting!==undefined);
 }
 const newSchools=(l.schoolHistory||[]).slice(b.schoolEntries);
 for(const school of newSchools){
  const year=school.year,age=school.startedAt;
  m.push('higherAdmissionYear',year);
  m.check('GAOKAO_SUSPENSION',!(region==='mainland'&&year>=1966&&year<=1969),{seed,year,age,stage:school.stage});
  m.check('FULLTIME_ENTRY_AGE',age<=35||school.mode==='adult',{seed,year,age,mode:school.mode});
 }
 m.check('TIMELINE',l.year===l.birthYear+l.age,{seed,year:l.year,age:l.age});
 m.check('FINITE_STATE',[l.money,l.debt,l.income,E.netWorth(l),...Object.values(l.stats)].every(Number.isFinite),{seed,age:l.age});
 m.check('STAT_BOUNDS',Object.values(l.stats).every(x=>x>=0&&x<=100),{seed,age:l.age});
 m.check('NONNEGATIVE_CASH',l.money>=0,{seed,age:l.age,money:l.money});
}
export function drive(l,m,{focus='work',shop=false,onStep}={}){
 observe(l,m,'startLife');let guard=0;
 while(l.phase==='life'&&guard++<2000){
  if(l.pending)observe(l,m,'autoChoose');
  else{
   if(focus&&l.job&&E.getFocusOptions(l).some(f=>f.id===focus))observe(l,m,'setFocus',focus);
   if(shop&&!l.school&&l.age>=18){for(const id of ['house','house-cash','car'])if(E.getShopItems(l).find(x=>x.id===id)?.available){observe(l,m,'purchase',id);break;}}
   observe(l,m,'advanceYear');
  }
  onStep?.(l);
 }
 m.check('TERMINATED',l.phase==='dead',{seed:l.seed,age:l.age,guard});
 return l;
}
