# 追思馆云开发

当前小游戏 AppID：`wxed5e2570a223e4a7`。
客户端环境配置在 `miniprogram/lib/memorial-cloud.js`，构建时同步到小游戏。

## 部署

1. 在当前小游戏的微信云开发控制台确认环境 `cloud1-d8gwoxbv9568494b0` 已开通且可使用云函数和文档数据库。
2. 创建文档集合 `memorial_lives` 和 `memorial_lights`，客户端读写权限均设为关闭（仅通过云函数访问）。
3. 执行 `node scripts/build-minigame.mjs`，在开发者工具中对 `minigame/cloudfunctions/memorial` 上传并部署，选择云端安装依赖。
4. 验证安放、重新打开追思馆、点亮烛光。安放失败可再次点击，不会提前标记已安放；同一微信用户的同一人生只写入一次。

云端列表对所有登录玩家展示，详情包含模拟人生记录和玩家主动保存的告别文字。未点击安放的人生不会上传。已有本地馆藏不会自动公开上传。

2026-11-02：已通过 CloudBase MCP 创建两个集合并设置 ADMINONLY 权限；`memorial` 云函数已部署，状态 Active / Available，云端调用成功执行身份校验。完整上传与读取仍需在微信用户会话中验证。
