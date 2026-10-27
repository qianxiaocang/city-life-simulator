import { build } from 'esbuild';
import { mkdir, rm, readdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const app = resolve(root, 'app');
const output = resolve(root, 'dist');
const releases = resolve(root, 'release');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
await stat(resolve(app, 'index.html'));
await stat(resolve(app, 'main.js'));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
async function copyTree(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || (relative(app, from) === 'data' && entry.name === 'source')) continue;
    const source = resolve(from, entry.name), destination = resolve(to, entry.name);
    if (entry.isDirectory()) await copyTree(source, destination);
    else if (entry.isFile()) await copyFile(source, destination);
  }
}
await copyTree(app, output);
await copyTree(resolve(root, 'docs'), resolve(output, 'docs'));
const bundled = await build({
  entryPoints: [resolve(app, 'main.js')], bundle: true, write: false,
  outfile: resolve(output, 'standalone-bundle.js'), format: 'iife', target: ['es2020'],
  platform: 'browser', legalComments: 'inline', charset: 'utf8',
  loader: { '.svg': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl' },
  define: { __BUILD_VERSION__: JSON.stringify(pkg.version) },
});
let html = await readFile(resolve(app, 'index.html'), 'utf8');
const script = bundled.outputFiles.find(file => file.path.endsWith('.js'))?.text;
if (!script) throw new Error('The standalone JavaScript bundle was not generated.');
await writeFile(resolve(output, 'main.js'), script);
const assetMime = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff' };
async function assetData(path, directory = app) {
  const bytes = await readFile(resolve(directory, path.replace(/^\.\//, '').replace(/^\//, '')));
  return `data:${assetMime[extname(path).toLowerCase()] || 'application/octet-stream'};base64,${bytes.toString('base64')}`;
}
const linkedStyles = [...html.matchAll(/<link\b(?=[^>]*\brel=["']stylesheet["'])([^>]*?)\bhref=["']([^"']+)["'][^>]*>/gi)];
for (const match of linkedStyles) {
  if (/^(?:https?:|\/\/)/i.test(match[2])) throw new Error(`Standalone builds require a local stylesheet: ${match[2]}`);
  const stylesheet = resolve(app, match[2].replace(/^\.\//, '').replace(/^\//, ''));
  let css = await readFile(stylesheet, 'utf8');
  for (const asset of [...css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)]) {
    if (/^(?:data:|#)/i.test(asset[1])) continue;
    if (/^(?:https?:|\/\/)/i.test(asset[1])) throw new Error(`Standalone builds require a local CSS asset: ${asset[1]}`);
    const resolvedAsset = new URL(asset[1], `file://${stylesheet}`);
    css = css.replace(asset[0], `url("${await assetData(fileURLToPath(resolvedAsset), '/')}")`);
  }
  html = html.replace(match[0], `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`);
}
for (const asset of [...html.matchAll(/<(?:img|link)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/gi)]) {
  if (/^(?:data:|https?:|\/\/|#)/i.test(asset[1]) || /\brel=["'](?:stylesheet|manifest|modulepreload)["']/i.test(asset[0])) continue;
  html = html.replace(asset[0], asset[0].replace(asset[1], await assetData(asset[1])));
}
const bundleCss = bundled.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n');
if (bundleCss) html = html.replace('</head>', `<style>${bundleCss}</style>\n</head>`);
const entryScript = /<script\b[^>]*\bsrc=["'](?:\.\/|\/)?main\.js["'][^>]*>\s*<\/script>/i;
if (!entryScript.test(html)) throw new Error('app/index.html must contain a script whose src is ./main.js.');
html = html.replace(entryScript, `<script>\n${script.replace(/<\/script/gi, '<\\/script')}\n</script>`);
html = html.replace(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>/gi, '');
await writeFile(resolve(output, 'standalone.html'), html);
for (const file of ['部署说明.md', 'data-sources.md']) {
  try { await copyFile(resolve(root, file), resolve(output, file)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await writeFile(resolve(output, 'build-info.json'), JSON.stringify({ name: pkg.name, version: pkg.version, builtAt: new Date().toISOString(), localEntry: 'standalone.html', serverEntry: 'index.html' }, null, 2) + '\n');

// A small standards-compliant ZIP writer keeps the release task portable: no zip CLI or Python is required.
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
async function listFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(path));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}
async function zipFiles(paths, base) {
const localParts = [], directoryParts = [];
let offset = 0;
for (const path of paths) {
  const name = Buffer.from(relative(base, path).split('\\').join('/'), 'utf8');
  const content = await readFile(path), compressed = deflateRawSync(content), crc = crc32(content);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10);
  central.writeUInt16LE(0x21, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
  localParts.push(local, name, compressed); directoryParts.push(central, name);
  offset += local.length + name.length + compressed.length;
}
const directory = Buffer.concat(directoryParts), end = Buffer.alloc(22), count = directoryParts.length / 2;
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
return Buffer.concat([...localParts, directory, end]);
}
await mkdir(releases, { recursive: true });
const releaseFile = resolve(releases, `${pkg.name}-v${pkg.version}.zip`);
await writeFile(releaseFile, await zipFiles(await listFiles(output), output));
const sourceFile=resolve(releases, `${pkg.name}-source-v${pkg.version}.zip`);
const rootFiles=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','README.md','部署说明.md','data-sources.md','design-qa.md','Dockerfile','compose.yaml','.dockerignore','.gitignore'];
const sourcePaths=rootFiles.map(name=>resolve(root,name));
for(const directory of ['app','scripts','tests','docs','deploy','game-audit'])sourcePaths.push(...await listFiles(resolve(root,directory)));
for(const file of ['qa/verification.md','qa/verification-v1.1.md','qa/verification-v1.3.md'])try{await stat(resolve(root,file));sourcePaths.push(resolve(root,file));}catch(error){if(error.code!=='ENOENT')throw error;}
for(const entry of await readdir(resolve(root,'qa'),{withFileTypes:true}))if(entry.isFile()&&entry.name.startsWith('v1.3-'))sourcePaths.push(resolve(root,'qa',entry.name));
await writeFile(sourceFile,await zipFiles(sourcePaths.sort(),root));
const artifactPaths=[releaseFile,sourceFile,resolve(output,'standalone.html')];
const artifacts=[];
for(const path of artifactPaths){const bytes=await readFile(path);artifacts.push({file:relative(root,path),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await writeFile(resolve(releases,'SHA256SUMS.txt'),artifacts.map(item=>item.sha256+'  '+item.file).join('\n')+'\n');
await writeFile(resolve(releases,'artifacts.json'),JSON.stringify({version:pkg.version,artifacts},null,2)+'\n');
const standaloneSize = (await stat(resolve(output, 'standalone.html'))).size;
console.log(`Built dist/index.html and dist/standalone.html (${Math.round(standaloneSize / 1024)} KiB).`);
console.log(`Release: ${releaseFile}`);
