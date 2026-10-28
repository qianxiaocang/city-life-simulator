// The same audit scripts can inspect the repository source as well as the
// immutable shipped snapshot. This adapter never changes the snapshot.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as engine from '../app/engine.js';
import { locations } from '../app/data/locations.js';
import { legalMarriageAge, retirementRule } from '../app/data/china-law.js';
import { HISTORY_EVENTS } from '../app/data/history.js';

const sources = [
  '../app/engine.js', '../app/career.js', '../app/education.js',
  '../app/economy.js', '../app/history-runtime.js', '../app/family-model.js',
  '../app/data/china-law.js', '../app/data/china-society.js',
  '../app/data/development.js', '../app/data/history.js',
];
const hash = createHash('sha256');
for (const source of sources) {
  hash.update(source);
  hash.update(readFileSync(fileURLToPath(new URL(source, import.meta.url))));
}
globalThis.__AUDIT_ENGINE_LABEL__ = `source-${hash.digest('hex').slice(0, 16)}`;
globalThis.__ENGINE_SHIPPED__ = { ...engine, locations, legalMarriageAge, retirementRule, HISTORY_EVENTS };
