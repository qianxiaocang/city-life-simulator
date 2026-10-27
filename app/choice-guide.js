// Concrete consequences for options whose caller does not already provide a description.
// These are game mechanics, not legal or statistical claims.
const T=(zhCN,zhTW,en)=>({zhCN,zhTW,en});
const D={
  reflect:{write:T('保存实际写下的内容，并给自己一次整理想法的时间。','保存實際寫下的內容，並給自己一次整理想法的時間。','Save what you actually write and spend time organizing your thoughts.'),continue:T('暂不记录文字，把这一段时间留给休息。','暫不記錄文字，把這段時間留給休息。','Leave the thought unwritten and use this time for rest.')},
  hobby:{music:T('音乐会逐年带来情绪和社交收益。','音樂會逐年帶來情緒及社交收益。','Music adds small recurring mood and social benefits.'),drawing:T('绘画会逐年带来情绪和专注收益。','繪畫會逐年帶來情緒及專注收益。','Drawing adds small recurring mood and focus benefits.'),sport:T('运动会逐年改善健康，也占用一点学习时间。','運動會逐年改善健康，也佔用一點學習時間。','Sport gradually improves health and takes some study time.'),reading:T('阅读会逐年增加知识，并占用一点社交时间。','閱讀會逐年增加知識，並佔用一點社交時間。','Reading gradually builds knowledge and takes some social time.')},
  'edu-suspended':{work:T('先工作或学习技能；停招年份不会获得普通高校录取。','先工作或學習技能；停招年份不會獲得普通高校錄取。','Work or learn skills; ordinary admission is unavailable this year.')},
  'edu-recommendation':{recommend:T('需满足实践与推荐审核；可能得到录取，也可能落选。','需符合實踐及推薦審查；可能錄取，也可能落選。','Practice and recommendation review are required; admission is uncertain.'),work:T('保留工作经验，今后仍可关注新的求学机会。','保留工作經驗，日後仍可留意新的求學機會。','Keep practical experience and consider later study opportunities.')},
  'edu-admission':{work:T('开始赚取收入，并推迟这次全日制入学。','開始賺取收入，並推遲這次全日制入學。','Begin earning and forgo this full-time admission round.')},
  'edu-funding':{family:T('使用已确认的家庭支持与奖助，不新增助学债务。','使用已確認的家庭支持與獎助，不新增助學債務。','Use confirmed family support and aid without new student debt.'),cheaper:T('转向费用较低的公办专科，学历路径也随之改变。','轉向費用較低的公辦專科，學歷途徑亦會改變。','Choose a lower-cost public associate route with a different qualification.'),work:T('推迟入学；工作可带来收入，但会耽误本次学业。','推遲入學；工作可帶來收入，但會延遲本次學業。','Defer study; work can bring income but delays this qualification.')},
  'edu-postgraduate':{apply:T('参加选拔并承担进一步学习的时间与费用。','參加選拔並承擔進一步學習的時間及費用。','Face selective admission and the time and cost of more study.'),work:T('立即积累工资与工作经验，暂不取得更高学位。','即時累積工資及工作經驗，暫不取得更高學位。','Gain earnings and experience now without this higher degree.')},
  'edu-bridge':{work:T('以现有专科学历开始工作并积累经验。','以現有專科學歷開始工作並累積經驗。','Work with your current associate qualification and build experience.'),bridge:T('尝试选拔性衔接本科；有落选和延后工作的风险。','嘗試選拔性銜接大學；有落選及延後工作的風險。','Attempt selective bachelor bridging, risking rejection and delayed earnings.')},
  'career-result':{decline:T('保留当前安排，放弃这次已通过考核的岗位。','保留目前安排，放棄這次已通過考核的職位。','Keep your present plans and pass on this approved post.'),continue:T('本次未获录用；保留经验，之后可再尝试。','本次未獲錄用；保留經驗，日後可再嘗試。','This recruitment failed; keep the experience for a later attempt.')},
  'retirement-law':{retire:T('停止领取当前岗位工资；待遇取决于缴费年限与本地规则。','停止領取目前職位工資；待遇視乎供款年期及本地規則。','End this salary; benefits depend on contributions and local rules.')},
  schoolfriend:{include:T('花时间接纳同学，改善关系和心情。','花時間接納同學，改善關係及心情。','Spend time including a classmate to improve relationships and mood.'),quiet:T('留出个人空间，暂时不建立这段新关系。','留出個人空間，暫時不建立這段新關係。','Keep personal space and postpone this new connection.')},
  screen:{sleep:T('减少屏幕时间，明天的身体和学习状态更好。','減少螢幕時間，明天的身體及學習狀態更好。','Cut screen time for better health and study.'),watch:T('得到眼前的放松，但少一些睡眠与健康。','得到眼前的放鬆，但少一些睡眠與健康。','Enjoy immediate relaxation at the expense of sleep and health.')},
  familyhelp:{help:T('少一点学习时间，积累照料家人的经验与信任。','少一點學習時間，累積照顧家人的經驗及信任。','Trade some study time for family care experience and trust.'),study:T('完成学习任务，为考试准备；家务暂由他人承担。','完成學習任務，為考試準備；家務暫由他人承擔。','Prepare for study and exams while others handle chores.')},
  romance:{date:T('尝试建立关系；相处需要时间，结果并不确定。','嘗試建立關係；相處需要時間，結果並不確定。','Try to build a relationship; it takes time and may not work out.'),alone:T('保留独处与自主安排，推迟这段关系。','保留獨處及自主安排，推遲這段關係。','Keep time for yourself and defer this relationship.')},
  marriage:{marry:T('共同生活并承担婚礼开支，今后可商量育儿。','共同生活並承擔婚禮開支，日後可商量育兒。','Share a life and wedding costs, with future family plans possible.'),wait:T('继续交往，不承担当下的婚礼支出。','繼續交往，不承擔當下的婚禮開支。','Continue dating without wedding expenses now.'),separate:T('结束这段关系，需面对一段情绪调整期。','結束這段關係，需要面對一段情緒調整期。','End the relationship and face an adjustment period.')},
  child:{try:T('尝试生育；成功并不保证，孩子会带来长期时间与经济责任。','嘗試生育；成功並無保證，孩子會帶來長期時間及經濟責任。','Try for a child; success is uncertain, and care requires time and money.'),later:T('保留当前时间与预算，未来年龄会影响再尝试的机会。','保留目前時間及預算，日後年齡會影響再嘗試的機會。','Keep time and savings now; age will affect later chances.')},
  worklife:{project:T('工资机会增加，近期健康与家人相处时间减少。','工資機會增加，近期健康及家人相處時間減少。','Improve earnings prospects while reducing health and family time.'),boundary:T('留住陪伴时间与心情，放弃这次额外工资机会。','留住陪伴時間及心情，放棄這次額外工資機會。','Protect family time and mood, forgoing this extra earnings opportunity.')},
  move:{stay:T('留在当前城市，保住熟悉的人际关系与搬迁预算。','留在目前城市，保住熟悉的人際關係及搬遷預算。','Stay in your city, retaining relationships and the moving budget.')},
  startup:{steady:T('保留稳定岗位与积蓄，放弃这次经营机会。','保留穩定職位及積蓄，放棄這次經營機會。','Keep your salary and savings, passing on this business opportunity.')},
  checkup:{postpone:T('省下眼前费用，但症状与延误风险仍在。','省下眼前費用，但症狀及延誤風險仍在。','Save immediate costs but keep the symptoms and delay risk.')},
  care:{time:T('亲自陪伴父母，可能减少一点岗位收入。','親自陪伴父母，可能減少一點職位收入。','Care for parents in person, possibly reducing earnings.'),service:T('支付照护费用，保留部分工作时间。','支付照護費用，保留部分工作時間。','Pay for care to protect some work time.')},
  memory:{record:T('留下可回看的记录，同时整理知识与心情。','留下可重看的紀錄，同時整理知識及心情。','Leave a record to revisit while reflecting on what you know.'),tell:T('花时间当面讲述，增进彼此关系。','花時間當面講述，增進彼此關係。','Tell the story in person and strengthen relationships.')},
  community:{join:T('投入志愿服务时间，建立邻里互助联系。','投入義工服務時間，建立鄰里互助聯繫。','Give time to volunteering and build neighborhood support.'),rest:T('保留休息与恢复时间，暂不参加这次服务。','保留休息及恢復時間，暫不參與這次服務。','Keep time for rest and recovery instead of this service.')},
};
export function describeChoice(action,option,life){
  if(option.description && Object.values(option.description).some(Boolean))return option.description;
  if(action==='move'&&option.id.startsWith('city-'))return T('支付约当年典型收入 8% 的搬迁费，职业与人际环境可能变化。','支付約當年典型收入 8% 的搬遷費，職業及人際環境可能改變。','Pay moving costs of about 8% of modeled annual typical income; work and relationships may change.');
  if(action==='career-result'&&option.id==='accept')return T('接受已通过考核的岗位与对应工资，离开原工作。','接受已通過考核的職位及相應工資，離開原工作。','Take the approved post and salary, leaving your prior work.');
  return D[action]?.[option.id]||T('这项安排会改变当前机会和时间分配；具体结果随人生状态而定。','這項安排會改變目前機會及時間分配；具體結果隨人生狀態而定。','This changes current opportunities and time use; the result depends on your situation.');
}
