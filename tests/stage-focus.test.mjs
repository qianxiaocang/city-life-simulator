import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,startLife,offerFocusStage,choose,advanceYear,autoChoose,setAutopilot} from '../app/engine.js';
const location={id:'110100',region:'mainland',name:{zhCN:'北京市',zhTW:'北京市',en:'Beijing'},prosperity:.9,weight:1};
function make(age=6,extra={}){
  const life=startLife(createLife({locations:[location],location,seed:'stage-focus-'+age,birthYear:2000,world:'past'}));
  Object.assign(life,{age,year:2000+age},extra);
  return life;
}
test('school stage choices begin at six and only offer age-appropriate time arrangements',()=>{
  assert.equal(offerFocusStage(make(5)),false);
  const life=make(6,{school:{stage:'primary',endsAt:12}});
  assert.equal(offerFocusStage(life),true);
  assert.equal(life.pending.action,'focus-stage');assert.equal(life.pending.data.stage,'child-school');
  assert.ok(life.pending.options.some(o=>o.id==='study'));
  assert.ok(!life.pending.options.some(o=>['work','health','volunteer'].includes(o.id)));
  for(const o of life.pending.options)for(const lang of ['zhCN','zhTW','en'])assert.ok(o.label[lang]&&o.description[lang]);
});
test('selecting a stage arrangement changes future focus without an immediate stat bonus',()=>{
  const life=make(13,{school:{stage:'junior',endsAt:15},focus:'friends',focusTime:{friends:1}});
  offerFocusStage(life);const stats={...life.stats};
  assert.equal(choose(life,'study'),true);
  assert.equal(life.focus,'study');assert.deepEqual(life.stats,stats);assert.deepEqual(life.focusTime,{friends:1});
  assert.equal(life.log.filter(row=>row.type==='choice'&&row.age===13).length,1);
});
test('each stage is offered once through save restore and returning to the same life state',()=>{
  const life=make(13,{school:{stage:'junior',endsAt:15}});offerFocusStage(life);choose(life,'balance');
  const restored=JSON.parse(JSON.stringify(life));
  assert.equal(offerFocusStage(restored),false);
  restored.age=14;restored.year++;assert.equal(offerFocusStage(restored),false);
  restored.age=18;restored.year=2018;restored.school={stage:'university',endsAt:22};
  assert.equal(offerFocusStage(restored),true);assert.equal(restored.pending.data.stage,'higher-study');
});
test('working, transition and retired stages offer only choices for their current situation',()=>{
  const worker=make(25,{job:{id:'office',salary:60000,years:1}});offerFocusStage(worker);
  assert.equal(worker.pending.data.stage,'early-work');assert.ok(worker.pending.options.some(o=>o.id==='work'));
  assert.ok(!worker.pending.options.some(o=>o.id==='study'));
  const retired=make(65,{retired:true,job:null});offerFocusStage(retired);
  assert.equal(retired.pending.data.stage,'retirement');assert.ok(retired.pending.options.some(o=>o.id==='health'));
  assert.ok(retired.pending.options.some(o=>o.id==='volunteer'));assert.ok(!retired.pending.options.some(o=>o.id==='work'));
  const transition=make(36);offerFocusStage(transition);
  assert.equal(transition.pending.data.stage,'adult-transition');assert.ok(!transition.pending.options.some(o=>o.id==='work'));
});
test('a full same-age budget or required pending plan postpones a stage offer without losing it',()=>{
  const life=make(18,{school:{stage:'university',endsAt:22}});
  life.decisionState.presentedByAge[18]=2;
  assert.equal(offerFocusStage(life),false);assert.equal(life.flags.focusStagesOffered,undefined);
  life.age=19;life.year++;
  life.pending={action:'edu-funding',options:[],data:{}};
  assert.equal(offerFocusStage(life),false);
  life.pending=null;assert.equal(offerFocusStage(life),true);assert.equal(life.pending.data.stage,'higher-study');
  assert.equal(life.decisionState.presentedByAge[19],1);
});
test('automated full lives retain the two-prompt limit and encounter stage choices',()=>{
  let stageChoices=0;
  for(let seed=0;seed<8;seed++){
    const life=startLife(createLife({locations:[location],location,seed:'stage-automated-'+seed,birthYear:2000,world:'past'}));
    setAutopilot(life,true);
    for(let steps=0;steps<1000&&life.phase!=='dead';steps++){
      if(life.pending){if(life.pending.action==='focus-stage')stageChoices++;autoChoose(life);}else advanceYear(life);
      assert.ok(Object.values(life.decisionState.presentedByAge).every(n=>n<=2));
    }
    assert.equal(life.phase,'dead');
  }
  assert.ok(stageChoices>8);
});
