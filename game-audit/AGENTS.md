# AGENTS.md — 修复本仓库时请遵守

本仓库是一个中文人生模拟游戏的**缺陷修复工作区**：`src/` 是**可直接运行的游戏模块**（原生 ESM，无依赖、无打包器、无 JSON 数据文件，所有内容表都在 `src/data/*.js` 的 `export const` 里），其余是回归校验器。任务：修复 25 条已实测确认的历史真实性与机制缺陷。

## 运行环境与命令

- **需要 Node 17+（建议 Node 20+）**：代码使用 `??=`、`||=`、`.at(-1)`、`structuredClone`。
- **零依赖、零网络**：`npm install` 不需要也不应执行；所有脚本只读本地文件。
- **所有脚本用 `GAME_SRC` 指向游戏模块目录**（默认 `./src`）。指向你自己的仓库：
  ```bash
  GAME_SRC=/绝对路径/你的仓库/src node verify-repo.mjs   # 第 0 步，必做
  GAME_SRC=/绝对路径/你的仓库/src node run-audit.mjs
  ```
  相对路径按“本脚本所在位置”解析（如 `GAME_SRC=../../repo/src`）。
- 冒烟测试（改代码前先确认工作区可用）：
  ```bash
  node verify-repo.mjs      # 核对源码是否为被审计的那份；有 FAIL 先人工比对再动手
  node run-audit.mjs        # 默认 12,000 局，约 16 秒，打印异常率表
  node verify.mjs           # 法规过渡探针，会打印校验分母
  ```
- 收口用的全量回归：
  ```bash
  N=60000 node run-audit.mjs
  node exp3-divergence.mjs  # 抉择杠杆分叉实验（判定「改了有没有用」）
  node econ2.mjs            # 经济闭环对账
  ```
  局数由环境变量 `N` 控制（`run-audit.mjs:13`，默认 12000）。macOS/Linux 用 `N=60000 node ...`。

## 必读顺序（不可调换）

1. `GAME_SRC=<你的游戏模块目录> node verify-repo.mjs` —— 18 条源码锚点全部 PASS 才继续；  
   出现 FAIL 说明这份源码与线上审计版本不同，先比对差异，**不要机械套用指南里的上下文与数值**。
2. `life-sim-fix-guide.md` **§0 元指令**、**§1.4 度量陷阱**、**§7 先修度量再修游戏**
3. `FILE-MAP.md` —— 指南里的路径 ↔ 本仓库实际路径的映射（**按符号名定位，不要按行号**）
4. `PROMPT.md` —— 批次划分与每批收口判据
5. 需要判定标准时查 `china-baseline-data.md`（227 条带来源官方数值；指南中 `BASE §9-n` 指它的 §9）

## 硬性约束

- **先做 B0**：给校验器补「断言必须报告分母」。本项目上一轮有 **5 条“缺陷”其实是校验器自身的 bug**（见 §1.4、§10）。典型：引擎在 `choose()` **内部**就完成雇佣/退休状态迁移，只在 `advanceYear()` 边界比对前后状态会让整组法规检查静默失效并显示「0 异常」。正确做法：在**每一次**引擎调用后各跑一次前后状态比对（`run-audit.mjs` 里的 `diffTransitions` 已是可用实现）。
- **年代/地区比较必须控混杂**：固定 `sex`，每格 ≥30 种子（本审计用 60）。单种子只能用于结构不变量，不能用于趋势判断。
- **禁止只改文案**。P0 全是 `src/data/development.js`、`src/engine.js`、`src/education.js`、`src/economy.js` 的数值与闸门问题。
- **禁止修改 `life-sim-fix-guide.md` §9「已验证正常」清单**中的行为（养老金替代率 p50=0.38、16 岁用工 0/3943 违规、时间线一致性、1981 年后寿命曲线、100/100 事件可达）。要改必须先给出反证。
- **不要为了绿灯放宽断言**。断言不通过时先判定是「代码没改对」还是「断言口径错」——两种都真实发生过。
- **保留 §1.1 的口径披露**：本审计是引擎无头对局 13.7 万局，不是浏览器逐局点击 1 万次。
- §6 八张重标定表是数值依据；标了「待补录」（§11）的项请在代码注释保留 `modelOnly`，不要伪装成官方观测。

## 批次（详见 §8 与 PROMPT.md）

B0 校验器 → B1 历史骨架（D-01/02/03/04，**四条必须同批改**，否则 `mortality` 与 `development.js` 相互抵消）→ B2 人口与家庭（D-06/07/08/09/10）→ B3 经济与职业（D-11/12/20/05/18）→ B4 玩法有效性（D-16/17/14/13/24/23）→ B5 法规与数据元（D-19/21/22/25）。  
每批结束必须跑全量回归，并把该批每条断言的 `pass/fail + 实测值 + 分母` 写进提交说明；**已达标项回退即视为该批未完成**。

## 已知瑕疵（不要当成游戏 bug，也不要掩盖）

`verify.mjs` 输出 `retired: 0 marriageChecked: 0` 是**该探针的标记字段名猜错**，不代表游戏退休/婚姻逻辑无问题——退休与初婚的独立复核仍欠一次。补 B0 时顺手修正，并在回报中说明。

## 引擎最小调用骨架

```js
import * as E from './src/engine.js';
import { locations } from './src/data/locations.js';
const life = E.createLife({ locations, seed: 'x1', world: 'past', birthYear: 1990 });
E.startLife(life);
while (life.phase === 'life') {
  if (life.pending) E.autoChoose(life);
  else { if (life.job) E.setFocus(life, 'work'); E.advanceYear(life); }
}
E.netWorth(life); E.summarize(life);
```

坑位速记：`life.totals` 字段名是 **`earned` / `spent`**；`china-society.js` 里 `C(id, …)` 的 `id` 是**普通字符串**（不是 `{zhCN}`）；`world` 只被 `engine.js`、`history-runtime.js`、`data/development.js` 三处读取。
