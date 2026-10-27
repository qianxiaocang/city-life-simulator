import { CHINA_LAW_SOURCES } from './data/china-law.js';
import { CHINA_SOCIETY_SOURCES, CHINA_JOBS, CULTURAL_EVENTS } from './data/china-society.js';
import { HISTORY_SOURCES, HISTORY_EVENTS, HISTORY_META } from './data/history.js';
import { DEVELOPMENT_SOURCES } from './data/development.js';
export const SOURCE_CATALOG=[...new Map([...CHINA_LAW_SOURCES,...CHINA_SOCIETY_SOURCES,...Object.values(HISTORY_SOURCES),...DEVELOPMENT_SOURCES].map(source=>[source.id,source])).values()];
export { HISTORY_EVENTS, HISTORY_META };
export const MODEL_SUMMARY={version:'1.1.0',checkedAt:'2026-10-25',historicalEvents:HISTORY_EVENTS.length,sources:SOURCE_CATALOG.length,jobs:CHINA_JOBS.length,culturalScenarios:CULTURAL_EVENTS.length};
export function referencesFor(entry){
  const ids=entry?.sourceIds||entry?.data?.sourceIds||[];
  const urls=[...(entry?.sourceUrls||entry?.data?.sourceUrls||[]),...ids.map(id=>SOURCE_CATALOG.find(source=>source.id===id)?.url).filter(Boolean)];
  return [...new Set(urls)].filter(url=>/^https:\/\/[^<>"'\s]+$/.test(url));
}
