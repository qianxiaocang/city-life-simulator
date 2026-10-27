// 核对目标仓库是否就是本指南审计的那份代码。
// 用法：GAME_SRC=/path/to/游戏src node verify-repo.mjs   （默认 ./src）
// 输出：每条锚点 PASS / FAIL；FAIL>0 时不要直接照指南改代码，先做人工比对。
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const GS = (process.env.GAME_SRC ?? './src').replace(/\/+$/, '');
const dir = /^[.\/]/.test(GS) ? new URL(`${GS}/`, import.meta.url) : new URL(`file://${GS}/`);
if (!existsSync(new URL('engine.js', dir))) {
  console.error ??= console.log;
  console.log(`[verify-repo] 未找到游戏模块：${decodeURIComponent(dir.pathname)}engine.js 不存在\n` +
    `             请先指定源码目录：GAME_SRC=/你的仓库/src node verify-repo.mjs`);
  process.exit(2);
}
const rd = p => existsSync(new URL(p, dir)) ? readFileSync2(p) : null;
function readFileSync2(p){ try { return readFileSync(fileURLToPath(new URL(p, dir)), 'utf8'); } catch { return null; } }
// [文件, 断言说明, 正则]  —— 全部来自审计时实测到的实现特征
const ANCHORS = [
  ['engine.js', '存在 familyYear()（D-06 亲属死亡率）', /function\s+familyYear\s*\(/],
  ['engine.js', '亲属年龄硬顶 113（D-06）', /113/],
  ['engine.js', 'mortality() 使用 expectancyFactor 79.5 基准（D-01/D-02）', /79\.5/],
  ['engine.js', '慢病 hazard 乘数 1.35', /1\.35/],
  ['engine.js', 'autoChoose() 存在（D-13）', /function\s+autoChoose\s*\(/],
  ['engine.js', 'siblingCount 按 birthYear<1980 分档（D-07）', /birthYear\s*<\s*1980\s*\?\s*integer\([^)]*1\s*,\s*4/],
  ['engine.js', 'totals 字段名为 earned/spent（度量口径）', /earned\s*:/],
  ['data/development.js', 'lifeExpectancy 锚点表首个年份为 1981（D-01 根因）', /lifeExpectancy\s*:\s*\[\s*\[\s*1981/],
  ['data/development.js', '存在 year<1981 线性外推（D-01 待删除项）', /year\s*<\s*1981/],
  ['data/development.js', '非大陆寿命为常数表 85/81/83.5（D-04 根因）', /hongkong\s*:\s*85/],
  ['data/development.js', '存在 cityFactor（D-05）', /cityFactor/],
  ['economy.js', '生活成本 house?0.35:0.45（D-12）', /\?\.35:\s*\.45/],
  ['economy.js', 'homeTerms 房价=收入×(6+prosperity×10)（D-05/D-12）', /prosperity[^]*?10|prosperity,\s*0,\s*1\)\s*\*\s*10/],
  ['economy.js', '房贷 DTI 上限 0.4（D-12）', /\*\s*\.4\b|\*\s*0\.4\b/],
  ['data/china-law.js', '非大陆法规返回 null（D-19 根因）', /null/],
  ['data/china-society.js', 'CHINA_JOBS 用 J() 构造、岗位数 66（D-18）', /export const CHINA_JOBS/],
  ['data/china-society.js', '岗位统一打标 illustrative-job-and-salary（D-18）', /illustrative-job-and-salary/],
  ['career.js', 'candidateCareers 硬排除 self-employed（D-18 已定位根因）', /!\[['\"]self-employed['\"]]\.includes\(job\.sector\)/],
  ['career.js', 'permittedCareer 的 urban 闸门（D-18）', /job\.urban===false\s*&&\s*life\.urban/],
];
let fail = 0, missing = new Set();
console.log(`核对目录：${decodeURIComponent(dir.pathname)}\n`);
for (const [file, desc, re] of ANCHORS) {
  const src = rd(file);
  if (src === null) { missing.add(file); console.log(`  MISSING  ${file}  ← ${desc}`); fail++; continue; }
  const ok = re.test(src);
  if (!ok) fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}    ${file.padEnd(22)} ${desc}`);
}
const jobs = rd('data/china-society.js');
if (jobs) {
  const i = jobs.indexOf('export const CHINA_JOBS');
  const seg = i < 0 ? '' : jobs.slice(i, jobs.indexOf('\nexport const', i + 10) > 0 ? jobs.indexOf('\nexport const', i + 10) : undefined);
  console.log(`\n  统计：CHINA_JOBS 岗位数 = ${(seg.match(/\bJ\('/g) || []).length}（审计值 66）`);
}
console.log(`\n结论：${fail === 0 ? '✅ 全部锚点命中，可直接按指南批次执行'
  : `⚠️  ${fail} 项不符 —— 这份源码与线上审计版本存在差异。先人工比对差异处，再决定是移植修复还是按本仓库重写；不要机械套用指南里的行号与数值上下文。`}`);
if (missing.size) console.log ?? 0, console.log(`缺失文件：${[...missing].join(', ')}`);
