import { valueText } from './i18n.js';
import { locations } from './data/locations.js';

const regionNames = {
  hongkong: { zhCN: '中国香港', zhTW: '中國香港', en: 'Hong Kong, China' },
  macau: { zhCN: '中国澳门', zhTW: '中國澳門', en: 'Macao, China' },
  taiwan: { zhCN: '中国台湾', zhTW: '中國臺灣', en: 'Taiwan, China' }
};

export function locationLabel(place, language = 'zh-CN') {
  if (!place) return '';
  const label = value => valueText(value, language);
  const parts = [];
  if (regionNames[place.region]) parts.push(label(regionNames[place.region]));
  else if (place.province) parts.push(label(place.province));
  if (place.region === 'taiwan' && place.province) parts.push(label(place.province));
  if (place.parentId && (place.region === 'taiwan' || (place.region === 'mainland' && !/市$/.test(valueText(place.name, 'zh-CN'))))) {
    const parent = locations.find(item => item.id === place.parentId);
    if (parent) parts.push(label(parent.name));
  }
  parts.push(label(place.name));
  return parts.filter((part, index) => part && part !== parts[index - 1]).join(' · ');
}

export function birthPlaceNarrative(text, place, language = 'zh-CN') {
  const shortName = valueText(place?.name, language);
  return shortName ? String(text || '').replace(shortName, locationLabel(place, language)) : String(text || '');
}
