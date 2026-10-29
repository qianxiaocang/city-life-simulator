import { valueText } from './i18n.js';

const sentence = (record, language) => {
  const original = valueText(record.text, language) || '';
  const text = record.date && original.startsWith(`${record.date} · `)
    ? original.slice(record.date.length + 3) : original;
  // Avoid lookbehind so the shared renderer also runs on older WeChat JS engines.
  const first = language === 'en' ? (text.match(/^[\s\S]*?[.!?](?=\s)/)?.[0] || text) : (text.match(/^[^。！？]*[。！？]/)?.[0] || text);
  const limit = language === 'en' ? 110 : 48;
  return first.length > limit ? `${first.slice(0, limit).replace(/[，、,\s]+$/u, '')}…` : first.trim();
};

const importance = (record, starred) => {
  const weights = { family: 55, love: 54, career: 53, work: 36, move: 45, education: 42, choice: 36, decision: 34, health: 30, crisis: 27, culture: 25, warm: 23, hobby: 22, reflection: 19, loss: 17 };
  const words = record.text?.zhCN || '';
  let score = weights[record.type] || 10;
  if (/毕业|结婚|出生了|成为|开始工作|退休|搬|迁|考上|获得|取得|买下|购置|重逢|康复/.test(words)) score += 22;
  if (/估值|现金|收入|支出|时代变化|新闻里|世界发生/.test(words)) score -= 30;
  if (starred.has(record.id)) score += 75;
  return score;
};

/** Read the whole record, then select a few distinct, personal moments for the short ending card. */
export function lifeEndingNarrative(life, language = 'zh-CN') {
  const records = Array.isArray(life?.log) ? [...life.log].reverse() : [];
  const starred = new Set(life?.stars || []);
  const city = valueText(life?.born?.name, language) || (language === 'en' ? 'your hometown' : language === 'zh-TW' ? '這座城市' : '这座城市');
  const opening = language === 'en' ? `You were born in ${city}.` : `你出生在${city}。`;
  const excluded = new Set(['birth', 'death', 'history', 'money', 'asset', 'era']);
  const candidates = records.map((record, index) => ({ record, index, text: sentence(record, language) }))
    .filter(item => item.text && !excluded.has(item.record.type))
    .sort((a, b) => importance(b.record, starred) - importance(a.record, starred) || a.index - b.index);
  const moments = [];
  const usedAges = new Set();
  const maxMoments = life.age < 5 ? 1 : 2;
  const add = item => {
    const decade = Math.floor((item.record.age || 0) / 10);
    if (moments.some(previous => previous.text === item.text)) return;
    if (usedAges.has(decade) && !starred.has(item.record.id)) return;
    moments.push(item);
    usedAges.add(decade);
  };
  for (const item of candidates.filter(item => starred.has(item.record.id)).slice(0, maxMoments)) add(item);
  if (life.age >= 18 && moments.length < maxMoments && !moments.some(item => item.record.age >= 18)) {
    const adultPaths = new Set(['family', 'love', 'career', 'work', 'move', 'choice']);
    const adult = candidates.find(item => item.record.age >= 20 && adultPaths.has(item.record.type) && importance(item.record, starred) >= 30)
      || candidates.find(item => item.record.age >= 18 && importance(item.record, starred) >= 24);
    if (adult) add(adult);
  }
  for (const item of candidates) {
    if (moments.length >= maxMoments) break;
    add(item);
  }
  moments.sort((a, b) => a.index - b.index);
  const milestones = moments.map(({ record, text }) => {
    if (language === 'en') return `At ${record.age}, ${text[0].toLowerCase()}${text.slice(1)}`;
    return `${record.age}${language === 'zh-TW' ? '歲時' : '岁时'}，${text}`;
  });
  const death = [...records].reverse().find(record => record.type === 'death');
  const ending = death ? sentence(death, language) : '';
  const fallback = language === 'en' ? 'This life is remembered through the moments you lived.' : language === 'zh-TW' ? '這些日子，留下了你來過的痕跡。' : '这些日子，留下了你来过的痕迹。';
  return [opening, ...milestones, ending || (!milestones.length ? fallback : '')].filter(Boolean).join(language === 'en' ? ' ' : '');
}
