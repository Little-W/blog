---
title: 音乐与 MV 系统说明
sidebar_label: 音乐与 MV 系统
---

# 音乐与 MV 系统

音乐页是一套静态站前端、B 站受限解析服务和本地维护工具组成的系统。它的目标是让站点能展示本地音乐库和 Project SEKAI MV，同时不把 B 站登录 Cookie、管理员令牌或任意可滥用的代理能力交给浏览器。

系统保留三个运行形态：日常开发可用本地解析器；Netlify 静态站可通过同源 Function 提供解析；也可以把静态站和接口放进 Cloudflare Worker。三种形态的前端接口保持一致，部署方式可以替换而无需改音乐页面。

## 功能范围

- 音乐页按歌单展示曲目，支持自定义播放列表、HQ/SQ/Hi-Res 选择、搜索和显示数量设置；
- MV 列表支持组合标签横向滚动、歌名搜索、网格/列表视图与观看状态；
- MV 播放器从 B 站实际返回的 DASH 轨道生成画质菜单，只有源站提供时才显示 1080P、1080P60、2K、4K、HDR 等选项；
- 低画质优先尝试 BiliAnalysis 风格的单段 MP4，无法获得同档位 MP4 时无缝回退 DASH；
- 播放器、MV 视图、分组、主题、音量、循环方式和特效帧率写入浏览器本地存储；
- 全站浅色/深色切换使用一层合成遮罩，避免对大量 DOM 节点逐一做颜色过渡；
- Live2D Cubism R5 运行时由构建脚本从 `vendor/` 打包至静态资源目录，避免手工维护生成文件。

## 目录说明

| 位置 | 作用 |
| --- | --- |
| `src/pages/music/` | 音乐页面的 React 骨架和页面布局样式。 |
| `src/pages/settings/` | 显示设置：主题、特效及帧率限制。 |
| `static/custom/js/aplayer.js` | 音乐列表、APlayer、MV 列表、解析请求、画质切换和本地设置逻辑。 |
| `static/custom/css/` | APlayer、Video.js、MV 卡片、深色模式和全局主题遮罩样式。 |
| `static/data/` | JSON-streaming 格式的音乐、MV、分类与 B 站来源数据。 |
| `scripts/import-bilibili-season.mjs` | 从指定 B 站合集更新 `mv_bilibili.0.jsonl`。 |
| `scripts/build-bili-parser-catalog.mjs` | 从 MV 数据生成后端白名单目录。 |
| `local-bili-parser/` | 仅监听本机回环地址的解析服务。 |
| `cloudflare-bili-worker/` | Cloudflare Worker 解析与静态资源托管方案。 |
| `tools/bili_qr_login_gui.py` | Netlify 后端扫码登录的图形化管理工具。 |
| `worker-demo/` | 不访问 B 站的本地 Range/媒体代理验证沙盒。 |
| `vendor/live2d-cubism-r5/` | Live2D Cubism R5 上游运行时源文件与许可证。 |

## 前端数据流

```text
JSON-streaming 数据文件
        │
        ├── 音乐列表 / APlayer
        └── MV 卡片 ──点击或预取──> /api/resolve
                                          │
                              短时 DASH 清单 + 实际轨道
                                          │
                      快速 MP4（可用时）或 Video.js DASH
                                          │
                                   B 站 UPOS CDN
```

页面只拿到短时媒体 URL 和播放清单，绝不会拿到 B 站登录 Cookie。解析服务也只接受收录在 MV 目录内的 BVID 与分 P，不能把接口当作任意 URL 的开放代理。

## 画质与播放策略

1. 页面请求 `/api/resolve?bvid=…&p=…`。
2. 后端以管理员已登录的会话请求 B 站 `x/player/playurl`，使用 `fnval=4048` 读取 DASH 视频和音频轨道。
3. 后端按实际轨道生成菜单，并保留轨道的分辨率、编码、码率及初始化范围。画质不是写死的；没有 1080P 的源不会显示 1080P。
4. 标准档位会额外尝试 HTML5 `durl` 单段 MP4。仅当接口返回**同一档位**且只有一个分段时，播放器才使用该快速源；降档或多分段结果会明确回退原画质 DASH。
5. DASH 视频和音频分轨由 Video.js 组合播放。Netlify 部署会优先选择经实测更快的国内 UPOS 镜像；若镜像失败，播放器会切换回 B 站原始节点。

这样可以兼顾低画质的快速启动与高画质、60fps、2K、4K 的真实可用档位。

## MV 数据维护

当前导入器读取 UP 主 `13148307` 的合集 `1547037`。执行以下命令会拉取合集全部分页、去重、清理标题中的投稿前缀，并写回 BVID、封面、时长、组合和 MV 类型：

```bash
npm run import:bili-season
```

标题清理遵循以下原则：优先保留书名号或日文引号中的歌名；去掉常见投稿标签；保留原始条目无法识别时的可读标题。组合和类型可由旧资料继承，缺失时按标题规则归类。导入完成后重新生成允许解析的目录：

```bash
npm run build:bili-catalog
```

该命令会写入部署仓库的 `../blog_static/netlify/functions/catalog.mjs`。数据变更与目录变更必须一起部署，否则新导入的 MV 会被后端拒绝。

## 本地开发：local-bili-parser

本地方案适合开发和直接测试。服务默认只监听 `127.0.0.1:19180`，会话保存在用户私有目录，页面默认访问 `http://127.0.0.1:19180/api`。

```bash
cd local-bili-parser
npm install
npm start

# 另一个终端：启动静态站
cd ..
npm start
```

打开音乐页后，通过页面的登录流程扫码。服务的 `--allow-origin` 只接受精确 Origin；若页面不是 `http://localhost:3000`，应显式传入自己的站点 Origin：

```bash
npm start -- --allow-origin https://example.com
```

本地实现会代理已经解析好的 Range 请求，让浏览器能安全读取独立的音视频轨道；它不接受任意外部媒体 URL。

## Netlify 部署

生产静态站当前可将 `build/` 同步到 `blog_static`，由 `netlify/functions/bili.mjs` 提供同源 `/api`。构建时必须指定同源 API：

```bash
BILI_PARSER_API=/api BILI_PARSER_MODE=netlify npm run build
```

Netlify Functions 需要以下仅服务端可见的环境变量：

| 变量 | 用途 |
| --- | --- |
| `BILI_SESSION_ENCRYPTION_KEY` | 至少 24 个字符的随机密钥，用于加密 Netlify Blobs 中的 Cookie。 |
| `BILI_PARSER_ADMIN_TOKEN` | 管理二维码登录、状态和退出接口的高强度令牌。 |
| `BILI_ALLOWED_ORIGIN` | 可选。静态站和 Function 同源时不必设置。 |

不要将上述变量写入仓库、Docusaurus 构建变量或浏览器脚本。使用 `tools/bili_qr_login_gui.py` 时，令牌只保留在当前 GUI 进程内。更完整的 Netlify 环境变量和接口说明位于部署仓库的 `NETLIFY-BILI-PARSER.md`。

## Cloudflare Worker 部署

Cloudflare 版本的源代码在 `cloudflare-bili-worker/`，Worker 可同时托管静态 Assets 和 `/api`。先在站点根目录构建，再部署 Worker：

```bash
BILI_PARSER_API=/api BILI_PARSER_MODE=cloudflare npm run build
cd cloudflare-bili-worker
npm install
npx wrangler login
npm run deploy
```

首次部署后创建 `PARSER_ADMIN_TOKEN` 与 `BILI_SESSION_ENCRYPTION_KEY`，使用 `wrangler secret put` 保存。随后以终端登录脚本扫码：

```bash
WORKER_URL=https://your-worker.workers.dev \
PARSER_ADMIN_TOKEN='仅在本机终端使用的令牌' \
npm run login
```

详细的 KV、Assets、跨域和运维说明见仓库内 `cloudflare-bili-worker/README.md`。如果静态站不与 Worker 同源，必须在 `wrangler.jsonc` 中把 `ALLOWED_SITE_ORIGIN` 设置成唯一的完整 Origin，不能使用 `*`。

## Live2D 资源构建

Live2D 运行时及模型的静态产物不直接人工编辑。构建前会执行：

```bash
npm run build:live2d
```

它会把 Cubism R5 的 Web 运行时打包至 `static/live2d/cubism-r5/`。完整站点构建会自动执行该步骤：

```bash
npm run build
```

上游许可证随 `vendor/live2d-cubism-r5/` 一并保留。更新该依赖时，应同时核对上游 CHANGELOG、许可证和最终输出文件。

## 验收清单

- `npm run build` 成功完成；
- 音乐页浅色、深色和移动端均无横向溢出；
- 刷新页面后播放器音量、画质、MV 视图和特效帧率仍被记住；
- 解析端已登录时，`/api/health` 返回已认证状态；
- 选择一支已收录 MV 后，菜单只显示源站实际返回的画质；
- 720P 以下可优先走快速 MP4；1080P、60fps、2K/4K 等无法提供同档位 MP4 时仍可经 DASH 播放；
- 在中国网络环境用**不经过本地代理**的请求实际测量视频与音频 Range 下载。若某个 UPOS 节点慢，应先比较同一签名资源的 B 站允许镜像，并保留原始节点回退；
- 登录 Cookie、管理员令牌、`.dev.vars`、本地会话文件和二维码内容均不出现在 Git 状态或构建产物中。

## 提交与发布建议

建议把数据、前端、解析后端和部署产物拆分提交。数据更新后先生成白名单目录；前端改动完成后再构建并同步 `build/`；最后在部署仓库提交 Function 与静态产物。这样一旦需要回滚，可以分别回退界面、目录数据或解析后端，而不影响已登录的加密会话。
