import test from 'node:test';
import assert from 'node:assert/strict';
import { memorialReview } from '../app/memorial-review.js';

const T = (zhCN, zhTW, en) => ({ zhCN, zhTW, en });
const life = {
  age: 78,
  born: { name: T('成都', '成都', 'Chengdu') },
  location: { name: T('上海', '上海', 'Shanghai') },
  visited: [{ id: 'chengdu' }, { id: 'shanghai' }],
  lastJob: { name: T('教师', '教師', 'teacher') },
  family: { children: [{}, {}] },
  totals: { family: 12, work: 22, learning: 4 }
};

test('a death-time reflection takes priority over the generated memorial review', () => {
  assert.deepEqual(memorialReview({ ...life, farewell: '  我一直珍惜和家人共度的日子。  ' }), {
    text: '我一直珍惜和家人共度的日子。', origin: 'written'
  });
});

test('an unwritten or old life receives a deterministic localized reflection', () => {
  for (const [language, city] of [['zh-CN', '成都'], ['zh-TW', '成都'], ['en', 'Chengdu']]) {
    const result = memorialReview({ ...life, farewell: ' ' }, language);
    assert.equal(result.origin, 'generated');
    assert.ok(result.text.includes(city));
    assert.ok(result.text.includes('78'));
    assert.equal(result.text, memorialReview(life, language).text);
  }
  assert.match(memorialReview({ age: 4, born: life.born, location: life.born }, 'zh-CN').text, /短暂的年岁/);
});
