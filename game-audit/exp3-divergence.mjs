// 游戏模块目录：默认 ./src；指向真实仓库：GAME_SRC=/path/to/src node 本脚本
//   相对路径按“本脚本所在位置”解析，例如 GAME_SRC=../../repo/src
import { pathToFileURL } from 'node:url';
const GS = (process.env.GAME_SRC ?? './src').replace(/\/+$/, '');
const u = p => (/^[.\/]/.test(GS) ? new URL(`${GS}/${p}`, import.meta.url).href : pathToFileURL(`${GS}/${p}`).href);
import { existsSync } from 'node:fs';
if (!existsSync(new URL(u('engine.js')))) {
  console.error ??= console.log;
  console.error(`[audit] 找不到游戏模块 ${GS}/engine.js\n` +
    `        用 GAME_SRC 指向含 engine.js 的目录，例如：GAME_SRC=/绝对路径/游戏src node ${process.argv[1].split('/').pop()}`);
  process.exit(2);
}
// ────────────────────────────────────────────────────────────────────
/**
 * Experiment D (v2): whole-life branch divergence.
 * Branches share a lifetime mortality-risk budget. Exact and tolerant outcomes
 * include experienced wellbeing, care, learning and volunteer time.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import {resolve} from 'node:path';
const E = await import(u('engine.js'));
const { locations } = await import(u('data/locations.js'));

const T = (v) => (typeof v === 'string' ? v : v?.zhCN ?? '');
const clone = (o) => structuredClone(o);

function liveToDeath(l) {
  let g = 0;
  while (l.phase === 'life' && g++ < 300) {
    if (l.pending) { E.autoChoose(l); continue; }
    const opts = E.getFocusOptions(l);
    if (l.job && opts.some((f) => f.id === 'work')) E.setFocus(l, 'work');
    E.advanceYear(l);
  }
  return {
    deathAge: l.death?.age ?? l.age,
    education: l.education,
    finalJob: l.job?.id ?? l.lastJob?.id ?? null,
    earned: Math.round(l.totals.earned),
    netWorth: Math.round(E.netWorth(l)),
    children: l.family.children.length,
    married: !!l.family.partner?.married,
    retired: !!l.retired,
    happinessEnd: +l.stats.happiness.toFixed(2),
    healthEnd: +l.stats.health.toFixed(2),
    cause: T(l.death?.cause),
    averageHappiness:+(l.years.reduce((s,y)=>s+y.happiness,0)/Math.max(1,l.years.length)).toFixed(2),
    averageHealth:+(l.years.reduce((s,y)=>s+y.health,0)/Math.max(1,l.years.length)).toFixed(2),
    averageKnowledge:+(l.years.reduce((s,y)=>s+y.knowledge,0)/Math.max(1,l.years.length)).toFixed(2),
    averageRelationships:+(l.years.reduce((s,y)=>s+y.relationships,0)/Math.max(1,l.years.length)).toFixed(2),
    familyTime:+(l.totals.family||0).toFixed(2),learningTime:+(l.totals.learning||0).toFixed(2),volunteerHours:+(l.totals.charity||0).toFixed(2),
    journalCount:l.journal.length,hobbyPractice:l.hobbies.reduce((s,h)=>s+h.level,0),
  };
}
const WATCH = ['edu-secondary','edu-college','edu-bridge','edu-postgraduate','edu-funding','edu-recommendation','career-offer','career-result','child','marriage','move','romance','startup','worklife','hobby','reflect','checkup','community','familyhelp','retirement-law','culture'];
const byAction = {};
const examples = [];
const duplicateImmediateExamples=[];
let probed = 0;

for (let i = 0; i < Number(process.env.LIVES ?? 900) && probed < Number(process.env.MAXP ?? 3500); i++) {
  const seed = 'expD-' + i;
  const l = E.createLife({ locations, seed, world: i % 4 === 0 ? 'past' : 'now', birthYear: i % 4 === 0 ? [1950,1955,1970,1985,2000][Math.floor(i/4)%5] : 2026, paceMinutes: 30 });
  E.startLife(l);
  let g = 0;
  const taken = new Set();
  while (l.phase === 'life' && g++ < 300) {
    if (l.pending) {
      const p = l.pending;
      if (WATCH.includes(p.action) && p.options?.length >= 2 && !taken.has(p.action) && (byAction[p.action]?.n||0)<180) {
        taken.add(p.action); probed++;
        const branches = [];
        for (const o of p.options) {
          const c = clone(l);
          let applied = false;
          try { applied = E.choose(c, o.id, o.id==='write'?'我想珍惜家人和健康':''); } catch { applied = false; }
          const immediate={health:c.stats.health,happiness:c.stats.happiness,knowledge:c.stats.knowledge,relationships:c.stats.relationships,money:Math.round(c.money),education:c.education,job:c.job?.id,school:c.school&&{stage:c.school.stage,mode:c.school.mode,ownership:c.school.ownership,schoolTier:c.school.schoolTier,admissionTier:c.school.admissionTier,annualTuition:c.school.annualTuition,loanApproved:c.school.loanApproved,scholarship:c.school.scholarship},seniorSchoolTier:c.educationState?.seniorSchoolTier,careerPreparation:c.careerPreparation&&{job:c.careerPreparation.job?.id,gate:c.careerPreparation.gate},partner:!!c.family.partner,married:!!c.family.partner?.married,children:c.family.children.length,location:c.location.id,careTime:c.totals.family,learningTime:c.totals.learning,volunteerHours:c.totals.charity,journalCount:c.journal.length,hobby:c.hobbies.map(h=>h.id),studentLoanApproved:!!c.studentLoan?.approved,exams:c.educationState?.exams?.map(exam=>[exam.kind,exam.score]),deferredOffer:c.educationState?.deferredOffer?.stage,suspendedStudy:c.educationState?.suspendedStudy?.stage,pending:c.pending&&{action:c.pending.action,options:c.pending.options.map(option=>option.id),gap:c.pending.data?.gap,program:c.pending.data?.program&&{stage:c.pending.data.program.stage,ownership:c.pending.data.program.ownership,admissionTier:c.pending.data.program.admissionTier,annualTuition:c.pending.data.program.annualTuition,scholarship:c.pending.data.program.scholarship},aidAttempted:!!c.pending.data?.program?.aidAttempted,loanAttempted:!!c.pending.data?.program?.loanAttempted}};
          branches.push({ option: o.id, label: T(o.label), applied, immediate, result: liveToDeath(c) });
        }
        const ok = branches.filter((b) => b.applied);
        if (ok.length < 2) continue;
        const ex = new Set(ok.map((b) => JSON.stringify(b.result))).size;
        const immediateDistinct=new Set(ok.map((b)=>JSON.stringify(b.immediate))).size;
        const tol = new Set(ok.map((b) => {
          const r = b.result;
          return [r.deathAge, r.education, r.finalJob, r.children, r.married, r.retired,
            Math.round(r.earned / Math.max(1, ok[0].result.earned) * 100),
            Math.round(r.netWorth / Math.max(1, ok[0].result.netWorth) * 100),
            Math.round(r.averageHappiness),Math.round(r.averageHealth),Math.round(r.averageKnowledge),Math.round(r.averageRelationships),
            Math.round(r.familyTime),Math.round(r.learningTime),Math.round(r.volunteerHours/40),r.journalCount,Math.round(r.hobbyPractice)].join('|');
        })).size;
        const dAge = Math.max(...ok.map((b) => b.result.deathAge)) - Math.min(...ok.map((b) => b.result.deathAge));
        const baseNw = Math.abs(ok[0].result.netWorth) || 1;
        const dNw = (Math.max(...ok.map((b) => b.result.netWorth)) - Math.min(...ok.map((b) => b.result.netWorth))) / baseNw;
        const a = (byAction[p.action] ??= { n: 0, exactIdentical: 0, tolIdentical: 0, immediateIdentical:0,duplicateImmediate:0,dAgeValues: [], dAgeSum: 0, dNwSum: 0, eduDiffs: 0, jobDiffs: 0 });
        a.n++; a.exactIdentical += ex === 1 ? 1 : 0; a.tolIdentical += tol === 1 ? 1 : 0;
        a.immediateIdentical+=immediateDistinct===1?1:0;
        a.duplicateImmediate+=immediateDistinct<ok.length?1:0;
        if(immediateDistinct<ok.length&&duplicateImmediateExamples.filter(example=>example.action===p.action).length<5)duplicateImmediateExamples.push({action:p.action,age:l.age,year:l.year,options:ok.map(b=>({id:b.option,label:b.label,immediate:b.immediate}))});
        a.dAgeValues.push(dAge); a.dAgeSum += dAge; a.dNwSum += dNw;
        if (new Set(ok.map((b) => b.result.education)).size > 1) a.eduDiffs++;
        if (new Set(ok.map((b) => b.result.finalJob)).size > 1) a.jobDiffs++;
        if (examples.length < 300 && tol === 1) examples.push({ action: p.action, age: l.age, title: T(p.title), options: ok.map((b) => b.label), finalNetWorth: ok[0].result.netWorth, finalAge: ok[0].result.deathAge });
      }
      E.autoChoose(l);
      continue;
    }
    E.advanceYear(l);
  }
}

const byActionOut = {};
for (const [k, v] of Object.entries(byAction).sort((a, b) => b[1].n - a[1].n)) {
  byActionOut[k] = {
    probed: v.n,
    pctExactIdentical: +((v.exactIdentical / v.n) * 100).toFixed(1),
    pctWithinToleranceIdentical: +((v.tolIdentical / v.n) * 100).toFixed(1),
    pctImmediateIdentical:+((v.immediateIdentical/v.n)*100).toFixed(1),
    pctWithDuplicateImmediateOptions:+((v.duplicateImmediate/v.n)*100).toFixed(1),
    meanMaxDeathAgeSpread: +(v.dAgeSum / v.n).toFixed(2),
    p95DeathAgeSpread:v.dAgeValues.sort((a,b)=>a-b)[Math.floor(v.n*.95)],
    denominator:v.n,
    meanMaxNetWorthSpreadPct: +(100 * v.dNwSum / v.n).toFixed(1),
    pctWhereEducationChanges: +((v.eduDiffs / v.n) * 100).toFixed(1),
    pctWhereFinalJobChanges: +((v.jobDiffs / v.n) * 100).toFixed(1),
  };
}
const tot = Object.values(byAction).reduce((a, v) => ({ n: a.n + v.n, e: a.e + v.exactIdentical, t: a.t + v.tolIdentical }), { n: 0, e: 0, t: 0 });
const out = {
  meta: { decisionPointsProbed: probed, lives: Number(process.env.LIVES ?? 900), watchActions: WATCH.length },
  overall: {
    pctExactIdenticalWholeLife: +((tot.e / Math.max(1, tot.n)) * 100).toFixed(1),
    pctWithinToleranceIdenticalWholeLife: +((tot.t / Math.max(1, tot.n)) * 100).toFixed(1),
  },
  byAction: byActionOut,
  meaninglessExamples: examples.slice(0, 12),duplicateImmediateExamples,
};
const outDir=resolve(process.env.AUDIT_OUT||'.');mkdirSync(outDir,{recursive:true});
writeFileSync(resolve(outDir,'exp3-results.json'), JSON.stringify({ out, examples }, null, 2));
console.log('meta', JSON.stringify(out.meta));

console.log('overall', JSON.stringify(out.overall));
console.log('--- pct of decision points where EVERY option yields the same whole-life outcome ---');
for (const [k, v] of Object.entries(byActionOut))
  console.log(`${String(v.pctExactIdentical).padStart(6)}% exact | ${String(v.pctWithinToleranceIdentical).padStart(6)}% tolerant | dAge spread ${String(v.meanMaxDeathAgeSpread).padStart(5)} | dNW ${String(v.meanMaxNetWorthSpreadPct).padStart(6)}% | edu ${String(v.pctWhereEducationChanges).padStart(5)}% | job ${String(v.pctWhereFinalJobChanges).padStart(5)}% | n=${String(v.probed).padStart(4)} | ${k}`);
