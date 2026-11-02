# 平行人生云开发

小游戏 AppID：`wxed5e2570a223e4a7`，环境：`cloud1-d8gwoxbv9568494b0`。

- `memorial` 云函数使用 `cloud.getWXContext().OPENID` 取得可信身份。客户端不得指定 OpenID、owner 或 _openid；接口拒绝这些参数。
- `publish` 仅接受完整的已结束人生。服务器存入 `owner` 和 `openid`，两者均来自微信会话，忽略存档内的身份字段。
- 新记录 ID 为 46 位大小写字母及数字：`Pp0` 前缀加 SHA-256 转 base62 后的 43 位内容。同一用户同一人生重复上传返回相同 ID。
- 寄语按 Unicode 字符最多 200 字，前后端清理脚本标签、HTML 标签及控制字符，只以 Canvas / WXML 纯文本显示。
- `stats` 返回当前身份对应范围的总数与缓存隔离键；`list` 每页固定 8 条并返回 `total`、`hasMore`。`scope=mine` 的查询条件由服务器生成，客户端不能提交用户过滤条件。
- 本地缓存按账号和列表范围隔离；先比较服务器总数，总数相同则复用缓存页，总数变化则清空旧页重取，成功上传或修改寄语会失效本机缓存。
- `memorial_lives`、`memorial_lights`、`memorial_aliases` 均为 ADMINONLY；客户端只能通过云函数访问。
- 查询索引：`createdAt` 降序、`owner` 升序与 `createdAt` 降序的复合索引。

2026-11-03 已迁移 3 条旧记录，保留所属用户，并使用 aliases 为旧分享 ID 保留读取映射。一次性迁移函数源码在 `scripts/cloud-migrations/parallelMigration20261102`，运行后删除云端临时函数。

构建：`node scripts/build-minigame.mjs`。部署 `minigame/cloudfunctions/memorial` 时选择云端安装依赖。

## 1.4.0 交付状态

云函数、集合权限、查询索引与旧 ID 映射已部署，客户端已通过开发者工具 CLI 上传为微信开发版本 1.4.0。
设置体验版需要微信公众平台版本管理页面；本次自动化访问该站点被浏览器安全策略阻断，故未将开发版本标记为体验版，也未提交正式版审核。
