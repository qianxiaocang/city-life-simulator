/* era-sweep.mjs — 逐年推进轴（引擎自报口径 × 外部官方逐年序列）
 *
 * 对每个出生年 by ∈ [1949, 2015]，各跑 N 局（seed 固定 era<by>_<j>，world='past'），
 * 只记录引擎**自己声明**的年度参数与其**自己**的逐年推进行，不做任何外推：
 *   e0        = profile.lifeExpectancy          （引擎给该出生年的预期寿命）
 *   e25       = profile.lifeExpectancyAt25      （引擎给"已活到25岁"的残余口径）
 *   cmr       = profile.childMortality          （引擎给该年的儿童死亡概率）
 *   incAge40  = 引擎逐年行里 年龄=40 那一年的 income 中位（CNY-2025-model）
 *   wagePeak  = 引擎逐年行里 25-55 岁峰值 income 中位（CNY-2025-model）
 *   realized  = 该出生年**已死亡者**的死亡年龄中位（右删失，只作参考）
 *   kids      = 该出生年平均子女数
 *   retM/retF = 该出生年男/女中位退休年龄
 * 确定性：同一 N 一定复现同一张表。
 *
 * usage: node era-sweep.mjs [N=60] [out=out/era-sweep.json]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

await import(resolve(process.env.AUDIT_ENGINE || './shipped/engine-shipped.mjs'));
const E = globalThis.__ENGINE_SHIPPED__;

function live(seed, world, birthYear) {
  const l = E.createLife({ locations: E.locations, seed, world, birthYear, paceMinutes: 30 });
  E.startLife(l);
  // profile is refreshed every simulated year. Keep the birth-year values before
  // advancing; reading it after death had mislabeled late-life values as e(0).
  l.__birthProfile = structuredClone(l.profile);
  let g = 0, retireAge=l.retired?l.age:undefined, wasRetired=l.retired;
  while (l.phase === 'life' && g++ < 400) {
    if (l.pending) E.autoChoose(l); else E.advanceYear(l);
    if (l.retired && !wasRetired) retireAge = l.age;
    wasRetired=l.retired;
  }
  l.__retireAge = retireAge;
  return l;
}

const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * p))] : null; };
const med = (a) => { const v = q(a, 0.5); return v == null ? null : Math.round(v * 100) / 100; };
const mean = (a) => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length * 1000) / 1000 : null;

const N = +(process.argv[2] ?? 60);
const OUT = process.argv[3] ?? 'out/era-sweep.json';
const rows = [];
for (let by = 1949; by <= 2015; by++) {
  const R = { e0: [], e25: [], cmr: [], incAge40: [], wagePeak: [], realized: [], kids: [], retM: [], retF: [] };
  for (let j = 0; j < N; j++) {
    let l; try { l = live(`era${by}_${j}`, 'past', by); } catch { continue; }
    const p = l.__birthProfile ?? {};
    const sex = l.sex === 'female' ? 'F' : 'M';
    if (Number.isFinite(p.lifeExpectancy)) R.e0.push(p.lifeExpectancy);
    if (Number.isFinite(p.lifeExpectancyAt25)) R.e25.push(p.lifeExpectancyAt25);
    if (Number.isFinite(p.childMortality)) R.cmr.push(p.childMortality * 1000);
    const yr = l.years ?? [];
    const r40 = yr.find((y) => y.age === 40); if (r40) R.incAge40.push(r40.income ?? 0);
    const peak = yr.filter((y) => y.age >= 25 && y.age <= 55 && y.job).reduce((m, y) => Math.max(m, y.income ?? 0), 0);
    if (peak) R.wagePeak.push(peak);
    if (l.death) R.realized.push(l.death.age);
    R.kids.push((l.family?.children ?? []).length);
    const ra = l.__retireAge;
    if (Number.isFinite(ra) && l.location?.region === 'mainland' && l.retirementRule?.statutory)
      (sex === 'F' ? R.retF : R.retM).push(ra);
  }
  rows.push({
    birthYear: by, n: R.e0.length,
    engine_e0: med(R.e0), engine_e25: med(R.e25), engine_childMortality_pct: R.cmr.length ? Math.round(q(R.cmr, .5) * 1000) / 1000 : null,
    engine_childMortality_mean_pct: R.cmr.length ? Math.round(mean(R.cmr) * 1000) / 1000 : null,
    engine_incomeAt40: med(R.incAge40), engine_peakIncome25_55: med(R.wagePeak),
    engine_realizedDeathAge_p50: med(R.realized), engine_realizedDeathAge_mean: mean(R.realized), deaths: R.realized.length,
    engine_kids_mean: mean(R.kids), engine_kids_childless_pct: R.kids.length ? Math.round(R.kids.filter((v) => v === 0).length / R.kids.length * 10000) / 100 : null,
    engine_retireAge_M_p50: med(R.retM), engine_retireAge_F_p50: med(R.retF),
  });
  process.stderr.write(`by=${by} n=${R.e0.length} e0=${rows.at(-1).engine_e0} inc40=${rows.at(-1).engine_incomeAt40}\n`);
}
writeFileSync(resolve(OUT), JSON.stringify({ meta: { N, profileAt: 'birth', retirementScope: 'mainland statutory only', unit: 'CNY-2025-model（引擎自报固定 2025 币值）', lives: rows.reduce((s, r) => s + r.n, 0) }, rows }, null, 1));
process.stderr.write(`wrote ${OUT}\n`);
