---
title: 音乐与 MV 系统说明
sidebar_label: 音乐与 MV 系统
---

# 音乐与 MV 系统

音乐页由静态前端、Netlify Function 解析服务和本地维护工具组成。页面展示本地音乐库和 Project SEKAI MV；B 站登录 Cookie 与管理员令牌不写入浏览器脚本，浏览器只取得短时媒体 URL。

当前部署分为两个环境：开发环境使用 `local-bili-parser`；生产环境将静态页面发布至 `blog_static`，并由其中的 Netlify Function 在同源 `/api` 下提供解析。页面构建时通过 `BILI_PARSER_API=/api` 指向生产接口，不包含管理员令牌或登录 Cookie。

## 功能范围

- 音乐页按歌单展示曲目，支持自定义播放列表、HQ/SQ/Hi-Res 选择、搜索和显示数量设置；
- MV 列表支持组合标签横向滚动、歌名搜索、网格/列表视图与观看状态；
- MV 播放器从 B 站实际返回的 DASH 轨道生成画质菜单，只有源站提供时才显示 1080P、1080P60、2K、4K、HDR 等选项；
- 所有画质首先使用 DASH 视频、音频分轨；该数据通路发生错误时，标准画质可尝试同档位单段 MP4，再依次尝试备用 CDN 与重新解析；
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
| `../blog_static/netlify/functions/bili.mjs` | 生产环境的 Netlify Function；保存会话、查询播放信息并返回受限 MV 的播放清单。 |
| `../blog_static/netlify/functions/catalog.mjs` | 由构建脚本生成的 BVID 与分 P 白名单。 |
| `tools/bili_qr_login_gui.py` | Netlify 后端扫码登录的图形化管理工具。 |
| `vendor/live2d-cubism-r5/` | Live2D Cubism R5 上游运行时源文件与许可证。 |

## 前端数据流

```text
JSON-streaming 数据文件
        │
        ├── 音乐列表 / APlayer
        └── MV 卡片 ──点击或预取──> /api/resolve
                                          │
                         Netlify Function：短时 DASH 清单 + 实际轨道
                                          │
                          Video.js DASH / 同档位单段 MP4
                                          │
                                   B 站 UPOS CDN
```

页面只取得短时媒体 URL 和播放清单，不取得 B 站登录 Cookie。解析服务只接受收录在 MV 目录内的 BVID 与分 P，不能用作任意 URL 的开放代理。

## 画质与播放策略

1. 页面请求 `/api/resolve?bvid=…&p=…`。
2. Function 先检查 `catalog.mjs` 中的 BVID 与分 P，再以服务器保存的登录会话查询视频资料和 `x/player/playurl`。请求使用 `fnval=4048`、`fourk=1` 和 `platform=html5`，以取得 DASH 视频轨道、音频轨道和实际支持的档位。
3. Function 按返回的轨道建立画质菜单，保留分辨率、编码、码率、初始化范围和备用 URL。没有对应轨道时，菜单中不会出现该档位。
4. 页面首先将 Function 返回的 MPD 内容交给 Video.js/VHS，使视频轨道与音频轨道同步播放。默认选择已保存的画质；没有已保存的档位时选择 720P，仍不存在时选择最高实际档位。
5. DASH 首次装载失败后，页面对相同清单重试一次；其后仅在接口确实返回同档位、单分段 `durl` 时使用单段 MP4。MP4 及其备用 URL 失败后，页面继续尝试 DASH 备用 URL，并在需要时重新请求 `/api/resolve`。

画质菜单的内容由当次 `playurl` 响应决定，因此可显示 1080P、1080P60、2K、4K、HDR 等实际返回的档位。

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

生产静态站将 `build/` 同步到 `blog_static`，由 `netlify/functions/bili.mjs` 提供同源 `/api`。构建时必须指定同源 API：

```bash
BILI_PARSER_API=/api BILI_PARSER_MODE=netlify npm run build
```

Netlify Functions 需要以下仅服务端可见的环境变量：

| 变量 | 用途 |
| --- | --- |
| `BILI_SESSION_ENCRYPTION_KEY` | 至少 24 个字符的随机密钥，用于加密 Netlify Blobs 中的 Cookie。 |
| `BILI_PARSER_ADMIN_TOKEN` | 管理二维码登录、状态和退出接口的高强度令牌。 |
| `BILI_ALLOWED_ORIGIN` | 可选。静态站和 Function 同源时不必设置。 |

不要将上述变量写入仓库、Docusaurus 构建变量或浏览器脚本。使用 `tools/bili_qr_login_gui.py` 时，令牌只保留在当前 GUI 进程内。完整的环境变量和接口说明位于部署仓库的 `NETLIFY-BILI-PARSER.md`。

发布时先执行 `npm run build:bili-catalog`，再以 `BILI_PARSER_API=/api BILI_PARSER_MODE=netlify npm run build` 生成静态文件。将 `build/` 同步至 `blog_static` 后，提交静态文件、`netlify/functions/catalog.mjs` 与相关 Function 修改，并推送 `blog_static` 的 `main` 分支。Netlify 以 `netlify.toml` 中的配置发布静态文件和 Function。

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
- 默认 720P 可播放；1080P、60fps、2K、4K 等仅在源站返回时显示并可经 DASH 播放；
- 在中国网络环境用**不经过本地代理**的请求实际测量视频与音频 Range 下载。若某个 UPOS 节点慢，应先比较同一签名资源的 B 站允许镜像，并保留原始节点回退；
- 登录 Cookie、管理员令牌、`.dev.vars`、本地会话文件和二维码内容均不出现在 Git 状态或构建产物中。

## 提交与发布建议

建议将数据、前端、解析 Function 与部署产物分开提交。数据更新后先生成白名单目录；前端改动完成后再构建并同步 `build/`；最后在部署仓库提交 Function 与静态产物。需要回退时可分别恢复界面、目录数据或解析 Function，不影响已加密保存的登录会话。
