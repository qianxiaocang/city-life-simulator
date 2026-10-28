# 给修复 AI 的开工说明（阶段轴 v3）

你收到的是对网页游戏《14亿分之一》(https://www.opportunity-tszy.site/) 的**审计交付包**。
本轮只做一件事：**把"这局人生像不像中国人的一生"按人生阶段轴、逐年推进、对着中国官方公开数据判一遍**，并把每条官方数据的出处一起给你，方便你存储与复核。

## 阅读顺序（按此顺序，不要跳）

1. `LIFE-STAGE-REVIEW.md` —— 主报告。§1 是 6 条最要紧的结论；§5 是**我明确没做完的事**，别当成已完成。
2. `out/life-stage.md` —— 30 行阶段轴判定表 + 67 个出生年的逐年推进表（自动生成，别手改数字）。
3. `DATA-SOURCES.md` —— 每一条外部数据的**页面 URL、抓取方式、发布日期、可信分级**；§7 是本轮新增与**旧文档作废项**。
4. `official-baselines.json` —— 机器可读来源登记册（29 条：A 10 / B 8 / C 11）。`life-stage.mjs` 对不在册的 id 直接抛错。5. `FIX-BRIEF.md` —— 上一版（v2）的 12 条工程缺陷清单。仍然有效，但**其中与 §7.3 冲突的口径以 §7.3 为准**。

## 三条硬规则（违反即本次修复无效）

1. **不许把 C 级来源写成"已核实"**。A=审计者本人抓取并逐字核对；B=取证任务真实打开页面（含统计年鉴 JPG 读图）；C=搜索摘要/二手转引/404/官方确实不存在/取证中断。凡引用 C 级，判定最高 WARN，且只能写"方向性/待核"。
2. **不许用"全绿"当修好**。每条修复必须能在**审计已测到问题的同一个 seed** 上复现问题→消失；基线命中为 0 的断言不得报绿，要报 `NOT OBSERVABLE` 或 `needsLives`。本轮 `L10K-11` 就是被这条规则拦下的（10 万局命中 22 次 vs 门禁 0 次，已隔离为 `POSITIVE CONTROL FAILED`）。
3. **不许自造字段名与口径**。本包已踩过的坑，你不要再踩一遍：
   - `life.pending` 是**单个对象**，不是数组（用 `pending?.length` 会静默卡死循环）；
   - `years[].job` 是对象 `{zhCN,zhTW,en}`，不是字符串；
   - `family.partner` 出现 = 伴侣/恋爱，**结婚**看 `partner.married`/`marriedYear`/`life.marriageAge`/`flags.marriageCount`；
   - `legalMarriageAge(sex, region, year)` 是**位置参数**，传 life 对象会恒返回 null → 探针发盲；
   - 引擎币值是 `CNY-2025-model`（固定 2025 购买力），跨年代比较必须先做 CPI 平减，否则就是在拿 2025 元比 1953 元。

## 构建标识（先确认你在改哪个包）

- `main.js` SHA-256：`f703243ce9662d669e7e5f020dae22ff1e190489794c07d6752f3a1537a6721c`
- 字节数：**1,454,475**（旧文档写的 1,574,199 B / 17,548 行是错的）
- `shipped/build-identity.json` 与 `shipped/engine-shipped.mjs` 为本次无头复现所用的引擎快照。

## 复现

```bash
node stage-collect2.mjs 40000 out/stage-engine.json   # 主分布
node era-sweep.mjs 24 out/era-sweep.json              # 1949→2015 逐年扫描
node marriage-true.mjs 6000                            # 婚姻真字段
node marriage-at-appear.mjs 4000                       # 伴侣出现年 vs 法定婚龄（探针阳性对照）
node life-stage.mjs > out/life-stage.md                # 阶段轴判定表（缺来源即抛错）
node stage-collect2.mjs --trace st1201 past 1955       # 个案逐年推进（退休清零/养老金恒定/18岁入职）
```

引擎加载契约（快照无 ES export）：

```js
await import(resolve('./shipped/engine-shipped.mjs'));
const E = globalThis.__ENGINE_SHIPPED__;
```

## 优先级建议（按"玩家可感知 × 证据强度"排）

1. 寿命曲线：把 1949-1970 队列的 e(0) 从 ~79 岁降到官方同期水平，并让 e(25) 与 e(0) 真正分离。
2. 退休：按退休**年份**分段取法定年龄（2025-01-01 起男 60→63、原 55→58、原 50→55），禁止在此之前给 63/65/71 岁；缴费年数以就业起始年为下界。
3. 生育：修正 1940s/1950s 队列的生育率（现在平均 0.19/0.5 个孩子、无子女率 80%+，方向反了）。
4. 婚姻：补 `婚姻性质（初婚/丧偶再婚/离异再婚）`+`配偶生死`+`离婚事件` 三类字段；当前离婚/丧偶在数据结构里完全不存在。
5. 死因：让构成随年代与年龄变化（现在五类慢病各 ~20%，等同均匀抽签）。
6. 清零/恒定：修 `netWorth` 在退休年被清零、养老金连续多年零调整。

## 本轮交付方式：一次跑完整条工单，再交付

**不要分批回报。** 全部问题在**一条会话内跑完**后一次性交付。工单与验收契约：

- `WORK-QUEUE.json` —— 唯一工单，**37 条**（FAIL 22 / WARN 7 / QUARANTINED 1 / WITHDRAWN 1 / BLOCKED 6；必修 29 条）。每条自带 `acceptance_assertions`，逐条自证。
- `DELIVERY-CONTRACT.md` —— 一次交付必须包含的 **5 个产物**、**6 条「不接受即视为未交付」红线**、跑单顺序、不许顺手改的东西。

开工前先跑一遍全部复现命令，把「改前」的 `out/life-stage.md` / `out/era-sweep.json` / `out/marriage-true.json` 存档作为 before 基线。**没有 before 就没有资格报绿。**
