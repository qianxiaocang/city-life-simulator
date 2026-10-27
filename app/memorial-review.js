import { valueText } from './i18n.js';

const wording = (language, zhCN, zhTW, en) => valueText({ zhCN, zhTW, en }, language);
const label = (value, language) => valueText(value, language) || '';

export function memorialReview(life, language = 'zh-CN') {
  const written = typeof life.farewell === 'string' ? life.farewell.trim().slice(0, 300) : '';
  if (written) return { text: written, origin: 'written' };

  const age = Math.max(0, Number(life.age) || 0);
  const birthplace = label(life.born?.name, language);
  const finalCity = label(life.location?.name, language) || birthplace;
  const job = label(life.lastJob?.name || life.job?.name, language);
  const children = life.family?.children?.length || 0;
  const cities = new Set((life.visited || []).map(place => place?.id || label(place?.name, language)).filter(Boolean)).size;
  const totals = life.totals || {};

  const opening = wording(language,
    `从${birthplace}出发，在${finalCity}走完了${age}岁的一生。`,
    `從${birthplace}出發，在${finalCity}走完了${age}歲的一生。`,
    `From ${birthplace} to ${finalCity}, this life lasted ${age} years.`);

  let path;
  if (age < 16) path = wording(language,
    '短暂的年岁里，也有成长、相遇和被记住的日常。',
    '短暫的年歲裡，也有成長、相遇和被記住的日常。',
    'Even a short life held moments of growing, meeting others and being remembered.');
  else if (job) path = wording(language,
    `曾从事${job}${children ? `，养育了${children}个孩子` : ''}。`,
    `曾從事${job}${children ? `，養育了${children}個孩子` : ''}。`,
    `Worked as ${job}${children ? ` and raised ${children} ${children === 1 ? 'child' : 'children'}` : ''}.`);
  else if (children) path = wording(language,
    `陪伴${children}个孩子成长，日常的照料也构成了这段人生。`,
    `陪伴${children}個孩子成長，日常的照料也構成了這段人生。`,
    `Raised ${children} ${children === 1 ? 'child' : 'children'}; everyday care was part of this life.`);
  else path = wording(language,
    '求学、谋生与身边的人，构成了独属于此人的旅程。',
    '求學、謀生與身邊的人，構成了獨屬於此人的旅程。',
    'Learning, making a living and the people nearby shaped a singular journey.');

  let reflection;
  if (cities > 1) reflection = wording(language,
    `走过${cities}个地方，留下的不只是行程，也有每一次重新安家的勇气。`,
    `走過${cities}個地方，留下的不只是行程，也有每一次重新安家的勇氣。`,
    `Across ${cities} places, the journey carried the courage to begin again.`);
  else if ((totals.family || 0) > (totals.work || 0) && (totals.family || 0) >= 2) reflection = wording(language,
    '这段人生把更多时间留给了陪伴，亲近的人记得那些平常的日子。',
    '這段人生把更多時間留給了陪伴，親近的人記得那些平常的日子。',
    'Much of this life was spent together; loved ones remember the ordinary days.');
  else if ((totals.learning || 0) >= 3) reflection = wording(language,
    '始终愿意学习和尝试，使不同年岁的生活各有新的开端。',
    '始終願意學習和嘗試，使不同年歲的生活各有新的開端。',
    'A willingness to learn and try gave each stage a new beginning.');
  else reflection = wording(language,
    '那些平凡又具体的日子，最终拼成了不可替代的一生。',
    '那些平凡又具體的日子，最終拼成了不可替代的一生。',
    'Ordinary, particular days made this a life that cannot be repeated.');

  return { text: [opening, path, reflection].join(language === 'en' ? ' ' : ''), origin: 'generated' };
}
