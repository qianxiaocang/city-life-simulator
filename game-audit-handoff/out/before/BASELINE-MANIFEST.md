# 改前基线存档

这三份文件于 2026-10-28 00:03:38（工作区本地时间）归档，在本轮修改游戏代码前生成。它们保留原审计探针口径；纠正探针但仍使用同一旧引擎的对照另存于 `../before-corrected-era.json`、`../before-corrected-stage.json` 与 `../before-corrected-marriage.json`，不覆盖此基线。

| 文件 | SHA-256 |
|---|---|
| `life-stage.md` | `62918527d9fca25b3dfbded8e818f19957fb0256d093ec0ce4019b78e4a9d5ee` |
| `era-sweep.json` | `51273215b063242ee81ba50c9f2ccd2ed1397b69f9c17703eb474e64ecc9265f` |
| `marriage-true.json` | `602d288447bb9c99b03cdd5ec647f1efe816deacbb352e3c90751599f3636f06` |

原网站 `main.js` 标识 SHA-256：`f703243ce9662d669e7e5f020dae22ff1e190489794c07d6752f3a1537a6721c`；无头切片 `shipped/engine-shipped.mjs` SHA-256：`8c5839d7b6d6a1b146207019101efc09acf9e9cce78a914a6d485863e1d8198c`。

存档对应原包复现顺序：`stage-collect2.mjs 40000`、`era-sweep.mjs 24`、`marriage-true.mjs 6000`、`marriage-at-appear.mjs 4000`、`life-stage.mjs`、`stage-collect2.mjs --trace st1201 past 1955`。
