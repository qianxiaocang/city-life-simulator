# 路径与符号映射（指南 ↔ 本工作区 ↔ 你自己的仓库）

指南中的路径是**抓取副本**的写法，与本工作区的实际目录有一层差异。按**符号名**定位，不要按行号定位。

| 指南里写的 | 本工作区实际路径 | 说明 |
|---|---|---|
| `data/development.js` | `src/data/development.js` | D-01/D-04/D-05 主战场。`MAINLAND_OBSERVED.lifeExpectancy`、`if(year<1981)` 线性段、`cityFactor`、`interpolateAnchors` |
| `engine.js::mortality` | `src/engine.js`（`function mortality`） | 婴幼儿分支、`expectancyFactor=exp((79.5-LE)/10)`、`healthFactor`、`incomeFactor`、`chronic ×1.35` |
| `engine.js::familyYear` | `src/engine.js` | D-06。平坦 hazard + 硬顶 113 |
| `engine.js::autoChoose` | `src/engine.js` | D-13。只做 `weighted(options)→choose()` |
| `engine.js::generateCompanions` | `src/engine.js` | D-07 兄弟姐妹数、D-09 母亲年龄 `uniform(24,37)` |
| `economy.js` | `src/economy.js` | D-11/D-12/D-20。`itemPrice`、`homeTerms`(第 244 行附近)、`canBorrowHousing`(第 218 行附近)、`getEconomyShopItems`(第 253 行附近) |
| `education.js` | `src/education.js` | D-03 升学通道、D-16 `edu-secondary`、D-20 学费分段 |
| `data/china-law.js` | `src/data/china-law.js` | D-19 非大陆返回 `null`；主干（退休查表/义务教育 9 年/婚姻年龄/助学贷款）**已正确，勿改** |
| `data/history.js`、`history-runtime.js` | `src/data/history.js`、`src/history-runtime.js` | D-14 零效应事件、D-15 错配地区 |
| `data/career.js`（指南早期写法，**实为岗位表所在**） | `src/data/china-society.js:131` | D-18 岗位表 `CHINA_JOBS`（66 个，`J()` 构造）在此；`src/career.js` 是就业**逻辑**，`candidateCareers()` 第 59 行硬排除 `self-employed`、`permittedCareer()` 第 45 行管 `urban` 闸门 |
| `data/locations.js` | `src/data/locations.js` | D-22 1,152 地仅 10 档权重、`population` 全空 |
| `data/china-society.js` | `src/data/china-society.js` | D-16/D-17/D-23/D-24/D-25 抉择与效果。注意 `C(id,...)` 的 `id` 是**普通字符串**；`CHINA_CONSUMPTION` 在第 222 行 |

## 关键结构事实（可省掉大量摸索时间）

- **无打包器、无 JSON 数据文件**：所有内容表都在 `data/*.js` 的 `export const` 里。
- 引擎可用 API：`createLife / startLife / advanceYear / choose / autoChoose / setFocus /
  getFocusOptions / netWorth / mortality / getShopItems / purchase / relocate / summarize /
  generateCompanions`；`ENGINE_VERSION = 1`。
- `createLife({locations, seed, world, birthYear})`：`world ∈ past|now|future`，`now`/`future` 都从 2026 起，
  `birthYear` 钳制 1950–2100，RNG 由 `seed` 完全决定（可复现）。
- `life.totals` 的字段名是 **`earned` / `spent`**（不是 earnings/spend）。
- `world` 只被 `engine.js`、`history-runtime.js`、`data/development.js` 三处读取 ——
  这就是"同一份 2026 数据套到三个世界"的根源，D-01/D-04/D-05 的共同上游。
- 引擎在 `choose()` **内部**就会完成雇佣/退休等状态迁移，所以任何前后状态比对必须在
  **每次**引擎调用后跑一次，只在 `advanceYear` 边界比对会静默漏检。

## 若你有自己的游戏仓库

把工作区换成你的仓库根目录，然后：
1. 把 `src/` 换成你仓库里对应的 ES 模块目录；
2. 按上表**用符号名重新定位**（行号仅作规模参考，我已标注近似位置）；
3. 校验脚本（`run-audit.mjs` 等）里的 `./src/...` import 路径改成指向你的模块；
4. 先跑 B0 让脚本在你的仓库上产出非零分母，再开始改代码。
