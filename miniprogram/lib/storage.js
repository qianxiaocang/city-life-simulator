const SAVE_KEY = 'one-in-1-4-billion.mini.v1';
const PREFIX = SAVE_KEY + '.life.';
const DIRECT_LIMIT = 900 * 1024;
const clone = value => JSON.parse(JSON.stringify(value));
function utf8Bytes(text) {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i++; }
    else bytes += 3;
  }
  return bytes;
}
function signature(text) {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { const code = text.charCodeAt(i); a = Math.imul(a ^ code, 16777619); b = Math.imul(b, 33) ^ code; }
  return `${text.length}-${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`;
}
function normalize(source, defaults) {
  return { ...clone(defaults), ...source, version: 1, settings: { ...defaults.settings, ...source.settings }, current: source.current || null, history: Array.isArray(source.history) ? source.history.slice(0, 12) : [] };
}
function loadRecord(ref) {
  if (!ref || typeof ref.key !== 'string' || !ref.key.startsWith(PREFIX)) throw new Error('人生存档索引损坏。');
  let value;
  if (ref.format === 'chunks') {
    if (!Array.isArray(ref.chunks) || !ref.chunks.length) throw new Error('人生存档分片索引损坏。');
    const pieces = ref.chunks.map(key => {
      if (typeof key !== 'string' || !key.startsWith(PREFIX)) throw new Error('人生存档分片索引损坏。');
      const piece = wx.getStorageSync(key);
      if (typeof piece !== 'string' || !piece) throw new Error('人生存档分片缺失。');
      return piece;
    });
    const json = pieces.join('');
    if (signature(json) !== ref.signature) throw new Error('人生存档校验未通过。');
    value = JSON.parse(json);
  } else {
    value = wx.getStorageSync(ref.key);
    if (!value || typeof value !== 'object') throw new Error('人生存档缺失。');
    if (signature(JSON.stringify(value)) !== ref.signature) throw new Error('人生存档校验未通过。');
  }
  return value;
}
function readStore(defaults) {
  const metadata = wx.getStorageSync(SAVE_KEY);
  if (!metadata || metadata.version !== 1) return clone(defaults);
  if (metadata.storageVersion !== 2) return normalize(metadata, defaults);
  const records = metadata.records || {};
  const loaded = new Map();
  const get = id => {
    if (!id) return null;
    if (!loaded.has(id)) {
      const life = loadRecord(records[id]);
      if (life.id !== id) throw new Error('人生存档身份不匹配。');
      loaded.set(id, life);
    }
    return loaded.get(id);
  };
  return normalize({ version: 1, settings: metadata.settings || {}, savedMomentToastCount: metadata.savedMomentToastCount || 0, current: get(metadata.currentId), history: (metadata.historyIds || []).map(get) }, defaults);
}
function recordKeys(ref) { return ref && ref.format === 'chunks' ? [ref.key, ...ref.chunks] : ref ? [ref.key] : []; }
function safelyRemove(key) {
  if (typeof key !== 'string' || !key.startsWith(PREFIX)) return;
  try { wx.removeStorageSync(key); } catch (error) { console.warn('Could not remove an obsolete life storage key', error); }
}
function writeStore(store) {
  if (!store || store.version !== 1) throw new Error('无法保存不支持的存档版本。');
  const old = wx.getStorageSync(SAVE_KEY);
  const oldRecords = old && old.storageVersion === 2 ? old.records || {} : {};
  const lives = new Map();
  const history = Array.isArray(store.history) ? store.history.slice(0, 12) : [];
  for (const life of [...history, store.current].filter(Boolean)) {
    if (!life.id || typeof life.id !== 'string') throw new Error('人生记录缺少身份，无法保存。');
    lives.set(life.id, life);
  }
  const records = {}, created = [];
  try {
    for (const [id, life] of lives) {
      const json = JSON.stringify(life), checksum = signature(json), previous = oldRecords[id];
      if (previous && previous.signature === checksum) { records[id] = previous; continue; }
      const key = PREFIX + encodeURIComponent(id) + '.' + checksum;
      if (utf8Bytes(json) <= DIRECT_LIMIT) {
        created.push(key); wx.setStorageSync(key, life);
        records[id] = { key, format: 'json', signature: checksum, bytes: utf8Bytes(json) };
      } else {
        // String chunks are far below WeChat's 1 MiB per-key budget, even with
        // Chinese UTF-8 characters and JSON string escaping. Never truncate logs.
        const chunks = [];
        for (let start = 0; start < json.length; start += 220000) {
          const chunkKey = key + '.part.' + chunks.length;
          created.push(chunkKey); wx.setStorageSync(chunkKey, json.slice(start, start + 220000)); chunks.push(chunkKey);
        }
        created.push(key); wx.setStorageSync(key, { format: 'chunks', chunks });
        records[id] = { key, format: 'chunks', chunks, signature: checksum, bytes: utf8Bytes(json) };
      }
    }
    const metadata = {
      version: 1, storageVersion: 2, settings: store.settings || {},
      currentId: store.current && store.current.id || null,
      historyIds: [...new Set(history.map(life => life.id))],
      savedMomentToastCount: Number(store.savedMomentToastCount) || 0,
      records
    };
    // This is the commit point. Existing metadata always references intact old
    // records until every new/changed record has been successfully written.
    wx.setStorageSync(SAVE_KEY, metadata);
  } catch (error) {
    const protectedKeys = new Set(Object.values(oldRecords).flatMap(recordKeys));
    for (const key of created) if (!protectedKeys.has(key)) safelyRemove(key);
    throw error;
  }
  const keep = new Set(Object.values(records).flatMap(recordKeys));
  for (const ref of Object.values(oldRecords)) for (const key of recordKeys(ref)) if (!keep.has(key)) safelyRemove(key);
  return store;
}
module.exports = { SAVE_KEY, readStore, writeStore };
