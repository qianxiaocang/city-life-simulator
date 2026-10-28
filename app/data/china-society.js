/**
 * Chinese family, work and consumption scenarios.
 * Names/rules are source-grounded; salaries, costs, probabilities and wellbeing
 * effects are explicitly game parameters, never national survey estimates.
 */
const T = (zhCN, zhTW, en) => ({ zhCN, zhTW, en });
export const CHINA_SOCIETY_SOURCES = [
  { id:'occupations-2022',title:'中华人民共和国职业分类大典（2022年版）发布说明',url:'https://chinajob.mohrss.gov.cn/h5/c/2022-10-08/361551.shtml',fact:'正式版职业数1639；本游戏仅选取部分职业，不冒充完整职业目录。' },
  { id:'qualifications-2021',title:'国家职业资格目录（2021年版）',url:'https://www.gov.cn/zhengce/zhengceku/2021-12/03/5655553/files/86876724c6ee4cdcb3d0be524aee036f.pdf',fact:'教师、医师、法律职业等有相应资格准入；并非所有岗位都要同一种考试。' },
  { id:'civil-service-law',title:'中华人民共和国公务员法（2018年修订）',url:'https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_6af2e9cf52224593b4dc15258bb34860.html',fact:'录用需公开考试、考察、资格审查等程序；年满十八周岁并符合职位要求。' },
  { id:'civil-service-2026',title:'中央机关及其直属机构2026年度考试录用公务员公告',url:'https://www.beijing.gov.cn/fuwu/bmfw/sy/jrts/tzxx/202510/t20251015_4224742.html',fact:'一般18至38周岁，2026年应届硕博士放宽至43周岁；公告一般学历为大专及以上，各具体职位另设要求。' },
  { id:'civil-exam-1994',title:'中央国家机关首次招考公务员',url:'https://www.12371.cn/2021/08/19/VIDE1629337082133758.shtml',fact:'1994年首次中央国家机关招考；此前已有试点，不能把历史干部任用等同于现代国考。' },
  { id:'public-recruitment-2006',title:'事业单位公开招聘人员暂行规定',url:'https://www.moe.gov.cn/jyb_xxgk/gk_gbgg/moe_0/moe_1133/moe_1237/tnull_17023.html',fact:'2006年1月1日起施行；公开招聘一般包括考试、考核等，不是拿到学历即保证编制。' },
  { id:'teacher-qualification-1995',title:'教师资格条例',url:'https://www.moe.gov.cn/jyb_sjzl/sjzl_zcfg/zcfg_jyxzfg/202204/t20220422_620496.html',fact:'1995年公布；专门从事教育教学工作应依法取得教师资格，具体认定路径并非一律只有笔试。' },
  { id:'family-education-2021',title:'中华人民共和国家庭教育促进法',url:'https://www.beijing.gov.cn/zhengce/zhengcefagui/qtwj/202305/t20230505_3087270.html',fact:'2022年施行，重视陪伴并尊重个体差异；不能将父母期待写成强制替孩子决定人生。' },
  { id:'elder-rights-2012',title:'中华人民共和国老年人权益保障法（2012年修订）',url:'https://www.gov.cn/zhengce/2012-12/28/content_2602283.htm',fact:'强调尊重、关心、照料老年人；赡养与照护可有不同家庭安排。' },
  { id:'spring-festival-unesco',title:'春节——中国人庆祝传统新年的社会实践',url:'https://ich.unesco.org/en/RL/spring-festival-social-practices-of-the-chinese-people-in-celebration-of-traditional-new-year-02126',fact:'2024年列入人类非物质文化遗产代表作名录；团圆、社区与代际传承是可用文化背景。' },
  { id:'spring-festival-china',title:'春节申遗成功，中国年与世界共享',url:'https://www.cq.gov.cn/ywdt/jrcq/202412/t20241208_13870992.html',fact:'中文政府资料说明春节的团圆、社区交往与代际传承；仅作情景背景，不推断人人遵循相同观念。' },
  { id:'spending-2025',title:'2025年居民收入和消费支出情况',url:'https://www.stats.gov.cn/sj/zxfb/202601/t20260119_1962321.html',fact:'食品烟酒29.3%、居住21.7%、教育文化娱乐11.8%；不能声称所有人或多数日常支出都用于买房。' },
  { id:'consumption-capital',title:'国民经济核算指标解释',url:'https://www.stats.gov.cn/sj/zbjs/202302/t20230202_1897108.html',fact:'消费与资本形成口径不同，购房不能直接等同于消费预算中的居住服务。' },
  { id:'housing-reform-1998',title:'关于进一步深化城镇住房制度改革加快住房建设的通知',url:'https://zjw.sh.gov.cn/wjhb/20180912/0011-30557.html',fact:'1998年下半年开始停止住房实物分配，逐步实行货币化；不等于此前无人买房。' },
  { id:'mortgage-1998',title:'个人住房贷款管理办法（1998年）',url:'https://www.pbc.gov.cn/zhengwugongkai/attachDir/2025/11/2025111818124023036.pdf',fact:'当时要求完全民事行为能力、稳定职业收入、还款能力与担保等；现代首付比例会随时间地区政策变动。' },
  { id:'capital-market-history',title:'中国资本市场发展报告摘要',url:'https://www.csrc.gov.cn/csrc/c100028/c1002839/1002839/files/《中国资本市场发展报告》摘要.pdf',fact:'1981年恢复国债发行，1990年沪深证券交易市场营业。' },
  { id:'funds-1998',title:'证券法对证券市场各主体的影响透析',url:'https://www.szse.cn/aboutus/research/secuities/documents/t20040106_531397.html',fact:'1998年金泰、开元是规范证券投资基金发展节点，并非中国历史上所有基金的最初出现。' },
  { id:'open-fund-2001',title:'华安基金公司发展历程',url:'https://huaan.com.cn/overview.shtml',fact:'2001年推出境内第一只开放式基金华安创新。' },
  { id:'mobile-phone-1987',title:'通信工具发展与1987年广州移动电话系统',url:'https://www.mva.gov.cn/sy/zt/jdbn/qhxzc/202106/t20210624_48292.html',fact:'1987年11月广州率先开通蜂窝模拟移动电话系统；游戏1987入口只表示早期机会，并不假定当时各城市均已覆盖。' },
  { id:'telecommunications-2010',title:'2010年全国电信业统计公报',url:'https://www.miit.gov.cn/gxsj/tjfx/txy/art/2020/art_55e8ca61f0f44b33bf832a5c748ee872.html',fact:'2010年移动电话普及率64.4部/百人、3G建设推进；智能手机2010入口属于时代模型而非首次发明或全面普及日期。' },
  { id:'taiwan-stock-1962',title:'台湾证券交易所历史',url:'https://www.twse.com.tw/en/about/company/history.html',fact:'台湾证券交易所1961年成立、1962年2月9日开业；只支持台湾股票入口时间，不支持其他投资门槛。' },
  { id:'hongkong-stock-history',title:'香港交易所及市场历史',url:'https://www.hkexgroup.com/about-hkex/about-hkex/history-of-hkex-and-its-market?sc_lang=en',fact:'香港正式证券市场可追溯至1891年、1947年战后交易所合并；游戏起始1950年已存在证券交易。' }
];
const sourceUrls = (...keys) => keys.map(key => CHINA_SOCIETY_SOURCES.find(x => x.id===key)?.url).filter(Boolean);
const O = (id,label,description,effects,autoWeight=1) => ({id,label,description,effects,autoWeight});
const C = (id,minAge,maxAge,title,description,options,keys,conditions={},extra={}) => ({
  id,minAge,maxAge,minYear:1950,title,description,options,conditions,
  sourceKeys:keys,sourceUrls:sourceUrls(...keys),modelKind:'fictional-choice-with-source-context',...extra
});
export const CULTURAL_EVENTS = [
  C('spring-reunion',16,90,
    T('今年春节，回家吗？','今年春節，回家嗎？','Home for the Spring Festival?'),
    T('家人盼着团圆，你也有自己的工作、路费和休息安排。团聚不只有一种方式。','家人盼著團圓，你也有自己的工作、路費和休息安排。團聚不只有一種方式。','Your family hopes to reunite, while work, travel costs and rest also matter. There is more than one way to stay close.'),
    [O('return',T('安排返乡团聚','安排返鄉團聚','Travel home'),T('付出时间与路费，和家人相处','付出時間與路費，和家人相處','Spend time and travel money to be together'),{relationships:4,happiness:3,moneyRatio:-.012},3),
     O('remote',T('协商错峰探望，先通话拜年','協商錯峰探望，先通話拜年','Call now and visit later'),T('按条件安排，不勉强赶路','按條件安排，不勉強趕路','Make a plan that fits your circumstances'),{relationships:2,happiness:1},3),
     O('rest',T('说明原因，留在当地休息','說明原因，留在當地休息','Explain and rest locally'),T('尊重自己的需要，也保持联络','尊重自己的需要，也保持聯絡','Respect your own needs and stay in touch'),{health:2,happiness:2,relationships:-.5},1)],
    ['spring-festival-unesco','spring-festival-china'],{hasLivingParent:true},{cooldownYears:4}),
  C('study-expectations',12,18,
    T('家人对成绩的期待','家人對成績的期待','Your family’s hopes for school'),
    T('家里谈起升学，希望你投入更多时间。你也想保留休息和自己的兴趣。','家裡談起升學，希望你投入更多時間。你也想保留休息和自己的興趣。','Your family hopes you will study more, while you want time for rest and interests.'),
    [O('study',T('商量一个更认真学习的计划','商量一個更認真學習的計畫','Agree on a study plan'),T('知识成长，但也需要照顾压力','知識成長，但也需要照顧壓力','Learn more while managing pressure'),{knowledge:3,happiness:-1,relationships:1},3),
     O('balance',T('一起讨论目标，保留运动与休息','一起討論目標，保留運動與休息','Discuss goals and keep time to rest'),T('用沟通找到自己的节奏','用溝通找到自己的節奏','Find a pace together'),{knowledge:1,relationships:2,health:1},3),
     O('interest',T('说明自己更想发展的方向','說明自己更想發展的方向','Explain your own interests'),T('自己的选择也值得被认真听见','自己的選擇也值得被認真聽見','Your preferences deserve to be heard'),{happiness:2,relationships:-1,knowledge:1},1)],
    ['family-education-2021'],{inSchool:true},{cooldownYears:5}),
  C('stable-career',20,38,
    T('家人眼中的稳定工作','家人眼中的穩定工作','What counts as a stable job?'),
    T('亲人提到教师、国企或公务员，希望你更安稳。招聘资格与考试仍要按当年的制度办理。','親人提到教師、國企或公務員，希望你更安穩。招聘資格與考試仍要按當年的制度辦理。','Relatives suggest teaching, a state enterprise or civil service. Qualifications and recruitment rules still apply.'),
    [O('prepare',T('了解要求，认真准备招聘或考试','了解要求，認真準備招聘或考試','Research the route and prepare'),T('只是准备机会，不保证录取','只是準備機會，不保證錄取','Preparation offers a chance, not a guaranteed post'),{knowledge:2,happiness:-1,careerExamPreparation:1},3),
     O('discuss',T('比较收入、兴趣与稳定性','比較收入、興趣與穩定性','Discuss stability, interests and pay'),T('由自己决定适合的方向','由自己決定適合的方向','Choose the path that suits you'),{relationships:2,happiness:1},3),
     O('ownpath',T('感谢关心，继续现有职业规划','感謝關心，繼續現有職涯規劃','Thank them and keep your own plan'),T('稳定并不只有一种职业形态','穩定並不只有一種職業形態','There is more than one kind of stability'),{happiness:2,relationships:-.5},2)],
    ['civil-service-law','public-recruitment-2006','teacher-qualification-1995'],{notInSchool:true},{minYear:1994,cooldownYears:8}),
  C('marriage-pressure',20,38,
    T('饭桌上的婚姻话题','飯桌上的婚姻話題','Marriage comes up at dinner'),
    T('有亲人问起你何时成家。这个问题带着关心，也可能让人有压力；婚姻应出于自己的意愿。','有親人問起你何時成家。這個問題帶著關心，也可能讓人有壓力；婚姻應出於自己的意願。','A relative asks when you will marry. It may feel caring or pressuring. Marriage remains your own choice.'),
    [O('meet',T('愿意认识合适的人','願意認識合適的人','Be open to meeting someone'),T('认识不等于承诺结婚','認識不等於承諾結婚','Meeting someone is not a promise to marry'),{relationships:2,happiness:1,openToDating:true},2),
     O('boundaries',T('温和说明自己的节奏','溫和說明自己的節奏','Explain your own pace'),T('表达边界，也保留关心','表達界線，也保留關心','Set boundaries while staying connected'),{happiness:2,relationships:1},3),
     O('decline',T('暂不考虑，请家人尊重','暫不考慮，請家人尊重','Say you are not considering it now'),T('不结婚不代表人生不完整','不結婚不代表人生不完整','A life can be whole without marriage'),{happiness:2,relationships:-1},1)],
    ['family-education-2021'],{unmarried:true},{cooldownYears:8}),
  C('parenthood-expectation',25,42,
    T('关于孩子，先谈谈彼此的想法','關於孩子，先談談彼此的想法','Talk about whether to have children'),
    T('长辈提起想抱孙辈。是否生育、何时生育，需要你与伴侣自愿商量，而不是由他人代替决定。','長輩提起想抱孫輩。是否生育、何時生育，需要你與伴侶自願商量，而不是由他人代替決定。','An elder hopes for grandchildren. Whether and when to have children is for you and your partner to discuss voluntarily.'),
    [O('discuss',T('认真讨论照护、工作与预算','認真討論照護、工作與預算','Discuss care, work and the budget'),T('理解彼此，不直接触发怀孕','理解彼此，不直接觸發懷孕','Understand each other; this does not trigger a pregnancy'),{relationships:3,knowledge:1},3),
     O('later',T('说明希望晚些再考虑','說明希望晚些再考慮','Explain that you would prefer to wait'),T('保留未来选择的空间','保留未來選擇的空間','Keep room for a later decision'),{happiness:2,relationships:1},2),
     O('no',T('说明不打算养育孩子','說明不打算養育孩子','Explain that you do not plan children'),T('尊重不同的生活选择','尊重不同的生活選擇','Respect different ways to live'),{happiness:2,relationships:-1},1)],
    ['family-education-2021'],{hasPartner:true},{cooldownYears:8}),
  C('home-before-marriage',24,40,
    T('先买房，还是先把日子过起来？','先買房，還是先把日子過起來？','Buy a home before settling down?'),
    T('家人把住房与成家联系起来。你们需要结合工作、储蓄和当地住房条件讨论，租住也能组成一个家。','家人把住房與成家聯繫起來。你們需要結合工作、儲蓄和當地住房條件討論，租住也能組成一個家。','Your family links owning a home with settling down. Work, savings and local housing matter. Renting can also make a home.'),
    [O('save',T('制定可负担的住房储蓄计划','制定可負擔的住房儲蓄計畫','Make an affordable savings plan'),T('先储蓄，不自动获得贷款','先儲蓄，不自動取得貸款','Save first; no loan is granted automatically'),{happiness:-.5,relationships:1,housingGoal:true},3),
     O('rent',T('先租住，保留工作和生活弹性','先租住，保留工作和生活彈性','Rent and keep flexibility'),T('住房选择不决定一个人的价值','住房選擇不決定一個人的價值','Housing tenure does not determine your worth'),{happiness:2,relationships:1},3),
     O('talk',T('解释现实条件，请家人降低期待','解釋現實條件，請家人降低期待','Explain the limits and reduce expectations'),T('沟通而不是为了面子过度举债','溝通而不是為了面子過度舉債','Talk rather than borrow beyond your means'),{happiness:1,relationships:2},2)],
    ['housing-reform-1998','mortgage-1998'],{hasLivingParent:true},{minYear:1998,cooldownYears:10}),
  C('elder-care',35,70,
    T('父母渐渐需要更多照料','父母漸漸需要更多照料','Your parents need more care'),
    T('家里商量如何照顾年长亲人。陪伴、经济支持、专业服务和兄弟姐妹分工可以结合，不应只由某一个性别承担。','家裡商量如何照顧年長親人。陪伴、經濟支持、專業服務和手足分工可以結合，不應只由某一個性別承擔。','Your family discusses care for an older relative. Time, financial support, professional services and shared responsibilities can work together.'),
    [O('time',T('投入时间，亲自陪伴照料','投入時間，親自陪伴照料','Spend time providing care'),T('关系加深，也要照顾自己的体力','關係加深，也要照顧自己的體力','Grow closer while protecting your own wellbeing'),{relationships:4,happiness:1,health:-1},3),
     O('share',T('与家人协商分工，必要时请专业帮助','與家人協商分工，必要時請專業協助','Share the work and seek professional help'),T('分担照护，支付可负担的服务费','分擔照護，支付可負擔的服務費','Share care and pay affordable service costs'),{relationships:3,health:1,moneyRatio:-.025},3),
     O('support',T('先提供能负担的经济支持并定期联系','先提供能負擔的經濟支持並定期聯絡','Offer affordable support and keep in touch'),T('距离不一定意味着忽视','距離不一定意味著忽視','Distance need not mean neglect'),{relationships:2,moneyRatio:-.018},2)],
    ['elder-rights-2012'],{hasLivingParent:true},{cooldownYears:6}),
  C('family-learning',29,55,
    T('孩子的成绩与兴趣','孩子的成績與興趣','Your child’s grades and interests'),
    T('孩子有自己的长处，也有不擅长的科目。家人对补习和升学各有看法，教育投入需要兼顾兴趣、休息与经济条件。','孩子有自己的長處，也有不擅長的科目。家人對補習和升學各有看法，教育投入需要兼顧興趣、休息與經濟條件。','Your child has strengths and struggles. Your family debates tutoring and school, while interests, rest and affordability also matter.'),
    [O('support',T('一起找适合的学习方法','一起找適合的學習方法','Find a learning approach together'),T('不把分数当作孩子的全部','不把分數當作孩子的全部','Do not reduce a child to a score'),{relationships:3,happiness:2},4),
     O('class',T('在预算内选择适合的课程','在預算內選擇適合的課程','Choose a suitable course within the budget'),T('投入不能保证录取或分数','投入不能保證錄取或分數','Spending does not guarantee admission or marks'),{relationships:1,knowledge:1,moneyRatio:-.025},2),
     O('rest',T('先减少压力，保证运动与休息','先減少壓力，確保運動與休息','Reduce pressure and protect rest'),T('健康与成长同样重要','健康與成長同樣重要','Health and growth matter too'),{relationships:3,health:1,happiness:1},2)],
    ['family-education-2021'],{hasChildren:true},{minYear:1980,cooldownYears:6}),
  C('family-gift',18,80,
    T('亲友的人情往来','親友的人情往來','Gifts and social obligations'),
    T('亲友邀请你参加一场聚会。礼数表达心意，也应该量力而行；不必为攀比增加负担。','親友邀請你參加一場聚會。禮數表達心意，也應該量力而行；不必為攀比增加負擔。','Relatives invite you to a gathering. A gift can express care, but there is no need to compete or spend beyond your means.'),
    [O('gift',T('准备一份负担得起的礼物','準備一份負擔得起的禮物','Bring an affordable gift'),T('心意与陪伴都重要','心意與陪伴都重要','Care and company both matter'),{relationships:3,happiness:1,moneyRatio:-.006},3),
     O('help',T('帮忙张罗，用行动表达祝福','幫忙張羅，用行動表達祝福','Help out and offer good wishes'),T('不只有金钱才能维系关系','不只有金錢才能維繫關係','Money is not the only way to sustain a bond'),{relationships:3,health:-.5},3),
     O('decline',T('说明安排，送上祝福','說明安排，送上祝福','Explain and send good wishes'),T('保持边界，不因此自责','保持界線，不因此自責','Keep boundaries without blaming yourself'),{happiness:1,relationships:-.5},1)],
    ['spring-festival-unesco'],{}, {cooldownYears:5,opportunityFraction:.88}),
  C('family-career-move',22,50,
    T('去远方工作，还是留在家人身边？','去遠方工作，還是留在家人身邊？','Work farther away or stay near family?'),
    T('一份机会意味着离家更远。有人看重发展，有人看重陪伴，你想和家人认真商量。','一份機會意味著離家更遠。有人看重發展，有人看重陪伴，你想和家人認真商量。','An opportunity would take you farther from home. Growth and companionship matter differently to different people.'),
    [O('explore',T('了解机会，再讨论探望安排','了解機會，再討論探望安排','Explore it and plan how to stay close'),T('先了解新城市的机会，也和家人谈谈将来如何往来','先了解新城市的機會，也與家人談談將來如何往來','Learn about the new city and discuss family visits'),{knowledge:1,relationships:1,openToMigration:true},2),
     O('stay',T('优先寻找附近合适的工作','優先尋找附近合適的工作','Look for suitable work nearby'),T('陪伴是你的主动选择','陪伴是你的主動選擇','Choose closeness on your own terms'),{relationships:3,happiness:1},3),
     O('negotiate',T('比较成本与照护责任后再决定','比較成本與照護責任後再決定','Compare costs and care responsibilities first'),T('没有对所有人都适用的标准答案','沒有對所有人都適用的標準答案','There is no single right answer for everyone'),{relationships:2,knowledge:1},3)],
    ['elder-rights-2012'],{working:true},{cooldownYears:9}),
  C('grandparent-care',48,78,
    T('要不要帮忙带孙辈？','要不要幫忙帶孫輩？','Help care for a grandchild?'),
    T('子女希望获得照护支持。你愿意帮忙，也需要考虑自己的健康、生活和边界。','子女希望獲得照護支持。你願意幫忙，也需要考慮自己的健康、生活與界線。','Your adult child asks for help with care. Your health, own life and boundaries matter too.'),
    [O('help',T('在身体允许时分担一部分','在身體允許時分擔一部分','Help for an agreed amount of time'),T('约定时间，不把全部责任揽下','約定時間，不把全部責任攬下','Agree on limits instead of taking on everything'),{relationships:4,happiness:2,health:-1},3),
     O('share',T('一起商量托育和家人分工','一起商量托育和家人分工','Discuss childcare and shared duties'),T('专业照护和家庭支持可以并存','專業照護與家庭支持可以並存','Professional care and family support can coexist'),{relationships:2,knowledge:1,moneyRatio:-.01},3),
     O('boundaries',T('说明不能长期承担，提供其他支持','說明不能長期承擔，提供其他支持','Explain your limits and offer other support'),T('照顾自己同样重要','照顧自己同樣重要','Your own wellbeing matters too'),{health:2,happiness:1,relationships:-.5},1)],
    ['elder-rights-2012','family-education-2021'],{hasGrandchildren:true},{cooldownYears:8}),
  C('family-financial-help',28,65,
    T('亲人遇到一笔急用钱','親人遇到一筆急用錢','A relative needs financial help'),
    T('一位亲人向你求助。你想照应，也需要保留自己的生活费；没有收入时不应为了人情自动背债。','一位親人向你求助。你想照應，也需要保留自己的生活費；沒有收入時不應為了人情自動背債。','A relative asks for help. You want to care, while keeping enough for your own living costs. A social obligation should not automatically create debt.'),
    [O('small',T('提供能负担的小额帮助','提供能負擔的小額協助','Offer a small affordable amount'),T('不足时不扣款、不借贷','不足時不扣款、不借貸','No deduction or borrowing if unaffordable'),{relationships:3,moneyRatio:-.02},2),
     O('plan',T('一起寻找其他支持办法','一起尋找其他支持辦法','Look for other support together'),T('帮助也可以是信息与陪伴','協助也可以是資訊與陪伴','Information and company can help too'),{relationships:2,knowledge:1},3),
     O('decline',T('说明自己目前的困难','說明自己目前的困難','Explain your own financial limits'),T('拒绝超出能力的请求','拒絕超出能力的請求','Decline a request beyond your means'),{happiness:1,relationships:-1},1)],
    ['elder-rights-2012'],{}, {cooldownYears:8,opportunityFraction:.88})
];

// The catalogue is a playable sample, not an assertion of vacancies or exact
// historical salaries. 'minYear' dates modern job form / game availability.
const J=(id,name,educationRank,sector,entry,minYear,multiplier,minAge=18,retirementCategory='worker',extra={})=>({
  id,name,educationRank,education:educationRank,sector,entry,minYear,multiplier,minAge,retirementCategory,
  sourceKeys:['occupations-2022',...(entry==='civil-exam'?['civil-service-law','civil-exam-1994','civil-service-2026']:entry==='teacher-qualification'?['teacher-qualification-1995']:entry==='public-exam'?['public-recruitment-2006']:entry==='professional-license'?['qualifications-2021']:[])],
  modelKind:'illustrative-job-and-salary',...extra
});
export const CHINA_JOBS=[
 J('farmer',T('种植农户','種植農戶','Crop farmer'),1,'agriculture','direct',1950,.55,16,'self-employed',{urban:false}),
 J('livestock',T('畜禽养殖户','畜禽養殖戶','Livestock farmer'),1,'agriculture','direct',1950,.6,16,'self-employed',{urban:false}),
 J('fishery',T('水产养殖员','水產養殖員','Aquaculture worker'),1,'agriculture','direct',1950,.64,18,'worker',{urban:false}),
 J('agricultural-tech',T('农业技术员','農業技術員','Agricultural technician'),3,'agriculture','direct',1950,.82,18,'professional',{urban:false}),
 J('cooperative',T('农业合作社经营者','農業合作社經營者','Farm cooperative operator'),2,'agriculture','direct',2007,.9,22,'self-employed',{urban:false}),
 J('mechanic',T('农机维修员','農機維修員','Farm machinery mechanic'),2,'agriculture','direct',1960,.83,18,'worker',{urban:false}),
 J('factory-operator',T('工厂生产操作员','工廠生產操作員','Factory production operator'),2,'private','direct',1980,.78),
 J('textile-worker',T('纺织服装工人','紡織服裝工人','Textile and garment worker'),2,'private','direct',1980,.73),
 J('state-factory',T('国有企业生产工人','國有企業生產工人','State-owned factory worker'),2,'state-owned','direct',1950,.83),
 J('welder',T('焊接工人','焊接工人','Welder'),3,'private','professional-license',1950,1.0,18,'worker',{qualificationNote:T('涉及特种作业时须相应操作资格','涉及特殊作業時須相應操作資格','Relevant special-operation authorization is required where applicable')}),
 J('electrician',T('电工','電工','Electrician'),3,'private','professional-license',1950,1.03),
 J('plumber',T('水暖安装维修工','水暖安裝維修工','Plumbing installer and repairer'),2,'private','direct',1950,.9),
 J('construction-worker',T('建筑施工工人','建築施工工人','Construction worker'),2,'private','direct',1980,.86),
 J('carpenter',T('木工','木工','Carpenter'),2,'private','direct',1950,.88),
 J('machine-technician',T('机械设备技术员','機械設備技術員','Machinery technician'),3,'private','direct',1960,1.06),
 J('quality-control',T('质量检验员','品質檢驗員','Quality inspector'),3,'private','direct',1980,.93),
 J('robotics-technician',T('工业机器人运维员','工業機器人維運員','Industrial robotics technician'),3,'private','direct',2015,1.18),
 J('state-engineer',T('国有企业工程师','國有企業工程師','State-owned enterprise engineer'),4,'state-owned','direct',1950,1.35,22,'professional'),
 J('utility-worker',T('电力供水企业技术员','電力供水企業技術員','Utility technician'),3,'state-owned','direct',1950,1.07),
 J('railway-worker',T('铁路运营工作人员','鐵路營運工作人員','Railway operations worker'),3,'state-owned','direct',1950,1.0),
 J('postal-worker',T('邮政工作人员','郵政工作人員','Postal worker'),2,'state-owned','direct',1950,.87),
 J('state-office',T('国有企业行政专员','國有企業行政專員','State-owned enterprise administrator'),4,'state-owned','direct',1980,1.12,22,'professional'),
 J('bank-teller',T('银行柜员','銀行櫃員','Bank teller'),4,'state-owned','direct',1985,1.1,22,'professional'),
 J('retail',T('商店营业员','商店營業員','Retail assistant'),2,'private','direct',1980,.7,16),
 J('cook',T('厨师','廚師','Chef'),2,'private','direct',1980,.87),
 J('restaurant-service',T('餐饮服务员','餐飲服務員','Restaurant server'),2,'private','direct',1980,.68,16),
 J('hotel-service',T('酒店服务员','旅館服務員','Hotel service worker'),2,'private','direct',1980,.74,16),
 J('cleaner',T('保洁人员','清潔人員','Cleaner'),1,'private','direct',1980,.6),
 J('security',T('保安员','保全人員','Security guard'),2,'private','professional-license',1990,.72),
 J('warehouse',T('仓储理货员','倉儲理貨員','Warehouse worker'),2,'private','direct',1980,.79),
 J('delivery',T('快递配送员','快遞配送員','Courier'),2,'private','direct',2000,.88),
 J('platform-delivery',T('平台外卖配送员','平台外送配送員','Platform food courier'),2,'private','direct',2010,.86),
 J('driver',T('货运驾驶员','貨運駕駛員','Freight driver'),2,'private','professional-license',1980,.98,22),
 J('bus-driver',T('公共交通驾驶员','公共運輸駕駛員','Public transport driver'),2,'state-owned','professional-license',1950,.95,22),
 J('care-worker',T('养老护理员','養老照護員','Elder-care worker'),2,'private','direct',1990,.8),
 J('kindergarten-teacher',T('幼儿园教师','幼兒園教師','Kindergarten teacher'),3,'public-institution','teacher-qualification',1950,.9,20,'professional',{entrySinceYear:1995,publicRecruitmentSinceYear:2006}),
 J('primary-teacher',T('小学教师','小學教師','Primary school teacher'),4,'public-institution','teacher-qualification',1950,1.08,22,'professional',{entrySinceYear:1995,publicRecruitmentSinceYear:2006}),
 J('secondary-teacher',T('中学教师','中學教師','Secondary school teacher'),4,'public-institution','teacher-qualification',1950,1.17,22,'professional',{entrySinceYear:1995,publicRecruitmentSinceYear:2006}),
 J('vocational-teacher',T('职业学校教师','職業學校教師','Vocational school teacher'),4,'public-institution','teacher-qualification',1980,1.15,22,'professional',{entrySinceYear:1995,publicRecruitmentSinceYear:2006}),
 J('university-lecturer',T('高校教师','大專校院教師','University lecturer'),5,'public-institution','teacher-qualification',1950,1.43,25,'professional',{entrySinceYear:1995,publicRecruitmentSinceYear:2006}),
 J('researcher',T('科研院所研究员','科研院所研究員','Research institute researcher'),5,'public-institution','public-exam',1950,1.44,25,'professional',{entrySinceYear:2006}),
 J('librarian',T('图书馆工作人员','圖書館工作人員','Public library staff'),4,'public-institution','public-exam',1950,.98,22,'professional',{entrySinceYear:2006}),
 J('museum',T('博物馆工作人员','博物館工作人員','Museum staff'),4,'public-institution','public-exam',1950,1.02,22,'professional',{entrySinceYear:2006}),
 J('social-service',T('社会服务机构工作人员','社會服務機構工作人員','Social service staff'),4,'public-institution','public-exam',1990,.97,22,'professional',{entrySinceYear:2006}),
 J('physician',T('医师','醫師','Physician'),4,'public-institution','professional-license',1950,1.5,23,'professional',{entrySinceYear:1999,publicRecruitmentSinceYear:2006}),
 J('nurse',T('护理人员','護理人員','Nurse'),3,'public-institution','professional-license',1950,1.04,20,'professional',{entrySinceYear:1994,publicRecruitmentSinceYear:2006}),
 J('pharmacist',T('药师','藥師','Pharmacist'),4,'private','professional-license',1995,1.16,22,'professional'),
 J('civil-clerk',T('公务员：综合管理岗','公務員：綜合管理職','Civil servant: administration'),4,'civil-service','civil-exam',1994,1.12,22,'professional'),
 J('civil-tax',T('公务员：税务岗','公務員：稅務職','Civil servant: taxation'),4,'civil-service','civil-exam',1994,1.17,22,'professional'),
 J('civil-statistics',T('公务员：统计调查岗','公務員：統計調查職','Civil servant: statistics'),4,'civil-service','civil-exam',1994,1.13,22,'professional'),
 J('civil-community',T('公务员：基层服务岗','公務員：基層服務職','Civil servant: local services'),3.5,'civil-service','civil-exam',1994,1.02,18,'professional',{qualificationNote:T('模型中的部分基层职位可由符合公告条件的专科生报考，不代表所有基层职位均接受专科。','模型中的部分基層職位可由符合公告條件的專科生報考，不代表所有基層職位均接受專科。','Some modeled local-service posts accept qualifying associate-degree applicants; individual vacancies set their own requirements.')}),
 J('legacy-state-office',T('行政机关办事人员','行政機關辦事人員','Government administrative staff'),3,'civil-service','direct',1950,.97,20,'professional',{maxYear:1993,sourceKeys:['civil-exam-1994']}),
 J('office',T('民营企业行政专员','民營企業行政專員','Private company administrator'),3,'private','direct',1980,.94,18,'professional'),
 J('accountant',T('企业财务会计','企業財務會計','Company accountant'),4,'private','direct',1980,1.17,22,'professional'),
 J('cpa',T('注册会计师','註冊會計師','Certified public accountant'),4,'private','professional-license',1994,1.46,23,'professional'),
 J('lawyer',T('律师','律師','Lawyer'),4,'private','professional-license',1980,1.43,23,'professional',{entrySinceYear:1986}),
 J('engineer',T('民营企业工程师','民營企業工程師','Private enterprise engineer'),4,'private','direct',1980,1.36,22,'professional'),
 J('developer',T('软件工程师','軟體工程師','Software engineer'),4,'private','direct',1990,1.5,22,'professional'),
 J('designer',T('设计师','設計師','Designer'),3,'private','direct',1985,1.12,20,'professional'),
 J('sales',T('企业销售专员','企業業務專員','Company sales representative'),3,'private','direct',1980,1.05,18,'professional'),
 J('ecommerce',T('电商运营人员','電商營運人員','E-commerce operations staff'),3,'private','direct',2000,1.16,18,'professional'),
 J('data-analyst',T('数据分析师','資料分析師','Data analyst'),4,'private','direct',2010,1.42,22,'professional'),
 J('new-energy',T('新能源设备技术员','新能源設備技術員','New-energy equipment technician'),3,'private','direct',2008,1.18,18,'worker'),
 J('business',T('个体商店经营者','個體商店經營者','Self-employed shopkeeper'),2,'self-employed','direct',1980,1.02,18,'self-employed'),
 J('repair-shop',T('个体维修店经营者','個體維修店經營者','Self-employed repairer'),2,'self-employed','direct',1980,.99,18,'self-employed'),
 J('restaurant-owner',T('餐饮店经营者','餐飲店經營者','Restaurant owner'),2,'self-employed','direct',1980,1.14,20,'self-employed')
];

export const INVESTMENT_AVAILABILITY = {
  jurisdiction:'mainland',
  deposit:{minYear:1950,label:T('银行存款','銀行存款','Bank deposits'),sourceKeys:['capital-market-history'],note:T('存款为默认模型；利率随年代变化，不假定永远正收益。','存款為預設模型；利率隨年代變化，不假定永遠正報酬。','The default savings model varies by era; positive real returns are not guaranteed.')},
  bond:{minYear:1981,label:T('国债','國債','Government bonds'),sourceKeys:['capital-market-history'],note:T('1981年是恢复发行国库券节点，不是中国历史上第一次发行债券。','1981年是恢復發行國庫券節點，不是中國歷史上第一次發行債券。','1981 marks resumed treasury issuance, not the first bonds in Chinese history.')},
  stock:{minYear:1990,label:T('股票市场','股票市場','Stock market'),sourceKeys:['capital-market-history'],note:T('使用沪深市场营业作为一般股票投资入口的简化时间门槛。','使用滬深市場營業作為一般股票投資入口的簡化時間門檻。','Exchange opening is a simplified starting point for broad stock-market access.')},
  fund:{minYear:1998,label:T('证券投资基金','證券投資基金','Securities investment funds'),sourceKeys:['funds-1998'],note:T('1998年是规范公募发展节点，早期模型先用封闭式基金。','1998年是規範公募發展節點，早期模型先用封閉式基金。','1998 marks regulated public-fund development; early access represents closed-end funds.')},
  mix:{minYear:2001,label:T('基金组合','基金組合','Fund portfolio'),sourceKeys:['open-fund-2001'],note:T('以2001年开放式基金时代作为便利组合投资的游戏门槛，并非法定限制。','以2001年開放式基金時代作為便利組合投資的遊戲門檻，並非法定限制。','2001 is a modeled threshold for accessible fund portfolios, not a legal restriction.')},
};
export function investmentAvailable(id,year,region='mainland') {
  if(region!=='mainland') return null; // Other jurisdictions need their own timeline.
  const key=id.startsWith('invest-')?id.slice(7):id;
  return key in INVESTMENT_AVAILABILITY && Number.isFinite(Number(year)) && Number(year)>=INVESTMENT_AVAILABILITY[key].minYear;
}
export const CONSUMPTION_BUDGET_2025 = {
  sourceKeys:['spending-2025'],year:2025,kind:'observed-national-consumption-share',
  shares:{food:0.293,clothing:0.053,housingServices:0.217,householdGoods:0.057,transportCommunications:0.146,educationCulture:0.118,health:0.087,other:0.029},
  note:T('全国平均消费结构，不是个人预算；购房作为资产购置单列。','全國平均消費結構，不是個人預算；購房作為資產購置單列。','National averages do not dictate individual budgets. Home purchases are tracked as asset acquisition.')
};
const P=(id,name,description,category,minAge,minYear,priceModel,extra={})=>({
 id,name,description,category,kind:category,minAge,minYear,priceModel,priceRatio:priceModel.kind==='income-ratio'?priceModel.ratio:undefined,priceCNY:priceModel.kind==='fixed-real'?priceModel.amount:undefined,sourceKeys:['spending-2025'],
 modelKind:'illustrative-purchasing-power-price',...extra
});
export const CHINA_CONSUMPTION = [
 P('furniture',T('添置家具','添置家具','Buy household furniture'),T('改善日常起居，量力而行','改善日常起居，量力而行','Make daily life more comfortable within your means'),'household',18,1950,{kind:'income-ratio',ratio:.07},{assetKey:'furniture',cooldownYears:6,effects:{happiness:4}}),
 P('appliances',T('购置家用电器','購置家用電器','Buy household appliances'),T('按年代添置合适的家电，减少家务负担','按年代添置合適的家電，減少家務負擔','Choose era-appropriate appliances and ease household work'),'household',18,1980,{kind:'income-ratio',ratio:.12},{assetKey:'appliances',cooldownYears:7,effects:{happiness:4,health:1},yearKind:'modeled-adoption-threshold'}),
 P('renovation',T('住房修缮与装修','住房修繕與裝潢','Repair or improve your home'),T('维护已有住房，不会直接增加同额房产价值','維護已有住房，不會直接增加同額房產價值','Maintain an existing home; spending does not add the same amount to its value'),'housing',22,1950,{kind:'home-ratio',ratio:.04},{requiresHouse:true,cooldownYears:10,effects:{happiness:5}}),
 P('house-cash',T('全款购置住房','全款購置住房','Buy a home with savings'),T('使用已有资产支付；不自动借贷','使用已有資產支付；不自動借貸','Pay from existing savings; no automatic borrowing'),'housing',18,1980,{kind:'annual-income-multiple',multiple:12},{assetKey:'house',oneTime:true,sourceKeys:['housing-reform-1998'],yearKind:'modeled-market-access'}),
 P('house',T('住房首付款','住房頭期款','Home down payment'),T('需有工作与还款能力，首付及利率按当年模型处理','需有工作與還款能力，頭期款及利率按當年模型處理','Employment and repayment capacity are required; down payment and interest follow the era model'),'housing',18,1998,{kind:'home-down-payment',ratio:.3},{assetKey:'house',oneTime:true,requiresEmployment:true,createsDebt:'mortgage',sourceKeys:['housing-reform-1998','mortgage-1998']}),
 P('car',T('购置家庭用车','購置家庭用車','Buy a family car'),T('购车后还需承担使用与维护成本','購車後還需負擔使用與維護成本','Ownership also brings running and maintenance costs'),'transport',20,1985,{kind:'annual-income-multiple',multiple:1.15},{assetKey:'car',oneTime:true,yearKind:'modeled-adoption-threshold'}),
 P('bicycle',T('购置自行车','購置自行車','Buy a bicycle'),T('适合短途出行，也是一种日常运动','適合短途出行，也是一種日常運動','A practical way to travel locally and exercise'),'transport',12,1950,{kind:'income-ratio',ratio:.018},{assetKey:'bicycle',oneTime:true,effects:{health:2,happiness:2}}),
 P('school-supplies',T('书籍与学习用品','書籍與學習用品','Books and school supplies'),T('支持日常学习，不等于购买考试分数','支持日常學習，不等於購買考試分數','Support learning without buying exam marks'),'education',6,1950,{kind:'income-ratio',ratio:.008},{requiresSchool:true,cooldownYears:1,effects:{knowledge:1}}),
 P('child-school',T('子女学习与成长支出','子女學習與成長支出','Support a child’s learning'),T('书籍、交通、生活与合规课程；不将义务教育学杂费重复收费','書籍、交通、生活與合規課程；不將義務教育學雜費重複收費','Books, transport, living costs and permitted courses; compulsory-school tuition is not charged again'),'education',22,1950,{kind:'income-ratio',ratio:.035},{requiresChildren:true,cooldownYears:1,effects:{relationships:2},sourceKeys:['family-education-2021']}),
 P('adultstudy',T('继续教育与学历补读','繼續教育與學歷補讀','Continuing education'),T('在职学习需要时间与考核，不会付款后立刻毕业','在職學習需要時間與考核，不會付款後立刻畢業','Part-time study takes time and assessment; paying does not grant a degree'),'education',23,1980,{kind:'income-ratio',ratio:.1},{durationYears:3,sourceKeys:['family-education-2021']}),
 P('course',T('职业技能与资格准备','職業技能與資格準備','Skills and qualification preparation'),T('帮助学习，但仍须通过对应资格或招聘程序','協助學習，但仍須通過對應資格或招聘程序','Learn skills while still meeting qualification and recruitment requirements'),'education',16,1950,{kind:'income-ratio',ratio:.035},{cooldownYears:1,effects:{knowledge:3},sourceKeys:['qualifications-2021']}),
 P('parent-support',T('父母赡养与照护支持','父母贍養與照護支持','Support parents and elder care'),T('结合家人需要与自身支付能力，不自动借贷','結合家人需要與自身支付能力，不自動借貸','Match family needs to your means without automatic debt'),'family',18,1950,{kind:'income-ratio',ratio:.025},{requiresLivingParent:true,cooldownYears:1,effects:{relationships:3},sourceKeys:['elder-rights-2012']}),
 P('childcare',T('托育与照护服务','托育與照護服務','Childcare and care services'),T('分担照护，服务可获得性随城市与年代变化','分擔照護，服務可取得性隨城市與年代變化','Share care where services are available in your city and era'),'family',22,1990,{kind:'income-ratio',ratio:.06},{requiresChildren:true,cooldownYears:1,effects:{health:1,relationships:2},yearKind:'modeled-service-access'}),
 P('wedding',T('量力而行的婚礼安排','量力而行的婚禮安排','An affordable wedding plan'),T('尊重双方意愿，不将高额婚礼和彩礼设为结婚条件','尊重雙方意願，不將高額婚禮和彩禮設為結婚條件','Respect both partners; an expensive ceremony is not a condition of marriage'),'family',20,1950,{kind:'income-ratio',ratio:.18},{requiresPartner:true,oneTime:true,effects:{relationships:3,happiness:4}}),
 P('health',T('体检与医疗护理','健檢與醫療照護','Checkups and health care'),T('照顾身体，不能保证免于疾病','照顧身體，不能保證免於疾病','Look after health without guaranteeing freedom from illness'),'health',16,1950,{kind:'income-ratio',ratio:.02},{cooldownYears:1,effects:{health:6}}),
 P('meal',T('家人朋友聚餐','家人朋友聚餐','Share a meal'),T('在预算内维护关系','在預算內維繫關係','Stay connected within your budget'),'family',12,1950,{kind:'income-ratio',ratio:.003},{cooldownYears:1,effects:{relationships:3,happiness:2}}),
 P('trip',T('旅行或返乡探亲','旅行或返鄉探親','Travel or visit family'),T('出行选择随交通与年代变化','出行選擇隨交通與年代變化','Travel options depend on transport and era'),'leisure',16,1950,{kind:'income-ratio',ratio:.025},{cooldownYears:1,effects:{happiness:4,knowledge:1}}),
 P('phone',T('购买通信设备','購買通訊設備','Buy a communication device'),T('按年代区分固定电话、移动电话与智能手机','按年代區分固定電話、行動電話與智慧手機','The device depends on the era: landline, mobile or smartphone'),'household',13,1985,{kind:'fixed-real',amount:2400},{assetKey:'phone',cooldownYears:5,yearKind:'modeled-adoption-threshold',sourceKeys:['mobile-phone-1987','telecommunications-2010']}),
 P('computer',T('购买家用电脑','購買家用電腦','Buy a home computer'),T('学习与工作工具的普及随年代变化','學習與工作工具的普及隨年代變化','Access to a tool for study and work varies by era'),'household',15,1990,{kind:'fixed-real',amount:5800},{assetKey:'computer',oneTime:true,yearKind:'modeled-adoption-threshold'})
];
export function culturalEventEligible(event,life) {
  if(life.phase==='dead'||life.age<event.minAge||life.age>event.maxAge||life.year<event.minYear||life.year>(event.maxYear??Infinity))return false;
  if(event.opportunityFraction<1){
    let h=2166136261;for(const char of `${life.seed}:${event.id}:opportunity`)h=Math.imul(h^char.charCodeAt(0),16777619);
    if((h>>>0)/4294967296>=event.opportunityFraction)return false;
  }
  const c=event.conditions||{}, family=life.family||{};
  if(c.hasLivingParent&&!([family.mother,family.father].some(p=>p?.alive)))return false;
  if(c.hasChildren&&!family.children?.length)return false;
  if(c.hasAdultChildren&&!family.children?.some(p=>p.alive&&p.age>=18))return false;
  if(c.hasGrandchildren&&!family.children?.some(p=>p.alive&&p.children>0))return false;
  if(c.hasPartner&&!family.partner?.alive)return false;
  if(c.unmarried&&family.partner?.married)return false;
  if(c.working&&!life.job)return false;
  if(c.inSchool&&!life.school)return false;
  if(c.notInSchool&&life.school)return false;
  return true;
}
