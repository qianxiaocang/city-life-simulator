import test from 'node:test';
import assert from 'node:assert/strict';
import { lifeEndingNarrative } from '../app/life-narrative.js';

const T = (zhCN, zhTW, en) => ({ zhCN, zhTW, en });
const record = (id, age, type, text) => ({ id, age, type, text: T(text, text, text) });
const life = (log, age = 41) => ({ age, born: { name: T('成都', '成都', 'Chengdu') }, log: [...log].reverse(), stars: [] });

test('ending narrative uses the life record and death rather than fixed farewell text', () => {
  const teacher = life([
    record('birth', 0, 'birth', '你出生在成都。'),
    record('school', 17, 'education', '你从中学毕业了。'),
    record('work', 25, 'career', '你成为了一名教师。'),
    record('death', 41, 'death', '你因病离开了人世。')
  ]);
  const result = lifeEndingNarrative(teacher, 'zh-CN');
  assert.match(result, /成都/);
  assert.match(result, /毕业/);
  assert.match(result, /教师/);
  assert.match(result, /因病/);
  assert.doesNotMatch(result, /有人记得你的笑容/);
});

test('short lives keep a personal moment and the actual ending', () => {
  const infant = life([
    record('birth', 0, 'birth', '你出生在成都。'),
    record('warm', 0, 'warm', '家人把小小的你抱在怀里。'),
    record('history', 0, 'history', '国际市场发生了波动。'),
    record('death', 0, 'death', '你因感染离开了人世。')
  ], 0);
  const result = lifeEndingNarrative(infant, 'zh-CN');
  assert.match(result, /家人把小小的你抱在怀里/);
  assert.match(result, /因感染/);
  assert.doesNotMatch(result, /国际市场/);
});

test('saved moments can surface over routine records without leaking ledger entries', () => {
  const person = life([
    record('birth', 0, 'birth', '你出生在成都。'),
    record('school', 18, 'education', '你考上了大学。'),
    record('memory', 26, 'warm', '你与好友在江边看了一夜灯火。'),
    record('ledger', 27, 'money', '现金增加 ¥200。'),
    record('work', 31, 'career', '你获得了新的岗位。'),
    record('death', 41, 'death', '你在家人陪伴下离世。')
  ]);
  person.stars = ['memory'];
  const result = lifeEndingNarrative(person, 'zh-CN');
  assert.match(result, /江边看了一夜灯火/);
  assert.doesNotMatch(result, /现金增加/);
  assert.match(result, /家人陪伴下离世/);
  assert.match(lifeEndingNarrative(person, 'en'), /Chengdu/);
});

test('the same record is narrated in the selected language', () => {
  const person = life([
    record('birth', 0, 'birth', '你出生在成都。'),
    { id: 'family', age: 3, type: 'family', text: T('家人陪你度过春天。', '家人陪你度過春天。', 'Your family spent spring with you.') },
    { id: 'death', age: 3, type: 'death', text: T('你离开了人世。', '你離開了人世。', 'Your life ended.') }
  ], 3);
  assert.match(lifeEndingNarrative(person, 'zh-TW'), /3歲時，家人陪你度過春天/);
  assert.match(lifeEndingNarrative(person, 'en'), /At 3, your family spent spring with you/);
});
