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
const E = await import(u('engine.js'));
const { locations } = await import(u('data/locations.js'));
console.log('engine version', E.ENGINE_VERSION, '| locations', locations.length);
const life = E.createLife({ locations, seed: 'probe-1', birthYear: 2026, world: 'now', paceMinutes: 30 });
E.startLife(life);
console.log('birth:', JSON.stringify({ name: life.name, gender: life.gender, city: life.location?.name, year: life.year, age: life.age }));
for (let i=0;i<80 && !life.dead;i++){ E.advanceYear(life); if (life.pendingDecision) { life.pendingDecision = null; } }
console.log('after 80 advances => age', life.age, 'year', life.year, 'dead', life.dead, 'cause', life.deathCause);
