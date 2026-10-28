/** Personal moments never create unbooked spending or replace major decisions. */
const T=(zhCN,zhTW,en)=>({zhCN,zhTW,en});
const hasSchool=l=>!!l.school, working=l=>!!l.job&&!l.retired, partner=l=>!!l.family?.partner?.alive;
const parents=l=>[l.family?.mother,l.family?.father].some(p=>p?.alive);
const children=l=>l.family?.children?.some(p=>p.alive&&p.age<16);
const adultChildren=l=>l.family?.children?.some(p=>p.alive&&p.age>=18);
const siblings=l=>l.family?.siblings?.some(p=>p.alive);
const healthy=l=>(l.stats?.health??80)>=45;
const entries=[];
function group(prefix,min,max,rows,{when=()=>true,from=1950,effects={happiness:1},topics=[]}={}){
  rows.forEach(([zhCN,zhTW,en],i)=>entries.push({id:prefix+'-'+(i+1),topic:topics[i]||prefix,min,max,from,when,effects,text:T(zhCN,zhTW,en)}));
}
group('infancy',0,2,[
 ['你追着拨浪鼓的声音转头，逗得照看你的人笑了。','你追著撥浪鼓的聲音轉頭，逗得照看你的人笑了。','You turned toward a rattle, making your caregiver smile.'],
 ['你紧紧攥住伸来的手指，迟迟不肯松开。','你緊緊攥住伸來的手指，遲遲不肯鬆開。','You held a finger tightly and refused to let go.'],
 ['熟悉的摇篮曲响起，你慢慢安静下来。','熟悉的搖籃曲響起，你慢慢安靜下來。','A familiar lullaby gradually settled you.'],
 ['你盯着镜子里的小脸，伸手碰了碰。','你盯著鏡子裡的小臉，伸手碰了碰。','You reached toward the little face in the mirror.'],
 ['你爬过垫子，终于够到了喜欢的玩具。','你爬過墊子，終於夠到了喜歡的玩具。','You crawled across the mat to reach your favourite toy.'],
 ['你在熟悉的怀抱里听着窗外的雨声，慢慢睡着了。','你在熟悉的懷抱裡聽著窗外的雨聲，慢慢睡著了。','You fell asleep in familiar arms to the sound of rain.'],
],{topics:['baby-play','baby-growth','baby-rest','baby-discovery','baby-growth','baby-rest']});
group('toddler',2,5,[
 ['你追着地上的影子跑，发现它总是跟着自己。','你追著地上的影子跑，發現它總是跟著自己。','You chased your shadow and found it always followed you.'],
 ['雨后的小水洼映着天空，你蹲下来看了很久。','雨後的小水窪映著天空，你蹲下來看了很久。','You watched the sky reflected in a puddle after rain.'],
 ['你学着叠好小衣服，虽然歪歪扭扭，却很得意。','你學著疊好小衣服，雖然歪歪扭扭，卻很得意。','You proudly folded your little clothes into a crooked pile.'],
 ['睡前故事讲到一半，你追问故事里的人去了哪里。','睡前故事講到一半，你追問故事裡的人去了哪裡。','You interrupted a bedtime story to ask where its characters had gone.'],
 ['你帮忙揉了一小团面，手上脸上都沾了面粉。','你幫忙揉了一小團麵，手上臉上都沾了麵粉。','Helping knead dough left flour on your hands and face.'],
 ['你指着天上的云，把它们想象成各种动物。','你指著天上的雲，把它們想像成各種動物。','You imagined different animals in the clouds.'],
 ['你把玩具借给另一个孩子，约好玩完就还。','你把玩具借給另一個孩子，約好玩完就還。','You lent a toy to another child and agreed when to return it.'],
 ['你捡起形状不同的落叶，排成一支小小的队伍。','你撿起形狀不同的落葉，排成一支小小的隊伍。','You arranged fallen leaves into a little line.'],
 ['你边数台阶边往上走，数错了又从头开始。','你邊數臺階邊往上走，數錯了又從頭開始。','You counted steps as you climbed, starting again after a mistake.'],
 ['你画了一幅谁也看不懂的画，却坚持认真讲解。','你畫了一幅誰也看不懂的畫，卻堅持認真講解。','You earnestly explained a drawing no one could quite understand.'],
 ['你试了好几次，终于自己扣好了衣服上的扣子。','你試了好幾次，終於自己扣好了衣服上的扣子。','After several attempts, you buttoned your clothes on your own.'],
 ['你学着把玩过的东西归位，忽然记起每件东西的小位置。','你學著把玩過的東西歸位，忽然記起每件東西的小位置。','Tidying your toys, you remembered where each one belonged.'],
],{topics:['child-discovery','child-outdoors','child-care','child-story','child-care','child-discovery','child-friends','child-outdoors','child-language','child-play','child-care','child-play']});
group('childhood',4,12,[
 ['你在空地上追着风筝跑，线绷直时忍不住欢呼。','你在空地上追著風箏跑，線繃直時忍不住歡呼。','You ran after a kite and cheered when its string pulled taut.'],
 ['捉迷藏时你藏得太认真，最后忍不住笑出了声。','捉迷藏時你藏得太認真，最後忍不住笑出了聲。','You hid so earnestly in hide-and-seek that you burst out laughing.'],
 ['你照看的一颗种子冒出了芽，每天都要去看一眼。','你照看的一顆種子冒出了芽，每天都要去看一眼。','A seed you tended sprouted, and you checked on it daily.'],
 ['你学会一笔一画写自己的名字，觉得这几个字格外特别。','你學會一筆一畫寫自己的名字，覺得這幾個字格外特別。','Writing your name carefully made those characters feel special.'],
 ['你把叠好的纸船放进浅水里，看它慢慢漂远。','你把疊好的紙船放進淺水裡，看它慢慢漂遠。','You watched a folded paper boat drift through shallow water.'],
 ['你和伙伴用几块石头画出游戏的边界，认真商量规则。','你和夥伴用幾塊石頭畫出遊戲的邊界，認真商量規則。','You and friends marked a game with stones and agreed on rules.'],
],{topics:['child-outdoors','child-play','child-discovery','child-language','child-play','child-friends']});
group('school',6,22,[
 ['同桌忘了带铅笔，你把备用的一支递了过去。','同桌忘了帶鉛筆，你把備用的一支遞了過去。','You offered a spare pencil to your desk mate.'],
 ['你站起来背完课文，坐下时还带着一点紧张。','你站起來背完課文，坐下時還帶著一點緊張。','You recited a passage and sat down still feeling nervous.'],
 ['你从图书室借到一本喜欢的书，小心夹好了书签。','你從圖書室借到一本喜歡的書，小心夾好了書籤。','You borrowed a favourite book and carefully placed a bookmark.'],
 ['轮到你值日，你和同学把黑板擦得干干净净。','輪到你值日，你和同學把黑板擦得乾乾淨淨。','On classroom duty, you and classmates cleaned the blackboard.'],
 ['跳绳时你比上次多坚持了一会儿，喘着气也很开心。','跳繩時你比上次多堅持了一會兒，喘著氣也很開心。','You skipped rope longer than before, happy despite being out of breath.'],
 ['你重做一道错题，终于想明白自己错在哪里。','你重做一道錯題，終於想明白自己錯在哪裡。','Reworking an answer, you finally understood your mistake.'],
 ['课间你站在操场边，看着球从人群上方飞过。','課間你站在操場邊，看著球從人群上方飛過。','At break, you watched a ball sail above the playground crowd.'],
 ['老师读了你作文中的几句话，你觉得文字也能被人记住。','老師讀了你作文中的幾句話，你覺得文字也能被人記住。','A teacher read lines from your essay, making your words feel memorable.'],
 ['放学时突然下雨，你和同学一起在屋檐下等雨停。','放學時突然下雨，你和同學一起在屋簷下等雨停。','You and classmates waited under an eave for rain to stop after school.'],
 ['运动会上你为班里同学加油，喊得嗓子有些哑。','運動會上你為班裡同學加油，喊得嗓子有些啞。','You cheered classmates at sports day until your voice grew hoarse.'],
 ['朋友在笔记本上留下一句鼓励，你没有舍得擦掉。','朋友在筆記本上留下一句鼓勵，你沒有捨得擦掉。','You kept a friend’s encouraging words in your notebook.'],
 ['你问出一道不懂的题，发现也有同学和自己一样困惑。','你問出一道不懂的題，發現也有同學和自己一樣困惑。','Asking a question showed that classmates shared your confusion.'],
 ['拍班级合照时，你站在熟悉的同学中间，记住了那天的阳光。','拍班級合照時，你站在熟悉的同學中間，記住了那天的陽光。','In a class photograph, you remembered the sunlight among familiar classmates.'],
 ['你和同学整理借来的资料，各自记下还想继续了解的内容。','你和同學整理借來的資料，各自記下還想繼續了解的內容。','Sorting borrowed materials with classmates, you noted what to explore next.'],
 ['一次课堂讨论中，你尝试把自己的理由讲得更清楚。','一次課堂討論中，你嘗試把自己的理由講得更清楚。','You tried to explain your reasoning clearly during a class discussion.'],
 ['你翻到以前的作业，才发觉许多当时不会的事已经学会。','你翻到以前的作業，才發覺許多當時不會的事已經學會。','Old homework showed how much you had learned since then.'],
],{when:hasSchool,effects:{knowledge:1,happiness:.5},topics:['school-help','school-confidence','school-reading','school-community','school-sport','school-study','school-outdoors','school-confidence','school-friends','school-sport','school-friends','school-study','school-memory','school-discovery','school-confidence','school-reflection']});
group('youth',10,25,[
 ['收音机响起熟悉的歌，你跟着轻轻哼了起来。','收音機響起熟悉的歌，你跟著輕輕哼了起來。','A familiar song on the radio made you hum along.'],
 ['你在日记里写下小烦恼，合上本子时轻松了一点。','你在日記裡寫下小煩惱，合上本子時輕鬆了一點。','Writing a worry in your diary left you feeling lighter.'],
 ['你主动和闹别扭的朋友说了话，误会终于解开。','你主動和鬧彆扭的朋友說了話，誤會終於解開。','You spoke to a friend after an argument and cleared up the misunderstanding.'],
 ['站在高处望着熟悉的地方，你认真想象起远方。','站在高處望著熟悉的地方，你認真想像起遠方。','From a high place, you looked over familiar places and imagined distant ones.'],
 ['你给朋友写信，把当面没说完的话慢慢写清楚。','你給朋友寫信，把當面沒說完的話慢慢寫清楚。','A letter to a friend found words you had missed in person.'],
 ['你学会缝牢松掉的扣子，发现照顾自己也有不少门道。','你學會縫牢鬆掉的扣子，發現照顧自己也有不少門道。','Sewing on a button showed you the skills of caring for yourself.'],
 ['你帮忙收拾公共活动场地，和几位同龄人熟悉起来。','你幫忙收拾公共活動場地，和幾位同齡人熟悉起來。','Tidying a shared activity space helped you meet people your age.'],
 ['你和伙伴约好再跑一圈，最后一段路彼此打着气。','你和夥伴約好再跑一圈，最後一段路彼此打著氣。','You ran another lap with a companion, encouraging each other at the end.'],
],{topics:['youth-culture','youth-reflection','youth-friends','youth-discovery','youth-friends','home-skills','community-service','youth-sport']});
group('young-adult',18,40,[
 ['你摸清常走路线的一条近道，日子开始有了自己的节奏。','你摸清常走路線的一條近道，日子開始有了自己的節奏。','Finding a shortcut helped you settle into your own rhythm.'],
 ['你照着做法完成一道菜，味道不算完美，却很满足。','你照著做法完成一道菜，味道不算完美，卻很滿足。','You cooked from a recipe; imperfect, but satisfying.'],
 ['你在地图上找到常听人提起的地方，计划有机会去看看。','你在地圖上找到常聽人提起的地方，計劃有機會去看看。','You found a much-mentioned place on a map and hoped to visit.'],
 ['你修好一件小物件，省去丢弃，也多了一点成就感。','你修好一件小物件，省去丟棄，也多了一點成就感。','Repairing a small object saved it from the bin and felt rewarding.'],
 ['面对不愿勉强自己的事，你练习把拒绝说得坦诚。','面對不願勉強自己的事，你練習把拒絕說得坦誠。','You practised giving an honest no to something you did not want.'],
 ['和老同学再次见面，你们发现各自走上了不同的路。','和老同學再次見面，你們發現各自走上了不同的路。','Meeting an old classmate showed how your paths had diverged.'],
 ['你把收支重新记了一遍，对接下来的安排有了清楚的打算。','你把收支重新記了一遍，對接下來的安排有了清楚的打算。','Reviewing your accounts gave you a clearer plan for the months ahead.'],
 ['你帮邻居留意晾着的衣服，一场急雨让你们熟络起来。','你幫鄰居留意晾著的衣服，一場急雨讓你們熟絡起來。','Watching a neighbour’s laundry during rain helped you get acquainted.'],
 ['不用赶路的清晨，你慢慢吃完早饭，听见窗外的鸟鸣。','不用趕路的清晨，你慢慢吃完早飯，聽見窗外的鳥鳴。','On an unhurried morning, you ate slowly and heard birds outside.'],
 ['你给一个长远目标写下第一步，决定从眼前能做的事开始。','你給一個長遠目標寫下第一步，決定從眼前能做的事開始。','You wrote the first step toward a distant goal and began with what was possible.'],
],{topics:['adult-rhythm','home-skills','adult-discovery','home-skills','adult-reflection','friend-reunion','adult-finance','community-neighbour','adult-rest','adult-resilience']});
group('work',16,75,[
 ['同事教你一个省力的办法，你记在了心里。','同事教你一個省力的辦法，你記在了心裡。','A colleague showed you an easier method, and you remembered it.'],
 ['你把易遗漏的步骤列成清单，忙起来时少了些慌乱。','你把易遺漏的步驟列成清單，忙起來時少了些慌亂。','A checklist made busy work feel calmer.'],
 ['午间休息时，你和同事聊起工作之外的兴趣。','午間休息時，你和同事聊起工作之外的興趣。','During a break, you and colleagues talked about interests beyond work.'],
 ['你重新核对一处细节，及时发现一个差点漏掉的问题。','你重新核對一處細節，及時發現一個差點漏掉的問題。','Rechecking a detail caught a problem that nearly slipped through.'],
 ['你认真完成的事情得到一句感谢，回家的脚步轻快了一些。','你認真完成的事情得到一句感謝，回家的腳步輕快了一些。','A thank-you for careful work made your walk home feel lighter.'],
 ['新来的同事问起流程，你耐心讲了一遍自己的经验。','新來的同事問起流程，你耐心講了一遍自己的經驗。','You patiently explained a work process to a new colleague.'],
 ['你和同事商量清楚分工，把责任说清后少了许多误会。','你和同事商量清楚分工，把責任說清後少了許多誤會。','Agreeing on responsibilities with colleagues prevented misunderstandings.'],
 ['忙过一阵后，你提醒自己按时休息，没有一直硬扛疲惫。','忙過一陣後，你提醒自己按時休息，沒有一直硬扛疲憊。','After a busy stretch, you rested rather than pushing through fatigue.'],
 ['通勤景色换了季节，你发现自己已走过许多个来回。','通勤景色換了季節，你發現自己已走過許多個來回。','A new season on your commute recalled countless trips along that route.'],
 ['同事遇到难处，你先听对方说完，没有急着出主意。','同事遇到難處，你先聽對方說完，沒有急著出主意。','You listened to a struggling colleague before offering advice.'],
 ['你把生疏的操作练熟，处理同类事情时更有把握。','你把生疏的操作練熟，處理同類事情時更有把握。','Practising an unfamiliar task gave you more confidence.'],
 ['休息日你没安排太多事情，让紧绷的心慢慢松下来。','休息日你沒安排太多事情，讓緊繃的心慢慢鬆下來。','Leaving a day off unplanned helped you slowly unwind.'],
],{when:working,effects:{knowledge:.7,happiness:1},topics:['work-learning','work-method','work-friends','work-detail','work-recognition','work-help','work-communication','work-rest','work-routine','work-friends','work-learning','work-rest']});
group('unemployed',18,60,[
 ['你重新整理自己会做的事，给找工作定下具体的小目标。','你重新整理自己會做的事，給找工作定下具體的小目標。','Reviewing your skills helped set concrete goals for finding work.'],
 ['熟人聊起招工消息，你记下可以进一步打听的线索。','熟人聊起招工消息，你記下可以進一步打聽的線索。','An acquaintance mentioned a job lead, and you noted how to follow it up.'],
],{when:l=>!l.job&&!l.school&&!l.retired,effects:{knowledge:1}});
group('partner',18,110,[
 ['你和伴侣散步时聊起一天的小事，路不长，却走得很慢。','你和伴侶散步時聊起一天的小事，路不長，卻走得很慢。','A slow walk with your partner gave time to share the day’s small details.'],
 ['你和伴侣重新分了分家务，决定让彼此都少累一点。','你和伴侶重新分了分家務，決定讓彼此都少累一點。','You and your partner shared out chores to ease each other’s load.'],
 ['争执后你们把各自的担心说开，比争个对错更踏实。','爭執後你們把各自的擔心說開，比爭個對錯更踏實。','After an argument, sharing worries felt better than deciding who was right.'],
 ['一首旧歌让你们想起刚认识的样子，忍不住相视而笑。','一首舊歌讓你們想起剛認識的樣子，忍不住相視而笑。','An old song recalled your early days together and made you both smile.'],
 ['你和伴侣一起准备家常饭，一边忙一边商量明天的安排。','你和伴侶一起準備家常飯，一邊忙一邊商量明天的安排。','You and your partner prepared an ordinary meal while planning tomorrow.'],
 ['你们聊清楚各自想要的独处时间，相处多了一点从容。','你們聊清楚各自想要的獨處時間，相處多了一點從容。','Agreeing on time alone helped you feel more at ease together.'],
],{when:partner,effects:{relationships:1,happiness:1},topics:['partner-company','partner-home','partner-communication','partner-memory','partner-home','partner-communication']});
group('parents',8,85,[
 ['你听父母讲年轻时的事，才知道他们也有过相似的烦恼。','你聽父母講年輕時的事，才知道他們也有過相似的煩惱。','Your parents’ youthful stories included worries much like yours.'],
 ['你向父母问起一道家常菜的做法，把熟悉的味道记下来。','你向父母問起一道家常菜的做法，把熟悉的味道記下來。','You asked your parents for a family recipe and noted a familiar flavour.'],
 ['父母讲起一件旧事，这次你问了几个从没问过的细节。','父母講起一件舊事，這次你問了幾個從沒問過的細節。','Listening to an old family story, you asked about unnoticed details.'],
],{when:parents,effects:{relationships:1,knowledge:.5}});
group('siblings',8,105,[
 ['你和兄弟姐妹为小事争了几句，过一会儿又一起笑了。','你和兄弟姊妹為小事爭了幾句，過一會兒又一起笑了。','An argument over something small ended in laughter with a sibling.'],
 ['你和兄弟姐妹聊起小时候的糗事，那些争吵早已成了笑话。','你和兄弟姊妹聊起小時候的糗事，那些爭吵早已成了笑話。','You and a sibling laughed over childhood mishaps and old arguments.'],
 ['你主动问候兄弟姐妹，发现一句近况也能让人安心。','你主動問候兄弟姊妹，發現一句近況也能讓人安心。','Checking in with a sibling, you found a little news reassuring.'],
],{when:siblings,effects:{relationships:1}});
group('parenting',18,80,[
 ['孩子问了一个你没想过的问题，你们一起找答案。','孩子問了一個你沒想過的問題，你們一起找答案。','Your child asked something you had never considered, and you searched together.'],
 ['孩子拿画给你看，你认真听完了画里的故事。','孩子拿畫給你看，你認真聽完了畫裡的故事。','Your child showed you a drawing, and you listened to its story.'],
 ['孩子做事慢了一点，你忍住催促，陪着把事情做完。','孩子做事慢了一點，你忍住催促，陪著把事情做完。','You resisted hurrying your child and patiently helped finish a task.'],
 ['你陪孩子认路边植物，孩子记住的名字比你想的还多。','你陪孩子認路邊植物，孩子記住的名字比你想的還多。','Naming plants together, you found your child remembered more than expected.'],
 ['孩子睡着后，你把散落的小东西归好，屋子安静下来。','孩子睡著後，你把散落的小東西歸好，屋子安靜下來。','After your child fell asleep, you tidied little things in the quiet house.'],
],{when:children,effects:{relationships:1,happiness:1},topics:['child-learning','child-memory','child-care','child-outdoors','child-care']});
group('adult-child',35,120,[
 ['长大的孩子自己拿定主意，你试着先听理由，再给建议。','長大的孩子自己拿定主意，你試著先聽理由，再給建議。','Your grown child made a decision, and you listened before advising.'],
 ['成年子女聊起近况，你认真记住生活里那些小变化。','成年子女聊起近況，你認真記住生活裡那些小變化。','Your grown child shared news, and you remembered the small changes.'],
 ['你向成年子女请教新东西，发现学习也可以倒过来。','你向成年子女請教新東西，發現學習也可以倒過來。','You enjoyed learning something new from your grown child.'],
],{when:adultChildren,effects:{relationships:1,knowledge:.5}});
group('midlife',35,70,[
 ['你把常用和闲置的东西分开，整理后的屋子清爽了不少。','你把常用和閒置的東西分開，整理後的屋子清爽了不少。','Sorting used and unused belongings made your home feel clearer.'],
 ['你推掉勉强应承的安排，给真正重要的人和事留出时间。','你推掉勉強應承的安排，給真正重要的人和事留出時間。','You dropped reluctant commitments to make time for what mattered.'],
 ['朋友倾诉压力，你们约好遇到难处时别一个人硬撑。','朋友傾訴壓力，你們約好遇到難處時別一個人硬撐。','You and a stressed friend agreed not to face hard times alone.'],
 ['你留意久坐后的僵硬，起身活动几分钟，舒服了一点。','你留意久坐後的僵硬，起身活動幾分鐘，舒服了一點。','Moving after a long sit eased some stiffness.'],
 ['你提前处理晚间琐事，给自己留下不用熬夜的晚上。','你提前處理晚間瑣事，給自己留下不用熬夜的晚上。','Finishing evening chores early left a night without staying up late.'],
 ['翻看以前的笔记，你发现有些问题已经有了不同的答案。','翻看以前的筆記，你發現有些問題已經有了不同的答案。','Old notes revealed how your answers to familiar questions had changed.'],
 ['计划临时变了，你重新排好顺序，决定一件件来。','計劃臨時變了，你重新排好順序，決定一件件來。','When plans changed, you reordered them and took things one at a time.'],
 ['熟悉地方的门面换了，记忆里的声音却还在。','熟悉地方的門面換了，記憶裡的聲音卻還在。','A familiar place had a new facade, though its old sounds stayed in memory.'],
 ['有人请教你熟悉的事，那些不起眼的经验竟也能帮上忙。','有人請教你熟悉的事，那些不起眼的經驗竟也能幫上忙。','Someone’s question showed how useful your ordinary experience could be.'],
 ['你给旧照片标上名字和年份，怕忘记那些具体的日子。','你給舊照片標上名字和年份，怕忘記那些具體的日子。','You labelled old photos to preserve their names, years and specific days.'],
],{topics:['adult-home','adult-reflection','friend-support','adult-health','adult-rest','adult-learning','adult-resilience','adult-memory','adult-learning','adult-memory']});
group('retirement',40,120,[
 ['不用赶着上班的早晨，你按自己的节奏安排好一天。','不用趕著上班的早晨，你按自己的節奏安排好一天。','Without rushing to work, you planned a day at your own pace.'],
 ['邻里来请教你拿手的事，你把积累的经验慢慢讲给他们。','鄰里來請教你拿手的事，你把累積的經驗慢慢講給他們。','You shared years of experience with neighbours who asked for advice.'],
 ['你读完从前没时间看的文章，还记下自己的想法。','你讀完從前沒時間看的文章，還記下自己的想法。','You read an article you once had no time for and added your thoughts.'],
 ['你给散步、家务和休息各留一点时间，日子过得有条理。','你給散步、家務和休息各留一點時間，日子過得有條理。','Making room for walks, chores and rest gave your day a comfortable rhythm.'],
],{when:l=>!!l.retired,topics:['retire-rhythm','retire-contribution','retire-learning','retire-rhythm']});
group('elder',60,120,[
 ['公园里有人认出了常来散步的你，招呼你坐下聊了一会儿。','公園裡有人認出了常來散步的你，招呼你坐下聊了一會兒。','Someone in the park recognised you and invited you to sit and talk.'],
 ['午后光落在窗边，你慢慢喝完温水，听着远处的动静。','午後光落在窗邊，你慢慢喝完溫水，聽著遠處的動靜。','You drank warm water by a sunlit window and listened to distant sounds.'],
 ['想起年轻时的小事，细节格外清楚，于是找人讲了讲。','想起年輕時的小事，細節格外清楚，於是找人講了講。','You shared a surprisingly vivid memory of a youthful moment.'],
 ['你慢慢写下几行字，手里的笔让心也安静了一些。','你慢慢寫下幾行字，手裡的筆讓心也安靜了一些。','Writing a few lines slowly helped settle your thoughts.'],
 ['照看窗边植物时，你发现新叶已经悄悄长出来。','照看窗邊植物時，你發現新葉已經悄悄長出來。','Tending a plant, you found a new leaf had quietly appeared.'],
 ['老朋友喊出你的名字，你们笑着数了数相识的年头。','老朋友喊出你的名字，你們笑著數了數相識的年頭。','An old friend called your name, and you counted your years of friendship.'],
 ['你把要记住的事情写成纸条，放在容易看见的地方。','你把要記住的事情寫成紙條，放在容易看見的地方。','You put reminders on little notes where you could see them.'],
 ['你按舒服的幅度活动手脚，没有和年轻时的自己较劲。','你按舒服的幅度活動手腳，沒有和年輕時的自己較勁。','You moved gently, without comparing yourself to your younger days.'],
 ['下雨时你留在屋里听雨声，把手边的旧物擦拭干净。','下雨時你留在屋裡聽雨聲，把手邊的舊物擦拭乾淨。','You stayed inside listening to rain and cleaning familiar objects.'],
 ['听见熟悉的乡音，你想起小时候的街巷和喊过的名字。','聽見熟悉的鄉音，你想起小時候的街巷和喊過的名字。','A familiar accent brought back childhood lanes and names.'],
 ['一次闲聊里，你听到一位新朋友不同的人生故事。','一次閒聊裡，你聽到一位新朋友不同的人生故事。','A casual conversation brought a new friend’s very different life story.'],
 ['你把家常做法写下来，连“少许”是多少也尽量说清。','你把家常做法寫下來，連「少許」是多少也盡量說清。','You wrote down a recipe, carefully explaining even a pinch.'],
 ['你发现一天不必塞满事情，从容做完一两件也很好。','你發現一天不必塞滿事情，從容做完一兩件也很好。','You found a day need not be full; doing a few things calmly was enough.'],
 ['天气转凉，你提前把常用衣物放到顺手的地方。','天氣轉涼，你提前把常用衣物放到順手的地方。','As weather cooled, you put warm clothes within easy reach.'],
 ['你想起帮过自己的人，想在能联系时认真道一声谢。','你想起幫過自己的人，想在能聯絡時認真道一聲謝。','Remembering someone who helped you, you hoped to thank them properly.'],
 ['用了多年的小物还在身边，让你想起一段不常提的往事。','用了多年的小物還在身邊，讓你想起一段不常提的往事。','An object kept for years brought back a seldom-told memory.'],
 ['天气合适时，你到门口坐坐，让阳光暖一暖肩膀。','天氣合適時，你到門口坐坐，讓陽光暖一暖肩膀。','In pleasant weather, you sat outside and let sunshine warm your shoulders.'],
 ['年轻人讲起难处，你没有比较年代，只是认真听。','年輕人講起難處，你沒有比較年代，只是認真聽。','You listened to a younger person’s difficulties without comparing generations.'],
 ['你午后小睡一会儿，醒来再慢慢做完今天的事。','你午後小睡一會兒，醒來再慢慢做完今天的事。','After an afternoon nap, you finished your tasks at an easy pace.'],
 ['你固定好常用物品的位置，做日常小事更顺手了。','你固定好常用物品的位置，做日常小事更順手了。','Keeping everyday things in fixed places made daily tasks easier.'],
 ['别人顺手帮你一件小事，你的感谢让对方也露出笑容。','別人順手幫你一件小事，你的感謝讓對方也露出笑容。','Someone helped with a little task, and your thanks made them smile.'],
 ['你把一段想了很久的话慢慢说清，听的人也放慢了语速。','你把一段想了很久的話慢慢說清，聽的人也放慢了語速。','You explained a long-held thought slowly, and your listener slowed down too.'],
],{topics:['elder-social','elder-rest','elder-memory','elder-learning','elder-home','elder-social','elder-care','elder-health','elder-rest','elder-memory','elder-social','elder-home','elder-reflection','elder-care','elder-reflection','elder-memory','elder-health','elder-social','elder-rest','elder-home','elder-reflection','elder-learning']});
group('rural',6,95,[
 ['雨后田埂有泥土气味，你沿着熟悉的小路慢慢走。','雨後田埂有泥土氣味，你沿著熟悉的小路慢慢走。','The field path smelled of earth as you walked after rain.'],
 ['周围田地换了一季颜色，你从日常景色里认出时节。','周圍田地換了一季顏色，你從日常景色裡認出時節。','Changing field colours marked a new season.'],
 ['邻里一起清理路边杂物，你也顺手搭了把手。','鄰里一起清理路邊雜物，你也順手搭了把手。','You joined neighbours clearing clutter beside a local path.'],
],{when:l=>!l.urban&&healthy(l),topics:['place-outdoors','place-season','community-service']});
group('urban',6,100,[
 ['行道树换了叶色，你意识到这一年已经走了很远。','行道樹換了葉色，你意識到這一年已經走了很遠。','Changing street leaves reminded you how much of the year had passed.'],
 ['换一条步行路线，你发现熟悉街区还有没留意过的一面。','換一條步行路線，你發現熟悉街區還有沒留意過的一面。','A new walking route revealed an unnoticed side of your neighbourhood.'],
 ['街角老地方重新开门，经过时你想起曾在那里停留的人。','街角老地方重新開門，經過時你想起曾在那裡停留的人。','An old corner reopened, recalling people who once stopped there.'],
],{when:l=>!!l.urban&&healthy(l),topics:['place-season','place-discovery','place-memory']});
group('festival',6,110,[
 ['过年前你帮忙摆正春联，来回看了几次才满意。','過年前你幫忙擺正春聯，來回看了幾次才滿意。','You helped straighten a New Year couplet and checked it carefully.'],
 ['你和熟人聊起各家的过年吃法，同一节日也有许多不同。','你和熟人聊起各家的過年吃法，同一節日也有許多不同。','Comparing New Year foods revealed many ways to mark one festival.'],
 ['中秋夜你看看月亮，想起此刻也许有人做着相同的事。','中秋夜你看看月亮，想起此刻也許有人做著相同的事。','At Mid-Autumn, you imagined others watching the same moon.'],
 ['元宵时你认真猜灯谜，揭晓答案后忍不住笑了。','元宵時你認真猜燈謎，揭曉答案後忍不住笑了。','A lantern riddle’s answer made you laugh after much thought.'],
 ['端午前后，你听人讲不同地方包粽子的习惯。','端午前後，你聽人講不同地方包粽子的習慣。','Around Dragon Boat Festival, you learned different local zongzi traditions.'],
],{topics:['festival-newyear','festival-newyear','festival-autumn','festival-lantern','festival-dragonboat']});
group('ordinary',10,120,[
 ['有人向你问路，你还提醒了一处容易走错的路口。','有人向你問路，你還提醒了一處容易走錯的路口。','You gave directions and warned about an easily missed turn.'],
 ['发现有人落下小东西，你赶上去还给了对方。','發現有人落下小東西，你趕上去還給了對方。','You caught up with someone to return a dropped item.'],
 ['听见没弄懂的词，你没有含糊带过，而是问清意思。','聽見沒弄懂的詞，你沒有含糊帶過，而是問清意思。','You asked about an unfamiliar word instead of pretending to understand.'],
 ['翻到旧相册，你记起当时没觉得特别的一天。','翻到舊相冊，你記起當時沒覺得特別的一天。','An old album recalled a day that once seemed ordinary.'],
 ['你读到一个没接触过的话题，还想再了解一点。','你讀到一個沒接觸過的話題，還想再了解一點。','Reading about an unfamiliar subject made you want to learn more.'],
 ['你做完手边的事，留下不用回应任何人的安静时间。','你做完手邊的事，留下不用回應任何人的安靜時間。','After your tasks, you kept a quiet moment with no one to answer to.'],
 ['老朋友托人带来问候，你也传回自己的近况。','老朋友託人帶來問候，你也傳回自己的近況。','An old friend sent greetings through someone, and you sent back news.'],
 ['你帮人弄明白一件小事，对方的感谢让你心里一暖。','你幫人弄明白一件小事，對方的感謝讓你心裡一暖。','Helping someone understand a little task brought a warming thank-you.'],
 ['你把总是凌乱的小角落整理好，找东西方便多了。','你把總是凌亂的小角落整理好，找東西方便多了。','Tidying a messy corner made things easier to find.'],
 ['傍晚天空出现特别的颜色，你停下脚步多看几眼。','傍晚天空出現特別的顏色，你停下腳步多看幾眼。','Unusual evening colours made you pause and look.'],
 ['一句无伤大雅的玩笑让大家笑起来，气氛松了一点。','一句無傷大雅的玩笑讓大家笑起來，氣氛鬆了一點。','A gentle joke made everyone laugh and eased tension.'],
 ['你注意到疲惫的信号，决定早点休息，不再勉强。','你注意到疲憊的訊號，決定早點休息，不再勉強。','Noticing fatigue, you chose an earlier rest.'],
 ['问起一个家常做法，你发现多年的习惯也能换个顺序。','問起一個家常做法，你發現多年的習慣也能換個順序。','An everyday tip showed you a different way to do familiar things.'],
 ['你给常用物品找好固定位置，以后不必到处翻找。','你給常用物品找好固定位置，以後不必到處翻找。','Giving everyday items a fixed place saved future searching.'],
 ['邻居借了工具，用完擦净归还，你们比从前熟悉了一点。','鄰居借了工具，用完擦淨歸還，你們比從前熟悉了一點。','A neighbour carefully returned a borrowed tool, helping you get acquainted.'],
 ['你顺手清理公共地方的垃圾，又有人跟着搭了把手。','你順手清理公共地方的垃圾，又有人跟著搭了把手。','You picked up litter in a shared space, and someone joined in.'],
 ['你和朋友边走边聊，没有赶着办事，到熟悉路口才道别。','你和朋友邊走邊聊，沒有趕著辦事，到熟悉路口才道別。','You walked and talked with a friend without an errand, parting at a familiar corner.'],
 ['你向信任的人说出心事，对方没有评判，只陪你理清思路。','你向信任的人說出心事，對方沒有評判，只陪你理清思路。','You shared a burden with someone who listened without judging.'],
 ['你发现不再那么介怀一件旧事，时间改变了一点看法。','你發現不再那麼介懷一件舊事，時間改變了一點看法。','An old grievance troubled you less as time changed your view.'],
 ['你把大目标拆成小事，完成第一件时心里踏实了一些。','你把大目標拆成小事，完成第一件時心裡踏實了一些。','Breaking a goal into small steps made the first success reassuring.'],
],{topics:['ordinary-kindness','ordinary-kindness','ordinary-learning','ordinary-memory','ordinary-learning','ordinary-rest','friend-reunion','ordinary-kindness','ordinary-home','ordinary-weather','ordinary-social','ordinary-health','ordinary-learning','ordinary-home','community-neighbour','community-service','friend-company','friend-support','adult-reflection','adult-resilience']});
group('technology',16,110,[
 ['你在网上查证一条说法，发现多看来源比急着转发更可靠。','你在網上查證一條說法，發現多看來源比急著轉發更可靠。','Checking sources online proved better than sharing a claim in haste.'],
 ['视频通话中，熟人把镜头转向窗外，让你也看见那边的天气。','視訊通話中，熟人把鏡頭轉向窗外，讓你也看見那邊的天氣。','In a video call, someone familiar showed you the weather outside.'],
 ['整理手机的提醒后，你终于少被无关消息打断。','整理手機的提醒後，你終於少被無關訊息打斷。','Adjusting phone notifications reduced unnecessary interruptions.'],
 ['陌生消息催你转账，你先核实当事人，识破了骗局。','陌生訊息催你轉帳，你先核實當事人，識破了騙局。','You verified an urgent money request and spotted a scam.'],
 ['你整理手机里模糊和重复的照片，留下真正舍不得删的几张。','你整理手機裡模糊和重複的照片，留下真正捨不得刪的幾張。','You sorted phone photos and kept the few that truly mattered.'],
 ['你跟免费教学视频学一个技巧，暂停重看了好几遍。','你跟免費教學影片學一個技巧，暫停重看了好幾遍。','You replayed a free tutorial to learn a useful little skill.'],
 ['你把手机放远一会儿，做完了总被打断的一件小事。','你把手機放遠一會兒，做完了總被打斷的一件小事。','Putting your phone away helped finish a usually interrupted task.'],
],{from:2012,topics:['technology-learning','technology-social','technology-rest','technology-safety','technology-memory','technology-learning','technology-rest']});
export const LIFE_EVENTS=Object.freeze(entries);
function stateFor(life){
  const state=life.routineState||={seen:[],topics:{}};state.seen||=[];state.topics||={};
  const texts=new Set((life.log||[]).map(r=>typeof r.text==='string'?r.text:r.text?.zhCN));
  const seen=new Set(state.seen);
  for(const e of LIFE_EVENTS)if(texts.has(e.text.zhCN))seen.add(e.id);
  state.seen=[...seen];return state;
}
export function eligibleLifeEvents(life){
  const s=stateFor(life),seen=new Set(s.seen);
  return LIFE_EVENTS.filter(e=>!seen.has(e.id)&&life.age>=e.min&&life.age<=e.max&&life.year>=e.from&&e.when(life)&&life.age-(s.topics[e.topic]??-Infinity)>=3);
}
const hobbyMilestones=[
 [2,T('你已经掌握这项兴趣的入门方法，练习时不再那么手忙脚乱。','你已經掌握這項興趣的入門方法，練習時不再那麼手忙腳亂。','You mastered the basics of this hobby and felt less clumsy.')],
 [5,T('持续练习让你能完成一段完整的尝试，这份进步让你很有成就感。','持續練習讓你能完成一段完整的嘗試，這份進步讓你很有成就感。','Steady practice let you complete a full attempt, bringing real satisfaction.')],
 [8,T('你开始形成自己的兴趣习惯，也能把经验分享给刚入门的人。','你開始形成自己的興趣習慣，也能把經驗分享給剛入門的人。','Your hobby developed a personal rhythm, and you could share tips with beginners.')],
 [10,T('多年的积累让这项兴趣成为生活里拿手的一件事，你珍惜这份长久的陪伴。','多年的累積讓這項興趣成為生活裡拿手的一件事，你珍惜這份長久的陪伴。','Years of practice made this hobby a familiar skill and a lasting companion.')],
];
/** Exhaustion leaves quiet years instead of repeating stories just to fill a quota. */
export function routineYear(life,{log,random}){
  if(life.phase!=='life')return[];
  const selected=[];
  for(let i=0;i<2;i++){
    const pool=eligibleLifeEvents(life);if(!pool.length)break;
    const e=pool[Math.min(pool.length-1,Math.floor(random(life)*pool.length))];
    life.routineState.seen.push(e.id);life.routineState.topics[e.topic]=life.age;
    const row=log(life,e.text,'life',e.effects);if(row)row.eventId=e.id;selected.push(e);
  }
  const state=stateFor(life);state.hobbyMilestones||=[];
  for(const hobby of life.hobbies||[]){
    if(random(life)<.2)hobby.level=Math.min(10,(hobby.level||0)+1);
    // First load of old saves does not replay every lower milestone at once.
    const milestone=hobbyMilestones.filter(([level])=>(hobby.level||0)>=level).at(-1);
    if(!milestone)continue;
    const [level,text]=milestone,key=String(hobby.id??hobby.name?.zhCN)+':'+level;
    if(state.hobbyMilestones.includes(key))continue;
    for(const [lower]of hobbyMilestones)if(lower<=level){const done=String(hobby.id??hobby.name?.zhCN)+':'+lower;if(!state.hobbyMilestones.includes(done))state.hobbyMilestones.push(done);}
    const name=hobby.name||T('兴趣','興趣','your hobby');
    const row=log(life,T(name.zhCN+'：'+text.zhCN,name.zhTW+'：'+text.zhTW,name.en+': '+text.en),'warm',{happiness:2});
    if(row)row.eventId='hobby-'+key;
  }
  return selected;
}
