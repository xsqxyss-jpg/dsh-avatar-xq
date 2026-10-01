# dsh-avatar-xq-xq

给 [DSH](https://github.com/deepseek-ai/deepseek-harness)（DeepSeek Harness）网页版对话挂上头像：助手头像在每条回复左侧，你的头像在每条消息右侧。设置面板里自带配置页，改完即时生效，不用重启。

零第三方依赖，MIT。

## 效果

- 助手消息左侧挂头像（`padding-left` 让位，不压正文）
- 用户消息右侧挂头像（`padding-right` 让位）
- 移动端（≤560px）自动缩小
- 总开关一键关掉，消息恢复纯文字排版

## 安装

```bash
dsh plugin --profile web add github:<owner>/dsh-avatar-xq-xq
```

本地开发：

```bash
dsh plugin --profile web add /path/to/dsh-avatar
```

装完**重启 dsh**（或等 profile `patchReload: live` 生效）生效。

> 安装时如果提示 `declares no dsh.bundle`，手动把插件名加进
> `profiles/web/package.json` 的 `dsh.profile.bundles` 数组——不登记就不会加载。

## 设置

设置面板左侧导航 → **消息头像**：

| 项 | 说明 |
|---|---|
| 启用消息头像 | 总开关 |
| 助手头像 / 你的头像 | 上传图片 → 进裁剪框（拖动选位置、100–300% 缩放）→ 按正方形裁成 256×256 PNG |
| 头像尺寸 | 20–72px |
| 头像与文字的间距 | 0–40px |
| 圆角 | 0 = 方形，一半 = 胶囊，拉满 = 正圆 |
| 助手头像离左边框 / 你的头像离右边框 | 0–32px 微调 |

图片存在 `$DSH_HOME/storages/dsh-avatar/config.json`，**不进代码库**，随时可换。默认占位是运行时生成的灰白剪影 SVG（零网络、零版权素材）。

## 实现要点

dsh 内核没有「助手消息头像」槽位，`AssistantNodeView` 也没导出，所以本插件走 **CSS 伪元素**路线——只加 `::before`，原生 markdown / 推理折叠 / 反馈 / 统计一律不碰。

三个踩过的坑（都写在 `lib/client.js` 注释里）：

1. `::before { content: url(img) }` 在 Chrome 里生成的是「内容图像」而非替换元素，**`width` / `height` / `border-radius` 全部失效**。必须 `content: ""` + `background-image`。
2. `::before` 默认 `inline`，必须显式 `display: block`，否则尺寸圆角不生效。
3. `padding` 不是 absolute 定位的基准，想挪贴边头像只能改 `left` / `right` 偏移。

## 已知限制

- 选择器依赖 CSS module 的语义后缀（`class*="hWmORq_root"` 助手行、`class*="Sixlwa_userRow"` 用户行）。dsh 升级若改变这些 hash，需要同步更新插件。
- 服务端只收 `data:image/` 前缀、单值上限 8MB 的标量白名单。

## License

MIT