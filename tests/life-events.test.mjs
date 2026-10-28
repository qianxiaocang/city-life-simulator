import test from 'node:test';
import assert from 'node:assert/strict';
import {LIFE_EVENTS,eligibleLifeEvents,routineYear} from '../app/life-events.js';
const make=(age=30,year=2026)=>({phase:'life',age,year,urban:true,school:null,job:null,retired:false,stats:{health:80},family:{mother:null,father:null,partner:null,children:[],siblings:[]},hobbies:[],log:[],money:3000,rngState:1723});
function rng(life){let x=life.rngState|0;x^=x<<13;x^=x>>>17;x^=x<<5;life.rngState=x>>>0;return life.rngState/4294967296;}
function environment(life){return{random:rng,log(_life,text,type,effects){const row={text,type,effects,age:life.age,year:life.year};life.log.unshift(row);return row;}};}
test('catalogue contains varied, uniquely identified moments with all three languages',()=>{
  assert.ok(LIFE_EVENTS.length>=100);
  assert.equal(new Set(LIFE_EVENTS.map(e=>e.id)).size,LIFE_EVENTS.length);
  for(const lang of ['zhCN','zhTW','en']){
    assert.equal(new Set(LIFE_EVENTS.map(e=>e.text[lang])).size,LIFE_EVENTS.length);
    assert.ok(LIFE_EVENTS.every(e=>typeof e.text[lang]==='string'&&e.text[lang].length>10));
  }
});
test('routine moments obey school, work, living relatives, retirement and era conditions',()=>{
  const life=make(20,1960);
  let pool=eligibleLifeEvents(life);
  assert.ok(pool.every(e=>!['school','work','partner','parents','siblings','parenting','adult-child','retirement','technology'].some(prefix=>e.id.startsWith(prefix+'-'))));
  life.school={stage:'university'};life.job={id:'teacher'};life.family.partner={alive:true};life.family.mother={alive:true};life.family.children=[{alive:true,age:3}];
  pool=eligibleLifeEvents(life);
  for(const prefix of ['school','work','partner','parents','parenting'])assert.ok(pool.some(e=>e.id.startsWith(prefix+'-')),prefix);
  life.age=65;life.year=2026;life.retired=true;
  pool=eligibleLifeEvents(life);
  assert.ok(pool.some(e=>e.id.startsWith('retirement-')));
  assert.ok(pool.some(e=>e.id.startsWith('technology-')));
  assert.ok(!pool.some(e=>e.id.startsWith('work-')));
  life.family.partner.alive=false;life.family.mother.alive=false;life.family.children[0].alive=false;
  assert.ok(eligibleLifeEvents(life).every(e=>!['partner','parents','parenting'].some(prefix=>e.id.startsWith(prefix+'-'))));
});
test('a long life never repeats a routine story and keeps three years between each topic',()=>{
  const life=make(0,1950),byTopic=new Map(),ids=new Set(),texts=new Set();
  for(let age=0;age<=120;age++){
    life.age=age;life.year=1950+age;life.school=age>=6&&age<=20?{}:null;life.job=age>=21&&age<60?{}:null;life.retired=age>=60;
    for(const e of routineYear(life,environment(life))){
      assert.ok(!ids.has(e.id),e.id);assert.ok(!texts.has(e.text.zhCN),e.text.zhCN);
      assert.ok(age-(byTopic.get(e.topic)??-Infinity)>=3,e.topic);
      ids.add(e.id);texts.add(e.text.zhCN);byTopic.set(e.topic,age);
    }
  }
  assert.ok(ids.size>100,ids.size+' distinct moments');
  assert.equal(life.money,3000,'routine stories do not invent unbooked spending');
  assert.ok(life.log.every(row=>row.eventId));
});
test('existing save text is respected and serialized state keeps deterministic future',()=>{
  const life=make();
  const known=eligibleLifeEvents(life)[0];life.log.push({text:known.text});
  assert.ok(!eligibleLifeEvents(life).some(e=>e.id===known.id));
  routineYear(life,environment(life));
  const restored=JSON.parse(JSON.stringify(life));
  for(let i=0;i<15;i++){
    life.age++;life.year++;restored.age++;restored.year++;
    routineYear(life,environment(life));routineYear(restored,environment(restored));
  }
  assert.deepEqual(life,restored);
});
test('hobby records only happen at distinct skill milestones',()=>{
  const life=make();life.hobbies=[{id:'music',name:{zhCN:'音乐',zhTW:'音樂',en:'Music'},level:0}];
  const env=environment(life);env.random=()=>0;
  for(let i=0;i<15;i++){routineYear(life,env);life.age++;life.year++;}
  const rows=life.log.filter(row=>row.eventId?.startsWith('hobby-'));
  assert.equal(rows.length,4);assert.equal(new Set(rows.map(row=>row.text.zhCN)).size,4);
  assert.equal(life.hobbies[0].level,10);
});
test('dead lives receive no extra routine records',()=>{
  const life=make();life.phase='dead';assert.deepEqual(routineYear(life,environment(life)),[]);assert.equal(life.log.length,0);
});
