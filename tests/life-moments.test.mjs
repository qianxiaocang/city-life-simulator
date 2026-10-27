import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLifeMoments } from '../app/life-moments.js';
import { describeHighlight, drawHighlightScene } from '../app/highlight-scenes.js';

const event = (number, age, type, zhCN) => ({ id: `life-example-${number}`, age, year: 2026 + age, type, text: { zhCN, zhTW: zhCN, en: zhCN } });

test('saved records replace automatic moments in their decade and all saved records survive', () => {
  const birth = event(0, 0, 'birth', '你出生了。');
  const school = event(1, 7, 'education', '你进入小学。');
  const savedOne = event(2, 7, 'warm', '你和朋友在公园散步。');
  const savedTwo = event(3, 8, 'warm', '家人给你拍了一张照片。');
  const savedThree = event(4, 9, 'warm', '你学会骑自行车。');
  const work = event(5, 20, 'career', '你开始了工作。');
  const life = { age: 20, log: [work, savedThree, savedTwo, savedOne, school, birth], stars: [savedOne.id, savedTwo.id, savedThree.id] };
  const picked = selectLifeMoments(life);
  assert.deepEqual(picked.map(item => item.id), [savedOne.id, savedTwo.id, savedThree.id, work.id]);
  assert.equal(picked.filter(item => item.age < 10).length, 3);
});

test('matching generated records do not duplicate saved moments', () => {
  const saved = event(8, 31, 'love', '你们结婚了。');
  const duplicate = event(9, 31, 'love', '你们结婚了。');
  const other = event(10, 34, 'family', '孩子出生了。');
  const picked = selectLifeMoments({ age: 34, log: [other, duplicate, saved], stars: [saved.id] });
  assert.deepEqual(picked.map(item => item.id), [saved.id, other.id]);
});

test('pixel plans follow record wording and encode distinct records', () => {
  const life = { urban: true };
  assert.equal(describeHighlight(event(1, 20, 'asset', '你买了一辆汽车。'), life).motif, 'car');
  assert.equal(describeHighlight(event(2, 22, 'education', '你大学毕业了。'), life).motif, 'graduate');
  assert.equal(describeHighlight(event(3, 30, 'love', '你们结婚了。'), life).motif, 'wedding');
  assert.equal(describeHighlight(event(4, 42, 'health', '你在医院接受治疗。'), life).motif, 'health');
  assert.equal(describeHighlight(event(5, 8, 'warm', '家人给你拍了一张照片。'), life).motif, 'camera');
  assert.equal(describeHighlight(event(6, 18, 'family', '你和家人一起过生日。'), life).motif, 'cake');
  const variants = Array.from({ length: 3000 }, (_, index) => describeHighlight(event(index, 30, 'warm', '你和朋友在公园散步。'), life).variant);
  assert.equal(new Set(variants).size, variants.length);
  const pictures = Array.from({ length: 12 }, (_, index) => {
    const pixels = [];
    const context = { fillStyle: '', clearRect() {}, fillRect(...rect) { pixels.push([this.fillStyle, ...rect]); } };
    drawHighlightScene({ width: 640, height: 220, getContext: () => context }, event(index, 30, 'warm', '你和朋友在公园散步。'), life);
    return JSON.stringify(pixels);
  });
  assert.equal(new Set(pictures).size, pictures.length);
});
