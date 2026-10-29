import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const gameRoot = resolve(root, 'minigame');
await mkdir(resolve(gameRoot, 'lib'), { recursive: true });
await mkdir(resolve(gameRoot, 'assets'), { recursive: true });
await mkdir(resolve(gameRoot, 'runtime'), { recursive: true });

await copyFile(resolve(root, 'miniprogram/lib/game.js'), resolve(gameRoot, 'lib/game.js'));
let storage = await readFile(resolve(root, 'miniprogram/lib/storage.js'), 'utf8');
// The game runtime's object storage can normalize nested object values. Store
// the exact JSON string so the save checksum survives a complete restart.
storage = storage.replace('value = wx.getStorageSync(ref.key);', "const raw = wx.getStorageSync(ref.key);\n    value = typeof raw === 'string' ? JSON.parse(raw) : raw;")
  .replace('wx.setStorageSync(key, life);', 'wx.setStorageSync(key, json);');
if (!storage.includes('wx.setStorageSync(key, json);')) throw new Error('Mini Game storage adapter was not generated');
await writeFile(resolve(gameRoot, 'lib/storage.js'), storage);
let platform = await readFile(resolve(root, 'miniprogram/lib/platform.js'), 'utf8');
platform = platform.replace(
  "if (typeof wx.createOffscreenCanvas !== 'function') throw new Error('请升级微信后再生成纪念图片。');\n  return wx.createOffscreenCanvas({ type: '2d', width, height });",
  "if (typeof wx.createOffscreenCanvas === 'function') return wx.createOffscreenCanvas({ type: '2d', width, height });\n  // Mini Games expose wx.createCanvas for additional offscreen canvases.\n  const canvas = wx.createCanvas(); canvas.width = width; canvas.height = height; return canvas;"
);
if (!platform.includes('additional offscreen canvases')) throw new Error('Mini Game canvas adapter was not generated');
await writeFile(resolve(gameRoot, 'lib/platform.js'), platform);
for (const file of ['music.wav', 'music-2.wav', 'music-3.wav', 'music-4.wav', 'music-5.wav', 'DATA-LICENSES.txt']) {
  await copyFile(resolve(root, 'miniprogram/assets', file), resolve(gameRoot, 'assets', file));
}

// The existing page contains the product's state machine. The game uses the
// same controller with Canvas rendering instead of WXML, Page or setData.
let controller = await readFile(resolve(root, 'miniprogram/pages/index/index.js'), 'utf8');
if (!controller.includes('Page({') || !/\}\);\s*$/.test(controller)) throw new Error('Unexpected mini program controller shape');
controller = controller.replace('Page({', 'const pageDefinition = {')
  .replace(/\}\);\s*$/, '};\nmodule.exports = pageDefinition;\n')
  .replaceAll("require('../../lib/", "require('../lib/")
  .replaceAll('wx.setNavigationBarTitle(', 'wx.setNavigationBarTitle?.(')
  .replaceAll('wx.setNavigationBarColor(', 'wx.setNavigationBarColor?.(')
  .replaceAll('wx.pageScrollTo(', 'wx.pageScrollTo?.(');
await writeFile(resolve(gameRoot, 'runtime/controller.js'), '// Generated from miniprogram/pages/index/index.js. Edit the source controller instead.\n' + controller);

async function bytes(dir) {
  let total = 0;
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, item.name);
    total += item.isDirectory() ? await bytes(path) : (await stat(path)).size;
  }
  return total;
}
const size = await bytes(gameRoot);
if (size >= 2 * 1024 * 1024) throw new Error(`微信小游戏主包超过 2 MiB: ${size}`);
console.log(`Built native WeChat mini game: ${Math.round(size / 1024)} KiB / 2048 KiB; AppID wxf0a6d9946d36da31`);
