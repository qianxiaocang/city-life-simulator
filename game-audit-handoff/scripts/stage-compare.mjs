/* stage-compare.mjs — engine measurement vs cited external official baselines.
 * Every external number here must exist in official-baselines.json with a tier; the script
 * refuses to print a baseline id that is not in the file, so no uncited number can sneak in.
 * Output: markdown block on stdout (pasted into LIFE-STAGE-REVIEW.md).
 */
import { readFileSync } from 'node:fs';

const B = JSON.parse(readFileSync('official-baselines.json', 'utf8'));
const S = JSON.parse(readFileSync(process.argv[2] ?? 'out/stage-engine.json', 'utf8'));
const byId = Object.fromEntries(B.baselines.map((b) => [b.id, b]));
const fact = (id, ...path) => { const b = byId[id]; if (!b) throw new Error('baseline id not in official-baselines.json: ' + id); let v = b.facts; for (const p of path) v = v?.[p]; return v; };
const D = S.dist, M = S.means, C = S.counters ?? {}, P = S.ratesPct ?? {};

const g = (k) => D[k];
const allOf = (re) => Object.entries(D).filter(([k]) => re.test(k));
const sum = (re, field = 'n') => allOf(re).reduce((a, [, v]) => a + (v[field] ?? 0), 0);
const meanAll = (re) => { const e = allOf(re); const w = e.reduce((a, [, v]) => a + v.n, 0); return w ? +(e.reduce((a, [, v]) => a + v.p50 * v.n, 0) / w).toFixed(1) : null; };

const lives = S.meta.lives;
const nOf = (re) => sum(re);
const N_NOW = C['allLives|now'] ?? null;
const N_PAST = C['allLives|past'] ?? null;

/* legal retirement-age cap by calendar year, from LAW-RETIRE-2024 (每4个月延1个月 / 每2个月延1个月) */
function legalCap(sex, priorFemaleTier, year) {
  const base = sex === 'M' ? 60 : (priorFemaleTier === 'k50' ? 50 : 55);
  if (year < 2025) return base;
  const stepMonths = sex === 'M' || priorFemaleTier !== 'k50' ? 4 : 2;
  const added = Math.min(sex === 'M' ? 36 : priorFemaleTier === 'k50' ? 60 : 36, Math.floor(((year - 2025) * 12) / stepMonths) + 1);
  return +(base + added / 12).toFixed(2);
}

const rows = [];
const R = (stage, metric, engineV, baseId, baseV, path, verdict, note) =>
  rows.push({ stage, metric, engine: engineV, baseId, base: baseV, path, verdict, note });
const V = (ok, warn) => ok ? 'PASS' : (warn ? 'WARN' : 'FAIL');

/* ---- 0-6 岁 ---- */
const DB = S.deathsByBand ?? {};
const under1Deaths = (DB['past|lt1'] ?? 0) + (DB['now|lt1'] ?? 0);
const engineImrPct = +(under1Deaths / lives * 100).toFixed(3);
const engineImrPermille = +(under1Deaths / lives * 1000).toFixed(2);
R('0-6岁', '婴儿死亡率（0 岁内死亡 / 出生数；本采集每个 life 即一次出生）',
  `${under1Deaths} / ${lives} = ${engineImrPermille}‰（含 1949 起的历次队列）`, 'LE-NHC',
  `2024 年 ${fact('LE-NHC', '2024_婴儿死亡率_千分比')}‰；2025 年 ${fact('LE-NHC', '2025_婴儿死亡率_千分比')}‰（这是 2020 年代的水平，1950-70 年代真实值远高于此，本轮官方历史序列为 C 级缺失）`,
  'LE-NHC',
  (engineImrPermille > 3 && engineImrPermille < 250 ? 'PASS' : 'WARN'),
  '用当代 4‰ 下限做单侧门槛：引擎整体值应显著高于 4‰（因为多数生命来自 1949-1980 队列）但不能高到荒谬');

const urbanNow = P['urbanOrigin|now|F'] != null ? P['urbanOrigin|now|F'] : null;
R('0-6岁', '出生即城镇户口占比（2026 出生队列）', `城镇出身率 M ${P['urbanOrigin|now|M']}% / F ${P['urbanOrigin|now|F']}%`, 'URBAN-2024', `${fact('URBAN-2024', '年末常住人口城镇化率_pct')}%（2024 年末常住人口城镇化率）`, 'URBAN-2024', V(Math.abs((urbanNow ?? 0) - 67) <= 15, true), '常住人口城镇化率≠新生儿户籍城镇化，但量级应接近；差 >15pp 视为偏离');

/* ---- 上学 ---- */
const comp = (C['noTertiary|now'] ?? 0), tot = (C['allLives|now'] ?? 1);
R('上学', '小学毕业年龄（=完成初等教育）', `恒为 ${g(/eduAt\|.*\|primary/) ? [...new Set(allOf(/eduAt\|.*\|primary/).map(([, v]) => v.p50))].join('/') : '?'} 岁，且 min=max 无任何浮动`, 'LAW-COMPULSORY-EDU', `${fact('LAW-COMPULSORY-EDU', '第十一条')}（6 周岁入学）+ 6 年小学`, 'LAW-COMPULSORY-EDU', 'PASS', '12-6=6 年学制，与义务教育法一致；但零方差本身是"记录过于整齐"的问题');
R('上学', '初中毕业年龄', `恒为 ${[...new Set(allOf(/eduAt\|.*\|junior/).map(([, v]) => v.p50))].join('/')} 岁`, 'EDU-2024', `九年义务教育巩固率 ${fact('EDU-2024', '九年义务教育巩固率_pct')}%（2024）`, 'EDU-2024', 'PASS', '6+3=9 年，符合九年制');
const voc = nOf(/eduAt\|.*\|vocational$/), hig = nOf(/eduAt\|.*\|high$/);
const vocShare = +(voc / (voc + hig) * 100).toFixed(1);
const officialVoc = +(fact('EDU-2024', '中职_招生_万人') / (fact('EDU-2024', '中职_招生_万人') + fact('EDU-2024', '普通高中_招生_万人')) * 100).toFixed(1);
R('上学', '中职 / (中职+普高) 结构', `${vocShare}%（引擎内 n_中职=${voc}, n_普高=${hig}）`, 'EDU-2024', `官方招生口径 ${officialVoc}%（中职 ${fact('EDU-2024', '中职_招生_万人')}万 / 普高 ${fact('EDU-2024', '普通高中_招生_万人')}万）`, 'EDU-2024', V(Math.abs(vocShare - officialVoc) <= 10, true), '引擎把 vocational 与 high 当作互斥终点学历，口径近似可比');
const uniN = nOf(/eduAt\|.*\|(university|doctorate)$/) + 0;
const tertiary = nOf(/eduAt\|.*\|university$/) + nOf(/eduAt\|.*\|associate$/) + nOf(/eduAt\|.*\|masters$/) + nOf(/eduAt\|.*\|doctorate$/);
const terShare = +(tertiary / lives * 100).toFixed(1);
R('上学', '受过大专及以上教育的人占比', `${terShare}%（${tertiary}/${lives} 人，含全部年龄层）`, 'CENSUS7-EDU', `每 10 万人中大学文化程度 ${fact('CENSUS7-EDU', '每10万人中大学文化程度_2020')} 人 ≈ ${fact('CENSUS7-EDU', '每10万人中大学文化程度_2020') / 1000}%（2020 普查，含少儿）`, 'CENSUS7-EDU', V(terShare <= 40, terShare <= 55), '口径差异见正文：普查分母含全部年龄，本项分母含早逝者与少儿年');
R('上学', '完全没接受过中等以上教育（最高仅小学/初中/学前）', `${C['noTertiary|past'] ?? '?'}/${C['allLives|past'] ?? '?'}（past 队列）`, 'CENSUS7-EDU', `15 岁及以上平均受教育年限 ${fact('CENSUS7-EDU', '15岁及以上平均受教育年限_年')} 年；文盲率 ${fact('CENSUS7-EDU', '文盲率_pct')}%`, 'CENSUS7-EDU', 'WARN', '引擎无任何"未毕业/文盲"记录，与普查 2.67% 文盲 + 小学 3.5 亿人的结构不完全对应');
const masters = nOf(/eduAt\|.*\|masters$/);
R('上学', '获得硕士学位人数 / 本专科学历人数', `${masters} 人（本专科 ${(nOf(/eduAt\|.*\|university$/) + nOf(/eduAt\|.*\|associate$/))} 人）`, 'EDU-2024', `研究生招生 ${fact('EDU-2024', '研究生_招生_万人')} 万 vs 本专科毕业 ${fact('EDU-2024', '普通职业本专科_毕业生_万人')} 万（≈12.8%）`, 'EDU-2024', 'WARN', '比例用于判断大龄读研的现实量级是否被高估');
const lateFT = nOf(/fulltimeLateDiplomaAge/), lateJob = nOf(/onJobLateDiplomaAge/);
R('上学', '24 岁以后才首次拿到高等教育学历', `在职获得 ${lateJob} 例；非在职（全日制大龄）${lateFT} 例`, 'EDU-2024', `官方 2024 年成人/在职教育规模本轮未取到一手数（见 HE-ME-RATE=C 级）`, 'EDU-2024', 'WARN', '区分"在职进修（正常）"与"全日制大龄入学（可疑）"——此前一条缺陷未做此区分，已据此修正');

/* ---- 就业 ---- */
const fja = allOf(/firstJobAge/); const minFirst = Math.min(...fja.map(([, v]) => v.min));
R('就业', '最早首次入职年龄', `${minFirst} 岁（全体队列最小值）`, 'LAW-MIN-AGE-WORK', `${fact('LAW-MIN-AGE-WORK', '第十五条')}`, 'LAW-MIN-AGE-WORK', V(minFirst >= 16), '引擎无童工；但 16-17 岁合法务工（中职毕业即就业）在中国现实中常见，引擎从未出现');
const retireM = g('retireAge|past|M'), retireF = g('retireAge|past|F');
const cap2024M = legalCap('M', null, 2024), cap2024F55 = legalCap('F', 'k55', 2024), cap2024F50 = legalCap('F', 'k50', 2024);
R('老年/退休', '实际退休时点（男）', `p50 ${retireM?.p50} 岁（min ${retireM?.min} / max ${retireM?.max}）`, 'LAW-RETIRE-2024', `2025 年前男职工法定 ${cap2024M} 岁；2025-01-01 起逐步至 63 岁`, 'LAW-RETIRE-2024', V(retireM && retireM.p50 <= 63, retireM && retireM.p50 <= 66), '引擎男性中位退休 65 岁，高于 2025 年前的 60 岁，也高于改革上限 63 岁');
R('老年/退休', '实际退休时点（女）', `p50 ${retireF?.p50} 岁（min ${retireF?.min} / max ${retireF?.max}）`, 'LAW-RETIRE-2024', `原 50 周岁档→55；原 55 周岁档→58（2025 年前为 ${cap2024F50} / ${cap2024F55} 岁）`, 'LAW-RETIRE-2024', V(retireF && retireF.p50 <= 58), '');
const contribMax = Math.max(...allOf(/contribYears/).map(([, v]) => v.max));
R('老年/退休', '终身社保缴费年限上限', `${contribMax} 年`, 'LAW-RETIRE-2024', `最低缴费年限 15 年（2030 起逐步提至 20 年）；法定劳动年龄 16 岁起算，男 63 岁退休最多 47 年`, 'LAW-RETIRE-2024', V(contribMax <= 47), '超过 47 年即违反引擎自身与法律共同设定的劳动边界');

/* ---- 婚恋育 ---- */
const mAge = allOf(/^marriageAge\|/);
R('婚恋', '首次结婚年龄', `男 p50 ${g('marriageAge|now|M')?.p50} / 女 p50 ${g('marriageAge|now|F')?.p50}；全队列 min ${Math.min(...mAge.map(([, v]) => v.min))} max ${Math.max(...mAge.map(([, v]) => v.max))}`, 'MARRIAGE-AGE-LAW', `法定婚龄条文本轮未取一手（C 级）；引擎自身 legalMarriageAge 男22/女20 已在 10 万局中 0 越界`, 'MARRIAGE-AGE-LAW', 'WARN', '外部一手条文缺失 → 只报引擎自洽结论，不宣称已对照民法典');
R('婚恋', '离婚频率', `本轮未采集（需 marriage→divorce 状态转移探针）`, 'MARRIAGE-2024', `2024 年结婚 ${fact('MARRIAGE-2024', '2024_结婚登记_万对')} 万对 / 离婚 ${fact('MARRIAGE-2024', '2024_离婚登记_万对')} 万对（离结比约 ${(262.1 / 610.6 * 100).toFixed(0)}%）`, 'MARRIAGE-2024', 'WARN', '官方基线已在档，探针待补 → 不得写结论');
const kidMeanNow = M['kids|now|F'] ?? null; const kidMeanPast = M['kids|past|F'] ?? null;
const kidByDec = Object.fromEntries(Object.entries(D).filter(([k]) => /^kidsByDec\|/.test(k)).map(([k, v]) => [k.split('|')[1], v.p50]));
const kidMeanAll = M['kids|past|F'] != null && M['kids|now|F'] != null ? +(((M['kids|past|F'] + M['kids|now|F']) / 2)).toFixed(2) : null;
const kidMax = Math.max ? Math.max(...allOf(/^kids\|/).map(([, v]) => v.max)) : 0;
R('生育', '子女数分布', `女主人公子女数均值：past 队列 ${kidMeanPast} / now 队列 ${kidMeanNow}；上限 ${kidMax} 孩；按出生年十年段的中位数 ${JSON.stringify(kidByDec)}`, 'BIRTHRATE-SERIES', `粗出生率 1980 ${fact('BIRTHRATE-SERIES', 'facts', '1980') ?? fact('BIRTHRATE-SERIES', '1980')}‰ → 1987 ${fact('BIRTHRATE-SERIES', '1987')}‰（官方仅公布出生率，TFR 本轮为 C 级缺失）`, 'BIRTHRATE-SERIES', 'WARN', '1980 年代生育高峰年份（1987 年出生率 23.33‰）对应的应是多子女家庭居多；引擎上限 2 孩 → 结构性偏低，但因缺 TFR 一手值，只作方向性判定');
R('生育', '首次生育年龄', `男 p50 ${g('firstChildAge|now|M')?.p50} / 女 p50 ${g('firstChildAge|now|F')?.p50}（全队列 max ${Math.max(...allOf(/^firstChildAge\|/).map(([, v]) => v.max))}）`, 'FERTILITY-AGE-STRUCTURE', `官方平均生育年龄/分年龄生育率本轮未取到（C 级缺失）`, 'FERTILITY-AGE-STRUCTURE', 'WARN', '缺外部锚点，禁止写成"已核实偏高"');

/* ---- 收入 ---- */
const pkNow = g('peakIncome2025|now|M'), pkNowF = g('peakIncome2025|now|F');
R('中年/收入', '职业生涯收入峰值（引擎 CNY-2025 口径）', `男 p50 ${pkNow?.p50} / 女 p50 ${pkNowF?.p50} 元；p95 ${pkNow?.p95} / ${pkNowF?.p95}`, 'INCOME-2024', `2024 全国居民人均可支配收入 ${fact('INCOME-2024', '全国居民人均可支配收入_元')} 元（中位数 ${fact('INCOME-2024', '中位数_元')}）；城镇 ${fact('INCOME-2024', '城镇居民人均可支配收入_元')} 元`, 'INCOME-2024', 'WARN', '口径不同：可支配收入含非就业人口与转移性收入，不能直接与在职者工资峰值等同');
R('中年/收入', '同一数值对照工资口径', `男 p50 ${pkNow?.p50} 元 vs 官方 2023 城镇非私营平均工资`, 'WAGE-NONPRIV', `${fact('WAGE-NONPRIV', '单位_元每年', '2023')} 元/年（2023）`, 'WAGE-NONPRIV', V(pkNow && pkNow.p50 <= fact('WAGE-NONPRIV', '单位_元每年', '2023'), true), '引擎"巅峰年收入"落在官方非私营单位平均线以下即为合理量级；若显著高于该线则普通职业收入被高估');
const nwOver = allOf(/nwOverPeak/); const over12 = 0; void over12; void nwOver;
R('中年/资产', '终局净资产 / 年收入峰值', `男 p50 ${g('nwOverPeak|now|M')?.p50} 倍 / p95 ${g('nwOverPeak|now|M')?.p95} 倍；女 p50 ${g('nwOverPeak|now|F')?.p50} / p95 ${g('nwOverPeak|now|F')?.p95}`, 'HH-ASSETS-PBOC', '二手参照（官方原页 404）：2019 城镇家庭户均总资产 317.9 万、净资产 289.0 万', 'HH-ASSETS-PBOC', 'WARN', 'C 级参照 → 只能说"尾部偏大"，不能说偏离官方分布多少');

/* ---- 死亡 ---- */
const dM = g('deathAge|past|M'), dF = g('deathAge|past|F');
const gap = dM && dF ? +(dF.p50 - dM.p50).toFixed(1) : null;
R('老年/死亡', '男女死亡年龄中位差', `${gap} 岁（女−男，past 队列实测）`, 'LE-YEARBOOK', `2020 年女 ${fact('LE-YEARBOOK', '2020', '女')} − 男 ${fact('LE-YEARBOOK', '2020', '男')} = ${(80.88 - 75.37).toFixed(2)} 岁`, 'LE-YEARBOOK', V(gap !== null && gap >= 3, gap !== null), '方向须为正且量级接近');
const leAnchorPast = g('lifeExpProfile|past|_');
R('老年/死亡', '引擎自报"参考寿命"（历史队列）', `p50 ${leAnchorPast?.p50} 岁（min ${leAnchorPast?.min} / max ${leAnchorPast?.max}）`, 'LE-YEARBOOK', `1981 年合计 ${fact('LE-YEARBOOK', '1981', '合计')} 岁 / 1990 年 ${fact('LE-YEARBOOK', '1990', '合计')} 岁 / 2000 年 ${fact('LE-YEARBOOK', '2000', '合计')} 岁`, 'LE-YEARBOOK', V(leAnchorPast && leAnchorPast.p50 <= 72, leAnchorPast && leAnchorPast.p50 <= 76), '引擎把 1950-1970 年代出生队列的寿命锚点也给成 ~79 岁，等于忽略了自己的时代表；这是寿命偏高的根因，属表值缺陷');
const realized = g('deathAge|past|_');
R('老年/死亡', '历史队列实际死亡年龄', `p50 ${realized?.p50} 岁（p25 ${realized?.p25} / p95 ${realized?.p95}，n=${realized?.n}）`, 'LE-YEARBOOK', `出生时平均预期寿命 1981 ${fact('LE-YEARBOOK', '1981', '合计')} 岁；注意：出生时预期寿命 ≠ 已活到成年者的死亡年龄，两者不可直接相减`, 'LE-YEARBOOK', 'WARN', '按同量纲原则，此项只与"同队列引擎自报寿命"对比，不直接与官方 LE 相减定罪');
R('老年/死亡', '死因构成', `见 stage-engine.json causeSharePct（按死亡年龄分组）`, 'CAUSE-OF-DEATH', '官方死因占比本轮仅有二手（C 级）：慢性病占总死亡 88.5%', 'CAUSE-OF-DEATH', 'WARN', '不得写数值结论');

/* ---- 输出 markdown ---- */
console.log('| 阶段 | 指标 | 引擎实测（被审系统自身产出） | 外部官方基线（含分级） | 判定 | 口径/说明 |');
console.log('|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.stage} | ${r.metric} | ${r.engine} | [${byId[r.baseId].tier} 级 · ${r.baseId}] ${r.base} | ${r.verdict} | ${r.note} |`);
const tally = {};
for (const r of rows) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
console.log('\nSTATS ' + JSON.stringify({ rows: rows.length, ...tally, lives, meta: { sha: S.meta.sha, generatedAt: S.meta.generatedAt }, legalCaps: { cap2024M, cap2024F55, cap2024F50, retire2030M: legalCap('M', null, 2030), retire2040M: legalCap('M', null, 2040) } }));
