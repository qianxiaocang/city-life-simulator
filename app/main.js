import { referencesFor } from './references.js';
import { drawHighlightScene } from './highlight-scenes.js';
import { memorialReview } from './memorial-review.js';
import { locations } from './data/locations.js';
import { LANGUAGES, t, valueText, money, educationText } from './i18n.js';
import { createLife, startLife, advanceYear, choose, autoChoose, setFocus, setAutopilot, runAutopilot, getFocusOptions, summarize, generateCompanions, configureLocations, netWorth, processTimeline, ensureModelState } from './engine.js';

configureLocations(locations);
const app = document.querySelector('#app'), modalRoot = document.querySelector('#modal-root');
const SAVE_KEY = 'this-life-city.v1';
const regions = ['mainland', 'taiwan', 'hongkong', 'macau'];
const locationsById = new Map(locations.map(place => [place.id, place]));
const initialLanguage = navigator.language.startsWith('en') ? 'en' : /TW|HK|Hant/.test(navigator.language) ? 'zh-TW' : 'zh-CN';
let store = { version: 1, settings: { language: initialLanguage, theme: 'light', scope: 'all', province: 'all', world: 'now', birthYear: 1980, pace: 30 }, current: null, history: [] };
try { const old = JSON.parse(localStorage.getItem(SAVE_KEY)); if (old?.version === 1) store = { ...store, ...old, settings: { ...store.settings, ...old.settings }, history: Array.isArray(old.history) ? old.history.slice(0, 12) : [] }; } catch { /* Private browsing can disable storage. */ }
if (!LANGUAGES.some(language => language.id === store.settings.language)) store.settings.language = 'zh-CN';
if (!regions.includes(store.settings.scope) && store.settings.scope !== 'all') store.settings.scope = 'all';
if (!['past', 'now'].includes(store.settings.world)) store.settings.world = 'now';
delete store.settings.gentle;
if(store.current&&store.current.phase!=='dead')ensureModelState(store.current);
let view = 'home', viewedLife = null, modal = null, lastFocus = null, minimizedDecision = null, advancedOpen = false, overviewExpanded = false;
let paused = true, speed = 1, fast = false, automatic = !!store.current?.autopilot?.enabled, progress = 0, logLimit = 12, autoDeadline = 0, toastTimer, lastFrame = 0;
let audioState = null;
const L = value => valueText(value, store.settings.language);
const tr = key => t(key, store.settings.language);
const tx = (zhCN, zhTW, en) => L({ zhCN, zhTW, en });
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const button = (action, label, extra = '') => `<button data-action="${action}" ${extra}>${label}</button>`;
const ageUnit = age => store.settings.language === 'en' && age === 1 ? 'year' : tr('age');
const ageLabel = age => store.settings.language === 'en' ? `${age} ${ageUnit(age)}` : `${age}${ageUnit(age)}`;
const formatMoney = number => money(number, store.settings.language);
const currentLife = () => viewedLife || store.current;
const placeLabel = place => L(place?.name);
const regionLabel = region => tr(region);
function modelStatus(life){
  const p=life.profile||{};
  const through=p.observedThrough||2025;
  const projection=p.projection?tx(`推算情景：沿用截至 ${through} 年的观测锚点`, `推算情景：沿用截至 ${through} 年的觀測錨點`, `Projection scenario using observation anchors through ${through}`):tx(`观测锚点截至 ${through} 年`, `觀測錨點截至 ${through} 年`, `Observation anchors through ${through}`);
  const estimate=p.historicalEstimate?tx(' · 早期或地区数值含历史估计',' · 早期或地區數值含歷史估計',' · early or regional values include historical estimates'):'';
  return `${projection}${estimate} · ${tx('金额为2025年购买力游戏元','金額為2025年購買力遊戲元','Money is modeled in 2025 CNY purchasing power')}`;
}
function journalHTML(life){return (life.journal||[]).length?`<div class="panel-pad"><h3>${tx('你写下的想法','你寫下的想法','What you wrote')}</h3>${life.journal.map(entry=>`<article class="memory-note"><span class="info-label">${entry.year} · ${ageLabel(entry.age)}</span><p>${esc(entry.text)}</p></article>`).join('')}</div>`:'';}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(store)); } catch { toast(tr('saveError')); } }
function toast(message) { const target = document.querySelector('#toast'); target.textContent = message; target.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => target.classList.remove('visible'), 3500); }
function languageSelect() {
  const selected = LANGUAGES.find(language => language.id === store.settings.language) || LANGUAGES[0];
  return `<details class="language-picker"><summary aria-label="${tx('切换语言', '切換語言', 'Change language')}"><span class="language-mark" aria-hidden="true">文</span><span class="language-current">${selected.label}</span><span class="language-chevron" aria-hidden="true"></span></summary><div class="language-options" role="group" aria-label="${tx('选择语言', '選擇語言', 'Select language')}">${LANGUAGES.map(language => button('language', `<span>${language.label}</span><span class="language-check" aria-hidden="true">✓</span>`, `data-value="${language.id}" class="${language.id === selected.id ? 'selected' : ''}" aria-pressed="${language.id === selected.id}"`)).join('')}</div></details>`;
}
function themeButton() { return button('theme', store.settings.theme === 'dark' ? '☀' : '◐', `class="theme-button" aria-label="${tr('theme')}" title="${tr('theme')}"`); }
function syncMusicControl() {
  const control = document.querySelector('#floating-music');
  const label = audioState ? tx('关闭音乐', '關閉音樂', 'Turn music off') : tx('开启音乐', '開啟音樂', 'Turn music on');
  control.classList.toggle('is-playing', !!audioState);
  control.setAttribute('aria-pressed', String(!!audioState));
  control.setAttribute('aria-label', label);
  control.title = label;
  document.body.dataset.view = view;
}
function header() {
  if (view === 'home') return '';
  const title = {certificate:tr('certificate'),archive:tr('archive'),report:tx('一段人生','一段人生','A lifetime')}[view] || tr('brand');
  return `<header class="page-topbar">${button('back','‹',`class="page-back" aria-label="${tr('back')}"`)}<strong>${title}</strong>${button('home','⌂',`class="page-home-link" aria-label="${tr('home')}"`)}</header>`;
}
function footer() { return ''; }
function navigate(next, life = null) { closeModal(); paused = true; fast = false; view = next; viewedLife = life; logLimit = 12; minimizedDecision = null; progress = Number(life?.uiProgress ?? store.current?.uiProgress ?? 0); render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
function render() {
  document.documentElement.lang = store.settings.language;
  document.documentElement.dataset.theme = store.settings.theme;
  document.title = `${tr('brand')} · ${tr('brandSub')}`;
  if (view === 'life' && currentLife()?.phase === 'dead') view = 'report';
  if (view === 'home') renderHome(); else if (view === 'certificate') renderCertificate(); else if (view === 'life') renderLife(); else if (view === 'archive') renderArchive(); else if (view === 'report') renderReport();;
  drawAll();
  syncMusicControl();
  if (view === 'life' && store.current?.pending && minimizedDecision !== store.current.pending.id) openDecision();
}
function pool() { return locations.filter(place => (store.settings.scope === 'all' || place.region === store.settings.scope) && (store.settings.province === 'all' || place.province.id === store.settings.province)); }
function provinceOptions() { const map = new Map(); for (const place of locations.filter(place => store.settings.scope === 'all' || place.region === store.settings.scope)) map.set(place.province.id, place.province); return [...map.values()].sort((a, b) => L(a).localeCompare(L(b), store.settings.language)); }
function renderHome() {
  const settings=store.settings,available=store.current&&store.current.phase!=='dead';
  const memories=store.history.slice(0,2);
  const worldLabel=world=>`${tr(world)}${world==='past'?` ${settings.birthYear}`:world==='now'?` ${new Date().getFullYear()}`:''}`;
  app.innerHTML=`<div class="wrap page-home"><main class="home-main">
    <div class="home-top"><span class="home-brand">${tr('brand')}</span><div class="home-controls">${languageSelect()}${themeButton()}</div></div>
    <section class="home-intro"><span class="eyebrow">${tx('人生模拟 · 中国城市','人生模擬 · 中國城市','A life across Chinese cities')}</span><h1>${tr('heroTitle')}</h1><p class="home-lede">${tr('heroText')}</p><div class="home-intro-art"><canvas id="home-scene" width="640" height="220" aria-hidden="true"></canvas></div></section>
    ${available?`<section class="resume-strip"><div><strong>${esc(L(store.current.name))} · ${ageLabel(store.current.age)}</strong><p>${tr('resumeText')} ${esc(placeLabel(store.current.location))}</p></div>${button('resume',tr('resume'),'class="primary"')}</section>`:''}
    <section class="registration" aria-labelledby="registration-title"><div class="section-heading"><h2 id="registration-title">${tx('过去和现在','過去和現在','Past and present')}</h2><span>${locations.length.toLocaleString()} ${tr('cityCount')}</span></div><div class="segments era-tabs">${['past','now'].map(world=>button('world',worldLabel(world),`data-value="${world}" class="${settings.world===world?'active':''}" aria-pressed="${settings.world===world}"`)).join('')}</div><p class="field-hint">${tr(`${settings.world}Hint`)}</p>
      ${settings.world==='past'?`<div class="field birth-year-field"><label for="birth-year">${tr('year')}</label><select id="birth-year" data-setting="birthYear">${Array.from({length:76},(_,index)=>2025-index).map(year=>`<option value="${year}" ${year===Number(settings.birthYear)?'selected':''}>${year}</option>`).join('')}</select></div>`:''}
      <details class="advanced-settings" ${advancedOpen?'open':''}><summary>${tx('出生地与游玩设置','出生地與遊玩設定','Birthplace and play settings')}</summary><div class="advanced-body"><div class="field"><label for="region-select">${tr('scope')}</label><select id="region-select" data-setting="scope"><option value="all">${tr('allRegions')}</option>${regions.map(region=>`<option value="${region}" ${settings.scope===region?'selected':''}>${regionLabel(region)}</option>`).join('')}</select></div><div class="field"><label for="province-select">${tr('province')}</label><select id="province-select" data-setting="province"><option value="all">${tr('allProvinces')}</option>${provinceOptions().map(province=>`<option value="${province.id}" ${settings.province===province.id?'selected':''}>${esc(L(province))}</option>`).join('')}</select></div><div class="field"><label>${tr('pace')}</label><div class="segments">${[30,60,90].map(pace=>button('pace',`${pace} ${tr('minutes')}`,`data-value="${pace}" class="${settings.pace===pace?'active':''}" aria-pressed="${settings.pace===pace}"`)).join('')}</div></div></div></details>
      ${button(available?'resume':'born',available?tr('resume'):tr('born'),'class="primary full birth-button"')}<p class="birth-footnote">${tr('weightedHint')}</p></section>
    <section class="home-memorial"><div class="section-heading"><h2>${tx('安放在追思馆的人生','安放在追思館的人生','Lives in the memorial hall')}</h2>${button('archive',tx('查看全部','查看全部','View all'),'class="text-button"')}</div>${memories.length?`<div class="memorial-preview">${memories.map(life=>`<button class="memorial-mini" data-action="review" data-value="${life.id}"><canvas data-memory-cover="${life.id}" width="640" height="220" aria-hidden="true"></canvas><strong>${esc(L(life.name))}</strong><small>${life.birthYear}–${life.year} · ${esc(placeLabel(life.born))}</small></button>`).join('')}</div>`:`<p class="home-empty">${tx('完成第一段人生后，它会出现在这里。','完成第一段人生後，它會出現在這裡。','Your first completed life will appear here.')}</p>`}</section>
  </main></div>`;
}
function newLife() {
  automatic = false;
  const candidates = pool();
  const selected = weightedPlace(candidates.length ? candidates : locations);
  const seed = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const birthYear = store.settings.world === 'past' ? Number(store.settings.birthYear) : new Date().getFullYear();
  const life = createLife({ location: selected, locations, language: store.settings.language, seed, birthYear, world: store.settings.world, paceMinutes: store.settings.pace });
  life.companions = generateCompanions({ locations, seed, birthYear, world: store.settings.world });
  life.stars = []; life.uiProgress = 0;
  store.current = life; persist(); navigate('certificate');
}
function weightedPlace(values) { const total = values.reduce((sum, place) => sum + place.weight, 0); let draw = Math.random() * total; return values.find(place => (draw -= place.weight) <= 0) || values.at(-1); }
function info(label, value) { return `<div><span class="info-label">${label}</span><div class="info-value">${esc(value)}</div></div>`; }
function renderCertificate() {
  const life = currentLife(); if (!life) return navigate('home');
  app.innerHTML = `<div class="wrap page-certificate">${header()}<main class="cert-wrap"><article class="certificate"><div class="cert-visual"><canvas id="cert-scene" width="640" height="220" role="img" aria-label="${esc(placeLabel(life.born))}"></canvas><p>${tx(`这一生从 ${esc(placeLabel(life.born))} 开始。`,`這一生從 ${esc(placeLabel(life.born))} 開始。`,`This life begins in ${esc(placeLabel(life.born))}.`)}</p></div>
    <div class="birth-context"><strong>${esc(placeLabel(life.born))}</strong><span>${esc(L(life.born.province))} · ${regionLabel(life.born.region)} · ${life.birthYear}</span><p>${tr('birthCityNote')}</p></div>
    <div class="cert-body"><div class="cert-name"><span class="info-label">${tr('certificate')}</span><h1>${esc(L(life.name))}</h1><p>${esc(L(life.log.at(-1).text))}</p></div><div class="cert-grid">${info(tr('sex'), tr(life.sex))}${info(tr('birthplace'), placeLabel(life.born))}${info(tr('familyClass'), tr(`class${life.classRank}`))}${info(tr('mother'), `${L(life.family.mother.name)} · ${ageLabel(life.family.mother.age)}`)}${info(tr('father'), `${L(life.family.father.name)} · ${ageLabel(life.family.father.age)}`)}${info(tx('出生月份','出生月份','Birth month'),life.birthYear+'-'+String(life.birthMonth||1).padStart(2,'0'))}${info(tr('referenceLifespan'), `${life.profile.lifeExpectancy.toFixed(1)} ${tr('age')}`)}</div>
    <h3>${tr('sameMoment')}</h3><p class="small-text muted">${tr('companionHint')}</p><div class="companions-inline">${(life.companions || []).map(person => `<div class="mini-person"><strong>${esc(L(person.name))}</strong><span>${esc(placeLabel(person.born))} · ${tr(person.sex)}</span></div>`).join('')}</div><p class="tiny muted model-note">${esc(modelStatus(life))}</p></div>
    <div class="cert-actions">${button('birth-card', tr('shareBirth'))}${button('begin', tr('beginLife'), 'class="primary"')}</div></article></main>${footer()}</div>`;
}
function lifeOverview(life) {
  const career = life.job ? L(life.job.name) : life.retired ? tx('已退休', '已退休', 'Retired') : tr('noJob');
  const facts = [
    [tr('sex'), tr(life.sex)],
    [tr('birthplace'), placeLabel(life.born)],
    [tr('currentCity'), placeLabel(life.location)],
    [tr('familyClass'), tr(`class${life.classRank}`)],
    [tr('education'), educationText(life.education, store.settings.language)],
    ...(life.temperament ? [[tx('气质', '氣質', 'Temperament'), L(life.temperament)]] : [])
  ];
  const stats = Object.entries(life.stats).map(([key, value]) => `<div class="overview-stat ${key}"><div class="overview-stat-line"><span>${tr(key)}</span><strong>${Math.round(value)}</strong></div><div class="overview-track" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, value))}%"></span></div></div>`).join('');
  const assets = [
    [tx('现金', '現金', 'Cash'), life.money],
    [tx('住房', '住房', 'Home'), life.assets?.house],
    [tx('车辆', '車輛', 'Car'), life.assets?.car],
    [tx('退休账户', '退休帳戶', 'Retirement'), life.assets?.retirement],
    ...[
      ['furniture', tx('家具', '家具', 'Furniture')],
      ['appliances', tx('家电', '家電', 'Appliances')],
      ['phone', tx('通信设备', '通訊設備', 'Communication device')],
      ['computer', tx('电脑', '電腦', 'Computer')],
      ['bicycle', tx('自行车', '自行車', 'Bicycle')]
    ].filter(([key]) => (life.assets?.[key] || 0) > 0).map(([key, label]) => [label, life.assets[key]]),
    [tx('负债', '負債', 'Debt'), life.debt]
  ];
  const family = [life.family.mother && `${tr('mother')} ${L(life.family.mother.name)}`, life.family.father && `${tr('father')} ${L(life.family.father.name)}`].filter(Boolean);
  const familyExtra = [
    life.family.partner ? `${tr('partner')} ${L(life.family.partner.name)}` : null,
    life.family.children.length ? `${tr('children')} ${life.family.children.length}` : null,
    life.family.siblings.length ? `${tr('siblings')} ${life.family.siblings.length}` : null
  ].filter(Boolean);
  return `<section class="life-overview" aria-labelledby="life-overview-title">
    <div class="overview-header"><span class="overview-eyebrow" id="life-overview-title">${tx('人生总览', '人生總覽', 'Life overview')}</span><span class="overview-date">${life.year} · ${ageLabel(life.age)}</span></div>
    <div class="overview-person"><div class="overview-avatar" aria-hidden="true">${esc(Array.from(L(life.name))[0] || '·')}</div><div class="overview-person-copy"><h1>${esc(L(life.name))}</h1><p>${esc(placeLabel(life.location))} · ${tr(life.urban ? 'urban' : 'rural')} · ${esc(career)}</p></div></div>
    <div class="overview-stats" aria-label="${tr('stats')}">${stats}</div>
    <div class="overview-finances"><div><span>${tr('wealth')}</span><strong>${formatMoney(netWorth(life))}</strong></div><div><span>${tx('现金', '現金', 'Cash')}</span><strong>${formatMoney(life.money)}</strong></div><div><span>${tr('income')}</span><strong>${formatMoney(life.income)}</strong></div></div>
    <div class="overview-household"><span>${tx('身份与家人', '身份與家人', 'Identity & family')}</span><p>${esc(`${tr(life.sex)} · ${educationText(life.education, store.settings.language)} · ${family.join(' · ')}${familyExtra.length ? ` · ${familyExtra.join(' · ')}` : ''}`)}</p></div>
    <details class="overview-details" ${overviewExpanded ? 'open' : ''}><summary>${tx('查看身份、家人与资产明细', '查看身份、家人與資產明細', 'View identity, family & assets')}</summary><div class="overview-detail-content"><div><h2>${tr('identity')}</h2><dl class="overview-facts">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></div><div><h2>${tr('family')}</h2><div class="overview-family-content">${familyHTML(life)}</div></div><div><h2>${tx('资产明细', '資產明細', 'Assets')}</h2><dl class="overview-facts">${assets.map(([label, value]) => `<div><dt>${label}</dt><dd>${formatMoney(value || 0)}</dd></div>`).join('')}</dl><p class="overview-note">${tr('moneyUnit')}</p></div></div></details>
    ${life.autopilot?.enabled || automatic ? button('take-control', tx('抉择已交给自动 · 点此恢复手动','抉擇已交給自動 · 點此恢復手動','Choices are automatic · Take control'), 'class="overview-auto"') : ''}
  </section>`;
}
function lifeFocus(life, choices) {
  return `<section class="life-focus-top" aria-label="${tr('focus')}"><div class="life-focus-heading"><strong>${tr('focus')}</strong><span>${choices.length ? tr('focusHint') : tr('babyFocus')}</span></div>${choices.length ? `<div class="life-focus-options">${choices.map(choice => button('focus', esc(L(choice.label)), `data-value="${choice.id}" class="focus-chip ${choice.id === life.focus ? 'selected' : ''}" title="${esc(L(choice.description))}" aria-pressed="${choice.id === life.focus}"`)).join('')}</div>` : ''}</section>`;
}
function lifeMoments(life) {
  const byId = new Map(life.log.map(event => [event.id, event]));
  const events = (life.stars || []).slice().reverse().map(id => byId.get(id)).filter(Boolean);
  return `<section class="life-moments" aria-labelledby="life-moments-title"><div class="moments-heading"><h2 id="life-moments-title">${tx('人生瞬间', '人生瞬間', 'Life moments')}</h2><span>${events.length}</span></div>${events.length ? `<div class="moments-track">${events.map(event => `<article class="moment-card"><canvas data-memory-event="${esc(event.id)}" width="640" height="220" role="img" aria-label="${esc(displayEventText(event))}"></canvas><div><small>${ageLabel(event.age)} · ${event.year}</small><p>${esc(displayEventText(event))}</p></div></article>`).join('')}</div>` : `<p class="moments-empty">${tx('点亮人生记录旁的星标，瞬间会带着像素画收藏在这里。', '點亮人生記錄旁的星標，瞬間會帶著像素畫收藏在這裡。', 'Star a life record to keep it here with a pixel scene.')}</p>`}</section>`;
}
function yearProgress(life) {
  const percent = Math.round(progress * 100);
  return `<div class="year-progress-block"><div class="year-progress-label"><span>${tx('这一年', '這一年', 'This year')} · ${life.year}</span><strong><span id="year-progress-value">${percent}%</span><span>${fast ? tx('快转', '快轉', 'Fast forward') + ' · ' : ''}${speed}×</span></strong></div><div class="year-progress" role="progressbar" aria-label="${tx('年度进度', '年度進度', 'Year progress')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span id="year-progress" style="width:${progress * 100}%"></span></div></div>`;
}
function renderLife() {
  const life = store.current; if (!life) return navigate('home');
  const choices = getFocusOptions(life);
  app.innerHTML = `<main class="game-shell"><div class="life-nav">${button('leave','‹',`aria-label="${tr('back')}"`)}<span>${tx('正在活着','正在活著','Living')}</span><span class="life-nav-spacer" aria-hidden="true"></span></div><header class="game-toolbar"><div class="game-toolbar-top"><div class="toolbar-brand">${tr('brand')}</div><div class="age-display">${life.age}<small>${ageUnit(life.age)}</small></div><div class="toolbar-person">${life.year} · ${esc(L(life.name))}<br>${esc(placeLabel(life.location))}</div><div class="toolbar-tools">${button('leave', tr('exit'))}</div></div>${yearProgress(life)}<div class="control-status"><span>${esc(life.job ? L(life.job.name) : life.retired ? tx('已退休','已退休','Retired') : tr('noJob'))}</span><span>${formatMoney(life.income)} / ${tx('年','年','yr')}</span></div><div class="time-controls">${button('pause', paused ? tr('play') : tr('pause'), `id="pause-control" class="${paused ? 'active' : ''}" aria-pressed="${paused}"`)}<div class="speed-controls">${[1, 2, 4, 8, 12, 16].map(value => button('speed', `${value}×`, `data-value="${value}" class="${speed === value ? 'active' : ''}" aria-pressed="${speed === value}"`)).join('')}</div><span class="control-divider"></span>${button('next', `${tr('next')} »`, `class="${fast ? 'active' : ''}"`)}${button('year', tr('oneYear'))}${button('auto', tr('auto'), `class="${automatic&&!life.autopilot?.enabled ? 'active' : ''}" aria-pressed="${automatic&&!life.autopilot?.enabled}"`)}${button('autopilot', tr('autopilot'), `class="${life.autopilot?.enabled ? 'active' : ''}" aria-pressed="${!!life.autopilot?.enabled}"`)}${life.pending && minimizedDecision === life.pending.id ? button('pending', tr('majorChoice'), 'class="primary"') : ''}</div></header>${lifeOverview(life)}${lifeFocus(life, choices)}${lifeMoments(life)}<div class="life-layout"><section class="life-center"><section class="panel life-scene"><canvas id="life-scene" width="640" height="220" role="img" aria-label="${esc(`${placeLabel(life.location)} · ${tr(life.urban ? 'urban' : 'rural')}`)}"></canvas><div class="scene-caption"><span>${esc(placeLabel(life.location))} · ${tr(life.urban ? 'urban' : 'rural')}</span><span>${life.year}</span></div></section><section class="panel feed-panel"><div class="panel-header panel-pad" style="margin-bottom:0"><h3>${tr('lifeLog')}</h3><span>${tr('newestFirst')}</span></div><div class="life-feed">${logHTML(life, logLimit)}</div>${life.log.length > logLimit ? `<div class="panel-pad">${button('earlier', tr('earlier'), 'class="full small"')}</div>` : ''}</section></section><aside class="life-right"><section class="panel panel-pad companions-panel"><h3>${tr('sameMoment')}</h3><div class="companions-stack">${companionsHTML(life)}</div><p class="tiny muted" style="margin:17px 0 0">${tr('companionHint')}</p></section><section class="panel panel-pad"><h3>${tr('lifeMap')}</h3>${yearGrid(life)}<p class="tiny muted" style="margin:12px 0 0">${tr('lifeMapHint')}</p></section><section class="panel panel-pad"><h3>${tr('survival')}</h3><canvas id="survival" class="survival-canvas" width="480" height="300" role="img" aria-label="${tr('survival')}"></canvas><p class="tiny muted" style="margin:10px 0 0">${tr('survivalHint')}</p></section></aside></div></main>`;
}
function familyHTML(life) {
  const row = (kind, person) => person ? `<div class="family-row"><span class="muted">${kind}</span><span class="family-name">${esc(L(person.name))}<small>${person.alive ? ageLabel(person.age) : tr('passed')}</small></span></div>` : '';
  return row(tr('mother'), life.family.mother) + row(tr('father'), life.family.father) + (life.family.partner ? row(tr('partner'), life.family.partner) : `<p class="tiny muted">${tr('single')}</p>`) + life.family.children.map(child => row(tr('children'), child)).join('') + (life.family.siblings.length ? `<div class="family-row"><span class="muted">${tr('siblings')}</span><span>${life.family.siblings.map(person => `${esc(L(person.name))} · ${person.alive ? ageLabel(person.age) : tr('passed')}`).join('<br>')}</span></div>` : '') + (life.hobbies.length ? `<p class="tiny muted" style="margin:14px 0 0">${life.hobbies.map(hobby => `${esc(L(hobby.name))} · Lv.${Math.floor(hobby.level)}`).join(' · ')}</p>` : '');
}
function displayEventText(event) { const text=L(event.text); return event.date&&text.startsWith(event.date+' · ')?text.slice(event.date.length+3):text; }
function logHTML(life, count) { return life.log.slice(0, count).map(event => `<article class="feed-item ${event.type}"><span class="feed-age">${event.age}</span><div class="feed-text">${event.date?'<span class="history-date mono">'+esc(event.date)+(event.timeBeijing?' '+esc(event.timeBeijing)+' (UTC+8)':'')+'</span>':''}${esc(displayEventText(event))}${sourceLinks(event)}${event.effects ? `<div class="feed-meta">${Object.entries(event.effects).filter(([key]) => key in life.stats).map(([key, value]) => `${tr(key)} ${value > 0 ? '+' : ''}${Math.round(value * 10) / 10}`).join(' · ')}</div>` : ''}</div>${button('star', life.stars?.includes(event.id) ? '★' : '☆', `data-value="${event.id}" class="star ${life.stars?.includes(event.id) ? 'is-starred' : ''}" aria-label="${tx('收藏记忆', '收藏記憶', 'Star a memory')}" aria-pressed="${!!life.stars?.includes(event.id)}"`)}</article>`).join(''); }
function companionsHTML(life) { return (life.companions || []).map(person => { const gone = life.age >= person.deathAge; const year = person.years.find(item => item.age === life.age) || person.years.at(-1); const stage = gone ? `${ageLabel(person.deathAge)} · ${tr('goneAt')}` : year?.job ? L(year.job) : educationText(year?.education, store.settings.language); return `<article class="companion ${gone ? 'gone' : ''}"><div class="companion-top"><div><div class="companion-name">${esc(L(person.name))}</div><div class="companion-city">${esc(placeLabel(person.born))} · ${tr(person.sex)}</div></div><span class="companion-dot"></span></div><p class="companion-status">${esc(stage)}</p></article>`; }).join(''); }
function yearGrid(life) { const byAge = new Map(life.years.map(year => [year.age, year])); return `<div class="year-grid">${Array.from({ length: Math.max(96, life.age + 1) }, (_, age) => { const year = byAge.get(age); return `<span class="year-square ${life.age === age ? 'current' : ''}" title="${ageLabel(age)}${year ? ` · ${tr('happiness')} ${Math.round(year.happiness)}` : ''}" ${year ? `style="background:hsl(${55 + year.happiness * .95} 28% ${83 - year.happiness * .46}%)"` : ''}></span>`; }).join('')}</div><div class="year-legend"><span>0</span><span>48</span><span>${Math.max(95, life.age)}</span></div>`; }
function memorialPlaceCount(life) { return new Set((life.visited || []).map(place => place?.id).filter(Boolean)).size || 1; }
function memorialReviewHTML(life) {
  const review = memorialReview(life, store.settings.language);
  return `<div class="memorial-review"><span>${review.origin === 'written' ? tx('亲笔点评', '親筆點評', 'Your words') : tx('一生点评 · 系统生成', '一生點評 · 系統生成', 'Life reflection · generated')}</span><p>${esc(review.text)}</p></div>`;
}
function memorialLifeFacts(life) {
  const summary = summarize(life);
  const facts = [
    [tr('birthplace'), placeLabel(life.born)],
    [tx('最后居所', '最後居所', 'Final home'), placeLabel(life.location)],
    [tr('education'), educationText(life.education, store.settings.language)],
    [tr('career'), L(summary.job)],
    [tr('partner'), life.family.partner ? L(life.family.partner.name) : tx('未记录', '未記錄', 'Not recorded')],
    [tr('children'), String(life.family.children.length)],
    [tx('生活过的地方', '生活過的地方', 'Places called home'), String(memorialPlaceCount(life))],
    [tx('珍藏瞬间', '珍藏瞬間', 'Saved moments'), String(life.stars?.length || 0)]
  ];
  return `<dl class="memorial-life-facts">${facts.map(([name, value]) => `<div><dt>${name}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
}
function memorialHallFacts(list) {
  const places = new Set(list.flatMap(life => (life.visited || [life.born]).map(place => place?.id).filter(Boolean)));
  const facts = [
    [tx('馆藏人生', '館藏人生', 'Lives remembered'), list.length],
    [tx('累计岁月', '累計歲月', 'Years lived'), list.reduce((sum, life) => sum + life.age, 0)],
    [tx('最长一生', '最長一生', 'Longest life'), Math.max(0, ...list.map(life => life.age))],
    [tx('到过地点', '到過地點', 'Places reached'), places.size],
    [tx('珍藏瞬间', '珍藏瞬間', 'Saved moments'), list.reduce((sum, life) => sum + (life.stars?.length || 0), 0)],
    [tx('点亮烛光', '點亮燭光', 'Candles lit'), list.reduce((sum, life) => sum + (life.candles || 0), 0)]
  ];
  return `<div class="memorial-hall-facts">${facts.map(([name, value]) => `<div><strong>${Number(value).toLocaleString(store.settings.language)}</strong><span>${name}</span></div>`).join('')}</div>`;
}
function renderArchive() {
  const list=store.history;
  app.innerHTML=`<div class="wrap page-archive">${header()}<main class="memorial-main"><div class="memorial-heading"><span class="eyebrow">MEMORIAL HALL</span><h1>${tr('archive')}</h1><p>${tx('这些人生，是有人把它活到了最后，想长久珍藏而安放在这里的。欢迎来看，点亮烛光，留下一句话。','這些人生，是有人把它活到了最後，想長久珍藏而安放在這裡的。歡迎來看，點亮燭光，留下一句話。','These lives were lived to the end and kept here to remember. Come in, light a candle, and leave a thought.')}</p></div>${memorialHallFacts(list)}
  ${list.length?`<div class="memorial-list">${list.map(life=>`<article class="memorial-card"><button class="memorial-card-main" data-action="review" data-value="${life.id}" aria-label="${esc(L(life.name))}"><canvas data-memory-cover="${life.id}" width="640" height="220" aria-hidden="true"></canvas><span class="memorial-card-body"><strong>${esc(L(life.name))}</strong><small>${life.birthYear}–${life.year} · ${esc(placeLabel(life.born))} · ${ageLabel(life.age)}</small><span>${esc(memorialTagline(life))}</span><span class="memorial-card-review">${esc(memorialReview(life, store.settings.language).text)}</span></span></button>${button('candle',`${life.candleLit??(life.candles>0)?'🕯️':'🕯'} <span>${life.candles||0}</span>`,`data-value="${life.id}" class="memorial-candle" aria-label="${(life.candleLit??(life.candles>0))?tx('收起烛光','收起燭光','Put out candle'):tx('点亮烛光','點亮燭光','Light a candle')}" aria-pressed="${!!(life.candleLit??(life.candles>0))}"`)}</article>`).join('')}</div>`:`<div class="memorial-empty"><p>${tr('noLives')}</p>${button('home',tr('born'),'class="primary"')}</div>`}</main></div>`;
}
function memorialTagline(life) {
  const job=L(summarize(life).job),years=(life.years||[]).filter(year=>year.job&&L(year.job)===job).length;
  return years>0?tx(`当了${years}年${job}的人生`,`當了${years}年${job}的人生`,`A life with ${years} years as ${job}`):tx(`在${placeLabel(life.born)}度过的一生`,`在${placeLabel(life.born)}度過的一生`,`A life lived in ${placeLabel(life.born)}`);
}
function reportHighlights(life) {
  const candidates=life.log.filter(event=>['birth','education','love','family','career','move','work','asset','decision','warm'].includes(event.type));
  const score=event=>{
    const words=event.text?.zhCN||'';
    let value={birth:100,education:24,love:21,family:18,career:22,move:15,work:17,decision:13,warm:3,asset:1}[event.type]||0;
    if(/毕业|出生了|结婚|退休|搬到|开始了|获得|取得|购置|安排了/.test(words))value+=35;
    if(/未能|困难|失去|失败|减少|估值/.test(words))value-=30;
    if(life.stars?.includes(event.id))value+=80;
    return value+event.age*.002;
  };
  const chosen=[];
  for(let decade=0;decade<=Math.floor(life.age/10);decade++){
    const within=candidates.filter(event=>Math.floor(event.age/10)===decade).sort((a,b)=>score(b)-score(a));
    if(within.length){
      chosen.push(within[0]);
      const second=within.find(event=>Math.abs(event.age-within[0].age)>=2&&score(event)>=48);
      if(second)chosen.push(second);
    }
  }
  const byId=new Map(life.log.map(event=>[event.id,event]));
  for(const id of life.stars||[]){const event=byId.get(id);if(event&&!chosen.some(item=>item.id===id))chosen.push(event);}
  return chosen.sort((a,b)=>a.age-b.age);
}
function memorialDecade(age){
  if(age<10)return tx('童年','童年','Childhood');
  if(age<20)return tx('十几岁','十幾歲','Teenage years');
  if(store.settings.language==='en')return `${Math.floor(age/10)*10}s`;
  return `${Math.floor(age/10)*10}${tx('多岁','多歲','s')}`;
}
function renderReport() {
  const life=currentLife();if(!life)return navigate('archive');
  const highlights=reportHighlights(life).sort((a,b)=>a.age-b.age);
  const groups=new Map();for(const event of highlights){const decade=Math.floor(event.age/10);if(!groups.has(decade))groups.set(decade,[]);groups.get(decade).push(event);}
  const allEvents=life.log.slice().reverse();
  app.innerHTML=`<div class="wrap page-report">${header()}<main class="memorial-detail"><article class="detail-person"><canvas data-memory-cover="${life.id}" width="640" height="220" aria-hidden="true"></canvas><div class="detail-person-body"><h1>${esc(L(life.name))}</h1><p class="muted">${life.birthYear}–${life.year} · ${esc(placeLabel(life.born))}</p><p class="detail-summary">${esc(memorialTagline(life))}</p><p class="detail-meta">${tr(life.sex)} · ${tx('活了','活了','Lived')} ${ageLabel(life.age)} · ${life.family.partner?.married?tx('已婚','已婚','Married'):tr('single')} · ${life.family.children.length} ${tr('children')}</p>${memorialLifeFacts(life)}${memorialReviewHTML(life)}${button('candle',`${life.candleLit??(life.candles>0)?'🕯️':'🕯'} <span>${life.candles||0}</span>`,`data-value="${life.id}" class="detail-candle" aria-label="${(life.candleLit??(life.candles>0))?tx('收起烛光','收起燭光','Put out candle'):tx('点亮烛光','點亮燭光','Light a candle')}" aria-pressed="${!!(life.candleLit??(life.candles>0))}"`)}</div></article>
  <div class="memorial-highlights"><h2>${tx('人生瞬间', '人生瞬間', 'Life moments')}</h2>${[...groups].map(([decade,events])=>`<section class="decade-group"><div class="decade-title"><strong>${memorialDecade(events[0].age)}</strong><span>${events.length===1?events[0].year:`${events[0].year}–${events.at(-1).year}`}</span></div><div class="decade-events">${events.map(event=>`<article class="memory-moment"><canvas data-memory-event="${event.id}" width="640" height="220" aria-hidden="true"></canvas><div><strong>${ageLabel(event.age)}</strong><span>${event.year}</span></div><p>${esc(displayEventText(event))}</p></article>`).join('')}</div></section>`).join('')}</div>
  <section class="whole-life" id="life-record"><h2>${tx('这一生','這一生','This life')}</h2><div class="life-record-list">${allEvents.map(event=>`<div class="record-row ${event.type}"><span class="record-age">${event.age}</span><p>${esc(displayEventText(event))}</p></div>`).join('')}</div></section><section class="memorial-message"><h2>${tx('编辑一生点评','編輯一生點評','Edit this life reflection')}</h2><textarea id="farewell-note" maxlength="300" aria-label="${tr('farewell')}" placeholder="${tx('写下你的点评，保存后将替换系统生成内容','寫下你的點評，儲存後將取代系統生成內容','Write your reflection to replace the generated one')}">${esc(life.farewell||'')}</textarea>${button('farewell',tr('saveNote'),'class="full"')}</section><div class="detail-bottom">${button('archive',tx('回到追思馆','回到追思館','Back to the memorial hall'),'class="full"')}${button('home',tr('home'),'class="full"')}</div></main></div>`;
}
function openModal(type, title, contents, wide = false) {
  if (!modal) lastFocus = document.activeElement;
  modal = { type, ...(modal?.type === type ? modal : {}) };
  document.body.classList.add('modal-open');
  modalRoot.innerHTML = `<div class="modal-overlay"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-top"><span id="modal-title">${title}</span>${button('close-modal', tr('close'), 'aria-label="'+tr('close')+'"')}</header><div class="modal-body">${contents}</div></section></div>`;
  modalRoot.querySelector('button, input, textarea')?.focus();
}
function closeModal() { modalRoot.innerHTML = ''; document.body.classList.remove('modal-open'); modal = null; autoDeadline = 0; if (lastFocus?.isConnected) lastFocus.focus(); }
function openDecision() {
  const life = store.current, pending = life?.pending; if (!pending) return;
  if (modal?.type === 'decision' && modal.id === pending.id) return;
  closeModal(); minimizedDecision = null; autoDeadline = automatic && !paused ? performance.now() + 2200 : 0;
  openModal('decision', pending.kind === 'reflection' ? tr('reflection') : tr('majorChoice'), `<div class="decision-kicker"><span>${ageLabel(life.age)} · ${life.year}</span><span>${esc(placeLabel(life.location))}</span></div><h2>${esc(L(pending.title))}</h2><p>${esc(L(pending.description))}</p>${sourceLinks(pending)}${pending.input ? `<textarea id="reflection-input" maxlength="200" aria-label="${tr('reflection')}" placeholder="${tr('reflectionPlaceholder')}"></textarea>` : ''}<div class="decision-options">${pending.options.map((option, index) => button('choose', `<span class="number">${index + 1}</span><span><b>${esc(L(option.label))}</b>${L(option.description) ? `<small>${esc(L(option.description))}</small>` : ''}</span>`, `class="decision-option" data-value="${option.id}"`)).join('')}</div><div class="decision-foot">${automatic ? `<div>${tr('autoCountdown')} <span id="decision-countdown">3</span></div>${button('take-control', tr('takeControl'))}` : button('auto', tr('auto'))}</div>`);
  modal.id = pending.id;
}
function sourceLinks(entry) {
  const urls=referencesFor(entry);
  return urls.length?`<div class="source-links">${urls.map((url,index)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${tx('出处','出處','Source')} ${index+1} ↗</a>`).join('')}</div>`:'';
}
function completeYear() { const life = store.current; if (!life || life.pending || life.phase !== 'life') return; const oldYear=life.year; advanceYear(life); progress = life.year===oldYear&&life.pending?1:0; life.uiProgress=progress; persist(); if (life.phase === 'dead') finishLife(); else { if (life.pending) fast = false; render(); } }
function makeChoice(optionId, isAutomatic = false) { const life = store.current; if (!life?.pending) return; const text = document.querySelector('#reflection-input')?.value || ''; if (isAutomatic) autoChoose(life); else choose(life, optionId, text); closeModal(); minimizedDecision = null; autoDeadline = 0; if(life.autopilot?.enabled)runAutopilot(life); persist(); render(); }
function finishLife() {
  const life = store.current;
  paused = true; fast = false; closeModal();
  store.history = [life, ...store.history.filter(item => item.id !== life.id)].slice(0, 12);
  persist(); view = 'report'; viewedLife = null; render();
  const ending = document.createElement('section');
  ending.className = 'ending'; ending.setAttribute('role', 'dialog'); ending.setAttribute('aria-modal', 'true'); ending.setAttribute('aria-label', tr('endingTitle'));
  ending.innerHTML = `<div class="ending-content"><canvas id="ending-scene" width="640" height="220" aria-hidden="true"></canvas><h1>${esc(L(life.name))}</h1><p class="date">${life.birthYear} — ${life.year}</p><p>${tr('endingTitle')}<br>${tr('endingText')}</p><label class="ending-review-label" for="ending-review">${tx('给这一生写一句点评（可选）', '給這一生寫一句點評（可選）', 'Write a reflection on this life (optional)')}</label><textarea id="ending-review" maxlength="300" placeholder="${tx('留空则由游戏生成一生点评', '留空則由遊戲生成一生點評', 'Leave blank for a generated reflection')}">${esc(life.farewell || '')}</textarea>${button('end-done', tr('viewReport'))}</div>`;
  document.body.append(ending); drawScene(ending.querySelector('canvas'), life, true); ending.querySelector('#ending-review').focus();
}
function toggleAuto() { automatic = !automatic; if(!automatic&&store.current?.autopilot?.enabled)setAutopilot(store.current,false,store.current.autopilot.strategy); if (automatic) paused = false; autoDeadline = 0; if (modal?.type === 'decision') closeModal(); persist(); render(); toast(tr(automatic ? 'autoOn' : 'autoOff')); }
function toggleAutopilot(){const life=store.current;if(!life||life.phase!=='life')return;const enable=!life.autopilot?.enabled;const strategy=life.autopilot?.strategy||'balanced';setAutopilot(life,enable,strategy);automatic=enable;paused=!enable?paused:false;if(enable)runAutopilot(life);persist();render();toast(tr(enable?'autopilotOn':'autopilotOff'));}
function updateFrame(timestamp) {
  const dt = Math.min(.2, Math.max(0, (timestamp - (lastFrame || timestamp)) / 1000)); lastFrame = timestamp;
  const life = store.current;
  if (view === 'life' && life?.phase === 'life') {
    if (life.pending) {
      if (automatic && !paused && (!modal || modal.type === 'decision')) {
        if (!autoDeadline) autoDeadline = timestamp + 2200;
        const countdown = document.querySelector('#decision-countdown'); if (countdown) countdown.textContent = Math.max(1, Math.ceil((autoDeadline - timestamp) / 1000));
        if (timestamp >= autoDeadline) makeChoice(null, true);
      }
    } else if (!paused && !modal && !document.hidden) {
      const amount = dt * speed * (fast ? 20 : 1) / life.yearSeconds;
      progress = Math.min(1, progress + amount);
      if (life.focus) life.focusTime[life.focus] = (life.focusTime[life.focus] || 0) + amount;
      life.uiProgress = progress;
      const timeline=processTimeline(life,progress);
      if(life.phase==='dead'){persist();finishLife();requestAnimationFrame(updateFrame);return;}
      if(timeline.changed){persist();render();}
      const bar = document.querySelector('#year-progress'); if (bar) { const percent=Math.round(progress*100); bar.style.width = `${progress * 100}%`; bar.parentElement.setAttribute('aria-valuenow',String(percent)); const label=document.querySelector('#year-progress-value');if(label)label.textContent=`${percent}%`; }
      if (progress >= 1) completeYear();
    }
  }
  requestAnimationFrame(updateFrame);
}

app.addEventListener('change', settingsChanged);
function settingsChanged(event) { const input = event.target; const key = input.dataset.setting; if (!key) return; advancedOpen = !!input.closest('details.advanced-settings')?.open; store.settings[key] = ['pace', 'birthYear'].includes(key) ? Number(input.value) : input.value; if (key === 'scope') store.settings.province = 'all'; persist(); render(); }
document.addEventListener('toggle', event => { if (event.target.matches?.('details.advanced-settings')) advancedOpen = event.target.open; }, true);
document.addEventListener('toggle', event => { if (event.target.matches?.('details.overview-details')) overviewExpanded = event.target.open; }, true);
document.addEventListener('click', event => { const picker = document.querySelector('.language-picker[open]'); if (picker && !picker.contains(event.target)) picker.open = false; });
document.addEventListener('click', async event => {
  const target = event.target.closest('button[data-action]'); if (!target || target.disabled) return;
  const action = target.dataset.action, value = target.dataset.value;
  try {
    if (action === 'back') return navigate(view === 'report' ? 'archive' : 'home');
    if (action === 'home' || action === 'leave') { persist(); return navigate('home'); }
    if (action === 'archive') return navigate('archive');
    if (action === 'candle') { const life=store.history.find(item=>item.id===value); if (life) { const wasLit=life.candleLit ?? (life.candles>0); life.candleLit=!wasLit; life.candles=Math.max(0,(life.candles||0)+(life.candleLit?1:-1)); persist(); render(); } return; }
    if (action === 'world') { if (!['past', 'now'].includes(value)) return; store.settings.world = value; persist(); return render(); }
    if (action === 'pace') { store.settings.pace = Number(value); persist(); return render(); }
    if (action === 'language') { if (!LANGUAGES.some(language => language.id === value)) return; store.settings.language = value; persist(); return render(); }
    if (action === 'theme') { store.settings.theme = store.settings.theme === 'dark' ? 'light' : 'dark'; persist(); return render(); }
    if (action === 'born') return newLife();
    if (action === 'resume') return navigate(store.current.phase === 'birth' ? 'certificate' : 'life');
    if (action === 'begin') { startLife(store.current); navigate('life'); paused = false; persist(); return render(); }
    if (action === 'pause') { paused = !paused; autoDeadline = 0; return render(); }
    if (action === 'speed') { speed = Number(value); paused = false; return render(); }
    if (action === 'next') { fast = !fast; paused = false; return render(); }
    if (action === 'year') { if (store.current.pending) openDecision(); else completeYear(); return; }
    if (action === 'focus') { if(store.current.autopilot?.enabled){setAutopilot(store.current,false,store.current.autopilot.strategy);automatic=false;}setFocus(store.current, value); persist(); return render(); }
    if (action === 'auto' || action === 'take-control') return toggleAuto();
    if (action === 'autopilot') return toggleAutopilot();
    if (action === 'choose') return makeChoice(value);
    if (action === 'pending') { minimizedDecision = null; return openDecision(); }
    if (action === 'close-modal') { if (modal?.type === 'decision') { minimizedDecision = store.current.pending.id; automatic = false; } closeModal(); if (view === 'life') render(); return; }
    if (action === 'earlier') { logLimit += 20; return render(); }
    if (action === 'star') { const life = currentLife(); life.stars ||= []; const removing=life.stars.includes(value); life.stars = removing ? life.stars.filter(id => id !== value) : [...life.stars, value]; persist(); render(); toast(removing?tx('已从人生瞬间移除','已從人生瞬間移除','Removed from life moments'):tx('已收藏到人生瞬间','已收藏到人生瞬間','Saved to life moments')); return; }
    if (action === 'review') return navigate('report', store.history.find(life => life.id === value));
    if (action === 'farewell') { currentLife().farewell = document.querySelector('#farewell-note').value.trim().slice(0, 300); persist(); render(); return toast(tr('saved')); }
    if (action === 'end-done') { const note=target.closest('.ending')?.querySelector('#ending-review')?.value.trim().slice(0,300); if(note){store.current.farewell=note;persist();}target.closest('.ending')?.remove();render();return; }
    if (action === 'life-card' || action === 'birth-card') return makeCard(currentLife(), action === 'birth-card', action === 'birth-card');
    if (action === 'music') { await toggleAudio(); return render(); }
  } catch (error) { console.error(error); toast(tx('这次操作没有完成，人生记录仍保留。', '這次操作沒有完成，人生紀錄仍保留。', 'The action could not be completed. Your life is still saved.')); }
});
document.addEventListener('keydown', event => {
  const picker = document.querySelector('.language-picker[open]');
  if (event.key === 'Escape' && picker && !modal) { event.preventDefault(); picker.open = false; picker.querySelector('summary')?.focus(); return; }
  if (modal) {
    if (event.key === 'Escape') { event.preventDefault(); modalRoot.querySelector('[data-action="close-modal"]')?.click(); }
    if (event.key === 'Tab') { const controls = [...modalRoot.querySelectorAll('button:not(:disabled),input,textarea,select,a[href]')]; const first = controls[0], last = controls.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
  }
});
window.addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); lastFrame = performance.now(); });
function download(blob, name) { const anchor = document.createElement('a'); const url = URL.createObjectURL(blob); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 15000); }
function validLife(value) {
  const name = (item, maxLength = 200) => item && ['zhCN', 'zhTW', 'en'].every(key => typeof item[key] === 'string' && item[key].length <= maxLength);
  const person = item => item && name(item.name) && Number.isFinite(item.age) && item.age >= 0 && item.age < 180;
  const decision = item => item && name(item.title) && name(item.description, 5000) && Array.isArray(item.options) && item.options.length > 0 && item.options.length < 20 && item.options.every(option => typeof option.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(option.id) && name(option.label));
  return value && value.version === 1 && typeof value.id === 'string' && /^life-[a-z0-9]+$/.test(value.id) && name(value.name)
    && ['birth', 'life', 'dead'].includes(value.phase) && Number.isInteger(value.age) && value.age >= 0 && value.age <= 120
    && Number.isFinite(value.rngState) && Number.isFinite(value.birthYear) && value.year === value.birthYear + value.age
    && locationsById.get(value.born?.id)?.region === value.born?.region && locationsById.get(value.location?.id)?.region === value.location?.region
    && value.stats && Object.keys(value.stats).length === 4 && ['health', 'happiness', 'knowledge', 'relationships'].every(key => Number.isFinite(value.stats[key]) && value.stats[key] >= 0 && value.stats[key] <= 100)
    && [value.money, value.income, value.debt, value.assets?.house, value.assets?.car, value.profile?.lifeExpectancy, value.profile?.typicalIncome, value.yearSeconds].every(Number.isFinite)
    && value.yearSeconds > 0 && value.focusTime && typeof value.focusTime === 'object' && value.flags && value.totals
    && value.family && person(value.family.mother) && person(value.family.father)
    && (!value.family.partner || person(value.family.partner)) && Array.isArray(value.family.children) && value.family.children.length < 40 && value.family.children.every(person)
    && Array.isArray(value.family.siblings) && value.family.siblings.length < 40 && value.family.siblings.every(person)
    && Array.isArray(value.log) && value.log.length <= 3000 && value.log.every(event => event && name(event.text, 5000) && Number.isInteger(event.age) && typeof event.id === 'string' && /^life-[a-z0-9]+-\d+$/.test(event.id) && typeof event.type === 'string' && /^[a-z-]{1,30}$/.test(event.type))
    && Array.isArray(value.years) && value.years.length <= 121 && Array.isArray(value.hobbies) && Array.isArray(value.owns)
    && Array.isArray(value.visited) && value.visited.length <= 121 && value.visited.every(place => locationsById.has(place.id))
    && Array.isArray(value.pendingQueue) && value.pendingQueue.length < 30 && value.pendingQueue.every(decision) && (!value.pending || decision(value.pending));
}
function normalizePlaces(life) {
  life.stars = (Array.isArray(life.stars) ? life.stars : []).filter(id => typeof id === 'string' && /^life-[a-z0-9]+-\d+$/.test(id));
  life.born = locationsById.get(life.born.id); life.location = locationsById.get(life.location.id);
  life.visited = life.visited.map(place => locationsById.get(place.id));
  life.companions = (Array.isArray(life.companions) ? life.companions : []).filter(person => locationsById.has(person.born?.id) && Array.isArray(person.years)).slice(0, 4).map(person => ({ ...person, born: locationsById.get(person.born.id) }));
  return life;
}
async function toggleAudio() {
  if (audioState) { clearInterval(audioState.timer); await audioState.context.close(); audioState = null; return; }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) { toast(tr('musicUnavailable')); return; }
  const context = new AudioContextClass(); await context.resume();
  const play = () => { if (document.hidden) return; const chord = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]][Math.floor(context.currentTime / 5) % 4]; chord.forEach((note, index) => { const osc = context.createOscillator(), gain = context.createGain(); osc.type = 'sine'; osc.frequency.value = 440 * 2 ** ((note - 69) / 12); const at = context.currentTime + index * .34; gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.018, at + .15); gain.gain.exponentialRampToValueAtTime(.0001, at + 4); osc.connect(gain).connect(context.destination); osc.start(at); osc.stop(at + 4.1); }); };
  audioState = { context, timer: setInterval(play, 5000) }; play();
}

function drawAll() {
  const life = currentLife();
  for (const id of ['home-scene', 'cert-scene', 'life-scene', 'report-scene']) { const canvas = document.querySelector(`#${id}`); if (canvas) drawScene(canvas, id === 'home-scene' ? null : life); }
  for (const canvas of document.querySelectorAll('[data-archive-scene]')) drawScene(canvas, store.history.find(item => item.id === canvas.dataset.archiveScene));
  for (const canvas of document.querySelectorAll('[data-memory-cover]')) { const person=store.history.find(item=>item.id===canvas.dataset.memoryCover); if(person){const covers=reportHighlights(person).filter(item=>['family','love','work','career','education','birth'].includes(item.type));const event=covers[person.birthYear%covers.length]||reportHighlights(person)[0];drawHighlightScene(canvas,event,person);} }
  for (const canvas of document.querySelectorAll('[data-memory-event]')) { const person=currentLife();const event=person?.log.find(item=>item.id===canvas.dataset.memoryEvent);if(event)drawHighlightScene(canvas,event,person); }
  if (document.querySelector('#survival')) drawSurvival(document.querySelector('#survival'), life);
}
function drawScene(canvas, life = null, ending = false) {
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; c.save(); c.scale(canvas.width / 320, canvas.height / 110);
  const urban = life?.urban ?? true, age = life?.age ?? 32, dark = ending || store.settings.theme === 'dark';
  c.fillStyle = dark ? '#7b8b8b' : '#b9d5d2'; c.fillRect(0, 0, 320, 110);
  c.fillStyle = dark ? '#d5ad81' : '#f2dfad'; c.fillRect(263, 13, 15, 15); c.fillRect(260, 16, 21, 9);
  c.fillStyle = dark ? '#b1b4ac' : '#f6f3e5'; for (const [x, y, w] of [[28, 18, 34], [132, 12, 27], [212, 28, 25]]) { c.fillRect(x, y + 4, w, 6); c.fillRect(x + 5, y, w - 12, 13); }
  if (urban) {
    c.fillStyle = dark ? '#6f807a' : '#a8c1b6'; for (let x = 0; x < 320; x += 24) c.fillRect(x, 43 + (x % 7) * 2, 20, 48);
    for (let index = 0; index < 6; index++) { const x = index * 51 + 4, h = 32 + (index * 13 % 24); c.fillStyle = ['#d3cab7', '#b2bcb1', '#c6b9a8'][index % 3]; c.fillRect(x, 89 - h, 38, h); c.fillStyle = '#8b9e93'; for (let wy = 95 - h; wy < 85; wy += 9) for (let wx = x + 5; wx < x + 32; wx += 10) c.fillRect(wx, wy, 5, 5); }
    c.fillStyle = '#e8dfc7'; c.fillRect(0, 82, 320, 11); c.fillStyle = '#9c8a71'; c.fillRect(0, 92, 320, 3);
  } else {
    c.fillStyle = '#8fad9a'; c.beginPath(); c.moveTo(0, 70); c.lineTo(40, 46); c.lineTo(83, 68); c.lineTo(155, 40); c.lineTo(225, 68); c.lineTo(275, 49); c.lineTo(320, 65); c.lineTo(320, 95); c.lineTo(0, 95); c.fill();
    c.fillStyle = '#a8b881'; c.fillRect(0, 78, 320, 15); c.fillStyle = '#d6cab1'; c.fillRect(35, 63, 47, 30); c.fillStyle = '#987b6c'; c.fillRect(31, 60, 55, 6); c.fillRect(36, 55, 45, 5); c.fillStyle = '#786953'; c.fillRect(55, 76, 10, 17);
    c.fillStyle = '#849866'; for (let x = 98; x < 320; x += 16) { c.fillRect(x, 84, 11, 2); c.fillRect(x, 90, 11, 2); }
  }
  c.fillStyle = '#6b8b71'; c.fillRect(0, 94, 320, 4); c.fillStyle = '#aa977b'; c.fillRect(0, 98, 320, 12); c.fillStyle = '#91836c'; for (let x = 3; x < 320; x += 13) c.fillRect(x, 104 + (x % 3), 3, 1);
  const people = [];
  if (!life || age < 20) { if (!life || life.family.mother?.alive) people.push({ age: 38, sex: 'female', main: false }); if (!life || life.family.father?.alive) people.push({ age: 40, sex: 'male', main: false }); }
  people.push({ age, sex: life?.sex || 'female', main: true });
  if (life?.family.partner?.alive) people.push({ age: life.family.partner.age, sex: life.sex === 'male' ? 'female' : 'male' });
  for (const child of life?.family.children.filter(person => person.alive).slice(0, 3) || [{ age: 7, sex: 'female' }]) people.push(child);
  const startX = 160 - people.length * 10;
  people.forEach((person, index) => drawPerson(c, startX + index * 22, 96, person.age, person.sex, person.main));
  if (life?.assets.car) { c.fillStyle = '#7b8d8b'; c.fillRect(261, 84, 36, 9); c.fillRect(269, 78, 19, 7); c.fillStyle = '#4c5754'; c.fillRect(266, 91, 6, 5); c.fillRect(286, 91, 6, 5); }
  c.restore();
}
function drawPerson(c, x, ground, age, sex, main = false) {
  const size = age < 2 ? .48 : age < 7 ? .62 : age < 15 ? .8 : 1;
  c.save(); c.translate(Math.floor(x), ground); c.scale(size, size);
  c.fillStyle = '#4e4b44'; c.fillRect(-5, -5, 4, 5); c.fillRect(2, -5, 4, 5);
  c.fillStyle = main ? '#44786d' : sex === 'female' ? '#a46e75' : '#697e91'; c.fillRect(-8, -20, 17, 15); c.fillStyle = '#c69d7c'; c.fillRect(-7, -33, 15, 14); c.fillRect(-11, -18, 3, 9); c.fillRect(9, -18, 3, 9);
  c.fillStyle = age > 62 ? '#b3b6aa' : '#4e4940'; c.fillRect(-8, -35, 17, 6); c.fillRect(-10, -31, 4, 12); c.fillRect(7, -30, 3, sex === 'female' ? 16 : 7);
  c.fillStyle = '#49473d'; c.fillRect(-3, -25, 1, 2); c.fillRect(4, -25, 1, 2); c.restore();
}
function drawSurvival(canvas, life) {
  if (!life) return; const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height; c.clearRect(0, 0, w, h); const style = getComputedStyle(document.documentElement); const ink = style.getPropertyValue('--muted'); c.font = '17px system-ui'; c.strokeStyle = style.getPropertyValue('--line'); c.lineWidth = 1;
  const y = p => 16 + (1 - p) * (h - 48), x = age => 36 + age / 120 * (w - 52);
  for (const p of [0, .5, 1]) { c.beginPath(); c.moveTo(36, y(p)); c.lineTo(w - 12, y(p)); c.stroke(); c.fillStyle = ink; c.fillText(`${p * 100}`, 0, y(p) + 6); }
  c.strokeStyle = style.getPropertyValue('--jade'); c.lineWidth = 3; c.beginPath();
  for (let age = 0; age <= 120; age++) { const p = Math.exp(-Math.exp((age - life.profile.lifeExpectancy - 4) / 11)); if (!age) c.moveTo(x(age), y(p)); else c.lineTo(x(age), y(p)); } c.stroke();
  c.strokeStyle = style.getPropertyValue('--accent'); c.lineWidth = 2; c.beginPath(); c.moveTo(x(life.age), 12); c.lineTo(x(life.age), h - 30); c.stroke(); c.fillStyle = ink; for (const age of [0, 40, 80, 120]) c.fillText(String(age), x(age) - 8, h - 4);
}
function wrapText(c, text, x, y, width, lineHeight, maxLines = 8) { const words = /\s/.test(text) && store.settings.language === 'en' ? text.split(/\s+/).map(word => word + ' ') : [...text]; let line = '', lines = 0; for (const word of words) { if (c.measureText(line + word).width > width && line) { c.fillText(line, x, y); y += lineHeight; lines++; line = word; if (lines >= maxLines - 1) break; } else line += word; } if (line) c.fillText(line, x, y); return y + lineHeight; }
async function makeCard(life, birth = false, share = false) {
  const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = birth ? 1080 : 1320; const c = canvas.getContext('2d'); c.fillStyle = '#f4f0e7'; c.fillRect(0, 0, 900, canvas.height); c.fillStyle = '#8a3345'; c.fillRect(0, 0, 900, 85); c.fillStyle = '#fffcf5'; c.font = '26px serif'; c.fillText(`${tr('brand')} · ${birth ? tr('certificate') : tr('deathRecord')}`, 50, 54);
  c.fillStyle = '#25332f'; c.font = '54px serif'; c.fillText(L(life.name), 50, 166); c.font = '22px system-ui'; c.fillStyle = '#6c756e'; c.fillText(`${placeLabel(life.born)} · ${tr(life.sex)}`, 50, 215); c.fillText(birth ? String(life.birthYear) : `${life.birthYear} — ${life.year} · ${ageLabel(life.age)}`, 50, 252);
  const scene = document.createElement('canvas'); scene.width = 800; scene.height = 275; drawScene(scene, life); c.drawImage(scene, 50, 295);
  c.fillStyle = '#25332f'; c.font = '23px system-ui'; const summary = summarize(life); let y = wrapText(c, birth ? L(life.log.at(-1).text) : L(summary.text), 50, 635, 800, 40, 6);
  if (!birth) { y = Math.max(y + 35, 835); c.font = '20px system-ui'; c.fillStyle = '#6c756e'; c.fillText(tr('lifeMap'), 50, y); y += 25; life.years.forEach((year, index) => { c.fillStyle = `hsl(${55 + year.happiness * .95} 28% ${83 - year.happiness * .46}%)`; c.fillRect(50 + index % 24 * 32, y + Math.floor(index / 24) * 32, 27, 27); }); if (life.farewell) { c.fillStyle = '#42756a'; c.font = '27px serif'; wrapText(c, life.farewell, 50, 1125, 800, 40, 2); } }
  c.fillStyle = '#6c756e'; c.font = '18px system-ui'; wrapText(c, tr('birthCityNote'), 50, canvas.height - 65, 800, 27, 2);
  canvas.toBlob(async blob => { if (!blob) return; const name = `this-life-${life.id}-${birth ? 'birth' : 'story'}.png`; if (share && navigator.share && navigator.canShare) { const file = new File([blob], name, {type:'image/png'}); if (navigator.canShare({files:[file]})) { try { await navigator.share({files:[file], title:tr('brand')}); return; } catch (error) { if (error?.name === 'AbortError') return; } } } download(blob,name); toast(tr('imageSaved')); }, 'image/png');
}

if (store.current && !validLife(store.current)) store.current = null;
if (store.current) normalizePlaces(store.current);
store.history = store.history.filter(validLife).map(normalizePlaces);
render(); requestAnimationFrame(updateFrame);
