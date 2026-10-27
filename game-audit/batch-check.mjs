import {E,locations,load,Meter,drive,save,stats} from './lib/harness.mjs';
const {developmentAt}=await load('data/development.js');const {historicalProfile}=await load('history-runtime.js');
const batch=process.env.BATCH||'B1',m=new Meter();
const ml=locations.find(x=>x.id==='cn-410800');
const p=(year,region='mainland')=>developmentAt(year,region==='mainland'?ml:locations.find(x=>x.region===region),'past');
if(['B1','B2','B3','B4','B5','final'].includes(batch)){
 m.check('D01_EARLY_LIFESPAN',p(1950).lifeExpectancy<48,{value:p(1950).lifeExpectancy});
 for(const y of [1959,1960,1961])m.check('D01_HISTORICAL_TROUGH',p(y).lifeExpectancy<p(1957).lifeExpectancy,{year:y,value:p(y).lifeExpectancy});
 m.check('PROTECTED_MODERN_LIFESPAN',p(1980).lifeExpectancy>=66&&p(1980).lifeExpectancy<=69&&p(2025).lifeExpectancy>=78.5&&p(2025).lifeExpectancy<=79.8,{v1980:p(1980).lifeExpectancy,v2025:p(2025).lifeExpectancy});
 for(const region of ['hongkong','taiwan','macau']){
  m.check('D04_EARLY_REGIONAL_LIFESPAN',p(1950,region).lifeExpectancy<65,{region,value:p(1950,region).lifeExpectancy});
  m.check('D04_REGIONAL_DEVELOPMENT',p(2025,region).lifeExpectancy>p(1985,region).lifeExpectancy,{region,early:p(1985,region).lifeExpectancy,current:p(2025,region).lifeExpectancy});
 }
 m.check('D02_EARLY_UNDER5',historicalProfile(ml,'male','past',1950).childMortality>=.2,{value:historicalProfile(ml,'male','past',1950).childMortality});
 m.check('D02_CURRENT_UNDER5',historicalProfile(ml,'male','past',2025).childMortality<=.01,{value:historicalProfile(ml,'male','past',2025).childMortality});
 const {educationMilestones}=await load('education.js');
 for(const year of [1966,1967,1968,1969])for(let i=0;i<60;i++){
  const l=E.createLife({locations,location:ml,birthYear:1950,seed:'suspended-'+year+'-'+i});l.age=18;l.year=year;l.phase='life';l.education='high';l.educationState.justGraduated='high';
  // A real module call with maximal ability cannot bypass a closed admission route.
  l.stats.knowledge=100;
  const env={option:(id,label,description,autoWeight)=>({id,label,description,autoWeight}),decision:(life,action,title,description,options,data)=>life.pending={action,options,data},log:()=>{},offerWork:()=>{},chance:()=>true,normal:()=>0};
  educationMilestones(l,env);m.check('D03_SUSPENDED_ADMISSION',l.pending?.action==='edu-suspended'&&!l.school,{year,action:l.pending?.action});
 }
}
if(['B2','B3','B4','B5','final'].includes(batch)){
 for(const year of [1950,2000,2020])for(const sex of ['male','female'])for(let i=0;i<60;i++){
  const l=E.createLife({locations,location:ml,birthYear:year,world:'past',seed:`family-${sex}-${i}`});l.sex=sex;l.profile=historicalProfile(ml,sex,'past',year);
  m.push('siblings@'+year,l.family.siblings.length);m.push('motherInitialAge@'+year,l.family.mother.age);
  drive(l,m);if(!l.family.mother.alive)m.push('motherDeath@'+year,l.family.mother.age);if(!l.family.father.alive)m.push('fatherDeath@'+year,l.family.father.age);
 }
}
const out={batch,...m.report()};save('batch-assertions.json',out);for(const[k,c]of Object.entries(out.checks))console.log(`${c.status} ${k} ${c.failed}/${c.denominator}`);
for(const[k,v]of Object.entries(out.aggregates))if(/siblings|mother|father/.test(k))console.log(k,JSON.stringify(v));
