// Starred records take the places of automatic picks in their decade.
export function selectLifeMoments(life) {
  const log = Array.isArray(life?.log) ? life.log : [];
  const byId = new Map(log.map(event => [event.id, event]));
  const saved = [...new Set(life?.stars || [])].map(id => byId.get(id)).filter(Boolean);
  const savedIds = new Set(saved.map(event => event.id));
  const candidates = log.filter(event => ['birth', 'education', 'love', 'family', 'career', 'move', 'work', 'asset', 'decision', 'warm'].includes(event.type));
  const score = event => {
    const words = event.text?.zhCN || '';
    let value = { birth: 100, education: 24, love: 21, family: 18, career: 22, move: 15, work: 17, decision: 13, warm: 3, asset: 1 }[event.type] || 0;
    if (/毕业|出生了|结婚|退休|搬到|开始了|获得|取得|购置|安排了/.test(words)) value += 35;
    if (/未能|困难|失去|失败|减少|估值/.test(words)) value -= 30;
    return value + event.age * .002;
  };
  const chosen = [...saved];
  const sameRecord = (left, right) => left.id === right.id ||
    (left.age === right.age && left.text?.zhCN && left.text.zhCN === right.text?.zhCN);
  for (let decade = 0; decade <= Math.floor((life?.age || 0) / 10); decade++) {
    const inDecade = chosen.filter(event => Math.floor(event.age / 10) === decade);
    const ranked = candidates.filter(event => Math.floor(event.age / 10) === decade && !savedIds.has(event.id))
      .sort((a, b) => score(b) - score(a));
    for (const event of ranked) {
      if (inDecade.length >= 2) break;
      if (chosen.some(item => sameRecord(item, event))) continue;
      if (inDecade.length && Math.abs(event.age - inDecade[0].age) < 2) continue;
      if (inDecade.length && score(event) < 48) continue;
      chosen.push(event);
      inDecade.push(event);
    }
  }
  return chosen.sort((a, b) => a.age - b.age || a.year - b.year || a.id.localeCompare(b.id));
}
