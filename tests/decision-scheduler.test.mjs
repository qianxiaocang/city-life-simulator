import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureDecisionState,decisionSlots,scheduleDecision,activateQueuedDecision,hasEducationPlan} from '../app/decision-scheduler.js';
const make=()=>({age:18,phase:'life',log:[],pending:null,pendingQueue:[]});
const prompt=(action,data={})=>({id:action,action,data,options:[{id:'continue'}]});
function finish(life){life.log.push({type:'choice',age:life.age});life.pending=null;return activateQueuedDecision(life);}
test('at most two visible choices, including required chained funding steps',()=>{
  const life=make();scheduleDecision(life,prompt('edu-college'));finish(life);
  scheduleDecision(life,prompt('edu-funding',{step:1}));finish(life);
  scheduleDecision(life,prompt('edu-funding',{step:2}));
  assert.equal(life.pending,null);assert.equal(life.pendingQueue.length,1);
  assert.equal(life.pendingQueue[0].notBeforeAge,19);assert.equal(hasEducationPlan(life),true);
  assert.equal(scheduleDecision(life,prompt('hobby')),false);assert.equal(decisionSlots(life),0);
  life.age++;let calls=0;
  activateQueuedDecision(life,(state,value)=>{calls++;assert.equal(state.age,19);return {...value,data:{recalculated:true}};});
  assert.equal(calls,1);assert.equal(life.pending.data.recalculated,true);assert.equal(life.pending.presentedAtAge,19);
});
test('queued second prompt counts once and is preserved through serialization',()=>{
  const life=make();scheduleDecision(life,prompt('reflect'));scheduleDecision(life,prompt('edu-secondary'));
  assert.equal(life.pendingQueue.length,1);assert.equal(decisionSlots(life),0);
  const restored=JSON.parse(JSON.stringify(life));ensureDecisionState(restored);finish(restored);
  assert.equal(restored.pending.action,'edu-secondary');assert.equal(restored.decisionState.presentedByAge[18],2);
  ensureDecisionState(restored);assert.equal(restored.decisionState.presentedByAge[18],2);
});
test('legacy history and pending prompts cannot reset the same-age budget',()=>{
  const life=make();life.log=[{type:'choice',age:18},{type:'choice',age:18}];life.pending=prompt('edu-funding');
  life.pendingQueue=[prompt('memory'),prompt('career-offer')];ensureDecisionState(life);
  assert.equal(life.pending,null);assert.equal(life.pendingQueue.length,2);
  assert.ok(life.pendingQueue.every(item=>item.notBeforeAge===19));
  assert.equal(decisionSlots(life),0);
});
test('critical plans replace an unshown optional reservation without choosing it',()=>{
  const life=make();scheduleDecision(life,prompt('reflect'));scheduleDecision(life,prompt('memory'));
  scheduleDecision(life,prompt('edu-college'));finish(life);
  assert.equal(life.pending.action,'edu-college');assert.equal(life.pendingQueue.length,0);
});
test('legacy overload defers all required plans and stale refresh may remove one',()=>{
  const life=make();life.pendingQueue=['edu-college','career-offer','retirement-law'].map(x=>prompt(x));
  ensureDecisionState(life);activateQueuedDecision(life);finish(life);finish(life);
  assert.equal(life.pending,null);assert.equal(life.pendingQueue[0].notBeforeAge,19);
  life.age=19;activateQueuedDecision(life,()=>null);assert.equal(life.pending,null);assert.equal(life.pendingQueue.length,0);
});
test('repeated optional topics cool down, and duplicate required plans do not pile up',()=>{
  const life=make();scheduleDecision(life,prompt('romance'));finish(life);
  life.age=19;assert.equal(scheduleDecision(life,prompt('romance')),false);
  life.age=21;assert.ok(scheduleDecision(life,prompt('romance')));finish(life);
  scheduleDecision(life,prompt('edu-funding',{course:1}));
  assert.equal(scheduleDecision(life,prompt('edu-funding',{course:1})),false);
});
