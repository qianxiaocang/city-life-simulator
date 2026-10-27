import test from 'node:test';
import assert from 'node:assert/strict';
import { locations, locationMeta } from '../app/data/locations.js';

test('all supported administrative birthplaces are present with stable unique IDs', () => {
  assert.equal(locations.length, 1152);
  const byId = new Map(locations.map(place => [place.id, place]));
  assert.equal(byId.size, locations.length);
  for (const place of locations) {
    assert.ok(['mainland', 'taiwan', 'hongkong', 'macau'].includes(place.region));
    assert.ok(place.population === null);
    assert.equal(place.weightKind, 'simulated');
    assert.equal(place.prosperityKind, 'simulated');
    assert.ok(place.weight > 0 && Number.isFinite(place.weight));
    assert.ok(place.prosperity >= 0 && place.prosperity <= 1);
    for (const key of ['zhCN', 'zhTW', 'en']) {
      assert.ok(place.name[key]);
      assert.ok(place.province[key]);
    }
    if (place.parentId) assert.ok(byId.has(place.parentId), place.id);
  }
  for (const [region, expected] of Object.entries(locationMeta.regionCounts)) {
    assert.equal(locations.filter(place => place.region === region).length, expected);
  }
  assert.equal(locations.filter(place => place.region === 'mainland' && place.level === 'municipality').length, 4);
  assert.equal(locations.filter(place => place.region === 'taiwan').length, 390);
  assert.equal(locations.filter(place => place.region === 'hongkong').length, 19);
  assert.equal(locations.filter(place => place.region === 'macau').length, 8);
});

test('city coverage includes all mainland city classes, offshore Taiwan, and the 2026 addition', () => {
  const mainland = locations.filter(place => place.region === 'mainland');
  assert.equal(mainland.filter(place => place.level === 'prefecture-city').length, 293);
  assert.equal(mainland.filter(place => place.level === 'prefecture').length, 40);
  assert.equal(mainland.filter(place => place.level === 'county-city').length, 398);
  assert.equal(mainland.filter(place => place.level === 'municipality').length, 4);
  const byId = new Map(locations.map(place => [place.id, place]));
  assert.equal(byId.get('cn-659013').name.zhCN, '草湖市');
  assert.equal(byId.get('cn-659012').name.zhCN, '白杨市');
  assert.equal(byId.get('cn-540481').name.zhCN, '米林市');
  assert.equal(byId.get('cn-540581').name.zhCN, '错那市');
  assert.equal(locations.filter(place => place.region === 'taiwan' && ['city', 'county'].includes(place.level)).length, 22);
  assert.equal(locations.filter(place => place.region === 'taiwan' && place.level === 'township-district').length, 368);
  assert.equal(locations.filter(place => place.parentId === 'tw-kinmen').length, 6);
  assert.equal(locations.filter(place => place.parentId === 'tw-lienchiang').length, 4);
  assert.equal(byId.get('cn-440300').name.en, 'Shenzhen');
  assert.equal(byId.get('cn-610100').name.en, "Xi'an");
  assert.equal(byId.get('tw-7101').name.en, 'Taipei City');
  assert.equal(byId.get('hk-central-western').name.zhTW, '中西區');
  assert.equal(byId.get('mo-city').name.en, 'Macao');
  assert.ok(!locations.some(place => /国外|國外|Foreign|海外/.test(place.name.zhCN)));
});
