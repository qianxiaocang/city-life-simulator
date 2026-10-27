# 音乐与语言切换移动端验证

日期：2026-10-27。

- `node --check app/main.js`、`git diff --check`：通过。
- `node --test`：95/95 通过。
- `node scripts/build.mjs`：成功生成 `dist/index.html`、`dist/standalone.html` 和发布 ZIP。
- 浏览器 320px、390px 宽度：首页无横向溢出；语言弹层完整显示，三项高度均为 44px。
- 语言切换到英文后，页面标题与音乐按钮的无障碍说明随语言更新；点击弹层外部可关闭菜单。
- 音乐开启：绿色背景、音符跳动、声波与外圈动画，`aria-pressed=true`；关闭：浅色背景、轻微摆动，`aria-pressed=false`。
- 390px 游戏页：悬浮按钮在底部时间控制栏上方，页面无横向溢出。

截图：[语言菜单](mobile-language-picker-390.jpg)、[音乐开启](mobile-floating-music-on-390.jpg)、[游戏页](mobile-floating-music-life-390.jpg)。
