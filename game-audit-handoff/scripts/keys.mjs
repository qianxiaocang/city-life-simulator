import { readFileSync } from 'node:fs';
const s = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const pre of process.argv.slice(3)) {
  const hits = Object.keys(s.dist).filter((k) => k.startsWith(pre));
  process.stdout.write(pre + ' -> ' + hits.length + ' : ' + hits.slice(0, 10).join(' , ') + '\n');
  for (const h of hits.slice(0, 4)) process.stdout.write('    ' + h + ' = ' + JSON.stringify(s.dist[h]) + '\n');
}
process.stdout.write('RATES: ' + JSON.stringify(s.ratesPct) + '\n');
process.stdout.write('MEANS: ' + JSON.stringify(Object.fromEntries(Object.entries(s.means).slice(0, 12))) + '\n');
