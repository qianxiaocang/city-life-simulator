import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as web from '../app/engine.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const miniRoot = resolve(root, 'miniprogram');
const bundlePath = resolve(miniRoot, 'lib/game.js');
const bundle = readFileSync(bundlePath, 'utf8');
const context = vm.createContext({ module: { exports: {} }, console, Date, Math, setTimeout, clearTimeout });
vm.runInContext(bundle, context, { filename: bundlePath });
const mini = context.module.exports;
const clone = value => JSON.parse(JSON.stringify(value));
function size(dir) { return readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => total + (entry.isDirectory() ? size(resolve(dir, entry.name)) : statSync(resolve(dir, entry.name)).size), 0); }

test('native project imports the requested AppID and fits the main-package budget', () => {
  const config = JSON.parse(readFileSync(resolve(root, 'project.config.json')));
  assert.equal(config.appid, 'wxd60ef0cc4d0a579e');
  assert.equal(config.compileType, 'miniprogram');
  assert.equal(config.miniprogramRoot, 'miniprogram/');
  const app = JSON.parse(readFileSync(resolve(miniRoot, 'app.json')));
  assert.deepEqual(app.pages, ['pages/index/index']);
  assert.ok(size(miniRoot) < 2 * 1024 * 1024, 'uncompressed native package must stay under 2 MiB');
  const template = readFileSync(resolve(miniRoot, 'pages/index/index.wxml'), 'utf8');
  assert.doesNotMatch(template, /<web-view\b|<iframe\b/);
  assert.match(template, /<canvas\s+type="2d"/);
  for (const [, expression] of template.matchAll(/wx:(?:if|elif)="([^"]*)"/g)) {
    assert.ok(expression.startsWith('{{') && expression.endsWith('}}'), 'WXML conditions must be data bindings');
    assert.doesNotMatch(expression, /&amp;/, 'WXML expressions use native &&, not XML entities');
  }
  assert.match(template, /view === 'home'[\s\S]*class="music-area"/);
});

test('the native bundle runs without browser globals and preserves seeded web outcomes', () => {
  assert.equal(typeof context.window, 'undefined');
  assert.equal(typeof context.document, 'undefined');
  assert.ok(mini.locations.length > 1000);
  let decisions = 0, stages = 0;
  for (const [index, birthYear] of [1950, 1969, 1990, 2000, 2026, 2026].entries()) {
    const location = clone(mini.locations[index * 170]);
    const options = { location, locations: [location], seed: `native-parity-${index}`, birthYear, world: birthYear === 2026 ? 'now' : 'past' };
    const nativeLife = mini.startLife(mini.createLife(options));
    const webLife = web.startLife(web.createLife(options));
    for (let step = 0; step < 1200 && nativeLife.phase !== 'dead'; step++) {
      assert.equal(Boolean(nativeLife.pending), Boolean(webLife.pending));
      if (nativeLife.pending) {
        assert.equal(nativeLife.pending.action, webLife.pending.action);
        decisions++;
        if (nativeLife.pending.action === 'focus-stage') stages++;
        mini.autoChoose(nativeLife); web.autoChoose(webLife);
      } else { mini.advanceYear(nativeLife); web.advanceYear(webLife); }
      assert.ok(Object.values(nativeLife.decisionState.presentedByAge).every(count => count <= 2));
    }
    assert.equal(nativeLife.phase, 'dead');
    assert.deepEqual(clone(nativeLife), clone(webLife));
  }
  assert.ok(decisions > 20, 'positive control: real decisions were selected');
  assert.ok(stages > 2, 'positive control: stage arrangements were encountered');
});

test('native images retain saved records and event-specific pixel scenes', () => {
  const life = mini.startLife(mini.createLife({ location: mini.locations[0], seed: 'native-moments', birthYear: 2000, world: 'past' }));
  const events = [
    { id: 'native-1', age: 18, year: 2018, type: 'education', text: { zhCN: '你从大学毕业了。' } },
    { id: 'native-2', age: 25, year: 2025, type: 'asset', text: { zhCN: '你买了一辆汽车。' } },
    { id: 'native-3', age: 30, year: 2030, type: 'family', text: { zhCN: '孩子出生了。' } },
  ];
  life.log.push(...events); life.age = 30; life.stars = events.map(event => event.id);
  const moments = mini.selectLifeMoments(life);
  for (const event of events) assert.ok(moments.some(moment => moment.id === event.id));
  assert.equal(mini.describeHighlight(events[0], life).motif, 'graduate');
  assert.equal(mini.describeHighlight(events[1], life).motif, 'car');
  assert.equal(mini.describeHighlight(events[2], life).motif, 'baby');
});

const pageSource = readFileSync(resolve(miniRoot, 'pages/index/index.js'), 'utf8');
const SAVE_KEY = 'one-in-1-4-billion.mini.v1';

function loadStorage(wx) {
  const sandbox = { module: { exports: {} }, wx, console };
  vm.runInNewContext(readFileSync(resolve(miniRoot, 'lib/storage.js'), 'utf8'), sandbox);
  return sandbox.module.exports;
}

function pageHarness(initialStore, initialStorage, overrides = {}) {
  let definition;
  const storage = new Map(initialStorage ? [...initialStorage].map(([key,value]) => [key,clone(value)]) : initialStore ? [[SAVE_KEY, clone(initialStore)]] : []);
  const platform = { albumAuthorized: async () => false, requestAlbumAccess: async () => {}, generateScene: async () => '/mock-scene.png', createBirthShare: async () => '/mock-birth-share.png', toggleMusic: () => true, stopMusic() {}, captureMemorial: async () => '/mock-photo.png', saveImage: async () => {} };
  const wx = {
    getStorageSync: key => storage.has(key) ? clone(storage.get(key)) : '',
    setStorageSync: (key, value) => storage.set(key, clone(value)),
    removeStorageSync: key => storage.delete(key),
    getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844 }), getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844 }),
    setNavigationBarTitle() {}, setNavigationBarColor() {}, pageScrollTo() {}, showLoading() {}, hideLoading() {},
    showModal: options => options.success({ confirm: true }),
  };
  const storageApi = loadStorage(wx);
  const sandbox = { require: path => path.endsWith('/game') ? { ...mini, ...overrides } : path.endsWith('/storage') ? storageApi : platform, Page: value => { definition = value; }, wx, console, Date, Math, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {} };
  vm.runInNewContext(pageSource, sandbox, { filename: 'miniprogram/pages/index/index.js' });
  const page = { ...definition, data: clone(definition.data), setData(patch, done) { Object.assign(this.data, clone(patch)); if (done) done(); } };
  page.onLoad();
  const action = (action, value) => page.onAction({ currentTarget: { dataset: { action, value } } });
  return { page, storage, storageApi, platform, wx, action, saved: () => storageApi.readStore(page.store) };
}

test('birth card uses native forwarding with a prepared image and memorial photo saves after consent', async () => {
  const { page, action, platform, wx } = pageHarness();
  const template = readFileSync(resolve(miniRoot, 'pages/index/index.wxml'), 'utf8');
  assert.match(template, /<button open-type="share"[^>]+birth-share/);
  assert.doesNotMatch(template, /data-action="birth-card"|data-action="save-photo"/);
  await action('born');
  assert.equal(page.data.birthShareReady, true);
  assert.equal(page.onShareAppMessage().imageUrl, '/mock-birth-share.png');
  assert.match(page.onShareAppMessage().title, /出生卡/);
  let asked = 0, rendered = 0, saved = 0, authorized = 0;
  platform.requestAlbumAccess = async () => { authorized++; };
  wx.showModal = options => { asked++; assert.match(options.content, /相册/); assert.ok([...options.confirmText].length<=4); options.success({ confirm: true }); };
  platform.captureMemorial = async () => { rendered++; return '/mock-photo.png'; };
  platform.saveImage = async path => { saved++; assert.equal(path, '/mock-photo.png'); };
  page.store.current.phase = 'dead'; page.navigate('ending');
  await action('capture-ending');
  assert.equal(asked, 1);
  assert.equal(rendered, 1);
  assert.equal(authorized, 1, 'first save explicitly requests album permission');
  assert.equal(saved, 1, 'one tap generates and saves the photo');
  assert.equal(page.data.photoReady, undefined);
  wx.showModal = options => { asked++; options.success({ confirm: false }); };
  await action('capture-ending');
  assert.equal(saved, 1, 'declining the privacy prompt does not save');
  platform.albumAuthorized = async () => true;
  await action('capture-ending');
  assert.equal(saved, 2); assert.equal(asked, 2, 'authorized saves do not repeat the permission explanation');
  page.onUnload();
});

test('navigation geometry keeps the centered title clear of the WeChat capsule', () => {
  const { page } = pageHarness();
  for (const [width, status, capsule] of [
    [390, 47, { top: 51, height: 32, left: 287 }],
    [320, 20, { top: 24, height: 32, left: 220 }],
    [360, 24, { top: 30, height: 32, left: 252 }]
  ]) {
    const nav = page.navigationMetrics({ windowWidth: width, statusBarHeight: status }, capsule);
    assert.ok(nav.navHeight >= capsule.top + capsule.height);
    assert.ok(width - nav.navSide < capsule.left, 'title right edge must stop before capsule');
    assert.ok(width - 2 * nav.navSide >= 64, 'title always has a readable area');
    assert.ok(nav.navBarHeight >= 44, 'navigation row keeps a usable tap target');
  }
  const fallback = page.navigationMetrics({ windowWidth: 320, statusBarHeight: 20 }, null);
  assert.equal(fallback.navHeight, 64);
  assert.equal(fallback.navSide, 96);
  page.onUnload();
});

test('native page creates and resumes lives, and profile dialog restores prior playback state', async () => {
  const { page, action, storage } = pageHarness();
  assert.equal(page.data.view, 'home');
  const template = readFileSync(resolve(miniRoot, 'pages/index/index.wxml'), 'utf8');
  const requiredLabels = [...new Set([...template.matchAll(/ui\.([A-Za-z0-9]+)/g)].map(match => match[1]))];
  for (const language of ['zh-CN', 'zh-TW', 'en']) {
    page.store.settings.language = language;
    const labels = page.uiLabels();
    for (const key of requiredLabels) assert.ok(typeof labels[key] === 'string' && labels[key].length > 0, `missing ${language} UI label ${key}`);
  }
  page.store.settings.language = 'zh-CN'; page.render();
  assert.equal(page.store.current, null);
  await action('born');
  assert.equal(page.data.view, 'certificate');
  assert.equal(page.store.current.phase, 'birth');
  await action('begin');
  assert.equal(page.data.view, 'life');
  assert.equal(page._paused, false);
  assert.equal(page.data.person.stats.length, 4);
  await action('life-details');
  assert.equal(page.data.modal, 'details');
  assert.equal(page._paused, true);
  await action('close-modal');
  assert.equal(page.data.modal, '');
  assert.equal(page._paused, false);
  await action('pause');
  await action('life-details'); await action('close-modal');
  assert.equal(page._paused, true, 'opening and closing details must not unpause a paused life');
  await action('toggle-overview');
  assert.equal(page.data.settings.overviewCollapsed, true);
  const restored = pageHarness(null, storage);
  assert.equal(restored.page.data.settings.overviewCollapsed, true);
  assert.equal(restored.page.store.current.id, page.store.current.id);
  await restored.action('resume');
  assert.equal(restored.page.data.view, 'life');
  assert.equal(restored.page._paused, false, 'continue resumes the life clock');
  page.onUnload(); restored.page.onUnload();
});

test('native page stages choices, saves records and only memorializes after the explicit user action', async () => {
  const { page, action, storage, saved } = pageHarness();
  const life = mini.startLife(mini.createLife({ location: mini.locations[0], locations: mini.locations, seed: 'native-controller-positive', birthYear: 2000, world: 'past' }));
  life.mortalityRisk.budget = 1e9;
  page.store.current = life; page.navigate('life');
  const favorite = life.log[0].id;
  for (let n = 0; n < 4; n++) {
    await action('star', favorite); assert.ok(life.stars.includes(favorite));
    if (n < 3) assert.match(page.data.toast, /人生瞬间/);
    else assert.equal(page.data.toast, '', 'favorites are silent after the third explanation');
    await action('star', favorite); assert.equal(page.data.toast, '');
  }
  await action('star', favorite);
  assert.equal(page.store.savedMomentToastCount, 3);
  let stageChoices = 0;
  for (let n = 0; n < 200 && life.age < 22; n++) {
    if (life.pending) {
      assert.equal(page.data.modal, 'choice');
      assert.ok(page.data.choice.options.length > 0);
      if (life.pending.action === 'focus-stage') stageChoices++;
      page.makeChoice(null, true);
    } else page.completeYear();
  }
  assert.ok(stageChoices >= 2, 'positive control: childhood and later stage modals were actually presented');
  assert.ok(Object.values(life.decisionState.presentedByAge).every(count => count <= 2));
  while (life.pending) page.makeChoice(null, true);
  life.mortalityRisk.budget = 0; page.completeYear();
  assert.equal(page.data.view, 'ending');
  assert.equal(page.store.history.length, 0);
  assert.equal(saved().history.length, 0, 'death must not automatically add the life to the memorial hall');
  await action('end-done');
  assert.equal(page.data.view, 'report');
  assert.ok(page.data.person.canEditReview);
  assert.ok(page.data.momentGroups.flatMap(group => group.events).some(event => event.id === favorite));
  await action('edit-review');
  assert.equal(page.data.modal, 'review');
  page.onReviewInput({ detail: { value: '愿你在这段人生里留下自己的光。' } });
  await action('save-review');
  assert.equal(life.farewell, '愿你在这段人生里留下自己的光。');
  await action('edit-review'); page.onReviewInput({ detail: { value: '愿你拥有安稳而鲜活的日常。' } }); await action('save-review');
  assert.equal(life.farewell, '愿你拥有安稳而鲜活的日常。', 'repeat edits are allowed before leaving');
  await action('memorialize');
  assert.equal(page.store.history.length, 1);
  await action('memorialize');
  assert.equal(page.store.history.length, 1, 'explicit archive action is idempotent');
  await action('replay');
  assert.equal(page.data.view, 'home');
  assert.equal(page._editable, null);
  await action('archive'); await action('review', life.id);
  assert.equal(page.data.view, 'report');
  assert.equal(page.data.fromArchive, true);
  assert.equal(page.data.person.canEditReview, false);
  await action('edit-review');
  assert.equal(page.data.modal, '', 'leaving the report permanently ends the editing session');
  assert.equal(saved().history[0].farewell, life.farewell);
  page.onUnload();
});

test('home memorial previews stop at eight and both life views show every record', () => {
  const { page } = pageHarness();
  const life = mini.startLife(mini.createLife({ location: mini.locations[0], seed: 'all-visible-records', birthYear: 2000, world: 'past' }));
  for (let index = 0; index < 70; index++) life.log.unshift({ id: `extra-${index}`, age: index, year: 2000 + index, type: 'daily', text: { zhCN: `第 ${index} 条记录` } });
  page.store.current = life;
  page.navigate('life');
  assert.equal(page.data.logs.length, life.log.length);
  life.phase = 'dead';
  page.navigate('report');
  assert.equal(page.data.logs.length, life.log.length);
  page.store.history = Array.from({ length: 9 }, (_, index) => ({ ...life, id: `memorial-${index}` }));
  page.navigate('home');
  assert.equal(page.data.memories.length, 8);
  page.onUnload();
});

test('native storage reloads twelve lives and a large full journal within WeChat per-key limits', () => {
  const memory = new Map();
  let injectFailure = false;
  const wx = {
    getStorageSync: key => memory.has(key) ? clone(memory.get(key)) : '',
    setStorageSync(key, value) {
      const bytes = Buffer.byteLength(JSON.stringify(value));
      assert.ok(bytes < 1024 * 1024, `per-key budget exceeded: ${bytes}`);
      if (injectFailure && key !== SAVE_KEY) throw new Error('injected storage quota failure');
      memory.set(key, clone(value));
    },
    removeStorageSync: key => memory.delete(key),
  };
  const api = loadStorage(wx);
  const defaults = { version: 1, settings: { language: 'zh-CN' }, current: null, history: [], savedMomentToastCount: 0 };
  const history = Array.from({ length: 12 }, (_, index) => ({ id: `archive-${index}`, version: 1, log: [{ text: { zhCN: '日常记录'.repeat(28000) } }], farewell: `第${index}段人生` }));
  history[0].log.push({ id: 'large-record', text: { zhCN: '愿平凡的日子也被珍惜。'.repeat(50000) } });
  assert.ok(Buffer.byteLength(JSON.stringify(history[0])) > 1024 * 1024);
  const expected = { ...defaults, current: history[0], history, savedMomentToastCount: 3 };
  api.writeStore(expected);
  assert.equal(memory.get(SAVE_KEY).storageVersion, 2);
  assert.equal(memory.get(SAVE_KEY).records[history[0].id].format, 'chunks');
  const reopened = api.readStore(defaults);
  assert.deepEqual(clone(reopened), clone(expected));
  assert.strictEqual(reopened.current, reopened.history[0], 'current and its memorial copy refer to one loaded life');
  const beforeKeys = [...memory.keys()].sort();
  const changed = clone(expected); changed.history[1].farewell = '修改后需要重新写入';
  injectFailure = true;
  assert.throws(() => api.writeStore(changed), /injected storage quota failure/);
  injectFailure = false;
  assert.deepEqual(clone(api.readStore(defaults)), clone(expected), 'failed writes preserve the last complete save');
  assert.deepEqual([...memory.keys()].sort(), beforeKeys, 'failed writes leave no orphan chunks');
  expected.history = expected.history.slice(0, 1); api.writeStore(expected);
  assert.equal(api.readStore(defaults).history.length, 1);
  assert.ok([...memory.keys()].every(key => !key.includes('archive-1.')), 'removed lives are collected after successful commits');
});


test('midyear choices stop fast-forward and stale taps keep the pending choice and typed text', async () => {
  const trigger = life => { life.pending = { id: 'midyear-test', action: 'reflect', title: { zhCN: '回想' }, description: { zhCN: '写下来' }, input: true, options: [{ id: 'write', label: { zhCN: '写下' } }] }; return { changed: true }; };
  const { page, action } = pageHarness(null, null, { processTimeline: trigger });
  page.store.current = mini.startLife(mini.createLife({ location: mini.locations[0], seed: 'midyear-native', birthYear: 2000 }));
  page.navigate('life'); page._paused = false; page._fast = true; page._lastTick = Date.now() - 120;
  page.tick();
  assert.equal(page._fast, false, 'fast-forward must stop at a calendar event choice');
  assert.equal(page.data.modal, 'choice');
  page.onReflectionInput({ detail: { value: '写下的想法' } });
  await action('choose', 'stale-option');
  assert.equal(page.store.current.pending.id, 'midyear-test');
  assert.equal(page.data.modal, 'choice');
  assert.equal(page.data.reflectionDraft, '写下的想法');
  page.onUnload();
});

test('save failures do not report a successful favorite or review, and corrupt saves are not overwritten', async () => {
  const { page, storageApi, action } = pageHarness();
  const life = mini.startLife(mini.createLife({ location: mini.locations[0], seed: 'save-failure-native', birthYear: 2000 }));
  page.store.current = life; page.navigate('life');
  const originalWrite = storageApi.writeStore;
  storageApi.writeStore = () => { throw new Error('injected save failure'); };
  await action('star', life.log[0].id);
  assert.equal((life.stars || []).length, 0);
  assert.equal(page.store.savedMomentToastCount, 0);
  assert.notEqual(page.data.toast, '已收藏');
  assert.doesNotMatch(page.data.toast, /已收藏/);
  storageApi.writeStore = originalWrite;
  life.phase = 'dead'; life.death = { cause: { zhCN: '疾病' } }; page.finishLife(); await action('end-done');
  await action('edit-review'); page.onReviewInput({ detail: { value: '需要保存的留言' } });
  storageApi.writeStore = () => { throw new Error('injected save failure'); };
  await action('save-review');
  assert.equal(page.data.modal, 'review');
  assert.equal(page.data.reviewDraft, '需要保存的留言');
  assert.equal(life.farewell, undefined);
  storageApi.writeStore = originalWrite;
  const bad = new Map([[SAVE_KEY, { version: 1, storageVersion: 2, currentId: 'missing', records: {}, historyIds: [] }]]);
  const restored = pageHarness(null, bad);
  assert.equal(restored.page._storageReadFailed, true);
  const before = clone(restored.storage.get(SAVE_KEY));
  assert.equal(restored.page.persist(), false);
  assert.deepEqual(restored.storage.get(SAVE_KEY), before, 'unreadable metadata is never replaced with an empty save');
  await restored.action('born');
  assert.equal(restored.page.data.view, 'home', 'do not start an unsavable life when previous storage is unreadable');
  const future = pageHarness({ version: 2, history: [] });
  assert.equal(future.page._storageReadFailed, true, 'an unknown version is not silently overwritten');
  future.page.onUnload();
  for (const invalid of [{ version: 1, storageVersion: 3, currentId: null, records: {}, historyIds: [] }, { version: 1, storageVersion: 2, currentId: '', records: {}, historyIds: [] }, { version: 1, current: false, history: [] }, { version: 1, current: { id: 'bad' }, history: [] }, { version: 1, current: null, history: [{ id: 'bad' }] }, { version: 1, current: null, history: 'bad' }]) {
    const checked = pageHarness(invalid);
    assert.equal(checked.page._storageReadFailed, true, 'unsupported or malformed existing lives must be protected');
    assert.equal(checked.page.persist(), false);
    assert.deepEqual(checked.storage.get(SAVE_KEY), invalid);
    checked.page.onUnload();
  }
  page.onUnload(); restored.page.onUnload();
});
