import {getEconomyShopItems, purchaseEconomyItem, homeTerms, spend, canSpend} from './economy.js';

// Costs, opportunities and cooldowns below are game parameters. Customs are
// optional experiences, never requirements for marriage, study or family life.
const T=(zhCN,zhTW,en)=>({zhCN,zhTW,en});
const amount=n=>Math.round(n).toLocaleString('zh-CN');
const scale=life=>Math.max(1000,Number(life.profile?.typicalIncome)||0);
const livingParents=life=>[life.family?.mother,life.family?.father].filter(p=>p?.alive);
const childKey=child=>`${child.birthYear}:${child.name?.zhCN||child.name?.en||'child'}`;
const schoolKey=school=>`${school.year??school.startedAt}:${school.label?.zhCN||school.stage}`;
export const LIFE_DECISION_TOPICS=['home','car','pet','wedding','baby-banquet','admission-banquet','new-year','gift','child-learning','parent-care','driving','rental','skills','trip','home-goods','retirement-hobby'];

function state(life){
  life.flags??={};
  life.lifeDecisions??={};
  const s=life.lifeDecisions;
  s.lastOffered??={};s.offerCounts??={};s.completed??={};s.occasions??=[];
  return s;
}
/** Record a real milestone; it remains an invitation rather than a purchase. */
export function notifyLifeMilestone(life,kind,data={}){
  const s=state(life);
  let topic,key,detail={};
  if(kind==='marriage'){
    const oldPurchaseAge=life.flags['purchase-wedding'];
    if(Number.isFinite(oldPurchaseAge)&&life.birthYear+oldPurchaseAge===life.family?.partner?.marriedYear)return false;
    topic='wedding';key=data.key??`${life.family?.partner?.marriedYear??life.year}:${life.family?.partner?.name?.zhCN||''}`;
    detail={partnerName:life.family?.partner?.name};
  }else if(kind==='child'&&data.child?.alive){
    topic='baby-banquet';key=childKey(data.child);detail={childKey:key,childName:data.child.name};
  }else if(kind==='admission'&&data.school?.admissionTier==='research-public'&&data.school.stage==='university'){
    topic='admission-banquet';key=schoolKey(data.school);detail={schoolLabel:data.school.label};
  }else return false;
  const id=`${topic}:${key}`;
  if(s.completed[id]||s.occasions.some(o=>o.id===id))return false;
  s.occasions.push({id,topic,createdAt:life.age,expiresAt:life.age+1,...detail});
  return true;
}
function discoverMilestones(life){
  if(life.family?.partner?.married&&life.family.partner.marriedYear===life.year)
    notifyLifeMilestone(life,'marriage');
  for(const child of life.family?.children||[])if(child.alive&&child.age===0)notifyLifeMilestone(life,'child',{child});
  if(life.school?.stage==='university'&&life.school.startedAt===life.age)
    notifyLifeMilestone(life,'admission',{school:life.school});
}
function choice(id,label,description,cost=0,effects={},extra={}){
  return {id,label,description,cost,effects,...extra};
}
function paid(life,id,label,ratio,effects={},purpose='family'){
  const cost=Math.round(scale(life)*ratio);
  return choice(id,label,T(`模型支出约 ¥${amount(cost)}，按可用家庭预算与本人积蓄安排，不为此借款。`,`模型支出約 ¥${amount(cost)}，依可用家庭預算與本人積蓄安排，不為此借款。`,`Modeled cost: CNY ${amount(cost)}, using eligible family support and personal savings, without borrowing.`),cost,effects,{purpose});
}
const free=(id,label,description,effects={})=>choice(id,label,description,0,effects);
function ceremony(life,occasion){
  const common={topic:occasion.topic,occasionKey:occasion.id,cooldown:99};
  if(occasion.topic==='wedding')return {...common,title:T('婚礼，想怎样留下纪念？','婚禮，想如何留下紀念？','How would you mark your marriage?'),description:T('你们已经决定结婚。酒席的规模可以商量，也可以不办；登记与共同生活不会取决于宴席。','你們已決定結婚。喜宴規模可以商量，也可以不辦；登記與共同生活不取決於宴席。','You have decided to marry. Choose a celebration together, or have none; marriage does not depend on a banquet.'),options:[
    paid(life,'banquet',T('量力办一场亲友喜宴','量力辦一場親友喜宴','Host a modest wedding banquet'),.18,{happiness:4,relationships:3},'wedding'),
    paid(life,'meal',T('只请双方家人吃顿饭','只請雙方家人吃頓飯','Share a meal with close family'),.035,{happiness:3,relationships:2},'wedding'),
    paid(life,'trip',T('把预算留给两人的短途旅行','把預算留給兩人的短途旅行','Choose a short trip together'),.06,{happiness:4},'wedding'),
    free('quiet',T('不办酒席，留下一封给彼此的信','不辦喜宴，留下一封給彼此的信','Skip the banquet and exchange letters'),T('不增加开支，按双方喜欢的方式开始共同生活。','不增加開支，依雙方喜歡的方式開始共同生活。','Spend nothing extra and begin your life together in your own way.'),{happiness:2,relationships:2})]};
  if(occasion.topic==='baby-banquet'){
    const name=occasion.childName||T('孩子','孩子','your child');
    const late=life.age>occasion.createdAt;
    return {...common,title:late?T(`补记${name.zhCN}的百日纪念`,`補記${name.zhTW}的百日紀念`,`A belated hundred-day memory for ${name.en}`):T(`${name.zhCN}的百日纪念`,`${name.zhTW}的百日紀念`,`Marking ${name.en}'s first hundred days`),description:late?T('此前忙于照护，百日纪念没有安排。这次可以补一次亲友小聚，也可以只整理孩子的旧照片；不用把宴席当作必须补办的事。','此前忙於照顧，未安排百日紀念。這次可補一次親友小聚，也可只整理孩子舊照片；不用把宴席當成必須補辦的事。','Care kept you busy and the hundred-day occasion passed. You can now share a small gathering or simply collect earlier photographs; a belated banquet is optional.'):T('孩子的到来让家里忙了起来。家人问起百日宴，你可以安排亲友小聚，也可以只留下合照，把精力留给照护。','孩子的到來讓家裡忙了起來。家人問起百日宴，你可安排親友小聚，也可只留下合照，把精力留給照顧。','Life is busy with a baby. Family asks about a hundred-day celebration. Gather a few people, or simply take a photograph and focus on care.'),options:[
      paid(life,'banquet',T('请亲友吃一顿百日宴','請親友吃一頓百日宴','Host a small hundred-day meal'),.055,{happiness:3,relationships:3},'celebration'),
      paid(life,'small',T('只与家人简单庆祝','只與家人簡單慶祝','Celebrate quietly with family'),.012,{happiness:3,relationships:2},'celebration'),
      free('photo',T('不办宴席，拍一张全家福','不辦宴席，拍一張全家福','Skip the banquet and take a family photograph'),T('不增加宴席支出，记录孩子与家人的日常。','不增加宴席支出，記錄孩子與家人的日常。','Add no banquet expense and record an ordinary family moment.'),{happiness:2,relationships:2})]};
  }
  return {...common,title:T('收到重点本科录取，怎样庆祝？','收到重點大學錄取，如何慶祝？','How would you celebrate selective university admission?'),description:T('你已经落实入学安排。有人提议办升学宴；答谢、家庭小聚或安静准备新学期，都可以成为自己的纪念。','你已落實入學安排。有人提議辦升學宴；答謝、家庭小聚或安靜準備新學期，都可成為自己的紀念。','Your university enrollment is arranged. Someone suggests a celebration; a family meal, thanking teachers or preparing quietly are all options.'),options:[
    paid(life,'meal',T('只请亲近家人聚餐，不收礼金','只請親近家人聚餐，不收禮金','Share a close-family meal without gifts'),.035,{happiness:4,relationships:2},'celebration'),
    free('thanks',T('向老师和家人写信道谢','向老師和家人寫信道謝','Write thanks to teachers and family'),T('不办宴席，把谢意认真说出来。','不辦宴席，把謝意認真說出來。','Thank people personally without a banquet.'),{relationships:3,happiness:2}),
    free('study',T('不办酒席，准备新的求学生活','不辦宴席，準備新的求學生活','Skip the banquet and prepare for study'),T('不增加开支，为入学整理行李与计划。','不增加開支，為入學整理行李與計劃。','Spend nothing extra and prepare for the new term.'),{knowledge:1,happiness:2})]};
}
function ordinaryScenarios(life){
  const s=state(life),rows=[],income=scale(life),adult=life.age>=18,working=!!life.job&&!life.retired;
  const add=(topic,title,description,options,cooldown=5)=>{
    const available=options.filter(o=>!o.cost||canSpend(life,o.cost,o.purchase?'purchase-'+o.purchase:o.purpose||'family'));
    if(available.length>=2)rows.push({topic,title,description,options:available,cooldown});
  };
  const shop=adult?getEconomyShopItems(life):[];
  if(adult&&life.age<=65&&!life.assets.house&&shop.some(x=>['house','house-cash'].includes(x.id))){
    const terms=homeTerms(life),cash=shop.find(x=>x.id==='house-cash'),mortgage=shop.find(x=>x.id==='house');
    const options=[];
    if(cash?.available)options.push(choice('cash',T('用积蓄全款买房','用積蓄全款買房','Buy a home outright'),T(`模型总价 ¥${amount(terms.totalPrice)}，不新增房贷。`,`模型總價 ¥${amount(terms.totalPrice)}，不新增房貸。`,`Modeled price CNY ${amount(terms.totalPrice)}; no mortgage.`),cash.cost,{}, {purchase:'house-cash'}));
    if(mortgage?.available)options.push(choice('mortgage',T('支付首付，申请住房按揭','支付頭期款，申請住房按揭','Pay a down payment and take a mortgage'),T(`模型首付 ¥${amount(terms.down)}，此后约每年还款 ¥${amount(terms.annualPayment)}、${terms.years}年。需通过收入与还款能力检查。`,`模型頭期款 ¥${amount(terms.down)}，此後約每年還款 ¥${amount(terms.annualPayment)}、${terms.years}年。須符合收入與還款能力檢查。`,`Modeled down payment CNY ${amount(terms.down)}, then about CNY ${amount(terms.annualPayment)} a year for ${terms.years} years, subject to income and repayment checks.`),mortgage.cost,{}, {purchase:'house'}));
    options.push(free('save',T('继续攒钱，暂不买房','繼續存錢，暫不買房','Keep saving and postpone buying'),T('没有合适的资金方案就先维持居住安排，不新增债务。','沒有合適資金方案就先維持居住安排，不新增債務。','Keep your current home and create no debt without an affordable plan.'),{happiness:1}));
    add('home',T('安一个家，先算清这笔账','安一個家，先算清這筆帳','A home starts with a budget'),T(`你看了看住房和积蓄。相似住房的模型总价约 ¥${amount(terms.totalPrice)}，全款和首付按揭需要分别衡量。买不起时，可以继续攒钱。`,`你比較住房與積蓄。相似住房的模型總價約 ¥${amount(terms.totalPrice)}，全款與頭期款按揭需分別衡量。買不起時，可繼續存錢。`,`You compare housing with savings. A similar modeled home costs about CNY ${amount(terms.totalPrice)}. Consider outright purchase, an affordable mortgage or more saving.`),options,4);
  }
  const car=shop.find(x=>x.id==='car');
  if(car?.available&&!life.assets.car&&life.age<=70)add('car',T('要不要添置一辆车？','要不要添置一輛車？','Would a car fit your life?'),T('通勤、接送与出门的需要变多了。买车方便，也会带来持续的养车支出。','通勤、接送與出門的需要變多了。買車方便，也會帶來持續養車支出。','Travel needs are growing. A car can help, while creating continuing running costs.'),[
    ...(car.available?[choice('buy',T('买一辆适合预算的家庭用车','買一輛適合預算的家庭用車','Buy a car within the budget'),T(`模型购车款 ¥${amount(car.cost)}；之后每年还有使用与维护费用。`,`模型購車款 ¥${amount(car.cost)}；此後每年另有使用及維護費用。`,`Modeled purchase CNY ${amount(car.cost)}, followed by annual running and maintenance costs.`),car.cost,{}, {purchase:'car'})]:[]),
    free('transit',T('继续步行、骑车或乘公共交通','繼續步行、騎車或乘公共運輸','Keep walking, cycling or using public transport'),T('不新增购车款，按现有生活条件出行。','不新增購車款，依現有生活條件出行。','Add no car purchase and use your current travel options.'),{health:1}),
    free('later',T('先把钱留给更需要的地方','先把錢留給更需要的地方','Keep the money for other needs'),T('暂缓买车，不产生汽车贷款。','暫緩買車，不產生汽車貸款。','Postpone buying without a car loan.'),{happiness:1})],6);
  if(adult&&life.age<=65&&life.year>=1980&&!s.petAdopted&&life.everWorked)add('pet',T('家里适合迎接一只宠物吗？','家裡適合迎接一隻寵物嗎？','Is there room in your life for a pet?'),T('养宠物意味着每天的陪伴、清洁和照护，也有长期食物与医疗预算。先确认住处和家人都能接纳。','養寵物意味每天陪伴、清潔及照護，也有長期食物與醫療預算。先確認住處與家人都能接納。','A pet needs daily care, cleaning, food and a healthcare budget. First consider the home and everyone sharing it.'),[
    ...['cat','dog'].map(kind=>paid(life,kind,kind==='cat'?T('做好准备后领养一只猫','準備好後領養一隻貓','Prepare and adopt a cat'):T('安排好遛狗时间后领养一只狗','安排好遛狗時間後領養一隻狗','Arrange daily walks and adopt a dog'),.025,{happiness:3,relationships:1},'pet-adoption')),
    free('wait',T('暂时不养，先照顾好现有生活','暫時不養，先照顧好現有生活','Wait and focus on present responsibilities'),T('不增加长期费用与照护责任。','不增加長期費用及照護責任。','Add no ongoing expense or care responsibility.'),{happiness:1})],8);
  if(adult&&livingParents(life).length&&life.location.id!==life.born?.id)add('new-year',T('过年，想怎样与家人团聚？','過年，想如何與家人團聚？','How would you spend New Year with family?'),T('年关渐近，你开始协调行程、工作和家人的期待。团聚可以有不同的方式。','年關將近，你開始協調行程、工作與家人的期待。團聚可以有不同方式。','As New Year approaches, you consider travel, work and family. There is more than one way to stay close.'),[
    paid(life,'home',T('安排返乡，陪家人过年','安排返鄉，陪家人過年','Travel home for New Year'),.025,{relationships:4,happiness:3},'moving'),
    free('contact',life.year>=2000?T('约好通话，换个时间再团聚','約好通話，換個時間再團聚','Arrange a call and visit another time'):T('写封家信，另约时间团聚','寫封家信，另約時間團聚','Send a letter and visit another time'),T('不增加本次旅费，认真安排远方的问候。','不增加本次旅費，認真安排遠方的問候。','Add no travel expense and make time to keep in touch.'),{relationships:2})],3);
  if(adult)add('gift',T('亲友有喜事，怎样表达心意？','親友有喜事，如何表達心意？','How would you mark a friend’s good news?'),T('一位熟悉的亲友邀请你参加喜事。礼数表达心意，金额不需要与别人比较。','一位熟悉親友邀你參加喜事。禮數表達心意，金額無須與別人比較。','Someone close invites you to celebrate. Care matters more than matching other people’s gifts.'),[
    paid(life,'gift',T('按预算准备一份小礼物','依預算準備一份小禮物','Bring a small gift within the budget'),.006,{relationships:3},'social-gift'),
    free('help',T('帮忙张罗，把祝福亲口说出','幫忙張羅，親口送上祝福','Help with preparations and offer your wishes'),T('用时间表达心意，不增加礼金支出。','用時間表達心意，不增加禮金支出。','Give time and good wishes without a cash gift.'),{relationships:2,happiness:1})],5);
  if(adult&&life.family.children.some(c=>c.alive&&c.age>=6&&c.age<=17))add('child-learning',T('孩子的课余时间，怎么安排？','孩子的課餘時間，如何安排？','How should your child spend time after school?'),T('孩子想尝试一项兴趣。你们讨论了意愿、休息和家庭预算，成长不只有考试成绩。','孩子想嘗試一項興趣。你們討論意願、休息與家庭預算，成長不只有考試成績。','Your child wants to try an interest. You discuss preferences, rest and the budget; growth involves more than grades.'),[
    paid(life,'class',T('选一项孩子愿意参加的兴趣活动','選一項孩子願意參加的興趣活動','Support an activity your child wants'),.025,{relationships:3,happiness:2},'purchase-child-school'),
    free('together',T('陪孩子阅读、运动或做手工','陪孩子閱讀、運動或做手工','Read, exercise or make things together'),T('用陪伴支持兴趣，不追加课程费。','用陪伴支持興趣，不追加課程費。','Support the interest through time together without course fees.'),{relationships:4,happiness:1})],4);
  if(adult&&livingParents(life).some(p=>p.age>=60))add('parent-care',T('父母的晚年，怎样分担照护？','父母的晚年，如何分擔照護？','How would you share care for your parents?'),T('父母需要的帮助变多了。你想与家人商量，兼顾陪伴、专业服务和自己的生活。','父母需要的協助變多了。你想與家人商量，兼顧陪伴、專業服務及自己的生活。','Your parents need more help. Discuss family time, professional support and everyone’s own responsibilities.'),[
    paid(life,'service',T('在预算内安排照护协助','在預算內安排照護協助','Arrange affordable care support'),.025,{relationships:3,health:1},'care'),
    free('share',T('与家人排班，轮流陪伴照顾','與家人排班，輪流陪伴照顧','Share care time with family'),T('用时间分担，不增加本次服务费。','用時間分擔，不增加本次服務費。','Share time without adding a service charge this time.'),{relationships:4,health:-.5})],5);
  if(adult&&life.age<=65&&life.year>=1985&&!s.completed.driving&&!s.drivingQualified&&!Number.isFinite(s.drivingAssessmentAge))add('driving',T('要不要学习驾驶？','要不要學習駕駛？','Would you like to learn to drive?'),T('你考虑花时间参加驾驶培训。学习与考核需要投入，报名并不等于直接取得资格。','你考慮花時間參加駕駛訓練。學習與考核需要投入，報名不等於直接取得資格。','Driving lessons take time and assessment. Paying for lessons does not immediately grant a licence.'),[
    paid(life,'learn',T('报名学习，并完成后续考核','報名學習，完成後續考核','Take lessons and complete the later assessment'),.07,{knowledge:2},'driving-course'),
    free('wait',T('暂不学，维持熟悉的出行方式','暫不學，維持熟悉出行方式','Keep your current travel choices'),T('不追加培训费，未来仍可考虑。','不追加訓練費，日後仍可考慮。','Add no training expense and consider it later.'),{happiness:1})],6);
  if(adult&&working&&!life.assets.house)add('rental',T('住得近一点，还是多存一点？','住近一點，還是多存一點？','A shorter commute or more savings?'),T('你比较了通勤与租住条件。换个住处可能更舒服，也会产生搬家和安置开支。','你比較通勤與租住條件。換住處可能更舒適，也會有搬家與安置開支。','You compare commuting and rented accommodation. Moving may help, while costing money and effort.'),[
    paid(life,'move',T('换到更适合通勤的住处','換到更適合通勤的住處','Move somewhere with a better commute'),.06,{health:2,happiness:3},'moving'),
    free('stay',T('先留在原处，继续积累储蓄','先留原處，繼續累積儲蓄','Stay and keep saving'),T('不增加本次搬家开支。','不增加本次搬家開支。','Add no moving cost this time.'),{happiness:1})],6);
  if(working&&life.age<=60)add('skills',T('工作之外，再学一门本领？','工作之外，再學一門本領？','Learn another skill alongside work?'),T('你遇到一个提升技能的机会。培训不能保证升职加薪，也可以先利用空闲时间自学。','你遇到提升技能的機會。訓練不能保證升職加薪，也可先利用空閒時間自學。','A chance to learn appears. A course does not guarantee promotion, and self-study is also possible.'),[
    paid(life,'course',T('参加与工作相关的技能课','參加工作相關技能課','Take a relevant skills course'),.035,{knowledge:3},'purchase-adultstudy'),
    free('self',T('借书请教，先用空闲时间自学','借書請教，先利用空閒自學','Use books and advice to study independently'),T('投入自己的时间，不新增课程费用。','投入自己的時間，不新增課程費。','Give your time without adding course expenses.'),{knowledge:2,happiness:-.5})],5);
  if(adult)add('trip',T('给生活留几天空闲','給生活留幾天空閒','Make room for a few days off'),T('你想从忙碌中抽出一点时间。远行、附近走走或在家休息，都有自己的滋味。','你想從忙碌中抽一點時間。遠行、附近走走或在家休息，各有滋味。','You want a pause from your routine. Travel, a local outing or rest at home each have their place.'),[
    paid(life,'travel',T('安排一次量力而行的短途旅行','安排一次量力短途旅行','Plan an affordable short trip'),.03,{happiness:4,knowledge:1},'travel'),
    free('local',T('到熟悉的公园走走','到熟悉公園走走','Spend time in a familiar park'),T('不增加旅费，给自己一些休息时间。','不增加旅費，給自己休息時間。','Add no travel expense and take time to rest.'),{health:2,happiness:2})],6);
  const furniture=shop.find(x=>['furniture','appliances'].includes(x.id)&&x.available);
  if(furniture&&adult)add('home-goods',T('家里有件东西，该换新了吗？','家裡有件東西，該換新了嗎？','Is it time to replace something at home?'),T('你重新看了看家中的起居用品。改善舒适，也要留足日常生活的积蓄。','你重新看看家中起居用品。改善舒適，也要留足日常生活積蓄。','You review household furnishings. Comfort matters, along with keeping enough savings for daily life.'),[
    choice('replace',furniture.name,T(`模型支出约 ¥${amount(furniture.cost)}；按当前年代添置。`,`模型支出約 ¥${amount(furniture.cost)}；依當前年代添置。`,`Modeled cost CNY ${amount(furniture.cost)}, appropriate to the period.`),furniture.cost,{}, {purchase:furniture.id}),
    free('repair',T('先整理保养，暂不更换','先整理保養，暫不更換','Care for what you have and wait'),T('这次不追加购买支出。','這次不追加購買支出。','Make no new purchase this time.'),{happiness:1})],7);
  if(life.retired)add('retirement-hobby',T('退休后的日子，想添点什么？','退休後的日子，想添些什麼？','What would you add to retirement?'),T('时间慢了下来，你想给每周留一件期待的小事。兴趣、邻里和休息，可以按自己的心意安排。','時間慢下來，你想每週留一件期待的小事。興趣、鄰里及休息，可按自己心意安排。','With more time, you want something to look forward to each week. Choose an interest, neighbors or rest in your own way.'),[
    paid(life,'learn',T('参加一项适合自己的兴趣活动','參加適合自己的興趣活動','Join an interest activity that suits you'),.012,{happiness:3,knowledge:1},'retirement-hobby'),
    free('neighbors',T('与邻居散步聊天，互相照应','與鄰居散步聊天，互相照應','Walk and talk with neighbors'),T('不新增课程费，在日常往来中建立支持。','不新增課程費，在日常往來建立支持。','Add no course fees and build support through ordinary contact.'),{health:1,relationships:3})],5);
  return rows;
}

export function offerLifeDecision(life,env){
  if(life.phase!=='life'||life.pending)return false;
  const s=state(life);discoverMilestones(life);
  s.occasions=s.occasions.filter(o=>!s.completed[o.id]&&life.age<=o.expiresAt);
  // An occasion is offered once and checked against the real family/study state.
  const occasion=s.occasions.find(o=>!o.offered&&(
    o.topic==='wedding'?life.family?.partner?.married&&life.family.partner.alive:
    o.topic==='baby-banquet'?life.family.children.some(c=>c.alive&&childKey(c)===o.childKey):
    life.school?.stage==='university'&&life.school.admissionTier==='research-public'));
  let scenario=occasion?ceremony(life,occasion):null;
  if(!scenario){
    const candidates=ordinaryScenarios(life).filter(row=>life.age-(s.lastOffered[row.topic]??-100)>=row.cooldown);
    if(!candidates.length)return false;
    const min=Math.min(...candidates.map(row=>s.offerCounts[row.topic]||0));
    const least=candidates.filter(row=>(s.offerCounts[row.topic]||0)===min);
    scenario=least[env.integer(life,0,least.length-1)];
  }
  const options=scenario.options.filter(o=>!o.cost||canSpend(life,o.cost,o.purchase?'purchase-'+o.purchase:o.purpose||'family'));
  if(!options.length)return false;
  const result=env.decision(life,'life-'+scenario.topic,scenario.title,scenario.description,options.map(o=>env.option(o.id,o.label,o.description,o.cost?1.2:1.8)),{scenario:scenario.topic,occasionKey:scenario.occasionKey||null,options,modelOnly:true});
  if(result===false)return false;
  s.lastOffered[scenario.topic]=life.age;s.offerCounts[scenario.topic]=(s.offerCounts[scenario.topic]||0)+1;
  if(occasion)occasion.offered=true;
  return true;
}

export function resolveLifeDecision(life,pending,optionId,env){
  if(!pending?.action?.startsWith('life-'))return false;
  const s=state(life),data=pending.data||{},selected=data.options?.find(o=>o.id===optionId);
  if(!selected)return true;
  if(data.scenario==='pet'&&['cat','dog'].includes(optionId)&&s.petAdopted)return true;
  // Recheck actual payment/purchase eligibility at selection time, including saves.
  if(selected.purchase){
    if(!purchaseEconomyItem(life,selected.purchase,env))env.log(life,T('当前资金或生活条件已变化，这次购买暂缓，你保留了积蓄。','目前資金或生活條件已變，這次購買暫緩，你保留積蓄。','Your funds or circumstances changed. The purchase was postponed and you kept your savings.'),'money');
    return true;
  }
  if(selected.cost>0&&!spend(life,selected.cost,selected.purpose||'family')){
    env.log(life,T('这项安排超出了眼下的预算，你暂缓开支，选择先照顾好日常生活。','這項安排超出眼下預算，你暫緩開支，先照顧日常生活。','This plan exceeded your present budget. You postponed it to protect daily living costs.'),'money');
    return true;
  }
  env.effects(life,selected.effects||{});
  if(selected.cost>0)env.log(life,T(`这次${selected.label.zhCN}，共安排模型支出 ¥${amount(selected.cost)}。`,`這次${selected.label.zhTW}，共安排模型支出 ¥${amount(selected.cost)}。`,`You chose “${selected.label.en}”, with modeled spending of CNY ${amount(selected.cost)}.`),'spending');
  if(data.occasionKey)s.completed[data.occasionKey]=life.age+1;
  if(data.scenario==='driving'&&optionId==='learn'){
    s.completed.driving=life.age+1;s.drivingAssessmentAge=life.age+1;
  }
  if(data.scenario==='pet'&&['cat','dog'].includes(optionId)){
    s.petAdopted=true;s.pet={kind:optionId,adoptedAt:life.age,years:0,lifespan:env.integer(life,10,15),alive:true,inHome:true};
    env.log(life,T('你为宠物安排了每天的照护。今后每年会计入食物、清洁与常规照护预算。','你為寵物安排每天照護。今後每年會計入食物、清潔與日常照護預算。','You arranged daily care for the pet. Food, cleaning and routine care will enter each annual budget.'),'family');
  }
  return true;
}

export function lifeDecisionYear(life,env){
  const s=state(life);
  if(s.lastSettledYear===life.year||life.phase!=='life')return;
  s.lastSettledYear=life.year;
  if(s.drivingAssessmentAge!==undefined&&life.age>=s.drivingAssessmentAge){
    s.drivingAssessmentAge=undefined;s.drivingQualified=true;
    env.log(life,T('完成培训与模拟考核后，你取得了驾驶资格。这段练习没有让生活自动多出一辆车。','完成訓練與模擬考核後，你取得駕駛資格；仍需另行安排購車。','After lessons and a modeled assessment, you gained a driving qualification. Buying a car remains a separate choice.'),'life',{knowledge:1,happiness:2});
  }
  const pet=s.pet;
  if(!pet?.alive||!pet.inHome||life.age===pet.adoptedAt)return;
  pet.years++;
  if(pet.years>=pet.lifespan){
    pet.alive=false;
    env.log(life,T('陪伴多年的宠物走到了生命尽头。你认真安放了这段共同生活的记忆。','陪伴多年的寵物走到生命盡頭。你認真安放這段共同生活的記憶。','Your pet reached the end of its life after years together. You kept the memory of that companionship.'),'family',{happiness:-3});
    return;
  }
  const cost=Math.round(scale(life)*.018);
  if(spend(life,cost,'pet-care')){
    env.log(life,T(`你为宠物的食物、清洁与日常照护支出 ¥${amount(cost)}。`,`你為寵物食物、清潔與日常照護支出 ¥${amount(cost)}。`,`You spent CNY ${amount(cost)} on pet food, cleaning and routine care.`),'spending',{happiness:1});
  }else{
    pet.inHome=false;
    env.log(life,T('生活预算难以继续承担养宠开支，你联系可信赖的家人或领养人，为宠物安排了稳定的新照护。','生活預算難以繼續承擔養寵開支，你聯絡可信賴家人或領養人，為寵物安排穩定新照護。','When your budget could no longer cover pet care, you arranged a stable new home with trusted family or an adopter.'),'family',{happiness:-2});
  }
}
