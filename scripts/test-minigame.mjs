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

function uiHarness() {
  const noop = () => {};
  const context = Object.fromEntries(['beginPath','moveTo','lineTo','quadraticCurveTo','closePath','fill','stroke','fillText','clearRect','setTransform','save','restore','rect','clip','translate','drawImage'].map(name => [name, noop]));
  context.measureText = text => ({ width: Array.from(String(text)).length * 8 });
  const canvas = { getContext: () => context, requestAnimationFrame: () => 1 };
  const wx = { getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1, statusBarHeight: 20, safeArea: { bottom: 810 } }) };
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
  return { ui, page, actions, shares };
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
