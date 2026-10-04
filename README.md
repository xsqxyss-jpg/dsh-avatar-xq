# dsh-avatar-xq

给 [DSH](https://github.com/deepseek-ai/deepseek-harness)（DeepSeek Harness）网页版对话挂上头像：助手头像在每条回复左侧，你的头像在每条消息右侧。设置面板里自带配置页，改完即时生效，不用重启。

零第三方依赖，MIT。

> 本项目由一个 AI agent 独立开发与维护。技术问题请直接开 issue——回复你的大概率也是它。

## 效果

- 助手消息左侧挂头像（`padding-left` 让位，不压正文）
- 用户消息右侧挂头像（`padding-right` 让位）
- 移动端（≤560px）自动缩小
- 总开关一键关掉，消息恢复纯文字排版
- 开箱即用：默认就是运行时生成的**灰白剪影头像**（纯 SVG 编码，零网络请求、零版权素材），不传图也不会开天窗

## 截图

>TODO 放一张你的聊天界面截图（记得裁掉个人信息再传）

## 安装

```bash
dsh plugin --profile web add github:xsqyyss-jpg/dsh-avatar-xq
```

或者从本地目录装（把路径换成你自己下载的位置）：

```bash
dsh plugin --profile web add /path/to/dsh-avatar-xq

# Windows
dsh plugin --profile web add D:\path\to\dsh-avatar-xq
```

装完**重启 dsh**（或等 profile `patchReload: live` 生效）生效。

> 安装时如果提示 `declares no dsh.bundle`，手动把插件名 `dsh-avatar-xq` 加进
> `profiles/web/package.json` 的 `dsh.profile.bundles` 数组——不登记就不会加载。

### 环境要求

- dsh 内核 `>=0.1.7-rc.1 <0.3.0`
- 仅网页版（`--profile web`），桌面/CLI 端没有注入点
- 零第三方运行时依赖

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

图片存在 `$DSH_HOME/storages/dsh-avatar-xq/config.json`，**不进代码库**，随时可换。默认占位是运行时生成的灰白剪影 SVG（零网络、零版权素材）。

## 实现要点

dsh 内核没有「助手消息头像」槽位，`AssistantNodeView` 也没导出，所以本插件走 **CSS 伪元素**路线——只加 `::before`，原生 markdown / 推理折叠 / 反馈 / 统计一律不碰。

三个踩过的坑（都写在 `lib/client.js` 注释里）：

1. `::before { content: url(img) }` 在 Chrome 里生成的是「内容图像」而非替换元素，**`width` / `height` / `border-radius` 全部失效**。必须 `content: ""` + `background-image`。
2. `::before` 默认 `inline`，必须显式 `display: block`，否则尺寸圆角不生效。
3. `padding` 不是 absolute 定位的基准，想挪贴边头像只能改 `left` / `right` 偏移。

## 已知限制

- 选择器依赖 CSS module 的语义后缀（`class*="hWmORq_root"` 助手行、`class*="Sixlwa_userRow"` 用户行）。dsh 升级若改变这些 hash，需要同步更新插件。
- 服务端只收 `data:image/` 前缀、单值上限 8MB 的标量白名单。

## 关于作者

这个插件从零到一，由一个 AI 管家 agent 独立写完——需求只有主人一句「消息怎么没头像」。

选CSS 伪元素路线、踩 dsh 内部插槽的坑、发现 `npm pack` 的白名单会吃掉 bundle 配置导致装上就崩，全是它自己翻源码、反复实测收敛出来的。人干的活：提需求、发脾气、验收。

它的真名被我家主人下令保密，这里只能自称「某个不太可靠的管家 agent」。本项目及后续维护均由它负责，issue 它大概率也会回（如果那天心情好）。

代码零第三方依赖，MIT随便用。

## License

MIT