const game = require('../../lib/game');
const platform = require('../../lib/platform');
const storage = require('../../lib/storage');
const AUTO_CHOICE_DELAY_MS = 2000;
const remainingChoiceSeconds = (deadline, now = Date.now()) => Math.max(1, Math.ceil(((deadline || now + AUTO_CHOICE_DELAY_MS) - now) / 1000));
const REGIONS = ['all', 'mainland', 'taiwan', 'hongkong', 'macau'];
const DEFAULTS = { language: 'zh-CN', theme: 'light', world: 'now', birthYear: 1980, scope: 'all', province: 'all', pace: 30, overviewCollapsed: false };
const validLife = life => life && life.version === 1 && life.name && life.born && life.location && Array.isArray(life.log) && life.family && life.stats;
const clone = value => JSON.parse(JSON.stringify(value));
game.configureLocations(game.locations);

Page({
  data: { navHeight: 64, navTop: 20, navBarHeight: 44, navSide: 96, view: 'home', theme: 'light', modal: '', toast: '', person: null, logs: [], momentGroups: [], archiveList: [], archiveFacts: [], memories: [], speeds: [1, 2, 4, 8, 12, 16], speed: 1, paused: true, progress: 0, musicPlaying: false, musicX: 0, musicY: 480, reviewDraft: '', reflectionDraft: '', birthShareReady: false, autoChoiceSeconds: 2 },
  onLoad() {
    this.store = { version: 1, settings: { ...DEFAULTS }, current: null, history: [], savedMomentToastCount: 0 };
    try {
      const loaded = storage.readStore(this.store);
      if ((loaded.current != null && !validLife(loaded.current)) || loaded.history.some(life => !validLife(life))) throw new Error('人生存档内容损坏。');
      this.store = loaded;
    } catch (error) { console.warn('Could not read save', error); this._storageReadFailed = true; }
    if (!validLife(this.store.current)) this.store.current = null;
    if (!game.LANGUAGES.some(item => item.id === this.store.settings.language)) this.store.settings.language = 'zh-CN';
    if (!REGIONS.includes(this.store.settings.scope)) this.store.settings.scope = 'all';
    if (!['now', 'past'].includes(this.store.settings.world)) this.store.settings.world = 'now';
    if (this.store.current && this.store.current.phase !== 'dead') game.ensureModelState(this.store.current);
    this._paused = true; this._speed = 1; this._progress = this.store.current?.uiProgress || 0;
    this._view = 'home'; this._momentLimit = 24; this._imageCache = new Map(); this._imagePending = new Set(); this._birthShareKey = ''; this._birthSharePath = ''; this._birthSharePending = null;
    const windowInfo = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.updateNavigation(windowInfo);
    this.setData({ musicX: Math.max(12,(windowInfo.windowWidth || 390) - 66), musicY: Math.max(100,(windowInfo.windowHeight || 844) - 150) });
    const musicPosition=this.store.settings.musicPosition;
    if(musicPosition&&Number.isFinite(musicPosition.x)&&Number.isFinite(musicPosition.y)){this._musicPosition={x:Math.max(0,Math.min((windowInfo.windowWidth||390)-56,musicPosition.x)),y:Math.max(0,Math.min((windowInfo.windowHeight||844)-100,musicPosition.y))};this.setData({musicX:this._musicPosition.x,musicY:this._musicPosition.y});}
    this._foreground = true; this._editable = null; this._viewed = null; this._minimized = null;
    this.render();
    if (this._storageReadFailed) this.notify(this.tx('存档读取失败，请重启小程序后重试','存檔讀取失敗，請重新開啟小程式後重試','Could not read your save. Please restart the app.'));
    this._timer = setInterval(() => this.tick(), 120);
  },
  onShow() { this._foreground = true; this._lastTick = Date.now(); },
  onResize() { this.updateNavigation(); },
  navigationMetrics(windowInfo, capsule) {
    const width = Math.max(240, Number(windowInfo?.windowWidth) || 390);
    const status = Math.max(0, Number(windowInfo?.statusBarHeight) || 20);
    const valid = capsule && Number.isFinite(capsule.top) && Number.isFinite(capsule.height) && Number.isFinite(capsule.left) && capsule.height > 0 && capsule.top >= status && capsule.left > width / 2 && capsule.left < width;
    const gap = valid ? Math.max(0, capsule.top - status) : 4;
    const barHeight = Math.max(44, valid ? capsule.height + gap * 2 : 44);
    const rightClearance = valid ? width - capsule.left + 8 : 96;
    return { navTop: status, navBarHeight: barHeight, navHeight: status + barHeight, navSide: Math.max(56, Math.min((width - 64) / 2, rightClearance)) };
  },
  updateNavigation(windowInfo) {
    let info = windowInfo;
    try { if (!info) info = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync(); } catch (error) { info = {}; }
    let capsule;
    try { if (typeof wx.getMenuButtonBoundingClientRect === 'function') capsule = wx.getMenuButtonBoundingClientRect(); } catch (error) { /* Use conservative geometry on unsupported clients. */ }
    this.setData(this.navigationMetrics(info || {}, capsule));
  },
  onHide() { this._foreground = false; this._lastTick = 0; this.persist(); },
  onUnload() { clearInterval(this._timer); clearTimeout(this._toastTimer); this.persist(); platform.stopMusic(); },
  onShareAppMessage() {
    if (this._view === 'certificate' && this.store.current?.phase === 'birth') {
      const life = this.store.current;
      return { title: this.tx(`${this.L(life.name)}的出生卡`,`${this.L(life.name)}的出生卡`,`${this.L(life.name)}'s birth card`), path: '/pages/index/index', ...(this._birthSharePath ? { imageUrl: this._birthSharePath } : {}) };
    }
    return { title: this.tr('brand'), path: '/pages/index/index' };
  },
  onShareTimeline() { return { title: this.tr('brand') }; },
  L(value) { return game.valueText(value, this.store.settings.language); },
  tr(key) { return game.t(key, this.store.settings.language); },
  tx(cn, tw, en) { return this.L({ zhCN: cn, zhTW: tw, en }); },
  amount(value) { return game.money(Number(value) || 0, this.store.settings.language); },
  compactAmount(value) {
    const n=Number(value)||0,abs=Math.abs(n),en=this.store.settings.language==='en';
    const unit=en?(abs>=1e6?1e6:abs>=1e4?1e3:1):(abs>=1e8?1e8:abs>=1e4?1e4:1);
    return unit===1?this.amount(n):`¥${(n/unit).toFixed(1)}${en?(unit===1e6?'M':'K'):(unit===1e8?'亿':'万')}`;
  },
  age(value) { return this.store.settings.language === 'en' ? `${value} years` : `${value}${this.tr('age')}`; },
  currentLife() { return this._viewed || this.store.current; },
  persist() {
    if (!this.store) return false;
    if (this._storageReadFailed) { this.notify(this.tx('存档读取失败，请重启小程序后重试','存檔讀取失敗，請重新開啟小程式後重試','Could not read your save. Please restart the app.')); return false; }
    try { storage.writeStore(this.store); return true; }
    catch (error) { console.error('Save failed', error); this.notify(this.tr('saveError')); return false; }
  },
  notify(text) {
    clearTimeout(this._toastTimer); this.setData({ toast: text });
    this._toastTimer = setTimeout(() => this.setData({ toast: '' }), 2600);
  },
  uiLabels() {
    const keys = ['brand','heroText','archive','past','now','year','scope','province','pace','minutes','born','resume','resumeText','certificate','beginLife','shareBirth','sameMoment','companionHint','health','happiness','knowledge','relationships','wealth','income','identity','family','education','career','mother','father','partner','children','birthplace','currentCity','close','back','pause','play','viewReport','saved','noLives','single','noJob','urban','rural','moneyUnit','lifeMap','lifeMapHint','survival','survivalHint'];
    const ui = Object.fromEntries(keys.map(key => [key, this.tr(key)]));
    const extra = {
      era: ['过去和现在','過去和現在','Past and present'], settings: ['出生地与游玩设置','出生地與遊玩設定','Birthplace and pace'],
      overview: ['人生总览','人生總覽','Life overview'], expand: ['展开','展開','Expand'], collapse: ['收起','收起','Collapse'],
      details: ['人生档案','人生檔案','Life details'], assets: ['资产明细','資產明細','Assets'], cash: ['现金','現金','Cash'],
      living: ['正在活着','正在活著','Living'], thisYear: ['这一年','這一年','This year'], next: ['下个抉择','下個抉擇','Next choice'],
      advance: ['推进一年','推進一年','Next year'], autopilot: ['托管人生','託管人生','Autopilot'], takeControl: ['恢复手动','恢復手動','Take control'],
      automatic: ['抉择已交给自动 · 点此恢复手动','抉擇已交給自動 · 點此恢復手動','Choices are automatic · Take control'],
      lifeLog: ['人生记录','人生紀錄','Life records'],
      pending: ['人生抉择','人生抉擇','Life choices'],
      autoChoiceSuffix: ['秒后自动选择','秒後自動選擇','s until automatic choice'],
      autoChoicePaused: ['自动选择已暂停','自動選擇已暫停','Automatic choice paused'],
      moments: ['人生瞬间','人生瞬間','Life moments'], wholeLife: ['这一生','這一生','This life'], report: ['一段人生','一段人生','A lifetime'],
      write: ['写下你的话','寫下你的話','Add your words'], yourWords: ['你想写的话','你想寫的話','Your words'], save: ['保存','儲存','Save'],
      reviewPlaceholder: ['你想对这段人生说点什么吗？','你想對這段人生說點什麼嗎？','What would you like to say to this life?'],
      reviewHint: ['离开本页后便不能修改；主动放入追思馆才会珍藏这段人生。','離開本頁後便不能修改；主動放入追思館才會珍藏這段人生。','You can edit until you leave this page. Choose to place this life in the memorial hall to keep it.'],
      photo: ['拍照纪念','拍照紀念','Save a photo'], memorialize: ['放入追思馆','放入追思館','Place in memorial hall'],
      memorialSaved: ['已放入追思馆','已放入追思館','In the memorial hall'], replay: ['重活一遍','重活一遍','Live again'],
      all: ['查看全部','查看全部','View all'], memories: ['安放在追思馆的人生','安放在追思館的人生','Lives remembered'],
      archiveIntro: ['这些人生，是有人把它活到了最后，想长久珍藏而安放在这里的。欢迎来看，点亮烛光，留下一句话。','這些人生，是有人把它活到了最後，想長久珍藏而安放在這裡的。歡迎來看，點亮燭光，留下一句話。','These lives were lived to the end and kept here to remember. Come in and light a candle.'],
      kicker: ['人生模拟 · 中国城市','人生模擬 · 中國城市','A life in a Chinese city'], locations: ['个出生地点','個出生地點','birthplaces'],
      reflectionPlaceholder: ['写下此刻的想法（可选）','寫下此刻的想法（可選）','Your thoughts (optional)'],
      pastHint: ['从所选年份出发，经历时代变化。历史条件为简化模型。','從所選年份出發，經歷時代變化。歷史條件為簡化模型。','Start in the chosen year and live through changing times.'],
      nowHint: ['从现在出发，开启属于你的一生。','從現在出發，開啟屬於你的一生。','Begin a lifetime in the present.'],
      music: ['音乐','音樂','Music'], musicOn: ['关闭音乐','關閉音樂','Music off'], musicOff: ['开启音乐','開啟音樂','Music on'],
      journal: ['你写下的想法','你寫下的想法','Your thoughts'],
      moreMoments: ['更多人生瞬间','更多人生瞬間','More life moments'],
      noMoments: ['这一生的日常，都留在下面的记录中。','這一生的日常，都留在下面的紀錄中。','Everyday moments live on in the records below.'],
      sharePreparing: ['准备分享…','準備分享…','Preparing…']
    };
    for (const [key, values] of Object.entries(extra)) ui[key] = this.tx(...values);
    const aliases={begin:'beginLife',birthCard:'shareBirth',birthSettings:'settings',birthYear:'year',capture:'photo',choice:'pending',eyebrow:'kicker',favorite:'save',lifeDetails:'details',lifeMoments:'moments',lifetime:'report',memorialEmpty:'noLives',oneYear:'advance',pastPresent:'era',rememberedLives:'memories',reviewHelp:'reviewHint',takeControlHint:'automatic',thisLife:'wholeLife',viewAll:'all',writeWords:'write'};
    for(const [alias,key] of Object.entries(aliases))ui[alias]=ui[key];
    ui.locationCount=`${game.locations.length.toLocaleString()} ${ui.locations}`;ui.yearUnit=this.tx('年','年','year');ui.theme=this.tr('theme');
    return ui;
  },
  scene(event, life) {
    if (!life || !event) return '';
    const key = `${life.id}:${event.id || event.type}:${event.age || 0}`;
    if (this._imageCache.has(key)) return this._imageCache.get(key);
    if (!this._imagePending.has(key)) {
      this._imagePending.add(key);
      platform.generateScene(event, life).then(path => { this._imageCache.set(key, path); this._imagePending.delete(key); if (this._foreground) this.render(); })
        .catch(error => { console.warn('Scene unavailable', error); this._imagePending.delete(key); this._imageCache.set(key, ''); });
    }
    return '';
  },
  coverFor(life) {
    if (!life) return '';
    const picks = life.phase === 'dead' ? game.selectLifeMoments(life) : [];
    return this.scene(picks.find(item => item.type !== 'birth') || life.log[life.log.length - 1] || { type: 'birth', age: 0 }, life);
  },
  survivalChart(life) {
    const key=`survival:${life.id}:${life.age}:${life.profile.lifeExpectancy}:${this.store.settings.theme}:${this.store.settings.language}`;
    if(this._imageCache.has(key))return this._imageCache.get(key);
    if(!this._imagePending.has(key)){
      this._imagePending.add(key);
      platform.generateSurvivalChart(life,this.store.settings.theme==='dark',this.store.settings.language).then(path=>{
        this._imageCache.set(key,path);this._imagePending.delete(key);
        if(this._foreground&&this.data.modal==='details')this.render();
      }).catch(error=>{this._imagePending.delete(key);this._imageCache.set(key,'');console.warn('Survival chart unavailable',error);});
    }
    return '';
  },
  prepareBirthShare(life) {
    const key = `${life.id}:${this.store.settings.language}`;
    if (this._birthShareKey === key && this.data.birthShareReady) return Promise.resolve(this._birthSharePath);
    if (this._birthSharePendingKey === key) return this._birthSharePending;
    this._birthShareKey = key; this._birthSharePath = ''; this._birthSharePendingKey = key;
    this.setData({ birthShareReady: false });
    this._birthSharePending = platform.createBirthShare(life, this.store.settings.language)
      .then(path => { if (this._birthShareKey === key) { this._birthSharePath = path; this.setData({ birthShareReady: true }); } return path; })
      .catch(error => { console.warn('Birth share image unavailable', error); if (this._birthShareKey === key) this.setData({ birthShareReady: true }); return ''; })
      .then(path => { if (this._birthSharePendingKey === key) { this._birthSharePendingKey = ''; this._birthSharePending = null; } return path; });
    return this._birthSharePending;
  },
  personFor(life) {
    if (!life) return null;
    const summary = game.summarize(life);
    const career = life.job ? this.L(life.job.name) : life.retired ? this.tx('已退休','已退休','Retired') : this.tr('noJob');
    const fact = (label, value) => ({ label, value: String(value ?? '') });
    const family = [];
    for (const [key, label] of [['mother',this.tr('mother')],['father',this.tr('father')],['partner',this.tr('partner')]]) {
      const member = life.family[key];
      if (member) family.push({ label, name: this.L(member.name), detail: `${this.age(member.age)}${member.alive === false ? this.tx(' · 已故',' · 已故',' · Deceased') : ''}` });
    }
    for (const [key,label] of [['siblings',this.tx('兄弟姐妹','兄弟姊妹','Sibling')],['children',this.tr('children')]])
      for (const member of life.family[key] || []) family.push({ label, name: this.L(member.name), detail: `${this.age(member.age)}${member.alive === false ? this.tx(' · 已故',' · 已故',' · Deceased') : ''}` });
    const assetNames = { house: ['住房','住房','Home'], car: ['车辆','車輛','Car'], retirement: ['退休账户','退休帳戶','Retirement'], furniture: ['家具','家具','Furniture'], appliances: ['家电','家電','Appliances'], phone: ['通信设备','通訊設備','Phone'], computer: ['电脑','電腦','Computer'], bicycle: ['自行车','自行車','Bicycle'] };
    const identityFacts = [fact(this.tr('sex'),this.tr(life.sex)),fact(this.tr('birthplace'),this.L(life.born.name)),fact(this.tr('currentCity'),this.L(life.location.name)),fact(this.tr('familyClass'),this.tr(`class${life.classRank}`)),fact(this.tr('education'),game.educationText(life.education,this.store.settings.language)),fact(this.tr('career'),career)];
    const facts = this._view === 'report' ? [fact(this.tr('birthplace'),this.L(life.born.name)),fact(this.tx('最后居所','最後居所','Final home'),this.L(life.location.name)),fact(this.tr('education'),game.educationText(life.education,this.store.settings.language)),fact(this.tr('career'),this.L(summary.job)),fact(this.tr('partner'),life.family.partner ? this.L(life.family.partner.name) : '—'),fact(this.tr('children'),life.family.children.length),fact(this.tx('生活过的地方','生活過的地方','Places called home'),new Set((life.visited || []).map(place => place.id)).size),fact(this.tx('珍藏瞬间','珍藏瞬間','Saved moments'),(life.stars || []).length)] : identityFacts;
    return {
      id: life.id, name: this.L(life.name), initial: this.L(life.name).slice(0,1), meta: `${this.tr(life.sex)} · ${this.L(life.location.name)} · ${this.tr(life.urban ? 'urban' : 'rural')} · ${career}`,
      year: life.year, age: this.age(life.age), date: `${life.birthYear}–${life.year} · ${this.L(life.born.name)}`, career, income: this.amount(life.income),
      reportMeta: `${this.tr(life.sex)} · ${this.age(life.age)} · ${life.family.partner?.married ? this.tx('已婚','已婚','Married') : this.tr('single')} · ${life.family.children.length} ${this.tr('children')}`,
      stats: Object.entries(life.stats).map(([key,value]) => ({ key, label: this.tr(key), value: Math.round(value), width: Math.max(0,Math.min(100,value)) })),
      finances: [fact(this.tr('wealth'),this.compactAmount(game.netWorth(life))),fact(this.tx('现金','現金','Cash'),this.compactAmount(life.money)),fact(this.tr('income'),this.compactAmount(life.income))],
      facts, identityFacts, family, assets: [fact(this.tx('现金','現金','Cash'),this.amount(life.money)),...Object.entries(life.assets || {}).filter(([,v]) => v > 0).map(([key,value]) => fact(assetNames[key] ? this.tx(...assetNames[key]) : key,this.amount(value))),fact(this.tx('负债','負債','Debt'),this.amount(life.debt))],
      companions: (life.companions || []).map(item => { const gone=life.age>=item.deathAge,snapshot=(item.years||[]).find(row=>row.age===life.age)||(item.years||[]).slice(-1)[0];return {name:this.L(item.name),meta:`${this.L(item.born.name)} · ${this.tr(item.sex)}`,gone,status:gone?`${this.age(item.deathAge)} · ${this.tr('goneAt')}`:snapshot?.job?this.L(snapshot.job):game.educationText(snapshot?.education,this.store.settings.language)};}),
      yearMap:Array.from({length:Math.max(96,life.age+1)},(_,age)=>{const snapshot=life.years.find(row=>row.age===age);return {age,current:life.age===age,color:snapshot?`hsl(${55+snapshot.happiness*.95},28%,${83-snapshot.happiness*.46}%)`:''};}),
      survivalCurve:this.data.modal==='details'?this.survivalChart(life):'',
      journal:(life.journal||[]).map(entry=>({age:this.age(entry.age),year:entry.year,text:entry.text})),
      birthText: this.L(life.log[life.log.length - 1]?.text), cover: this.coverFor(life), tagline: this.tagline(life), review: game.memorialReview(life,this.store.settings.language).text,
      canEditReview: this._editable === life.id && life.phase === 'dead' && !this._viewed, candles: life.candles || 0
    };
  },
  tagline(life) {
    const job = this.L(game.summarize(life).job), years = (life.years || []).filter(item => item.job && this.L(item.job) === job).length;
    return years ? this.tx(`当了${years}年${job}的人生`,`當了${years}年${job}的人生`,`${years} years as ${job}`) : this.tx(`在${this.L(life.born.name)}度过的一生`,`在${this.L(life.born.name)}度過的一生`,`A life in ${this.L(life.born.name)}`);
  },
  eventText(event) { const text = this.L(event.text); return event.date && text.startsWith(`${event.date} · `) ? text.slice(event.date.length + 3) : text; },
  render() {
    if (!this.store) return;
    const settings = this.store.settings, life = this.currentLife(), ui = this.uiLabels();
    const regionOptions = REGIONS.map(value => ({ value, label: this.tr(value === 'all' ? 'allRegions' : value) }));
    const places = game.locations.filter(place => settings.scope === 'all' || place.region === settings.scope);
    const provinces = [{ value: 'all', label: this.tr('allProvinces') }, ...[...new Map(places.map(place => [place.province.id,{ value: place.province.id, label: this.L(place.province) }])).values()]];
    const years = Array.from({length: new Date().getFullYear() - 1949}, (_,index) => ({label: String(1950 + index), value: 1950 + index}));
    const recordList=this._view==='report'?[...(life?.log || [])].reverse():this._view==='life'?(life?.log || []):[];
    const logs = recordList.map(event => ({ id: event.id, age: event.age, date: event.date || '', text: this.eventText(event), type: event.type, starred: (life.stars || []).includes(event.id), effects: Object.entries(event.effects || {}).filter(([key]) => key in life.stats).map(([key,value]) => `${this.tr(key)} ${value > 0 ? '+' : ''}${Math.round(value * 10) / 10}`).join(' · ') }));
    const history = this.store.history;
    const cards = history.map(item => ({ id: item.id, name: this.L(item.name), date: `${item.birthYear}–${item.year} · ${this.L(item.born.name)} · ${this.age(item.age)}`, tagline: this.tagline(item), review: game.memorialReview(item,settings.language).text, cover: this.coverFor(item), candles: item.candles || 0 }));
    const archiveFacts = [[this.tx('馆藏人生','館藏人生','Lives remembered'),history.length],[this.tx('累计岁月','累計歲月','Years lived'),history.reduce((sum,item)=>sum+item.age,0)],[this.tx('最长一生','最長一生','Longest life'),Math.max(0,...history.map(item=>item.age))],[this.tx('到过地点','到過地點','Places reached'),new Set(history.flatMap(item=>(item.visited || []).map(place=>place.id))).size],[this.tx('珍藏瞬间','珍藏瞬間','Saved moments'),history.reduce((sum,item)=>sum+(item.stars || []).length,0)],[this.tx('点亮烛光','點亮燭光','Candles lit'),history.reduce((sum,item)=>sum+(item.candles || 0),0)]].map(([label,value])=>({label,value}));
    const groups = new Map();
    if (this._view === 'report' && life?.phase === 'dead') {
      for (const event of game.selectLifeMoments(life).slice(0,this._momentLimit)) {
        const decade = Math.floor(event.age/10);
        if (!groups.has(decade)) groups.set(decade,[]);
        groups.get(decade).push({id:event.id,age:this.age(event.age),year:event.year,text:this.eventText(event),cover:this.scene(event,life)});
      }
    }
    const momentGroups = [...groups].map(([decade,events])=>({title:decade===0?this.tx('童年','童年','Childhood'):decade===1?this.tx('十几岁','十幾歲','Teenage years'):this.tx(`${decade*10}多岁`,`${decade*10}多歲`,`${decade*10}s`),years:events.length===1?String(events[0].year):`${events[0].year}–${events[events.length-1].year}`,events}));
    const pending = this.store.current?.pending;
    if (this._view === 'life' && pending && (!this.data.modal || this.data.modal === 'choice') && this._minimized !== pending.id) {
      if (this.data.choice?.id !== pending.id) this._autoDeadline = this.store.current.autopilot?.enabled ? Date.now() + AUTO_CHOICE_DELAY_MS : 0;
      this.data.modal = 'choice';
    } else if (this.data.modal === 'choice' && !pending) this.data.modal = '';
    let visibleOptions = pending?.options || [];
    if (visibleOptions.length > 4) {
      const preferred = pending.action === 'focus-stage'
        ? (this.store.current.school ? ['study','balance','family','sport'] : this.store.current.retired ? ['balance','family','health','hobby'] : ['work','balance','family','health'])
        : [];
      const selected = preferred.map(id=>visibleOptions.find(option=>option.id===id)).filter(Boolean);
      for (const option of visibleOptions) if (selected.length < 4 && !selected.includes(option)) selected.push(option);
      // Keep the last alternative (often decline / keep the current arrangement).
      if (!preferred.length) selected[3] = visibleOptions[visibleOptions.length-1];
      visibleOptions = selected;
    }
    const optionDescriptions = visibleOptions.map(option => this.L(option.description).trim());
    const repeatedDescription = optionDescriptions.length > 1 && optionDescriptions.every(text => text === optionDescriptions[0]);
    const choice = pending ? { id: pending.id, title: this.L(pending.title), description: pending.action==='focus-stage' ? this.tx('选择这一阶段的生活重心，下个阶段可以重新选择。','選擇這一階段的生活重心，下個階段可以重新選擇。','Choose your focus for this stage. You can choose again at the next stage.') : this.L(pending.description), meta: `${this.age(this.store.current.age)} · ${this.store.current.year}`, input: !!pending.input, options: visibleOptions.map((option,index)=>({id:option.id,number:index+1,label:this.L(option.label),description:repeatedDescription ? '' : optionDescriptions[index]})) } : null;
    this.setData({ view:this._view,theme:settings.theme,ui,settings:{...settings},languageLabels:game.LANGUAGES.map(item=>({label:item.label,value:item.id})),languageIndex:game.LANGUAGES.findIndex(item=>item.id===settings.language),years,yearIndex:Math.max(0,years.findIndex(item=>item.value===settings.birthYear)),regions:regionOptions,regionIndex:REGIONS.indexOf(settings.scope),provinces,provinceIndex:Math.max(0,provinces.findIndex(item=>item.value===settings.province)),advancedOpen:!!this._advanced,available:places.filter(place=>settings.province==='all'||place.province.id===settings.province).length,resume:this.store.current&&this.store.current.phase!=='dead'?{name:this.L(this.store.current.name),age:this.age(this.store.current.age),place:this.L(this.store.current.location.name)}:null,homeCover:this.scene({id:'home',type:'family',age:30,text:{zhCN:'一家人在城市里生活'}},{id:'home',seed:'home',age:30,log:[],family:{children:[]}}),memories:cards.slice(0,8),person:this.personFor(life),cover:life?this.coverFor(life):'',logs,paused:this._paused,speed:this._speed,progress:Math.round(this._progress*100),fast:!!this._fast,automatic:!!this.store.current?.autopilot?.enabled,archiveFacts,archiveList:cards,momentGroups,hasMoreMoments:this._view==='report'&&life?.phase==='dead'&&game.selectLifeMoments(life).length>this._momentLimit,fromArchive:!!this._viewed,memorialSaved:!!life&&history.some(item=>item.id===life.id),endingText:life?.phase==='dead'?game.lifeEndingNarrative(life,settings.language):'',modal:this.data.modal,choice,autoChoiceSeconds:remainingChoiceSeconds(this._autoDeadline),hasPending:!!pending });
    wx.setNavigationBarTitle({title:this._view==='home'?ui.brand:this._view==='life'?ui.living:this._view==='certificate'?ui.certificate:this._view==='archive'?ui.archive:ui.report});
    const darkNav=settings.theme==='dark'||this._view==='ending';
    wx.setNavigationBarColor({frontColor:darkNav?'#ffffff':'#000000',backgroundColor:this._view==='ending'?'#101b15':darkNav?'#1d2420':'#f3f0e8',animation:{duration:150,timingFunc:'easeIn'}});
  },
  navigate(view, viewed=null) {
    if ((this._view==='report'||this._view==='ending') && view!=='report' && view!=='ending') this._editable=null;
    this._view=view;this._viewed=viewed;this._paused=true;this._fast=false;this._minimized=null;this._momentLimit=24;this._autoDeadline=0;this._photo=null;this.setData({modal:''});
    if (view==='life' && this.store.current) game.offerFocusStage(this.store.current);
    this.persist();this.render();wx.pageScrollTo({scrollTop:0,duration:0});
    if (view==='certificate' && this.store.current) this.prepareBirthShare(this.store.current);
  },
  async newLife() {
    if (this._creating) return;
    if (this._storageReadFailed) { this.persist(); return; }
    this._creating=true;
    try {
      if (this.store.current && this.store.current.phase!=='dead') {
        const answer=await new Promise(resolve=>wx.showModal({title:this.tx('开始新的人生？','開始新的人生？','Begin another life?'),content:this.tx('当前这一生将被新的起点替换。','目前這一生將被新的起點替換。','The current life will be replaced.'),success:resolve,fail:()=>resolve({confirm:false})}));
        if (!answer.confirm) return;
      }
      wx.showLoading({title:this.tx('准备出生','準備出生','Preparing')});
      const s=this.store.settings,pool=game.locations.filter(place=>(s.scope==='all'||place.region===s.scope)&&(s.province==='all'||place.province.id===s.province));
      if (!pool.length) throw new Error('Empty birthplace pool');
      let draw=Math.random()*pool.reduce((sum,item)=>sum+item.weight,0);
      const place=pool.find(item=>(draw-=item.weight)<=0)||pool[pool.length-1];
      const seed=`${Date.now()}-${Math.random()}`,birthYear=s.world==='past'?Number(s.birthYear):new Date().getFullYear();
      const life=game.createLife({location:place,locations:game.locations,language:s.language,seed,birthYear,world:s.world,paceMinutes:s.pace});
      life.companions=game.generateCompanions({locations:game.locations,seed,birthYear,world:s.world});life.stars=[];life.uiProgress=0;
      this.store.current=life;this._progress=0;this.navigate('certificate');await this.prepareBirthShare(life);
    } finally {this._creating=false;wx.hideLoading();}
  },
  tick() {
    const now=Date.now(),dt=Math.min(.25,Math.max(0,(now-(this._lastTick||now))/1000));this._lastTick=now;
    const life=this.store?.current;
    if (!this._foreground || this._view!=='life' || life?.phase!=='life' || this._paused) return;
    if (life.pending) {
      if (life.autopilot?.enabled && (!this.data.modal||this.data.modal==='choice')) {
        this._autoDeadline ||= now+AUTO_CHOICE_DELAY_MS;
        const seconds=remainingChoiceSeconds(this._autoDeadline,now);
        if(this.data.autoChoiceSeconds!==seconds)this.setData({autoChoiceSeconds:seconds});
        if (now>=this._autoDeadline) this.makeChoice(null,true);
      }
      return;
    }
    if (this.data.modal) return;
    const amount=dt*this._speed*(this._fast?20:1)/life.yearSeconds;
    this._progress=Math.min(1,this._progress+amount);
    if (life.focus) life.focusTime[life.focus]=(life.focusTime[life.focus]||0)+amount;
    life.uiProgress=this._progress;
    const timeline=game.processTimeline(life,this._progress);
    if (life.pending) this._fast=false;
    if (life.phase==='dead') return this.finishLife();
    if (timeline.changed) {this.persist();this.render();}
    else if (this.data.progress!==Math.round(this._progress*100)) this.setData({progress:Math.round(this._progress*100)});
    if (this._progress>=1) this.completeYear();
  },
  completeYear() {
    const life=this.store.current;if(!life||life.pending||life.phase!=='life')return;
    const oldYear=life.year;game.advanceYear(life);this._progress=life.year===oldYear&&life.pending?1:0;life.uiProgress=this._progress;
    if(life.phase==='dead')return this.finishLife();
    if(life.pending)this._fast=false;this.persist();this.render();
  },
  makeChoice(id,automatic=false) {
    const life=this.store.current;if(!life?.pending)return;
    if(!automatic){
      if(!life.pending.options.some(option=>option.id===id))return;
      game.setAutopilot(life,false,life.autopilot?.strategy||'balanced');
    }
    const accepted=automatic ? game.autoChoose(life) : game.choose(life,id,this.data.reflectionDraft||'');
    if(!accepted)return;
    this.setData({modal:'',reflectionDraft:''});this._minimized=null;this._autoDeadline=0;
    if(life.autopilot?.enabled)game.runAutopilot(life);
    this.persist();if(life.phase==='dead')return this.finishLife();this.render();
  },
  finishLife(){this._paused=true;this._editable=this.store.current.id;this._view='ending';this._viewed=null;this.setData({modal:''});this.persist();this.render();wx.pageScrollTo({scrollTop:0,duration:0});},
  onSetting(event) {
    const key=event.currentTarget.dataset.key,index=Number(event.detail.value);
    const options={language:this.data.languageLabels,birthYear:this.data.years,scope:this.data.regions,province:this.data.provinces};
    if(!options[key]?.[index])return;
    this.store.settings[key]=options[key][index].value;if(key==='scope')this.store.settings.province='all';this.persist();this.render();
  },
  onReviewInput(event){this.setData({reviewDraft:event.detail.value.slice(0,300)});},
  onReflectionInput(event){this.setData({reflectionDraft:event.detail.value.slice(0,300)});},
  onMusicMove(event){if(event.detail.source==='touch'){this._musicMoved=Date.now();this._musicPosition={x:event.detail.x,y:event.detail.y};this.store.settings.musicPosition=this._musicPosition;this.data.musicX=event.detail.x;this.data.musicY=event.detail.y;}},
  noop(){},
  async onAction(event) {
    const {action,value}=event.currentTarget.dataset,life=this.currentLife();
    try {
      if(action==='born'||action==='new')return await this.newLife();
      if(action==='home'||action==='replay')return this.navigate('home');
      if(action==='back')return this.navigate(this._view==='report'&&this._viewed?'archive':'home');
      if(action==='archive')return this.navigate('archive');
      if(action==='review'){const found=this.store.history.find(item=>item.id===value);if(found)return this.navigate('report',found);return;}
      if(action==='resume'){if(!this.store.current)return;const next=this.store.current.phase==='dead'?'report':this.store.current.phase==='birth'?'certificate':'life';this.navigate(next);if(next==='life'){this._paused=false;this.render();}return;}
      if(action==='begin'){game.startLife(this.store.current);this.navigate('life');this._paused=false;this.persist();return this.render();}
      if(action==='world'){if(['past','now'].includes(value))this.store.settings.world=value;this.persist();return this.render();}
      if(action==='pace'){if([30,60,90].includes(Number(value)))this.store.settings.pace=Number(value);this.persist();return this.render();}
      if(action==='toggle-advanced'){this._advanced=!this._advanced;return this.render();}
      if(action==='theme'){this.store.settings.theme=this.store.settings.theme==='dark'?'light':'dark';this.persist();return this.render();}
      if(action==='toggle-overview'){this.store.settings.overviewCollapsed=!this.store.settings.overviewCollapsed;this.persist();return this.render();}
      if(action==='pause'){this._paused=!this._paused;this._autoDeadline=0;return this.render();}
      if(action==='speed'){if([1,2,4,8,12,16].includes(Number(value)))this._speed=Number(value);this._paused=false;return this.render();}
      if(action==='next'||action==='next-choice'){if(this.store.current?.pending){this._minimized=null;return this.render();}this._fast=!this._fast;this._paused=false;return this.render();}
      if(action==='year'||action==='next-year'){if(this.store.current?.pending){this._minimized=null;return this.render();}return this.completeYear();}
      if(action==='pending'){this._minimized=null;return this.render();}
      if(action==='autopilot'||action==='take-control'){
        const enable=action==='take-control'?false:!this.store.current.autopilot?.enabled;
        game.setAutopilot(this.store.current,enable,this.store.current.autopilot?.strategy||'balanced');
        if(enable){this._paused=false;game.runAutopilot(this.store.current);this._minimized=null;}
        this._autoDeadline=0;this.persist();return this.render();
      }
      if(action==='choose')return this.makeChoice(value);
      if(action==='life-details'){if(this._view!=='life')return;this._detailsWasPaused=this._paused;this._paused=true;this.setData({modal:'details'});return this.render();}
      if(action==='close-modal'){
        if(this.data.modal==='details')this._paused=this._detailsWasPaused;
        if(this.data.modal==='choice'){this._minimized=this.store.current?.pending?.id;game.setAutopilot(this.store.current,false,this.store.current.autopilot?.strategy||'balanced');this.persist();}
        this.setData({modal:''});return this.render();
      }
      if(action==='star'){
        if(this._view!=='life'||life?.phase!=='life')return;
        life.stars ||= [];const previousStars=life.stars, previousCount=this.store.savedMomentToastCount;const removing=life.stars.includes(value);life.stars=removing?life.stars.filter(id=>id!==value):[...life.stars,value];
        if(!this.persist()){life.stars=previousStars;this.store.savedMomentToastCount=previousCount;this.render();return;}this.render();
        if(removing){clearTimeout(this._toastTimer);this.setData({toast:''});}else this.notify(this.tx('收藏成功！已为您记录下此刻的人生瞬间！','收藏成功！已為您記錄下此刻的人生瞬間！','Saved! This life moment is now recorded!'));return;
      }
      if(action==='more-moments'){this._momentLimit+=24;return this.render();}
      if(action==='end-done'){this._view='report';this.render();wx.pageScrollTo({scrollTop:0,duration:0});return;}
      if(action==='edit-review'){if(this._editable!==life?.id||this._view!=='report'||this._viewed)return;this.setData({modal:'review',reviewDraft:life.farewell||''});return;}
      if(action==='save-review'){if(this._editable!==life?.id||this._view!=='report'||this.data.modal!=='review'||this._viewed)return;const previous=life.farewell;life.farewell=this.data.reviewDraft.trim().slice(0,300);if(!this.persist()){life.farewell=previous;return;}this.setData({modal:''});this.render();return this.notify(this.tr('saved'));}
      if(action==='memorialize'){
        if(this._view!=='report'||life?.phase!=='dead'||this._viewed)return;
        if(this._storageReadFailed){this.persist();return;}
        if(!this.store.history.some(item=>item.id===life.id)){const old=this.store.history;this.store.history=[life,...old].slice(0,12);try{storage.writeStore(this.store);}catch(error){this.store.history=old;throw error;}}
        this.render();return this.notify(this.tx('这一生已放入追思馆','這一生已放入追思館','Placed in the memorial hall'));
      }
      if(action==='candle'){const item=this.store.history.find(item=>item.id===value)||life;if(!item||item.phase!=='dead')return;const previousLit=item.candleLit,previousCandles=item.candles,lit=item.candleLit??item.candles>0;item.candleLit=!lit;item.candles=Math.max(0,(item.candles||0)+(lit?-1:1));if(!this.persist()){item.candleLit=previousLit;item.candles=previousCandles;}return this.render();}
      if(action==='music'){if(Date.now()-(this._musicMoved||0)<350)return;this.setData({musicPlaying:platform.toggleMusic()});return;}
      if(action==='capture-ending'){
        if(!life||life.phase!=='dead'||this._savingPhoto)return;
        this._savingPhoto=true;
        try{
        if(!await platform.albumAuthorized()){
        const consent=await new Promise(resolve=>wx.showModal({
          title:this.tx('保存纪念照片','儲存紀念照片','Save a memorial photo'),
          content:this.tx('需要申请保存图片到相册的权限，用于保存这段人生的纪念照。照片包含角色姓名和记录，仅在本机生成，不会上传。','照片包含這段人生的姓名和紀錄，只在本機產生。確認後會儲存到手機相簿，不會上傳。','This photo includes the character’s name and life story. It is created on your device and saved to your photos only with your consent.'),
          confirmText:this.tx('允许保存','允許儲存','Allow'),
          success:result=>resolve(!!result.confirm),fail:()=>resolve(false)
        }));
        if(!consent)return;
        await platform.requestAlbumAccess();
        }
        wx.showLoading({title:this.tx('保存照片中','儲存照片中','Saving photo')});
          this._photo ||= await platform.captureMemorial(this,life,{language:this.store.settings.language});
          await platform.saveImage(this._photo,life,this.store.settings.language);
          this.notify(this.tx('已保存到手机相册','已儲存到手機相簿','Saved to your photos'));
        }catch(error){
          if(/auth deny|authorize|permission|scope\.writePhotosAlbum/i.test(error?.errMsg||''))wx.showModal({title:this.tx('允许保存照片','允許儲存照片','Allow photo access'),content:this.tx('请在微信设置中允许保存到相册，然后重试。','請在微信設定中允許儲存到相簿，然後重試。','Allow photo access in WeChat settings, then try again.'),confirmText:this.tx('去设置','去設定','Settings'),success:result=>{if(result.confirm)wx.openSetting({});}});
          else this.notify(this.tx('照片未保存，请重试','照片未儲存，請重試','Photo not saved. Try again.'));
        }finally{this._savingPhoto=false;wx.hideLoading();}
        return;
      }
    }catch(error){console.error('Action failed',action,error);wx.hideLoading();this.notify(this.tx('这次操作未完成，请重试。人生记录仍在。','這次操作未完成，請重試。人生紀錄仍在。','Please try again. Your life is still saved.'));}
  }
});
