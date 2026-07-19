# Website

基于 [Docusaurus 2](https://docusaurus.io/) 的个人静态站点。除博客与文档外，站点包含一个可维护的音乐库、Project SEKAI MV 播放页、显示/特效设置以及 Live2D 资源构建流程。

## 音乐与 MV 系统

音乐页不再依赖一段难以维护的内联脚本：React 页面负责结构和无障碍语义，`static/custom/` 中的兼容脚本负责 APlayer、Video.js、MV 筛选与画质切换，数据文件则以 JSON-streaming 格式独立保存。MV 解析服务始终将 B 站登录信息留在服务端或本机，不会把 Cookie、管理员令牌或任意 URL 代理能力暴露给浏览器。

| 模块 | 作用 |
| --- | --- |
| `src/pages/music/` | 音乐库和 MV 页面布局、搜索、视图切换及响应式样式。 |
| `src/pages/settings/` | 主题、特效开关及特效帧率上限；设置保存在浏览器本地。 |
| `static/data/` | 音乐、歌单、MV、组合和 B 站来源目录。 |
| `local-bili-parser/` | 默认仅监听 `127.0.0.1` 的本地扫码登录/解析服务。 |
| `../blog_static/netlify/functions/` | 生产环境的 Netlify Function：B 站会话保存、受限 MV 解析和目录白名单。 |
| `scripts/` | B 站合集导入、解析器允许目录和 Live2D 运行时构建脚本。 |

完整的架构、播放策略、数据更新、Netlify/本地运行方式和密钥管理见 [音乐与 MV 系统说明](docs/etc/music-mv-player.md)。另见[解析 B 站视频直链并嵌入博客的方法](docs/etc/bilibili-direct-url-embed.md)。

### 本地启动

```bash
npm install
npm run build:live2d   # 首次或更新 Live2D 源码后执行；npm run build 会自动执行
npm start
```

如需在本地实际解析并播放 B 站 MV，请在另一终端启动仅回环可访问的服务：

```bash
cd local-bili-parser
npm install
npm start
```

默认页面会请求 `http://127.0.0.1:19180/api`。生产构建必须改为同源的 `/api`，并由 `blog_static` 中的 Netlify Function 提供解析；不要把登录 Cookie 或管理员令牌写入本仓库。

### Installation

```
$ yarn
```

### Local Development

```
$ yarn start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

```
$ yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

### Deployment

Using SSH:

```
$ USE_SSH=true yarn deploy
```

Not using SSH:

```
$ GIT_USER=<Your GitHub username> yarn deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.
