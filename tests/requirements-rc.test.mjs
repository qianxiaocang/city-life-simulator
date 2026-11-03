import test from 'node:test';
import assert from 'node:assert/strict';
import {LIFE_EVENTS,eligibleLifeEvents} from '../app/life-events.js';
import {getFocusOptions,childPolicy,marriageChoicePolicy} from '../app/engine.js';
import {CULTURAL_EVENTS,culturalEventEligible} from '../app/data/china-society.js';
import {money} from '../app/i18n.js';

const place=region=>({region});
function life(age,year,urban=true,region='mainland'){
  return {phase:'life',age,year,urban,location:place(region),school:null,job:null,retired:false,stats:{health:80},
    family:{mother:{alive:true},father:null,partner:null,children:[],siblings:[]},log:[],routineState:{seen:[],topics:{}}};
}
const pool=l=>eligibleLifeEvents(l).map(e=>e.id);
const event=id=>CULTURAL_EVENTS.find(e=>e.id===id);

test('routine records respect infant development, rural schooling, devices and commuting eras',()=>{
  assert.ok(!pool(life(0,1955)).includes('infancy-4'));
  assert.ok(!pool(life(0,1955)).includes('infancy-5'));
  assert.ok(pool(life(1,1956)).includes('infancy-4'));
  const ruralStudent=life(9,1955,false);ruralStudent.school={stage:'primary'};
  for(const id of ['school-3','school-11','school-13','school-15'])assert.ok(!pool(ruralStudent).includes(id),id);
  assert.ok(pool(ruralStudent).some(id=>id.startsWith('school-rural-')));
  const urbanStudent=life(9,1990);urbanStudent.school={stage:'primary'};
  for(const id of ['school-3','school-11','school-13','school-15'])assert.ok(pool(urbanStudent).includes(id),id);
  assert.ok(pool(life(12,1958,false)).includes('youth-rural-broadcast-1'));
  assert.ok(!pool(life(12,1958,false)).includes('youth-1'));
  assert.ok(pool(life(12,1970)).includes('youth-1'));
  for(const [age,year,urban,expected] of [[70,1985,true,false],[40,1985,false,false],[40,1975,true,false],[40,1985,true,true]]){
    const worker=life(age,year,urban);worker.job={id:'worker'};
    assert.equal(pool(worker).includes('work-9'),expected,`${age}/${year}/${urban}`);
  }
});

test('difficult daily records, regional festivals and digital childhood have real eligibility gates',()=>{
  const unemployed=life(35,1995);assert.ok(pool(unemployed).filter(id=>id.startsWith('unemployed-')).length>=5);
  assert.ok(pool(unemployed).includes('layoff-1'));
  assert.ok(!pool(life(35,2006)).includes('layoff-1'));
  for(const region of ['hongkong','macau']){
    const ids=pool(life(30,2026,true,region));
    assert.ok(!ids.includes('festival-1')&&!ids.includes('festival-4'));
    assert.ok(ids.filter(id=>id.startsWith('festival-hkmo-')).length>=5);
  }
  assert.ok(pool(life(30,2026,true,'taiwan')).filter(id=>id.startsWith('festival-taiwan-')).length>=5);
  const digital=life(10,2015);digital.school={stage:'primary'};
  assert.ok(pool(digital).some(id=>id.startsWith('digital-childhood-')));
  digital.year=2005;assert.ok(!pool(digital).some(id=>id.startsWith('digital-childhood-')));
  assert.ok(LIFE_EVENTS.every(e=>e.max<=95));
  assert.ok(LIFE_EVENTS.filter(e=>e.id.startsWith('elder-')).length>=16);
});

test('focus choices use age, place and employment without adult subtitles for children',()=>{
  const rural=life(6,1956,false);rural.school={stage:'primary'};
  assert.ok(getFocusOptions(rural).some(o=>o.id==='familyHelp'));
  const urban=life(6,1998);urban.school={stage:'primary'};
  assert.deepEqual(getFocusOptions(urban).map(o=>o.id),['study','balance','friends','family','sport','hobby']);
  for(const age of [6,12,15]){
    const child=life(age,2026);const descriptions=getFocusOptions(child).map(o=>o.description.zhCN).join(' ');
    assert.doesNotMatch(descriptions,/职业|收入|房贷|婚姻|买房/);
  }
  const jobless=life(40,2026);assert.ok(!getFocusOptions(jobless).some(o=>o.id==='rest'));
  assert.ok(getFocusOptions({...jobless,retired:true}).some(o=>o.id==='rest'));
  const subtitles=getFocusOptions({...jobless,job:{id:'worker'}}).map(o=>o.description.zhCN).join(' ');
  assert.doesNotMatch(subtitles,/人际↑|关系↑|晋升↑/);
});

test('cultural choices and child weights follow the current calendar period',()=>{
  const old=life(30,1972);old.job={id:'worker'};
  assert.ok(culturalEventEligible(event('spring-reunion-early'),old));
  assert.ok(!culturalEventEligible(event('spring-reunion'),old));
  assert.ok(!culturalEventEligible(event('family-career-move'),old));
  const modern=life(30,1990);modern.job={id:'worker'};
  assert.ok(culturalEventEligible(event('spring-reunion'),modern));
  assert.ok(culturalEventEligible(event('family-career-move'),modern));
  const parent=life(30,1975);parent.family.children=[{sex:'male'}];
  const before=childPolicy(parent).tryWeight;
  parent.year=1985;const restricted=childPolicy(parent).tryWeight;
  parent.year=2018;const reopened=childPolicy(parent).tryWeight;
  assert.ok(restricted<before&&reopened>restricted);
  assert.match(marriageChoicePolicy(1975).title.zhCN,/登记结婚/);
  assert.match(marriageChoicePolicy(2010).title.zhCN,/一起生活/);
  assert.ok(marriageChoicePolicy(1975).divorceWeight<marriageChoicePolicy(2010).divorceWeight);
  for (const region of ['mainland','hongkong','macau','taiwan']) {
    for (const year of [1980,2026]) assert.equal(money(500,'zh-CN',life(30,year,true,region)),money(500,'zh-CN'));
  }

});
