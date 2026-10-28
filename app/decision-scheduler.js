// A decision is counted when it becomes visible, not when an option is chosen.
// Important plans may wait for next year; the scheduler never chooses for a player.
export const MAX_DECISIONS_PER_AGE = 2;
export const isEssentialDecision = value => /^(edu-|career-)/.test(value?.action || '') ||
  ['retirement-law','job','secondary','university','postgraduate','retire'].includes(value?.action);
const REPEATING = new Set(['schoolfriend','screen','familyhelp','worklife','move','startup','checkup','care','memory','community','romance']);
const ageOf = life => Math.max(0, Math.floor(Number(life.age) || 0));
const countAt = (state, age) => Math.max(0, Number(state.presentedByAge[age]) || 0);
const occurrence = value => value.action === 'culture' ? `culture:${value.data?.eventId || ''}` : value.action;
const cooldown = value => value.action === 'culture' ? 6 : value.action === 'marriage' ? 2 : REPEATING.has(value.action) ? 3 : 0;
const samePlan = (a,b) => a.action === b.action && JSON.stringify(a.data || {}) === JSON.stringify(b.data || {});
function queued(life, value) {
  value.scheduledAtAge ??= ageOf(life);
  value.notBeforeAge ??= ageOf(life);
  return value;
}
function defer(life, value) {
  queued(life,value);
  value.notBeforeAge = Math.max(value.notBeforeAge,ageOf(life)+1);
  delete value.presentedAtAge;
  if (!life.pendingQueue.some(item => samePlan(item,value))) life.pendingQueue.push(value);
}
function activate(life,value) {
  const age=ageOf(life), state=life.decisionState;
  value.presentedAtAge=age;
  state.presentedByAge[age]=countAt(state,age)+1;
  life.pending=value;
  return value;
}
export function ensureDecisionState(life) {
  life.pendingQueue ||= [];
  const migration = !life.decisionState || life.decisionState.version !== 1;
  if (migration) {
    const presentedByAge={};
    for (const row of life.log || []) if (row.type === 'choice' && Number.isFinite(row.age))
      presentedByAge[row.age]=(presentedByAge[row.age] || 0)+1;
    life.decisionState={version:1,presentedByAge,lastOffered:{}};
  }
  const state=life.decisionState, age=ageOf(life);
  state.presentedByAge ||= {}; state.lastOffered ||= {};
  if (life.pending) {
    const value=queued(life,life.pending);
    if (migration || value.presentedAtAge !== age) {
      if (countAt(state,age)<MAX_DECISIONS_PER_AGE) activate(life,value);
      else {
        life.pending=null;
        if (isEssentialDecision(value)) defer(life,value);
      }
    }
  }
  // Saved queues from older versions could contain more prompts than the new
  // limit permits. Keep every required plan, and omit excess optional offers.
  let reserved=countAt(state,age);
  life.pendingQueue=life.pendingQueue.map(value=>queued(life,value)).sort((a,b)=>
    Number(isEssentialDecision(b))-Number(isEssentialDecision(a))).filter(value=>{
    if (value.notBeforeAge>age) return true;
    if (reserved<MAX_DECISIONS_PER_AGE) { reserved++; return true; }
    if (isEssentialDecision(value)) { value.notBeforeAge=age+1; return true; }
    return false;
  });
  return state;
}
/** Available slots include already queued prompts for this age. */
export function decisionSlots(life) {
  const state=ensureDecisionState(life), age=ageOf(life);
  const reserved=life.pendingQueue.filter(value=>value.notBeforeAge<=age).length;
  return Math.max(0,MAX_DECISIONS_PER_AGE-countAt(state,age)-reserved);
}
export function hasEducationPlan(life) {
  return [life.pending,...(life.pendingQueue || [])].some(value=>/^(edu-)|^(secondary|university|postgraduate)$/.test(value?.action || ''));
}
/** Returns false when an optional opportunity cannot be offered this year. */
export function scheduleDecision(life,value) {
  const state=ensureDecisionState(life), age=ageOf(life);
  if (life.phase && life.phase !== 'life') return false;
  if ([life.pending,...life.pendingQueue].some(item=>item && samePlan(item,value))) return false;
  const essential=isEssentialDecision(value), key=occurrence(value), last=state.lastOffered[key];
  if (!essential && Number.isFinite(last) && age-last<cooldown(value)) return false;
  queued(life,value);
  if (!essential && !decisionSlots(life)) return false;
  if (essential && !decisionSlots(life)) {
    // A queued optional opportunity can yield its reservation to a required
    // education / employment / retirement plan that has not yet been shown.
    const optional=life.pendingQueue.findIndex(item=>!isEssentialDecision(item)&&item.notBeforeAge<=age);
    if (optional>=0) life.pendingQueue.splice(optional,1);
  }
  state.lastOffered[key]=age;
  if (!life.pending && countAt(state,age)<MAX_DECISIONS_PER_AGE && !life.pendingQueue.some(item=>item.notBeforeAge<=age))
    return activate(life,value);
  if (decisionSlots(life)>0) life.pendingQueue.push(value);
  else if (essential) defer(life,value);
  else return false;
  return value;
}
/** Call after resolving a prompt and after increasing age. refresh(life,value)
 * rebuilds a required plan's fees / eligibility when it crosses a year. */
export function activateQueuedDecision(life,refresh) {
  const state=ensureDecisionState(life), age=ageOf(life);
  if (life.pending || (life.phase && life.phase !== 'life')) return life.pending || null;
  if (countAt(state,age)>=MAX_DECISIONS_PER_AGE) return null;
  while (true) {
    const index=life.pendingQueue.findIndex(value=>value.notBeforeAge<=age);
    if (index<0) return null;
    let value=life.pendingQueue.splice(index,1)[0];
    if (value.scheduledAtAge<age && isEssentialDecision(value) && refresh) {
      const updated=refresh(life,value);
      if (updated===null || updated===false) continue;
      if (updated) value={...updated,scheduledAtAge:age,notBeforeAge:age};
    }
    // Optional prompts in legacy saves should not silently recur years later.
    if (!isEssentialDecision(value) && value.scheduledAtAge<age) continue;
    return activate(life,value);
  }
}
