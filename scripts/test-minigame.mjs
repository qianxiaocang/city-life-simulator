import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const gameRoot = resolve(root, 'minigame');
const source = path => readFileSync(resolve(gameRoot, path), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
function size(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((total, entry) =>
    total + (entry.isDirectory() ? size(resolve(dir, entry.name)) : statSync(resolve(dir, entry.name)).size), 0);
}

test('standalone Mini Game has the requested AppID and a native Canvas entry', () => {
  const config = JSON.parse(source('project.config.json'));
  assert.equal(config.appid, 'wxf0a6d9946d36da31');
  assert.equal(config.compileType, 'game');
  assert.ok(size(gameRoot) < 2 * 1024 * 1024);
  assert.match(source('game.js'), /wx\.createCanvas\(\)/);
  assert.doesNotMatch(source('game.js'), /qa-preview|qa-state|__life_ui_qa__/);
  assert.doesNotMatch(source('game.js'), /\bPage\s*\(|document\.|window\./);
  assert.doesNotMatch(source('runtime/controller.js'), /\bPage\s*\(/);
  assert.equal(source('lib/game.js'), readFileSync(resolve(root, 'miniprogram/lib/game.js'), 'utf8'));
  for (const entry of readdirSync(gameRoot, { recursive: true })) assert.doesNotMatch(entry, /\.(wxml|wxss)$/);
  for (let n = 1; n <= 5; n++) assert.ok(statSync(resolve(gameRoot, 'assets', `music${n === 1 ? '' : '-' + n}.wav`)).size > 100);
});

test('save records preserve their checksum when the runtime normalizes stored objects', () => {
  const data = new Map();
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, reorder(value[key])])) : value;
  const wx = {
    getStorageSync: key => data.has(key) ? reorder(data.get(key)) : '',
    setStorageSync: (key, value) => data.set(key, copy(value)),
    removeStorageSync: key => data.delete(key),
  };
  const sandbox = { module: { exports: {} }, wx, console };
  vm.runInNewContext(source('lib/storage.js'), sandbox);
  const { writeStore, readStore, SAVE_KEY } = sandbox.module.exports;
  const life = { id: 'test-life', settings: { z: 1, a: 2 }, log: [{ id: 'one', text: '测试记录' }], age: 9 };
  const store = { version: 1, settings: { language: 'zhCN' }, current: life, history: [], savedMomentToastCount: 2 };
  writeStore(store);
  const key = Object.values(data.get(SAVE_KEY).records)[0].key;
  assert.equal(typeof data.get(key), 'string', 'record must be saved as exact JSON text');
  assert.deepEqual(copy(readStore({ version: 1, settings: {}, current: null, history: [] }).current), life);
  writeStore({ ...store, current: { ...life, age: 10 } });
  assert.equal(readStore({ version: 1, settings: {}, current: null, history: [] }).current.age, 10);
});

function uiHarness(windowInfo = {}) {
  const noop = () => {};
  const context = Object.fromEntries(['beginPath','moveTo','lineTo','quadraticCurveTo','closePath','fill','stroke','fillText','clearRect','setTransform','save','restore','rect','clip','translate','drawImage'].map(name => [name, noop]));
  context.measureText = text => ({ width: Array.from(String(text)).length * 8 });
  const canvas = { getContext: () => context, requestAnimationFrame: () => 1 };
  const wx = { getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1, statusBarHeight: 20, safeArea: { bottom: 810 }, ...windowInfo }) };
  const actions = [], shares = [];
  wx.shareAppMessage = data => shares.push(data);
  const page = { data: { view: 'life', theme: 'light', automatic: false, modal: 'choice', choice: {
    meta: '17岁 · 1997', title: '家里忙碌的一天', description: '家人今天很忙，你还有自己的作业和安排。',
    options: [{ number: '1', id: 'family', label: '分担一些家务', description: '少一点学习时间' }, { number: '2', id: 'study', label: '先完成学习任务', description: '完成学习任务' }]
  }, ui: { choice: '人生抉择', close: '关闭' } }, onAction: event => actions.push(event.currentTarget.dataset),
    onShareAppMessage: () => ({ title: '出生卡', path: '/pages/index/index', imageUrl: 'birth-card.png' }) };
  const sandbox = { module: { exports: {} }, require: () => ({}), wx, console, setTimeout };
  vm.runInNewContext(source('runtime/canvas-ui.js'), sandbox);
  const ui = new sandbox.module.exports(canvas, page);
  ui.p = ui.palette();
  return { ui, page, actions, shares, canvas };
}

test('choice dialog fits its content and its options remain tappable', () => {
  const { ui, actions } = uiHarness();
  ui.modal();
  assert.ok(ui.modalViewportHeight < 400, 'two short options should not leave a tall empty sheet');
  assert.ok(ui.modalContentHeight <= ui.modalViewportHeight + 10, 'short choice should not scroll');
  const choices = ui.modalHits.filter(hit => hit.action === 'choose');
  assert.equal(choices.length, 2);
  ui.action(choices[1]);
  assert.equal(actions[0].action, 'choose');
  assert.equal(actions[0].value, 'study');
});

test('birth sharing removes Mini Program page routes from Mini Game share data', () => {
  const { ui, shares } = uiHarness();
  ui.action({ action: 'share-birth' });
  assert.deepEqual(copy(shares), [{ title: '出生卡', imageUrl: 'birth-card.png' }]);
});

test('scrolling content cannot intercept touches in the navigation or modal header', () => {
  const { ui } = uiHarness();
  ui.viewportBottom = 600; ui.scroll = 150;
  ui.hit(15, 0, 200, 60, 'star', 'hidden');
  assert.equal(ui.hits.length, 0);
  ui.hit(15, 150, 200, 50, 'star', 'visible');
  assert.equal(ui.hits[0].y, ui.navHeight);
  ui.modalBounds = { x: 15, y: 220, w: 360, h: 200 }; ui.modalScroll = 100;
  ui.hit(25, 250, 200, 60, 'choose', 'hidden', 'modal-content');
  assert.equal(ui.modalHits.length, 0);
  ui.hit(25, 300, 200, 60, 'choose', 'partial', 'modal-content');
  assert.equal(ui.modalHits[0].y, 220);
  assert.equal(ui.modalHits[0].h, 40);
});

test('a swipe scrolls without selecting the record under the finger', () => {
  const { ui, page, actions } = uiHarness();
  page.data.modal = ''; ui.viewportBottom = 650; ui.contentHeight = 1800;
  ui.hits = [{ x: 10, y: 350, w: 370, h: 100, action: 'star', value: 'record' }];
  ui.touchStart({ touches: [{ clientX: 190, clientY: 400 }] });
  ui.touchMove({ touches: [{ clientX: 190, clientY: 300 }] });
  ui.touchEnd({ changedTouches: [{ clientX: 190, clientY: 300 }] });
  assert.equal(ui.scroll, 100);
  assert.equal(actions.length, 0);
});

test('narrow devices keep the native navigation safe and map touches to the layout', () => {
  const { ui, canvas } = uiHarness({ windowWidth: 320, windowHeight: 568, pixelRatio: 2, statusBarHeight: 20, safeArea: { bottom: 548 } });
  assert.equal(canvas.width, 640); assert.equal(canvas.height, 1136);
  assert.ok(ui.navHeight * ui.deviceScale >= 64);
  const point = ui.point({ touches: [{ clientX: 160, clientY: 200 }] });
  assert.equal(point.x, 195);
  assert.ok(Math.abs(point.y * ui.deviceScale - 200) < .001);
  const rows = ui.lines('生活开支 ¥12,345。', 62, 14);
  assert.ok(rows.some(row => row.includes('¥12,345')), 'a currency amount wraps as a complete token');
});

test('the floating music control follows a drag, keeps its position when scrolling and distinguishes a tap', () => {
  const { ui, page, actions } = uiHarness();
  page.data.view = 'home'; page.data.modal = ''; page.data.settings = {};
  page.store = { settings: {} }; let saves = 0; page.persist = () => { saves++; return true; };
  ui.p = ui.palette(); ui.music();
  const start = { ...ui.musicPosition };
  ui.touchStart({ touches: [{ x: start.x + 25, y: start.y + 25 }] });
  ui.touchMove({ touches: [{ x: start.x - 55, y: start.y + 145 }] });
  ui.touchEnd({ changedTouches: [{ x: start.x - 55, y: start.y + 145 }] });
  assert.equal(ui.musicPosition.x, start.x - 80);
  assert.equal(ui.musicPosition.y, start.y + 120);
  assert.equal(ui.scroll, 0); assert.equal(saves, 1); assert.equal(actions.length, 0);
  assert.equal(page.store.settings.canvasMusicPosition.x, ui.musicPosition.x);
  assert.equal(page.store.settings.canvasMusicPosition.y, ui.musicPosition.y);
  ui.scroll = 300; ui.hits = []; ui.music();
  const x = ui.musicPosition.x + 25, y = ui.musicPosition.y + 25;
  ui.touchStart({ touches: [{ clientX: x, clientY: y }] });
  ui.touchEnd({ changedTouches: [{ clientX: x, clientY: y }] });
  assert.equal(actions[0].action, 'music');
});

test('home selectors and pace labels are centered in their own controls', () => {
  const { ui, page } = uiHarness(); page.data.view = 'home'; page.data.modal = ''; ui.viewportBottom = 3000;
  Object.assign(page.data, {
    theme: 'dark', settings: { world: 'now', pace: 60 }, advancedOpen: true, languageIndex: 0,
    languageLabels: [{ label: '简体中文' }], regions: [{ label: '全部地区' }], regionIndex: 0,
    provinces: [{ label: '不限' }], provinceIndex: 0, memories: [], resume: null, homeCover: ''
  });
  Object.assign(page.data.ui, { eyebrow: '人生模拟 · 中国城市', brand: '13亿分之一', heroText: '从这里开始。', pastPresent: '过去和现在', locationCount: '1,152 个出生地点', past: '过去', now: '现在', nowHint: '从现在出发。', birthSettings: '出生地与游玩设置', scope: '出生范围', province: '省 / 县市', pace: '一段人生的节奏', minutes: '分钟', born: '出生', rememberedLives: '安放在追思馆的人生', viewAll: '查看全部', memorialEmpty: '暂无人生' });
  ui.p = ui.palette();
  const texts = [], boxes = [], originalText = ui.text.bind(ui), originalBox = ui.box.bind(ui);
  ui.text = (value, ...args) => { texts.push({ value, x: args[0], y: args[1], size: args[2] }); return originalText(value, ...args); };
  ui.box = (...args) => { boxes.push(args); return originalBox(...args); };
  ui.home();
  const label = texts.find(item => item.value === '简体中文'), icon = texts.find(item => item.value === '☀');
  assert.equal(label.y + label.size / 2, icon.y + icon.size / 2);
  const count = texts.find(item => item.value === '1,152 个出生地点'), countWidth = Math.min(116, Array.from(count.value).length * 9 + 14);
  const badge = boxes.find(box => box[4] === ui.p.paper2 && box[2] === countWidth && box[3] === 26);
  assert.ok(Math.abs(count.x + Array.from(count.value).length * 4 - (badge[0] + badge[2] / 2)) < .01);
  for (const pace of [30, 60, 90]) {
    const item = texts.find(text => text.value === `${pace} 分钟`), hit = ui.hits.find(target => target.action === 'pace' && target.value === pace);
    assert.ok(Math.abs(item.x + Array.from(item.value).length * 4 - (hit.x + hit.w / 2)) < .01);
  }
});

test('birth certificate keeps both action buttons within the card for long details', () => {
  const { ui, page } = uiHarness(); page.data.modal = ''; ui.viewportBottom = 3000;
  page.data.person = {
    cover: '', name: '沈俊熙', meta: '男 · 黄大仙区 · 乡间生活 · 尚未工作',
    birthText: '你出生在黄大仙区，一个经济拮据的家庭。你是个男孩。'.repeat(3),
    facts: [{ label: '性别', value: '男' }, { label: '出生地', value: '甘南藏族自治州' }, { label: '现居地', value: '甘南藏族自治州' }, { label: '出身家庭', value: '经济拮据' }],
    companions: Array.from({ length: 4 }, (_, i) => ({ name: `同伴${i}`, meta: '甘南藏族自治州 · 男' }))
  };
  Object.assign(page.data.ui, { certificate: '出生登记', sameMoment: '同一刻出生的人', birthCard: '分享出生卡', begin: '开始这一生' });
  const boxes = [], originalBox = ui.box.bind(ui);
  ui.box = (...args) => { boxes.push(args); return originalBox(...args); };
  const end = ui.certificate(), card = boxes[0];
  const buttons = ui.hits.filter(hit => ['share-birth', 'begin'].includes(hit.action));
  assert.equal(buttons.length, 2);
  for (const hit of buttons) {
    const localTop = hit.y - ui.navHeight;
    assert.ok(hit.x > card[0] && hit.x + hit.w < card[0] + card[2]);
    assert.ok(localTop >= card[1] && localTop + hit.h < card[1] + card[3]);
    assert.ok(!boxes.some(([x,y,w,h]) => h === 1 && y > localTop && y < localTop + hit.h && x < hit.x + hit.w && x + w > hit.x), 'divider must not cross a button');
  }
  assert.ok(end > card[1] + card[3]);
});

test('birth certificate actions can be reached on a short screen', () => {
  const { ui, page } = uiHarness({ windowWidth: 320, windowHeight: 568, statusBarHeight: 20, safeArea: { bottom: 548 } });
  page.data.modal = ''; ui.viewportBottom = ui.height;
  page.data.person = { cover: '', name: '沈俊熙', meta: '男 · 黄大仙区 · 乡间生活 · 尚未工作', birthText: '你出生在黄大仙区，一个经济拮据的家庭。'.repeat(3), facts: [{ label: '出生地', value: '黄大仙区' }], companions: Array.from({ length: 4 }, (_, i) => ({ name: `同伴${i}`, meta: '甘南藏族自治州 · 男' })) };
  Object.assign(page.data.ui, { certificate: '出生登记', sameMoment: '同一刻出生的人', birthCard: '分享出生卡', begin: '开始这一生' });
  ui.contentHeight = ui.certificate() + 24 + ui.safeBottom;
  ui.scroll = Math.max(0, ui.contentHeight - (ui.viewportBottom - ui.navHeight)); ui.hits = []; ui.certificate();
  const buttons = ui.hits.filter(hit => ['share-birth', 'begin'].includes(hit.action));
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every(hit => hit.h === 46 && hit.y >= ui.navHeight && hit.y + hit.h <= ui.viewportBottom));
});

test('autopilot control visibly changes when switched on and off', () => {
  const { ui, page } = uiHarness(); page.data.modal = '';
  Object.assign(page.data, { person: { year: 1996, career: '尚未工作', income: '¥0' }, speed: 1, speeds: [1, 2, 4, 8, 12, 16], progress: 9, paused: false });
  Object.assign(page.data.ui, { thisYear: '这一年', yearUnit: '年', pause: '暂停', play: '继续', next: '下个抉择', advance: '推进一年', autopilot: '托管人生' });
  page.onAction = event => { if (event.currentTarget.dataset.action === 'autopilot') page.data.automatic = !page.data.automatic; };
  const boxes = [], originalBox = ui.box.bind(ui);
  ui.box = (...args) => { boxes.push(args); return originalBox(...args); };
  const draw = () => { boxes.length = 0; ui.hits = []; ui.footer(); const hit = ui.hits.find(item => item.action === 'autopilot'); const box = boxes.find(item => item[0] === hit.x && item[1] === hit.y && item[2] === hit.w && item[3] === hit.h); return { hit, fill: box[4] }; };
  const before = draw(), x = before.hit.x + before.hit.w / 2, y = before.hit.y + before.hit.h / 2;
  ui.touchStart({ touches: [{ clientX: x, clientY: y }] }); ui.touchEnd({ changedTouches: [{ clientX: x, clientY: y }] });
  const after = draw(); assert.equal(page.data.automatic, true); assert.notEqual(after.fill, before.fill);
  ui.touchStart({ touches: [{ clientX: x, clientY: y }] }); ui.touchEnd({ changedTouches: [{ clientX: x, clientY: y }] });
  assert.equal(page.data.automatic, false); assert.equal(draw().fill, before.fill);
});

test('the overview details row has room for its label and short life records stay compact', () => {
  const { ui, page } = uiHarness(); page.data.modal = ''; ui.viewportBottom = 2000;
  page.data.settings = { overviewCollapsed: false };
  page.data.person = { year: 1998, age: '7岁', initial: '沈', name: '沈俊熙', meta: '男 · 黄大仙区', stats: [], finances: [] };
  Object.assign(page.data.ui, { overview: '人生总览', collapse: '收起', expand: '展开', lifeDetails: '人生档案', lifeLog: '人生记录' });
  page.data.logs = [{ id: 'one', age: '7', text: '找到喜欢的事：阅读' }, { id: 'two', age: '6', text: '同桌忘了带铅笔。', effects: '知识 +1' }];
  ui.life();
  const details = ui.hits.find(hit => hit.action === 'life-details'), stars = ui.hits.filter(hit => hit.action === 'star');
  assert.equal(details.h, 42); assert.equal(stars.length, 2);
  assert.ok(stars[0].h >= 44 && stars[0].h <= 58, 'short records should stay compact while retaining a usable target');
  assert.equal(stars[0].y + stars[0].h, stars[1].y);
});

test('life moment groups have a compact gap without overlapping their descriptions', () => {
  const { ui, page } = uiHarness(); page.data.modal = ''; ui.viewportBottom = 3000;
  page.data.person = { cover: '', name: '沈俊熙', date: '1991–2070', tagline: '一段人生', reportMeta: '男 · 79岁', facts: [], review: '愿这一生被记住。', candles: 0 };
  Object.assign(page.data.ui, { moments: '人生瞬间', wholeLife: '这一生' });
  page.data.momentGroups = [
    { title: '童年', years: '1991–1997', events: [{ age: '6岁', year: 1997, text: '童年的一次相遇。', cover: '' }] },
    { title: '十几岁', years: '2006–2009', events: [{ age: '15岁', year: 2006, text: '开始新的求学生活。', cover: '' }] }
  ];
  page.data.logs = []; page.data.fromArchive = true;
  const texts = [], originalText = ui.text.bind(ui);
  ui.text = (value, ...args) => { texts.push({ value, x: args[0], y: args[1], size: args[2] }); return originalText(value, ...args); };
  ui.report();
  const description = texts.find(item => item.value === '童年的一次相遇。'), nextTitle = texts.find(item => item.value === '十几岁');
  const gap = nextTitle.y - (description.y + description.size);
  assert.ok(gap >= 0 && gap <= 32, `unexpected group spacing: ${gap}`);
});
