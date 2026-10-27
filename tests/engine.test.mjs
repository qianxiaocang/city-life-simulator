import test from 'node:test';
import assert from 'node:assert/strict';
import { createLife, startLife, advanceYear, choose, autoChoose, setFocus, getFocusOptions, getShopItems, purchase, summarize, generateCompanions, configureLocations, relocate, localize } from '../app/engine.js';

const locations = [
  { id: '110100', region: 'mainland', name: { zhCN: '北京市', zhTW: '北京市', en: 'Beijing' }, prosperity: .9, weight: 10 },
  { id: 'tw-taipei', region: 'taiwan', name: { zhCN: '台北市', zhTW: '臺北市', en: 'Taipei' }, prosperity: .83, weight: 3 },
  { id: 'hk', region: 'hongkong', name: { zhCN: '香港', zhTW: '香港', en: 'Hong Kong' }, prosperity: .96, weight: 2 },
  { id: 'mo', region: 'macau', name: { zhCN: '澳门', zhTW: '澳門', en: 'Macau' }, prosperity: .9, weight: 1 },
];
const make = seed => createLife({ locations, location: locations[0], seed });
function finish(life) {
  startLife(life);
  for (let i = 0; i < 2000 && life.phase !== 'dead'; i++) {
    if (life.pending) autoChoose(life);
    else {
      const options = getFocusOptions(life);
      if (options.length) setFocus(life, options[Math.floor(life.age % options.length)].id);
      advanceYear(life);
    }
  }
  return life;
}

test('unsupported birthplaces and relocation cannot introduce foreign countries', () => {
  assert.throws(() => createLife({ location: { id: 'jp', region: 'japan', name: { en: 'Japan' } } }), /supported/);
  configureLocations(locations);
  const life = make('geography');
  startLife(life); life.age = 24; life.year=life.birthYear+24; life.money=100000;
  assert.throws(() => relocate(life, { id: 'jp', region: 'japan', name: { en: 'Japan' } }), /supported/);
  assert.equal(relocate(life, { ...locations[0], id: 'not-in-catalogue' }), false);
  assert.equal(relocate(life, locations[1]), true);
  assert.equal(life.location.region, 'taiwan');
  assert.equal(relocate(life, { ...locations[2], name: { en: 'Forged place' }, prosperity: .01 }), true);
  assert.deepEqual(life.location.name, locations[2].name);
  assert.equal(life.location.prosperity, locations[2].prosperity);
});

test('same seed gives reproducible birth and complete lifespan', () => {
  assert.deepEqual(make('same'), make('same'));
  assert.deepEqual(finish(make('same')), finish(make('same')));
});

test('pending decisions block time and invalid choices are inert', () => {
  const life = make('decision'); startLife(life);
  for (let i = 0; i < 5 && !life.pending; i++) advanceYear(life);
  assert.ok(life.pending);
  const before = JSON.stringify(life);
  advanceYear(life);
  assert.equal(JSON.stringify(life), before);
  assert.equal(choose(life, 'not-an-option'), false);
  assert.equal(JSON.stringify(life), before);
  assert.equal(choose(life, life.pending.options[0].id), true);
});

test('serialized state restores deterministic future including random state', () => {
  const original = make('restore'); startLife(original);
  for (let i = 0; i < 30; i++) original.pending ? autoChoose(original) : advanceYear(original);
  const restored = JSON.parse(JSON.stringify(original));
  assert.deepEqual(finish(original), finish(restored));
});

test('a range of seeds always reaches a valid bounded ending', () => {
  for (let seed = 0; seed < 80; seed++) {
    const life = finish(make(`life-${seed}`));
    assert.equal(life.phase, 'dead');
    assert.ok(life.age >= 0 && life.age <= 120);
    assert.equal(life.pending, null);
    assert.equal(life.year, life.birthYear + life.age);
    assert.ok(Number.isFinite(life.money));
    assert.ok(Number.isFinite(summarize(life).netWorth));
    assert.equal(new Set(life.years.map(year => year.age)).size, life.years.length);
    for (const value of Object.values(life.stats)) assert.ok(value >= 0 && value <= 100);
    for (const event of life.log) for (const lang of ['zhCN', 'zhTW', 'en']) assert.ok(event.text[lang]);
    for (const place of life.visited) assert.ok(locations.some(item => item.id === place.id));
  }
});

test('focus time is weighted, not decided by final click alone', () => {
  const a = make('focus'); startLife(a); a.age = 30; a.focus = 'balance';
  a.job = { id: 'office', name: { zhCN: '职员', zhTW: '職員', en: 'Office worker' }, salary: 70000, years: 1 };
  a.focusTime = { health: 9, work: 1 };
  const b = JSON.parse(JSON.stringify(a)); b.focusTime = { health: 1, work: 9 };
  advanceYear(a); advanceYear(b);
  assert.ok(a.stats.health > b.stats.health);
  assert.deepEqual(a.focusTime, {});
});

test('purchases enforce funds, age, cooldown and investment selection', () => {
  const life = make('shop'); startLife(life); life.age = 30; life.money = 1e7;
  assert.equal(purchase(life, 'phone'), true);
  assert.equal(purchase(life, 'phone'), false);
  assert.equal(purchase(life, 'meal'), true);
  assert.equal(purchase(life, 'meal'), false);
  assert.equal(purchase(life, 'invest-stock'), true);
  assert.equal(life.investment, 'stock');
  assert.equal(purchase(life, 'invest-stock'), false);
  life.money = 0;
  assert.equal(purchase(life, 'house'), false);
  life.age = 3;
  assert.deepEqual(getShopItems(life), []);
});

test('companions are bounded, translated and drawn only from allowed places', () => {
  const companions = generateCompanions({ locations, seed: 'four', count: 4 });
  assert.equal(companions.length, 4);
  for (const companion of companions) {
    assert.ok(companion.deathAge <= 120);
    assert.ok(locations.some(place => place.id === companion.born.id));
    assert.ok(localize(companion.summary.text, 'en').length > 30);
    assert.ok(companion.years.length > 0);
  }
});

test('continuing education takes years and cannot be bought repeatedly', () => {
  const life = make('adult-study'); startLife(life);
  life.age = 30; life.year = life.birthYear + 30; life.education = 'high'; life.money = 1e6;
  assert.equal(purchase(life, 'adultstudy'), true);
  assert.equal(life.education, 'high');
  assert.equal(life.continuingEducation.endsAt, 33);
  assert.equal(purchase(life, 'adultstudy'), false);
  for (let i = 0; i < 2; i++) {
    while (life.pending) autoChoose(life);
    advanceYear(life);
  }
  assert.equal(life.education, 'high');
  assert.ok(life.continuingEducation);
  while (life.pending) autoChoose(life);
  advanceYear(life);
  assert.equal(life.continuingEducation, null);
});

test('same-age reflection and school decisions are both retained', () => {
  const life = make('queue'); startLife(life);
  life.age = 14; life.year = life.birthYear + 14; life.school = { stage: 'junior', endsAt: 15 };
  advanceYear(life);
  assert.equal(life.pending.action, 'reflect');
  assert.equal(life.pendingQueue[0].action, 'edu-secondary');
  const atAge = life.age;
  choose(life, 'continue');
  assert.equal(life.age, atAge);
  assert.equal(life.pending.action, 'edu-secondary');
  const vocational=life.pending.data.programs.findIndex(program=>program.stage==='vocational');
  choose(life, 'school-'+vocational);
  assert.equal(life.school.stage, 'vocational');
  assert.equal(life.pending, null);
});
