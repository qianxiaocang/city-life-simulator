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
 * Exact fingerprint (no rounding) + tolerant fingerprint (within 1% money, same death age).
 */
import { writeFileSync } from 'node:fs';
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
  };
}
const exactFp = (r) => JSON.stringify ? JSON.stringify(r) : String(JSON.stringify(r));

const WATCH = ['edu-secondary','edu-bridge','edu-postgraduate','edu-funding','edu-recommendation','career-offer','child','marriage','move','romance','startup','worklife','hobby','reflect','health','community','familyhelp'];
const byAction = {};
const examples = [];
let probed = 0;

for (let i = 0; i < Number(process.env.LIVES ?? 900) && probed < Number(process.env.MAXP ?? 2500); i++) {
  const seed = 'expD-' + i;
  const l = E.createLife({ locations, seed, world: i % 4 === 0 ? 'past' : 'now', birthYear: i % 4 === 0 ? [1955,1970,1985,2000][i % 4] : 2026, paceMinutes: 30 });
  E.startLife(l);
  let g = 0, picks = 0;
  const taken = new Set();
  while (l.phase === 'life' && g++ < 300 && picks < 9) {
    if (l.pending) {
      const p = l.pending;
      if (WATCH.includes(p.action) && p.options?.length >= 2 && !taken.has(p.action)) {
        taken.add(p.action); picks++; probed++;
        const branches = [];
        for (const o of p.options) {
          const c = clone(l);
          let applied = false;
          try { applied = E.choose(c, o.id); } catch { applied = false; }
          branches.push({ option: o.id, label: T(o.label), applied, result: liveToDeath(c) });
        }
        const ok = branches.filter((b) => b.applied);
        if (ok.length < 2) continue;
        const ex = new Set(ok.map((b) => JSON.stringify(b.result))).size;
        const tol = new Set(ok.map((b) => {
          const r = b.result;
          return [r.deathAge, r.education, r.finalJob, r.children, r.married, r.retired,
            Math.round(r.earned / Math.max(1, ok[0].result.earned) * 100),
            Math.round(r.netWorth / Math.max(1, ok[0].result.netWorth) * 100)].join('|');
        })).size;
        const dAge = Math.max(...ok.map((b) => b.result.deathAge)) - Math.min(...ok.map((b) => b.result.deathAge));
        const baseNw = Math.abs(ok[0].result.netWorth) || 1;
        const dNw = (Math.max(...ok.map((b) => b.result.netWorth)) - Math.min(...ok.map((b) => b.result.netWorth))) / baseNw;
        const a = (byAction[p.action] ??= { n: 0, exactIdentical: 0, tolIdentical: 0, dAgeSum: 0, dNwSum: 0, eduDiffs: 0, jobDiffs: 0 });
        a.n++; a.exactIdentical += ex === 1 ? 1 : 0; a.tolIdentical += tol === 1 ? 1 : 0;
        a.dAgeSum += dAge; a.dNwSum += dNw;
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
    meanMaxDeathAgeSpread: +(v.dAgeSum / v.n).toFixed(2),
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
  meaninglessExamples: examples.slice(0, 12),
};
writeFileSync('exp3-results.json', JSON.stringify({ out, examples }, null, 2));
console.log('meta', JSON.stringify(out.meta));

console.log('overall', JSON.stringify(out.overall));
console.log('--- pct of decision points where EVERY option yields the same whole-life outcome ---');
for (const [k, v] of Object.entries(byActionOut))
  console.log(`${String(v.pctExactIdentical).padStart(6)}% exact | ${String(v.pctWithinToleranceIdentical).padStart(6)}% tolerant | dAge spread ${String(v.meanMaxDeathAgeSpread).padStart(5)} | dNW ${String(v.meanMaxNetWorthSpreadPct).padStart(6)}% | edu ${String(v.pctWhereEducationChanges).padStart(5)}% | job ${String(v.pctWhereFinalJobChanges).padStart(5)}% | n=${String(v.probed).padStart(4)} | ${k}`);
