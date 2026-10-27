本包【不含游戏源码】——因为接手方（Codex）已有完整源码。

唯一必须做的第一件事：把 GAME_SRC 指向你仓库里含 engine.js 的那个目录，跑源码核对：

    GAME_SRC=/你的仓库/src node verify-repo.mjs

18 条锚点全部 PASS  → 这份源码就是被审计的那份，按 AGENTS.md 的 B0→B5 执行。
出现 FAIL / MISSING → 源码与线上审计版本有差异：先只读 verify-repo.mjs 的输出，
                     逐条比对差异处，再决定移植还是重写；不要机械套用指南里的上下文。

指南中形如 data/development.js 的路径对应你仓库里的同名模块，映射见 FILE-MAP.md；
行号仅作规模参考，一律按符号名定位。
