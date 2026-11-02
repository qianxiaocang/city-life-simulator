import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import crypto from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));

function harness() {
  const collections = new Map();
  const table = name => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  const database = {
    serverDate: () => new Date('2026-11-02T00:00:00Z'),
    collection(name) {
      const rows = table(name);
      return {
        doc(id) { return {
          async get() { if (!rows.has(id)) throw new Error('missing'); return { data: { _id: id, ...rows.get(id) } }; },
          async set({ data }) { rows.set(id, data); },
          async update({ data }) { const row = rows.get(id); for (const [key, value] of Object.entries(data)) { if (key === 'summary.candles') row.summary.candles = value; else row[key] = value; } },
        }; },
        orderBy() { return {
          skip(offset) { return {
            limit(size) { return {
              field() { return { async get() { return { data: [...rows].reverse().slice(offset, offset + size).map(([id, row]) => ({ _id: id, summary: row.summary })) }; } }; },
            }; },
          }; },
        }; },
        where(query) { return { async count() { return { total: [...rows.values()].filter(row => row.memorialId === query.memorialId).length }; } }; },
      };
    },
  };
  let openid = 'person-one';
  const sdk = { DYNAMIC_CURRENT_ENV: 'dynamic', init() {}, database: () => database, getWXContext: () => ({ OPENID: openid }) };
  const sandbox = { exports: {}, require: name => name === 'wx-server-sdk' ? sdk : crypto, Buffer };
  vm.runInNewContext(readFileSync(resolve(root, 'cloudfunctions/memorial/index.js'), 'utf8'), sandbox);
  return { main: sandbox.exports.main, collections, setOpenid: value => { openid = value; } };
}

test('memorial cloud function publishes once, lists cloud records, opens full lives and counts unique candle lighters', async () => {
  const { main, collections, setOpenid } = harness();
  const life = { version: 1, id: 'life-one', phase: 'dead', name: { zhCN: '测试人物' }, born: { name: { zhCN: '成都市' } }, birthYear: 2026, year: 2100, age: 74, log: [{ id: 'birth', type: 'birth' }, { id: 'last', type: 'daily' }], years: [] };
  const first = await main({ action: 'publish', life, previewEventId: 'last' });
  assert.equal(first.ok, true);
  assert.equal((await main({ action: 'publish', life })).alreadySaved, true);
  assert.equal(collections.get('memorial_lives').size, 1);
  const listed = await main({ action: 'list' });
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].log[0].id, 'last');
  assert.equal(listed.items[0].id, first.id);
  const opened = await main({ action: 'get', id: first.id });
  assert.equal(opened.life.sourceId, life.id);
  assert.equal(opened.life.log.length, 2);
  assert.equal((await main({ action: 'candle', id: first.id })).candles, 1);
  assert.equal((await main({ action: 'candle', id: first.id })).candles, 1);
  setOpenid('person-two');
  assert.equal((await main({ action: 'candle', id: first.id })).candles, 2);
  assert.equal((await main({ action: 'list' })).items[0].candles, 2);
  assert.equal((await main({ action: 'publish', life: { ...life, phase: 'life' } })).ok, false);
});
