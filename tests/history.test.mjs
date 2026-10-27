import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_EVENTS, HISTORY_SOURCES, HISTORY_META, HISTORICAL_ERAS, eventsForYear, activeHistoryEffects, matchesHistoryLocation, getHistoricalEra } from '../app/data/history.js';
import { ensureHistoryState, processHistory, historicalContext, historicalProfile } from '../app/history-runtime.js';
import { locations } from '../app/data/locations.js';

const byId = new Map(locations.map(location => [location.id, location]));
const eventById = new Map(HISTORY_EVENTS.map(event => [event.id, event]));
function character(locationId = 'cn-511800', year = 2013, birthYear = 1980) {
  return {
    id: 'fixture', phase: 'life', age: year - birthYear, year, birthYear,
    birthMonth: 1, birthDay: 1, location: byId.get(locationId), born: byId.get('cn-511800'),
    money: 10000, debt: 0, assets: { house: 300000, car: 0 },
    stats: { health: 80, happiness: 60, knowledge: 50, relationships: 60 },
    profile: { typicalIncome: 50000 }, log: [], rngState: 42,
  };
}
const noRisk = { chance: () => false };

test('curated facts are unique, trilingual, sourced, and bounded by the research cutoff', () => {
  assert.equal(HISTORY_META.cutoff, '2026-10-25');
  assert.equal(HISTORY_EVENTS.length, HISTORY_META.eventCount);
  assert.equal(eventById.size, HISTORY_EVENTS.length);
  assert.ok(HISTORY_EVENTS.filter(e => e.scope === 'regional').length >= 30);
  assert.ok(HISTORY_EVENTS.filter(e => e.scope === 'global').length >= 20);
  for (const event of HISTORY_EVENTS) {
    assert.ok(event.year >= 1950 && event.year <= 2026, event.id);
    assert.ok(event.date <= HISTORY_META.cutoff, event.id);
    assert.equal(Number(event.date.slice(0, 4)), event.year);
    assert.ok(['day', 'month', 'year'].includes(event.datePrecision));
    assert.equal(event.endYear, event.year + event.duration - 1);
    for (const key of ['zhCN', 'zhTW', 'en']) {
      for (const field of ['title', 'description', 'modelNote']) assert.ok(event[field][key]?.length > 0, `${event.id}:${field}:${key}`);
    }
    assert.ok(event.sourceIds.length > 0, event.id);
    assert.deepEqual(event.sourceUrls, event.sourceIds.map(id => HISTORY_SOURCES[id]?.url));
    assert.ok(event.sourceUrls.every(url => /^https:\/\//.test(url)), event.id);
    for (const id of event.locationIds || []) assert.ok(byId.has(id), `${event.id}: unknown ${id}`);
    for (const id of event.provinceIds || []) assert.ok(locations.some(l => l.province.id === id), `${event.id}: unknown ${id}`);
  }
});

test('every year 1950–2026 has exactly one continuous historical phase', () => {
  for (let year = 1950; year <= 2026; year++) {
    assert.equal(HISTORICAL_ERAS.filter(e => e.startYear <= year && e.endYear >= year).length, 1, String(year));
    const era = getHistoricalEra(year);
    assert.equal(era.projection, false);
    assert.ok(era.educationAccess > 0 && era.healthcare > 0);
    assert.ok(era.sourceIds.every(id => HISTORY_SOURCES[id]));
  }
  assert.deepEqual(eventsForYear(2027, byId.get('cn-511800')), []);
  assert.equal(getHistoricalEra(2030).projection, true);
});

test('regional filters include child cities/districts and never use birthplace', () => {
  assert.ok(eventsForYear(2013, byId.get('cn-511800')).some(e => e.id === 'lushan2013'));
  assert.ok(!eventsForYear(2013, byId.get('cn-510100')).some(e => e.id === 'lushan2013'));
  assert.ok(matchesHistoryLocation(eventById.get('haicheng1975'), byId.get('cn-210381')));
  assert.ok(matchesHistoryLocation(eventById.get('hato-macao2017'), byId.get('mo-city')));
  assert.ok(matchesHistoryLocation(eventById.get('mangkhut-hk2018'), byId.get('hk-central-western')));
  const life = character('cn-510100');
  processHistory(life, 1, noRisk);
  assert.ok(!life.history.experienced.includes('lushan2013'));
});

test('Lushan facts are retained without interpreting all Ya’an residents as epicentral fatalities', () => {
  const e = eventById.get('lushan2013');
  assert.equal(e.date, '2013-04-20'); assert.equal(e.timeBeijing, '08:02');
  assert.equal(e.magnitude, 7); assert.equal(e.depthKm, 13);
  assert.equal(e.reportedImpact.deaths, 196);
  assert.ok(e.effects.deathRisk < .001);
  assert.ok(e.effects.injuryRisk > e.effects.deathRisk);
  assert.ok(e.exposureModel);
  assert.ok(HISTORY_EVENTS.filter(e => e.scope === 'global').every(e => !e.effects.deathRisk));
});

test('calendar progress triggers an event at its date once, including after JSON save/load', () => {
  let life = character();
  processHistory(life, .29, noRisk);
  assert.ok(!life.history.experienced.includes('lushan2013'));
  processHistory(life, .31, noRisk);
  assert.ok(life.history.experienced.includes('lushan2013'));
  const count = life.log.length;
  life = JSON.parse(JSON.stringify(life));
  processHistory(life, .7, noRisk); processHistory(life, .2, noRisk);
  assert.equal(life.log.filter(e => e.historicalEventId === 'lushan2013').length, 1);
  const entry = life.log.find(e => e.historicalEventId === 'lushan2013');
  assert.equal(entry.date, '2013-04-20'); assert.equal(entry.timeBeijing, '08:02');
  assert.ok(entry.sourceUrls.length >= 2);
  assert.ok(life.log.length >= count);
});

test('a character born after a disaster does not experience that disaster', () => {
  const life = character('cn-511800', 2013, 2013);
  life.birthMonth = 5;
  processHistory(life, 1, { chance: () => true });
  assert.ok(!life.history.experienced.includes('lushan2013'));
  assert.equal(life.phase, 'life');
});

test('moving after an event cannot retroactively create exposure', () => {
  const life = character('cn-510100');
  processHistory(life, .4, noRisk);
  life.location = byId.get('cn-511800');
  processHistory(life, .7, noRisk);
  assert.ok(life.history.seen.includes('lushan2013'));
  assert.ok(!life.history.experienced.includes('lushan2013'));
  assert.ok(!historicalContext(life).eventIds.includes('lushan2013'), 'a completed acute disaster does not follow a later arrival');
});

test('death, injury and housing outcomes have independent rolls and source metadata', () => {
  const e = eventById.get('lushan2013');
  const life = character();
  let fatal;
  const result = processHistory(life, .31, {
    chance: (_, p) => p === e.effects.deathRisk,
    die: (target, cause, metadata) => {
      fatal = { cause, metadata }; target.phase = 'dead';
      target.log.unshift({ type: 'death', year: target.year, text: cause });
    },
  });
  assert.equal(result.dead, true); assert.equal(life.assets.house, 300000);
  assert.equal(life.stats.health, 77);
  assert.equal(fatal.metadata.historicalEventId, 'lushan2013');
  assert.ok(fatal.cause.en && fatal.metadata.sourceUrls.length);
  assert.equal(life.log[0].historicalEventId, 'lushan2013');
  assert.equal(life.log[0].date, '2013-04-20');
  assert.deepEqual(life.log[0].sourceUrls, e.sourceUrls);
});

test('housing damage reduces owned assets and available cash without inventing credit', () => {
  const life = character(); life.money = 20;
  const e = eventById.get('lushan2013');
  processHistory(life, .31, { chance: (_, p) => p === e.effects.homeLossRisk });
  assert.ok(life.assets.house < 300000);
  assert.ok(life.money >= 0); assert.equal(life.debt, 0); assert.equal(life.phase, 'life');
  assert.ok(life.log.some(e => e.historicalOutcome === 'housing-damage'));
});

test('a year-only source is summarized without fabricating its first day as an exact date', () => {
  const life = character('cn-350200', 1980, 1960);
  processHistory(life, .5, noRisk);
  assert.ok(!life.history.experienced.includes('sez-xiamen'));
  processHistory(life, 1, noRisk);
  const entry = life.log.find(e => e.historicalEventId === 'sez-xiamen');
  assert.equal(entry.date, '1980'); assert.equal(entry.datePrecision, 'year');
  assert.ok(!entry.text.en.includes('1980-01-01'));
});

test('continuing development creates local opportunities over multiple years', () => {
  const life = character('cn-440300', 1984, 1960);
  processHistory(life, 1, noRisk);
  const local = historicalContext(life);
  assert.ok(local.eventIds.includes('sez-shenzhen'));
  const other = character('cn-510100', 1984, 1960);
  processHistory(other, 1, noRisk);
  assert.ok(local.incomeMultiplier > historicalContext(other).incomeMultiplier);
  assert.ok(activeHistoryEffects(1984, life.location).some(e => e.id === 'sez-shenzhen'));
  assert.ok(!eventsForYear(1984, life.location).some(e => e.id === 'sez-shenzhen'));
});

test('historical context changes at the actual event date and never rerolls personal hazards', () => {
  const life = character();
  processHistory(life, .29, noRisk);
  assert.ok(!historicalContext(life).eventIds.includes('lushan2013'));
  processHistory(life, .31, noRisk);
  const context = historicalContext(life);
  assert.ok(context.eventIds.includes('lushan2013'));
  assert.equal(context.deathRisk, undefined);
  const snapshot = JSON.stringify(life);
  historicalContext(life); historicalContext(life);
  assert.equal(JSON.stringify(life), snapshot);
});

test('profiles distinguish observed anchors, game money and regional scenario models', () => {
  const early = historicalProfile(byId.get('cn-440300'), 'male', 'past', 1960);
  const modern = historicalProfile(byId.get('cn-440300'), 'male', 'past', 2025);
  assert.ok(early.typicalIncome < modern.typicalIncome);
  assert.ok(early.lifeExpectancy < modern.lifeExpectancy);
  assert.ok(early.educationAccess < modern.educationAccess);
  assert.ok(early.childMortality > modern.childMortality);
  assert.ok(modern.sourceIds.includes('nhc-life-2025'));
  const hk = historicalProfile(byId.get('hk-city'), 'female', 'past', 1966);
  assert.equal(hk.dataKind, 'regional-scenario-not-regional-official-statistics');
  assert.ok(!hk.sourceIds.some(id => id.startsWith('nbs')));
  assert.ok(!hk.eraLabel.en.includes('Cultural Revolution'));
});

test('unknown future years add no historical events and do not generate future-era logs', () => {
  const life = character('cn-511800', 2027, 2000);
  const result = processHistory(life, 1, noRisk);
  assert.equal(result.changed, false); assert.equal(life.log.length, 0);
  assert.equal(historicalContext(life).projection, true);
  assert.equal(historicalProfile(life.location, 'male', 'future', 2030).projection, true);
  assert.equal(ensureHistoryState(life).cutoff, '2026-10-25');
});
