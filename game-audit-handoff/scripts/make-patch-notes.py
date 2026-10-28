"""Generate the one-pass handoff report from frozen before and final rerun data."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
load = lambda p: json.loads((ROOT / p).read_text())
queue = load("WORK-QUEUE.json")["items"]
registry = {x["id"]: x["tier"] for x in load("official-baselines.json")["baselines"]}
before = load("out/before/stage-engine.json")
after = load("out/stage-engine.json")
era_before_raw = load("out/before/era-sweep.json")
era_before_corrected = load("out/before-corrected-era.json")
era_after = load("out/era-sweep.json")
mar_before = load("out/before/marriage-true.json")
mar_before_corrected = load("out/before-corrected-marriage.json")
mar_after = load("out/marriage-true.json")
replay_before = load("out/before/seed-replay.json")["cases"]
replay_after = load("out/seed-replay-after.json")["cases"]
text = load("out/text-controls.json")
retire = load("out/retire-controls.json")
inventory = load("out/decision-inventory.json")

def stats(path):
    s = re.search(r"^STATS (\{.*\})$", (OUT / path).read_text(), re.M)
    if not s:
        raise RuntimeError(f"missing STATS: {path}")
    return json.loads(s.group(1))

old_stats = stats("before/life-stage.md")
new_stats = stats("life-stage.md")
def mean(d, key):
    return d["means"].get(key)
def maxval(d, key):
    return d["dist"].get(key, {}).get("max")
def pp(x):
    return "—" if x is None else f"{x*100:.1f}%"
def ratio(r):
    return round(r["netWorth"] / r["typicalIncome"], 1) if r["typicalIncome"] else None
def seedrows(k, field, fn=lambda x:x):
    return "、".join(f"{b['seed']} {fn(b[field])}→{fn(a[field])}" for b,a in zip(replay_before[k],replay_after[k]))
def fmt_status(s):
    return s

rows = {
 "S3-01": ("未改寿命参数；修正 era-sweep 出生档案采样时点",
   f"原脚本 1949 e0={era_before_raw['rows'][0]['engine_e0']}；同快照正确采样={era_before_corrected['rows'][0]['engine_e0']} 岁",
   f"1949 e0={era_after['rows'][0]['engine_e0']}；e25={era_after['rows'][0]['engine_e25']} 岁；时期寿命不可直接当出生队列寿命",
   "era1949_0..23@1949/past", "no", "WITHDRAWN", "原高寿命结论由探针读取终局 profile 造成；原断言拿时期寿命对出生队列，口径不成立。"),
 "S3-02": ("未改寿命曲线；纠正 e(25) 的统计定义",
   f"原表 e0/e25={era_before_raw['rows'][0]['engine_e0']}/{era_before_raw['rows'][0]['engine_e25']}；快照出生采样={era_before_corrected['rows'][0]['engine_e0']}/{era_before_corrected['rows'][0]['engine_e25']}",
   f"出生采样 e0/e25={era_after['rows'][0]['engine_e0']}/{era_after['rows'][0]['engine_e25']}；条件生存者预期死亡年龄高于出生时预期是合理的",
   "era1949_0..23@1949/past", "no", "WITHDRAWN", "要求 e0−e25≥2 的验收式方向反了；不能据此改模型。"),
 "S3-03": ("app/career.js retireWithContributions；退休生效年月和再就业重置",
   "st613 男，1952 生，2015 年 63 岁退休；适用旧规则 60 岁",
   "st613 2012 年 60 岁退休；以退休当年年月取旧规则；重跑法定岗位超规则计数见阶段轴",
   "st613@1952/past", "yes", "FIXED", "同一 seed 的旧制迟退休阳性对照消失；非大陆及自雇另列，不套大陆法定职工年龄。"),
 "S3-04": ("app/career.js retireWithContributions；按女职工原类别取年龄",
   "st93 女，1997 生，2061 年 64 岁退休；原类别法定 55 岁",
   "st93 2052 年 55 岁退休；female50/55 在样本中分列",
   "st93@1997/past", "yes", "FIXED", "同一 seed 的超法定+3 岁阳性对照消失；不得把非职工退休最大年龄当违规。"),
 "S3-05": ("app/career.js acceptCareer 清理旧退休标志；stage-collect2 增加逐年缴费断言",
   f"st70 缴费 78 年；40k 全体最高 {max(maxval(before,'contribYears|past|M') or 0,maxval(before,'contribYears|past|F') or 0)} 年",
   "st70 本轮路径未就业，缴费 0；st3260 再就业后按新岗位再退休，缴费 38 年；40k 缴费最大 48 年、法定岗位超实际就业—退休跨度 0 例",
   "st70@1970/past；st3260@2026/now", "yes", "PARTIAL", "st70 消失伴随整局路径改变，不能作因果修复阳性；另以 st3260 证实旧退休状态导致的再就业累计问题已处理。"),
 "S3-06": ("app/engine.js child 抉择频率及年代家庭规模上限",
   f"40k：1950s 子女均值 {mean(before,'kidsByDec|1950')}，2020s {mean(before,'kidsByDec|2020')}",
   f"40k：1950s {mean(after,'kidsByDec|1950')}，2020s {mean(after,'kidsByDec|2020')}；方向已反转",
   "st0..39999；era1949_0..23", "yes", "DIRECTIONAL", "粗出生率不是队列终生子女数；儿童死亡、婚育年龄一手分层数据仍缺，不能宣称已校准。"),
 "S3-07": ("app/engine.js marriage/marriage-crisis/familyYear；marriageHistory、status、结束原因",
   f"6000 局婚姻次数直方图 {mar_before['marriageCountHistogram']}；无离婚/丧偶类型字段",
   f"6000 局直方图 {mar_after['marriageCountHistogram']}；现有婚姻史类型与配偶生死、离婚抉择",
   "st0..5999", "yes", "FIXED", "结构字段已补；年度登记对数不能直接检验终生再婚率。"),
 "S3-08": ("app/engine.js 死因抽样按死亡年龄与日历年代加权；stage-collect2 分死亡年代",
   "旧抽样五类慢病近似均匀（旧阶段轴显示）；原死亡年代分层计数缺失",
   f"40k 现有死亡年代分层 {len(after.get('causeShareByDeathEraPct',{}))} 个年龄×日历桶；逐桶占比见 stage-engine.json",
   "st0..39999", "yes", "DIRECTIONAL", "结构上不再均匀抽签；CAUSE-OF-DEATH 是 C 级，仅能作方向性观察。"),
 "S3-09": ("app/economy.js 养老金固定购买力逐年调整；st1201 逐年轨迹复核",
   "st1201 退休前净资产已为 0，故清零断言不成立；旧版 50–58 岁收入恒 8463 元",
   "st1201 未出现正净资产无支出归零；养老金按模型年调 1%（固定 2025 元）",
   "st1201@1955/past", "no", "PARTIAL", "只证实养老金恒定子项；净资产清零没有阳性对照，不能报已修好。"),
 "S3-10": ("stage-collect2 改用去重的人生队列学历率；未据错误分母调高教参数",
   "旧表学历记录占比 15.08%，与普查存量 15.467% 接近；所谓 66.4% 非同口径",
   f"按活到18岁的游戏队列：1950s 大专及以上 {pp(mean(after,'tertiaryAttainedByDec|1950'))}；2000s {pp(mean(after,'tertiaryAttainedByDec|2000'))}",
   "st0..39999", "no", "NOT OBSERVABLE", "记录占比、游戏出生队列和人口普查存量不是同一分母；不能凭此宣称已修正高教率。"),
 "S3-11": ("app/engine.js 入学年龄/小学学制变动；app/education.js 历史初中退出分支",
   "主线小学 12、初中 15 岁，完成率近 100%，无模拟退出",
   f"小学毕业 12/13 岁等；活到18岁的 1950s 初中取得率 {pp(mean(after,'juniorAttainedByDec|1950'))}、2000s {pp(mean(after,'juniorAttainedByDec|2000'))}",
   "st0..39999", "yes", "DIRECTIONAL", "模型已有方差；游戏出生队列不能直接与 2024 在校生巩固率 95.9% 作等值校验。"),
 "L10K-01": ("app/history-runtime.js 事件标题模板",
   "w0 动词标题硬接「发生了」8 处",
   "w0 同类病句 0 处",
   "w0@1950/past", "yes", "FIXED", "同 seed 阳性对照；标题保留动词后直接成句。"),
 "L10K-02": ("未改地区闸门；replay-seeds 用事件发生地而非终局现居地复核",
   "审计称 w120 错区；按事件时 historicalLocationId 核查为 0 条",
   "w120 同口径仍为 0 条；已有 regions 过滤",
   "w120@1950/past", "no", "NOT OBSERVABLE", "基线与复核口径不一致；没有阳性对照，不报告已修复。"),
 "L10K-03": ("app/career.js employmentAllowed；到退休年龄不再新增常规职工岗",
   "w13 65 岁 vocational-teacher；w38 59 岁 retail；w50 57 岁 fishery",
   "三 seed 上上述超龄常规岗均不再出现；w13 的 64 岁 repair-shop 为自雇类，不按法定职工退休年龄排除",
   "w13/w38/w50@2026/now", "yes", "FIXED", "职工岗阳性对照；自雇与返聘需单独定义，不能一刀切禁业。"),
 "L10K-04": ("未给自雇补法定退休年龄；retirementRule 调用只在适用岗位判",
   "w0/w13/w19/w22 的空规则主要对应 self-employed 或未退休状态",
   "同 seed 仍有非职工不适用；法定职工另有规则，例 st613 60 岁",
   "w0@1950/past；w13/w19/w22@2026/now", "no", "NOT OBSERVABLE", "把自雇无强制年龄判成规则缺失是类别错误；需要带 reason 的 API 优化另列未解决。"),
 "L10K-05": ("app/engine.js generateCompanions 子女取名去重",
   "w54/w67/w102/w108 各有 1 个子女与亲属同名/同名",
   "四个同 seed 不再重名",
   "w54@1985/past；w67@2026/now；w102@2000/past；w108@1961/past", "yes", "FIXED", "按姓名与名同时比较；同 seed 的 4 个阳性全部消失。"),
 "L10K-06": ("未凭主观上限裁剪资产；仅在 stage-collect2 记录同币值比值",
   f"w4/w5/w9/w13 净资产/典型年收入={','.join(str(ratio(x)) for x in replay_before['L10K-06'])}",
   f"相同 seed={','.join(str(ratio(x)) for x in replay_after['L10K-06'])}；高尾仍在",
   "w4/w5/w9/w13@2026/now", "yes", "UNRESOLVED", "仅引擎自报同币值比值，没有同人/户、同年龄、同收入定义的官方硬阈值；不任意改经济模型。"),
 "L10K-07": ("app/family-model.js 早期出生队列已有兄弟姐妹权重",
   "w156/w180/w216/w288 的出生时 siblings 均 0",
   "相同四 seed：w216 变为 1；其余仍为 0；当前字段是出生时已有手足，不等于终生独生",
   "w156@1972/past；w180@1950/past；w216@1972/past；w288@1961/past", "yes", "DIRECTIONAL", "只作方向性调低；旧断言把出生时已有手足误读为终生独生，无可靠同口径基线。"),
 "L10K-08": ("app/engine.js move 抉择按显示名去重",
   "w664/w4184/w8787/w11835 各有 1 次同屏重名",
   "四个同 seed 各 0 次重名",
   "w664/w4184/w8787/w11835@2026/now", "yes", "FIXED", "同 seed 4 个阳性全部消失。"),
 "L10K-09": ("未改 data/history.js 郑州条目；按 zhCN 真正字形检查",
   "给定四个 seed 的郑州 zhCN 无繁体专属字形；先前命中的是病句模板",
   "四 seed 繁体专属字形仍 0；模板病句修正另见 L10K-01",
   "w1686@1972/past；w2190@1950/past；w3414@1985/past；w13026@1972/past", "no", "NOT OBSERVABLE", "缺旧版字形阳性对照，不能把模板变好说成简繁混排修复。"),
 "L10K-10": ("app/education.js enroll/finishEducation；app/economy.js adultstudy 可用年龄；app/engine.js 在职结业上限",
   "w7 本科39（45 岁门限内）、w12 硕士63、w21 本科63、w24 本科55；附加 w38 本科63",
   "上述 seed 均无 45 岁后首次取得高等学历；w7 的 39 岁取得并非本轮门限违规，变化不能单算修复证据",
   "w7@2026/now；w12@2000/past；w21@2026/now；w24@1985/past；w38@2026/now", "yes", "FIXED", "保留 45 岁内在职提升；63/55 岁阳性 seed 消失，新增路径 w38 已二次修正并重跑。"),
 "L10K-11": ("未改 canConceive；重查 birthYear−本人 birthYear",
   "报告称 10 万局 22 例；给定 w4854/w9024/w12892/w17274 四 seed 实际均 0",
   "同四 seed 仍 0；原门禁 1.5 万局亦 0",
   "w4854@1985/past；w9024@1985/past；w12892@2026/now；w17274@1985/past", "no", "QUARANTINED", "阳性对照失败；要提供原命中 22 例的日志结构与 seed 才能定位。"),
 "L10K-12": ("未改初婚年龄闸门；按 marriageCount 与 prior partner 分流",
   "新口径基线 0；无可复现单局 seed",
   "仍无非零阳性基线；不能声称通过",
   "审计未提供 seed", "no", "WITHDRAWN", "保持撤回，待可证伪断言和命中样本。"),
 "C1": ("app/history-runtime.js 同 L10K-01 文案模板",
   "cf0 六条示例中动词标题硬接「发生了」",
   "cf0 对应病句 0，事件以自然语序成句",
   "cf0@1950/past", "yes", "FIXED", "同 seed 原句与新句对照；C1 与 L10K-01 是同根问题。"),
 "C3": ("app/data/history.js、china-society.js、app/economy.js、career.js、education.js 玩家文案",
   "cf0 六个抽样内部术语合计 28 次",
   "cf0 六个抽样术语 0 次；未扫完审计 1200 万文本字段",
   "cf0@1950/past", "yes", "PARTIAL", "覆盖给定阳性样本；其他 1438 种去重文本尚未全量人工审读。"),
 "C4": ("未修改职业 minYear；按引擎自身职业出现年复核",
   "审计已复核真违规 0",
   "给定 cf430/cf9420 仍无越过自身 minYear 的职位",
   "cf430/cf9420", "no", "WITHDRAWN", "原告警来自手写出现年表，非引擎自证；不改已通过部分。"),
 "C6": ("未改金额格式；复核检测器误把年月、年份标题判作金额",
   "cf0 的示例为「1953 · 第一个五年计划…」等非金额句",
   "同 seed 无可独立确认的金额/量词错误；数值格式问题需提供真阳性",
   "cf0@1950/past", "no", "NOT OBSERVABLE", "不能凭误报改币值或量词；保留具体真阳性收集任务。"),
 "C7": ("app/education.js edu-college option label 加统一动词",
   "cf2 同屏 4 个裸学校名 + 2 个完整动作句",
   "cf2 六项均以动作短语开头",
   "cf2@2026/now", "yes", "FIXED", "同 seed 的文风阳性对照消失。"),
 "C8": ("未改亲属称谓系统",
   "20k 审计样本同局混用 0",
   "无正样本，不能报告修复",
   "cf0..19999", "no", "WITHDRAWN", "基线命中 0；维持观察。"),
 "S3-12": ("scripts/decision-inventory.mjs、decision-review.mjs；输出逐选项表",
   "原 28 类只清点出现年龄与选项数，未逐项评价",
   f"4000 局观测 {len(inventory['actions'])} 类（原 28 类全覆盖 + 新增 marriage-crisis）；129 个 action×optionId，{len(inventory['rows'])} 个动态标签变体",
   "choice0..3999", "no", "ANALYSED", "逐项判定在 DECISION-OPTION-REVIEW.md；本条是分析交付，不冒充旧缺陷已修。"),
 "S3-13": ("stage-collect2 增加 sex 分层死亡年龄均值",
   "旧表男女差为 null，测量管道故障",
   f"past 女均值 {mean(after,'deathAge|past|F')}、男 {mean(after,'deathAge|past|M')}，差 {round(mean(after,'deathAge|past|F')-mean(after,'deathAge|past|M'),3)} 岁",
   "st0..39999", "no", "MEASURED", "这是完整模拟人生的终局年龄差，非官方某年的时期寿命差。"),
 "S3-B1": ("app/data/development.js 注释标记模型儿童风险",
   "1949–1977 逐年一手儿童死亡率缺失",
   "选择处置 (b)：待核／方向性校准；不宣称已对齐官方逐年表",
   "era1949_0..23", "no", "BLOCKED", "未补造官方表。"),
 "S3-B2": ("app/family-model.js 注释标记初婚年龄",
   "全国逐年初婚年龄一手序列缺失",
   "选择处置 (b)：待核／方向性校准",
   "st0..5999", "no", "BLOCKED", "不以年度登记量替代终生年龄分布。"),
 "S3-B3": ("app/family-model.js、app/data/development.js 注释标记分年龄率",
   "分年龄死亡率与生育率一手表未入册",
   "选择处置 (b)：待核／方向性校准",
   "st0..39999", "no", "BLOCKED", "年龄权重是模型假设。"),
 "S3-B4": ("app/data/money-basis.js 注释标记币值",
   "1949–2025 CPI 定基逐年序列缺失",
   "选择处置 (b)：固定 2025 购买力模型值，待核／方向性校准",
   "era1949_0..23", "no", "BLOCKED", "不拿固定模型元直接与历史名义元比较。"),
 "S3-B5": ("app/data/development.js 注释标记城镇率",
   "仅 2024 城镇率锚点在册；逐年完整序列缺失",
   "选择处置 (b)：城镇路径是插值模型，待核／方向性校准",
   "st0..39999", "no", "BLOCKED", "出生地抽样与常住人口比率也不同口径。"),
 "S3-B6": ("app/data/admission-policy.js 注释标记高教规模",
   "高教毛入学率/成人教育规模一手页面抓取失败",
   "选择处置 (b)：录取概率与继续教育规模待核／方向性校准",
   "choice0..3999", "no", "BLOCKED", "未将 C 级来源升级为硬基线。"),
}

assert len(queue) == 37 and len(rows) == 37
missing = set(x["id"] for x in queue) - rows.keys()
assert not missing, missing
lines = ["# 37 项审计工单 · 一次性交付记录", "",
 "## 复跑口径与新旧 STATS", "",
 "改前原包三个必需产物已在首次改代码前归档至 `out/before/`；原构建 SHA-256 为 `f703243ce9662d669e7e5f020dae22ff1e190489794c07d6752f3a1537a6721c`。",
 "最终引擎使用 `current-engine.mjs` 装载当前源模块；样本种子与原包相同。原报告与新报告的行结构不同，PASS/FAIL 数量不构成直接质量分数。", "",
 "| 项 | 改前 | 改后 |", "|---|---|---|",
 f"| STATS | `{json.dumps(old_stats,ensure_ascii=False)}` | `{json.dumps(new_stats,ensure_ascii=False)}` |",
 f"| 原始 1949 e0/e25 | {era_before_raw['rows'][0]['engine_e0']}/{era_before_raw['rows'][0]['engine_e25']}（旧探针误取终局） | {era_after['rows'][0]['engine_e0']}/{era_after['rows'][0]['engine_e25']}（出生时） |",
 f"| 同快照纠正后 1949 e0/e25 | {era_before_corrected['rows'][0]['engine_e0']}/{era_before_corrected['rows'][0]['engine_e25']} | 同左模型，来源探针纠正 |", "",
 f"婚姻探针同样纠正：原始 before 的 `marriedPct={mar_before['marriedPct']}%` 把已故伴侣也当当前在婚；同快照纠正为 {mar_before_corrected['marriedPct']}%，改后为 {mar_after['marriedPct']}%。原始文件保持不变，纠正后的旧版结果另存 `out/before-corrected-marriage.json`。", "",
 "阳性对照包括 st613 男性旧制退休 63→60 岁、st93 女性退休 64→55 岁、w0 病句 8→0、四个子女同名 seed 4→0、四个迁居重名 seed 4→0。以下每项都写明改前在所列 seed 是否真命中，`no` 的条目一律不作“已修好”结论。", "",
 "## 逐项 6 字段记录", ""]
for item in queue:
    id_ = item["id"]
    changed, old, new, seed, positive, state, note = rows[id_]
    baseline = item.get("official_baseline") or {}
    sid, tier = baseline.get("id"), baseline.get("tier")
    if sid and registry.get(sid) != tier:
        raise ValueError(f"unregistered or mismatched source: {id_} {sid}/{tier}")
    source = f"`{sid}` · {tier} 级" if sid else ("无在册来源 id · C 级数据缺口" if tier=="C" else "无外部基线 · 引擎内部/文案判据")
    if tier == "C" and state=="FIXED":
        raise ValueError(f"C-tier cannot be verified: {id_}")
    if positive=="no" and state=="FIXED":
        raise ValueError(f"zero positive control cannot be FIXED: {id_}")
    lines += [f"### {id_} · {item['title']}", "",
              f"- 状态：**{fmt_status(state)}**。{note}",
              f"- 改了哪个函数/表：{changed}",
              f"- 改前实测值：{old}",
              f"- 改后实测值：{new}",
              f"- 复现 seed：`{seed}`",
              f"- 该 seed 上改前是否真的复现出问题（yes/no）：**{positive}**",
              f"- 引用的官方基线 id + 分级：{source}", ""]
(ROOT/"PATCH-NOTES.md").write_text("\n".join(lines).rstrip()+"\n")
print(f"wrote PATCH-NOTES.md: {len(queue)} items, before {old_stats['stageRows']}, after {new_stats['stageRows']}")
