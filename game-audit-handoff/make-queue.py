# make-queue.py — 生成一次性跑完的工单 WORK-QUEUE.json + DELIVERY-CONTRACT.md
import json, io, os, shutil, subprocess

def item(i, title, source, stage, sev, fix, measured, baseline, acceptance,
         must_fix=True, blocked=False, seed=None, note=None):
    d = dict(id=i, title=title, source=source, stage=stage, severity=sev,
             fix_class=fix, must_fix_in_one_pass=must_fix,
             measured_baseline_value=measured, official_baseline=baseline,
             acceptance_assertions=acceptance,
             blocked_by_missing_official_data=blocked)
    if seed: d['repro_seed'] = seed
    if note: d['note'] = note
    return d

NA = dict(id=None, tier=None, facts='引擎内部自洽性缺陷，不需要外部官方基线')
E = []

E.append(item('S3-01', '出生预期寿命整段偏高 9-14 岁', 'LIFE-STAGE-REVIEW §1.1 / out/life-stage.md 阶段6', '老年/死亡', 'FAIL', 'engine-data',
  {'引擎自报 e0': {'1949队列': 77.25, '2015队列': 82.02, '1950-1970队列中位': 79.28},
   '官方': {'1981': 67.77, '1990': 68.55, '2000': 71.40, '2010': 74.83, '2020': 77.93}},
  dict(id='LE-YEARBOOK', tier='B', facts='统计年鉴读图，另有 2024=79.0 / 2025=79.25（卫健委）'),
  ['逐年扫描后 1950-1970 出生队列 engine_e0 中位必须落入官方同年代 ±3 岁（双侧，不许只降不升）',
   '1949 队列 e0 不得高于 67.77+3',
   '2026 出生队列 UI「模型参考寿命」不得高于 79.0+3'], seed='era<birthYear>_<0..23>'))

E.append(item('S3-02', 'e(25) 与 e(0) 几乎相等，幼年死亡风险不进入寿命期望', 'LIFE-STAGE-REVIEW §1.2', '老年/死亡', 'FAIL', 'engine-logic',
  {'e0 减 e25': '各出生年均 < 1 岁（1949: 77.25 vs 76.60；2013: 79.51 vs 79.69）',
   '引擎自报儿童死亡率 1950s 均值': '86.35‰'}, NA,
  ['若仍给高儿童死亡率，则 1950 年代 e(0)−e(25) 必须为正且 ≥ 2 岁',
   '若要差值≈0，则必须同时把高年代儿童死亡率降到接近 0，二者不可并存']))

E.append(item('S3-03', '1949-1957 出生队列男性已给 63-65 岁退休', 'LIFE-STAGE-REVIEW §1.3', '退休', 'FAIL', 'engine-rule',
  {'retireAge_past_M': {'p50': 63, 'min': 60, 'max': 71}},
  dict(id='LAW-RETIRE-2024', tier='A', facts='2025-01-01 起男 60→63（每4个月延1个月），弹性±3 年；此前国发〔1978〕104 号 60 岁'),
  ['退休年 < 2025 的男性退休年龄必须 = 60（特殊工种提前档需给出依据字段）',
   '2025 ≤ 退休年 < 2040 的男性，退休年龄必须落在 [legalCap(year)−3, legalCap(year)+3]',
   '任何 life 退休年龄不得超过 legalCap(退休年)+3']))

E.append(item('S3-04', '女性退休最高 71 岁，超过任何一档法定+弹性上限', 'LIFE-STAGE-REVIEW §1.3', '退休', 'FAIL', 'engine-rule',
  {'retireAge_past_F': {'p50': 57, 'min': 50, 'max': 71}},
  dict(id='LAW-RETIRE-2024', tier='A', facts='原55→58（每4个月延1个月）；原50→55（每2个月延1个月）'),
  ['引擎必须先给每个女 life 定档并在 retirementRule.category 输出依据',
   '任何女 life 退休年龄不得超过 61 岁（58+3），max=71 必须消失']))

E.append(item('S3-05', '终身缴费年数最高 87 年（物理上限 47 年）', 'LIFE-STAGE-REVIEW 阶段6', '退休', 'FAIL', 'engine-count',
  {'max_contributionYears': 87, '物理上限': '16 岁就业 → 63 岁退休 = 47 年'},
  dict(id='LAW-MIN-AGE-WORK', tier='B', facts='第十五条 16 岁最低就业年龄；配合 LAW-RETIRE-2024 最低缴费年限 15→20 年'),
  ['contributionYears 必须以首次就业年为下界、退休年为上界重算',
   '任何 life 满足 0 ≤ contributionYears ≤ 退休年 − max(16, 首次就业年龄)',
   '2030 年起退休者需另判最低缴费年限（每年 +6 个月至 20 年）']))

E.append(item('S3-06', '最该生育的年代反而不生育', 'LIFE-STAGE-REVIEW §1.4', '生育', 'FAIL', 'engine-data',
  {'kidsByDec_mean': {'1940': 0.188, '1950': 0.5}, '1949队列无子女率': 87.5, 'kids_past_M_mean': 0.552},
  dict(id='BIRTHRATE-SERIES', tier='B', facts='粗出生率 1980 18.21‰ / 1990 21.06‰ / 2023 6.39‰'),
  ['1940s/1950s 出生队列平均子女数必须高于 2010s/2020s 队列（方向正确）',
   '1950s 队列无子女率不得高于 2020s 队列',
   '男性侧同样统计，修复不得只按女性侧计']))

E.append(item('S3-07', '婚姻无法区分初婚/丧偶再婚/离异再婚，离婚与丧偶字段不存在', 'LIFE-STAGE-REVIEW §1.5', '婚恋', 'FAIL', 'engine-structure',
  {'divorced/widowed/离异/分居/丧偶 全文命中': 0,
   'family_keys': ['mother', 'father', 'partner', 'children', 'siblings'],
   'marriageCount': {'1': 4963, '2': 20, 'none': 1017},
   '再婚年龄p50': 26, '初婚年龄p50': 28, '已婚率pct': 81.07, '伴侣出现率pct': 85.32},
  dict(id='MARRIAGE-2024', tier='B', facts='2024 结婚 610.6 万对 / 离婚 262.1 万对（离结比 42.9%）'),
  ['必须新增：婚姻性质枚举（初婚/丧偶再婚/离异再婚）、配偶 alive 与死亡年、离婚事件与年份',
   '再婚者年龄必须 ≥ 前一段婚姻结束时年龄（现在 26 < 28，不可能）',
   '有婚史者中再婚占比不得仍停在 0.41%，或给出与官方离结比同量级的解释']))

E.append(item('S3-08', '死因构成等同均匀抽签，不随年代与年龄变化', 'LIFE-STAGE-REVIEW §1.6', '老年/死亡', 'FAIL', 'engine-data',
  {'past_75p': {'衰老相关疾病': 20.06, '呼吸系统疾病': 19.63, '癌症': 20.08, '脑血管疾病': 20.05, '心血管疾病': 20.19},
   'past_60_74 极差': '19.31-20.70', 'now_75p 极差': '19.66-20.42',
   'past_45_59 只有三类': {'意外事故': 32.52, '急性疾病': 36.5, '心血管疾病': 30.98}},
  dict(id='CAUSE-OF-DEATH', tier='C', facts='二手转引：慢性病占总死亡 88.5%、心血管病城市 45.86%'),
  ['同一死因在各年龄组间占比极差必须 > 10pp（现在 < 1.5pp）',
   'past 与 now 同年龄组占比必须可区分',
   '因基线为 C 级，本条只要求「有年代/年龄差异」，不得声称已达官方占比']))

E.append(item('S3-09', '退休当年净资产被清零，养老金连续 8 年零调整', 'LIFE-STAGE-REVIEW 个案', '中年/资产', 'FAIL', 'engine-logic',
  {'st1201': '女/1955/安徽广德/urban：55 岁起 netWorth=0 持续至 62 岁死亡；income 恒为 8463（55-62 岁）',
   '同局其他矛盾': '18 岁同年完成高中并入职国有企业生产工人，无高考分支；自报寿命 79.669 却 62 岁死于癌症'}, NA,
  ['退休年之后 netWorth 不得由正直接变 0 并恒定（除非有明确支出/转移事件记录）',
   '养老金必须逐年变化（至少跟得上引擎自报 CPI 或工资增长），连续 3 年完全相等即判失败'], seed='st1201'))

E.append(item('S3-10', '大专及以上学历记录占比高出普查一个量级', 'LIFE-STAGE-REVIEW 阶段2', '上学', 'FAIL', 'engine-data',
  {'引擎大专及以上记录占比': '66.4%', '普查每10万人大学文化程度': 15467},
  dict(id='CENSUS7-EDU', tier='A', facts='每10万人大学文化程度 2020=15467 / 2010=8930；15岁及以上平均受教育年限 9.91 年'),
  ['按出生年代分层后，大专及以上占比须从低到高，1950s/1960s 队列显著低于 2000s 队列',
   '交付报告须先写明口径差异（学历获得人次 vs 2020 人口存量）再给新数']))

E.append(item('S3-11', '九年义务教育零方差且不存在未完成初中者', 'LIFE-STAGE-REVIEW 阶段2', '上学', 'FAIL', 'engine-data',
  {'小学完成': 'min=max=12', '初中完成': 'min=max=15', '未完成初中人群': 0},
  dict(id='EDU-2024', tier='A', facts='2024 九年义务教育巩固率 95.9%'),
  ['初中完成率不得为 100%，且随出生年代变化（1980 年前应远低于 95.9%）',
   '小学完成年龄必须出现 11/13/14 岁等方差（晚入学、留级、辍学）',
   '入学年龄只允许 6 或 7 周岁'],
  note='免学费杂费条款属 2006 修订文本（2006-09-01 施行）；1986 年前收 39/34 元不算缺陷，不得顺手改'))

LK = [('L10K-01', '历史事件文案把标题当名词硬接「发生了」，标题自带动词时生成病句', '文案'),
      ('L10K-02', '大陆专属历史事件在台湾及部分港澳人生里播出，违反事件表自己的 regions 字段', '事件'),
      ('L10K-03', '超过法定退休年龄后仍会「开始新工作」，与引擎自己的退休规则矛盾', '就业/退休'),
      ('L10K-04', '大陆人嘴里 retirementRule 经常给不出可用退休年龄', '退休'),
      ('L10K-05', '孩子的名字直接复制父/母的「名」，甚至与母亲全名完全相同', '姓名'),
      ('L10K-06', '终局净资产中位数已达年收入 7.6 倍、p95 约 168 倍，偏离常识区间', '资产'),
      ('L10K-07', '1980 年以前出生的人约 1% 完全没有兄弟姐妹', '家庭构成'),
      ('L10K-08', '「搬去哪里」抉择候选城市出现完全重复的选项', '抉择选项'),
      ('L10K-09', '个别历史事件 zhCN 文案里混入繁体字形', '文案'),
      ('L10K-10', '39-63 岁才「首次获得」本科/硕士学历（产品方口径：属时序缺陷）', '上学')]
for i, t, stg in LK:
    E.append(item(i, t, 'FIX-BRIEF.md §2（10 万局审计）', stg, 'FAIL', 'engine-fix',
      dict(see='FIX-BRIEF.md 对应小节，含 evidence 与 replaySeeds'), NA,
      ['先在 defects.json 该条 replaySeeds 上复现原现象，再修，再在同一 seed 上断言消失（阳性对照）']))

E.append(item('L10K-11', '女性玩家本人 49 岁以上仍会生育（男性已按口径排除）', 'FIX-BRIEF.md §2 / §4', '生育', 'QUARANTINED', 'blocked-probe',
  {'现象': '10 万局审计命中 22 例，1.5 万局门禁命中 0 例，口径分歧未定位'}, NA,
  ['先定位两侧探针为何分歧（种子空间？队列权重？状态字段读取时机？），未定位前不得改游戏代码',
   '定位后在命中 22 例的那批 seed 上复现，再修，再断言消失'], must_fix=False, blocked=True))
E.append(item('L10K-12', '无配偶史的人生仍会出现 70+ 岁「初婚」', 'FIX-BRIEF.md §2', '婚恋', 'WITHDRAWN', 'unfalsifiable',
  {'现状': '新口径下基线命中为 0，断言不可证伪'}, NA,
  ['本条不得报绿：要么重设可证伪断言（给出非零基线），要么保持现状并在交付中说明为何不可测'], must_fix=False))

for cid, ct in [('C1', '动词性事件标题硬接「发生了」（病句）'), ('C3', '出戏的内部术语漏进玩家文案'),
                ('C4', '年代穿帮（已按引擎自己的 job.minYear 复核）'), ('C6', '金额/量词格式混用'),
                ('C7', '同屏选项文风混搭（整句与裸名词并存）'), ('C8', '亲属称谓同局混用（语域一致性）')]:
    E.append(item(cid, ct, 'FIX-BRIEF.md §2b 文案语感专项', '文案', 'WARN', 'engine-copy',
      dict(see='FIX-BRIEF.md §2b，含原句记录与改写稿'),
      dict(id=None, tier=None, facts='语感项，无官方基线'),
      ['按 §2b 改写稿逐条对齐；本专项只改文案，不动代码结构']))

E.append(item('S3-12', '28 类抉择动作尚未逐选项判定是否符合中国人认知', 'LIFE-STAGE-REVIEW §5（审计方自认缺口）', '全部阶段', 'FAIL', 'audit-task',
  {'已清点数': 28, '已测': '出现年龄 + 选项数',
   '未测': '每个选项「一个中国人会不会这样选、该年龄/年代是否可能被提出」'},
  dict(id=None, tier=None, facts='无需官方数据，靠引擎文案 + 年代合理性判定'),
  ['输出 28 类动作 × 逐选项判定表（动作、选项、出现年龄区间、出现年代区间、判定、理由、建议改写）',
   '重点：financial(25)、culture(28)、career-offer(7)、edu-college(7)、edu-funding(5)、move(4)、marriage(3)'],
  note='不做完这条就不得声称「抉择侧已全面验证」'))

E.append(item('S3-13', '男女死亡年龄差异本轮未测量（旧表体故障）', 'stage-compare.md 旧版', '老年/死亡', 'WARN', 'audit-task',
  {'现状': '旧表该行输出 null，属测量管道故障，不是结论'},
  dict(id='LE-YEARBOOK', tier='B', facts='1981 男 66.28/女 69.27（差 2.99）；2020 男 75.37/女 80.88（差 5.51）'),
  ['重测男女死亡年龄中位差并与官方性别差比对（官方长期女>男；引擎若相反或差值≈0 即为缺陷）']))

for bid, t, stg in [('S3-B1', '历史婴儿/儿童死亡率无法逐年对齐（官方无 1949-1977 一手序列）', '生育/死亡'),
                    ('S3-B2', '初婚年龄逐年基线不存在（官方无逐年全国序列）', '婚恋'),
                    ('S3-B3', '分年龄死亡率/分年龄生育率一手表未取到', '生育/死亡'),
                    ('S3-B4', 'CPI 定基逐年序列缺失，无法完成 1949→2025 平减', '收入跨年比较'),
                    ('S3-B5', '城镇人口比重逐年序列未取到（仅 2024=67.00% 为 A 级）', '迁徙'),
                    ('S3-B6', '高等教育毛入学率/成人教育规模页面抓取失败（404/超时）', '上学')]:
    E.append(item(bid, t, 'DATA-SOURCES.md §7.4 缺口清单', stg, 'BLOCKED', 'await-official-data',
      dict(reason='官方一手数据本轮未取到，或官方从未发布'),
      dict(id=None, tier='C', facts='C 级：不得写成已核实'),
      ['禁止以「已修好」交付。只能选其一：(a) 自己取到一手页，把 URL + 抓取方式 + 日期补进 official-baselines.json；(b) 在代码注释与交付报告中标为「待核/方向性校准」'],
      must_fix=False, blocked=True))

counts = {}
for e in E:
    counts[e['severity']] = counts.get(e['severity'], 0) + 1
q = dict(meta=dict(version='v3-one-pass',
                   engine_sha256='f703243ce9662d669e7e5f020dae22ff1e190489794c07d6752f3a1537a6721c',
                   engine_bytes=1454475,
                   generated_from=['LIFE-STAGE-REVIEW.md', 'out/life-stage.md', 'FIX-BRIEF.md', 'DATA-SOURCES.md §7'],
                   total_items=len(E), counts=counts,
                   must_fix_count=sum(1 for e in E if e['must_fix_in_one_pass']),
                   blocked_count=sum(1 for e in E if e['blocked_by_missing_official_data']),
                   one_pass_rule='一次交付必须覆盖全部 must_fix_in_one_pass=true 条目；BLOCKED/QUARANTINED/WITHDRAWN 条目必须逐条给出处置，不得静默丢失。',
                   no_green_rule='修前必须能在同一 seed 上复现问题；基线命中为 0 的断言不得报绿，只能报 NOT OBSERVABLE / WITHDRAWN。'),
          items=E)
json.dump(q, io.open('WORK-QUEUE.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

L = ['# 一次性交付契约（DELIVERY CONTRACT）', '',
     '你（游戏侧修复 AI）本轮要**一次跑完整条工单再交付**，不要分批回报。工单机器可读版：`WORK-QUEUE.json`（共 %d 条，必修 %d 条，被官方数据缺口卡住 %d 条）。' % (len(E), q['meta']['must_fix_count'], q['meta']['blocked_count']), '',
     '## 一次交付必须包含的 5 个产物', '',
     '1. `PATCH-NOTES.md`：逐条对应 `WORK-QUEUE.json` 的 id，每条填 6 个字段——`改了哪个函数/表` / `改前实测值` / `改后实测值` / `复现 seed` / `该 seed 上改前是否真的复现出问题（yes/no）` / `引用的官方基线 id + 分级`。',
     '2. 重跑后的 `out/life-stage.md`（用 `node scripts/life-stage.mjs` 生成，不许手改）与新旧 `STATS` 行对比。',
     '3. 重跑后的 `out/era-sweep.json` 与 `out/marriage-true.json`（命令见 `AGENTS.md`）。',
     '4. `S3-12` 的**28 类抉择动作 × 逐选项判定表**（此前审计方自认未完成，本轮必须补完）。',
     '5. `UNRESOLVED.md`：所有你判定为「不该改 / 改不动 / 数据缺失无法判」的条目与理由。', '',
     '## 判交不接受（任一条命中即视为未交付）', '',
     '- 任一 `must_fix_in_one_pass=true` 条目缺字段或缺改后实测值。',
     '- 报告「已修好」但在审计给出的 seed 上**改前无法复现**问题（即探针发盲）。',
     '- 断言的基线命中数为 0 却报 GREEN（必须改判 `NOT OBSERVABLE` 或 `WITHDRAWN`）。',
     '- 把 `official-baselines.json` 里 C 级条目写成「已核实」，或引用了不在册的来源 id。',
     '- 对 BLOCKED 条目（S3-B1~B6、L10K-11、L10K-12）静默跳过而不给 (a)/(b) 处置。',
     '- 用「全绿」作为结论却没有给出任一条断言的**阳性对照**（同 seed 改前能命中）。', '',
     '## 顺序建议（一条会话内跑完）', '',
     '1. 先跑一遍全部复现命令，把「改前」的 `life-stage.md` / `era-sweep.json` / `marriage-true.json` 存档（这是你的 before 基线）。',
     '2. S3-01 / S3-02 / S3-03 / S3-04 / S3-05（寿命曲线与退休，证据最强）。',
     '3. S3-06 / S3-07（生育方向、婚姻数据结构，需加字段）。',
     '4. S3-08 / S3-09（死因构成、退休清零与养老金恒定）。',
     '5. S3-10 / S3-11（教育结构与零方差）。',
     '6. L10K-01~10、C1~C8（工程与文案，逐条 seed 复现）。',
     '7. S3-12 / S3-13（抉择逐选项判定 + 男女死亡差，纯分析，不动代码）。',
     '8. 最后处理 BLOCKED/QUARANTINED/WITHDRAWN，逐条写处置。',
     '9. 重跑全部复现命令 → 生成 5 个产物 → 一次交付。', '',
     '## 不许顺手改的东西', '',
     '- `FIX-BRIEF.md §3 明确通过的部分` 不要动。',
     '- 义务教育免学费杂费的时代边界：条款出自 **2006 修订文本（2006-09-01 施行）**，1986 年前小学/初中收 39/34 元**不是缺陷**。',
     '- `preschool` 完成年龄恒为 0 岁是占位字段，不要据此新增「学前教育」逻辑。',
     '- 引擎币值是 `CNY-2025-model`（固定 2025 购买力）；改收入/资产数值前先确认你在哪个币值口径上。']
io.open('DELIVERY-CONTRACT.md', 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('items=%d counts=%s must_fix=%d blocked=%d' % (len(E), counts, q['meta']['must_fix_count'], q['meta']['blocked_count']))
