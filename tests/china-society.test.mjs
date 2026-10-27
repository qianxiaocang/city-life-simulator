import test from 'node:test';
import assert from 'node:assert/strict';
import {CULTURAL_EVENTS,CHINA_JOBS,CHINA_CONSUMPTION,CHINA_SOCIETY_SOURCES,investmentAvailable,culturalEventEligible,CONSUMPTION_BUDGET_2025} from '../app/data/china-society.js';
const translated=value=>['zhCN','zhTW','en'].every(key=>typeof value?.[key]==='string'&&value[key].length>0);
test('society content has translated choices, meaningful alternatives and provenance',()=>{
  const sources=new Set(CHINA_SOCIETY_SOURCES.map(s=>s.id));
  assert.ok(CULTURAL_EVENTS.length>=12);
  for(const event of CULTURAL_EVENTS){
    assert.ok(translated(event.title)&&translated(event.description));
    assert.ok(event.options.length>=3);
    assert.ok(event.sourceUrls.length>0);
    for(const key of event.sourceKeys)assert.ok(sources.has(key));
    for(const option of event.options)assert.ok(translated(option.label)&&translated(option.description));
    assert.ok(!event.conditions.sex); // expectations do not force gendered roles
  }
  const child={age:15,year:2026,phase:'life',school:{stage:'junior'},family:{mother:{alive:true},father:{alive:true},children:[]}};
  assert.equal(culturalEventEligible(CULTURAL_EVENTS.find(e=>e.id==='study-expectations'),child),true);
  assert.equal(culturalEventEligible(CULTURAL_EVENTS.find(e=>e.id==='marriage-pressure'),child),false);
});
test('career catalogue has diverse sectors and differentiated entry paths',()=>{
  assert.ok(CHINA_JOBS.length>=50);
  assert.equal(new Set(CHINA_JOBS.map(x=>x.id)).size,CHINA_JOBS.length);
  for(const job of CHINA_JOBS){
    assert.ok(translated(job.name));assert.ok(job.minAge>=16);
    assert.ok(['worker','professional','self-employed'].includes(job.retirementCategory));
    if(job.entry==='civil-exam')assert.ok(job.sourceKeys.includes('civil-service-2026'));
  }
  for(const sector of ['private','state-owned','civil-service','public-institution','self-employed','agriculture'])assert.ok(CHINA_JOBS.some(x=>x.sector===sector));
  const local=CHINA_JOBS.find(x=>x.id==='civil-community');
  assert.equal(local.educationRank,3.5);assert.equal(local.minAge,18);
});
test('investment dates describe mainland market access and do not silently become other regions law',()=>{
  assert.equal(investmentAvailable('stock',1989),false);assert.equal(investmentAvailable('stock',1990),true);
  assert.equal(investmentAvailable('bond',1980),false);assert.equal(investmentAvailable('bond',1981),true);
  assert.equal(investmentAvailable('fund',1997),false);assert.equal(investmentAvailable('fund',1998),true);
  assert.equal(investmentAvailable('mix',2000),false);assert.equal(investmentAvailable('mix',2001),true);
  assert.equal(investmentAvailable('stock',1950,'hongkong'),null);
});
test('consumption separates assets, household goods, care and education without false spending majority',()=>{
  for(const id of ['house','house-cash','car','furniture','appliances','renovation','child-school','adultstudy','parent-support','wedding'])assert.ok(CHINA_CONSUMPTION.some(x=>x.id===id));
  for(const item of CHINA_CONSUMPTION)assert.ok(translated(item.name)&&translated(item.description));
  assert.equal(CHINA_CONSUMPTION.find(x=>x.id==='house').requiresEmployment,true);
  assert.equal(CHINA_CONSUMPTION.find(x=>x.id==='house').minYear,1998);
  assert.ok(Math.abs(Object.values(CONSUMPTION_BUDGET_2025.shares).reduce((a,b)=>a+b,0)-1)<.002);
  assert.ok(CONSUMPTION_BUDGET_2025.shares.housingServices<.5);
});
