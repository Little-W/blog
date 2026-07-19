# 本地 Cloudflare Worker 媒体流模拟

这是一个只连接本机受控源站的安全演示，用来验证四件事：

- ArtPlayer 通过 Worker 路径播放 MP4；
- Worker 在服务端加入虚构的 `Cookie` 与 `Referer`；
- `Range` 请求和 `206 Partial Content` 响应被正确透传；
- `Response.body` 直接返回，视频不会被完整缓冲进 Worker 内存。

它不会接收浏览器中的完整网站 Cookie，也不能配置或代理 B 站等第三方站点。

## 对 `bili-parse` 的安全复用

本目录参考了仓库旁的 MIT 项目 `../bili-parse`：沿用“输入视频链接 → 提取 BV/av 与分 P → 返回播放器结果”的交互和 `/api/bili/` 路由命名。实现已重写为 Cloudflare Worker 模块，并做了以下调整：

- 使用严格域名、BV/av 格式、输入长度和分 P 范围校验；
- 返回 `player.bilibili.com` 官方嵌入地址；
- 不调用 `playurl` 获取 CDN 直链；
- 不传入 `high_quality`，不接收或转发 B 站 Cookie/Referer；
- 不保留原项目的开放 CORS、任意平台解析和 Redis 依赖。

相关许可证记录见 `THIRD_PARTY_NOTICES.md`。

## 本地运行

环境要求：Node.js 20 以上、FFmpeg（只在重新生成演示视频时需要）。

```bash
cd worker-demo
npm install --registry=https://registry.npmmirror.com
npm run vendor
```

打开两个终端：

```bash
# 终端 1：需要虚构 Cookie 和 Referer 的本地媒体源
npm run origin
```

```bash
# 终端 2：本地 Cloudflare workerd 运行时
npm run worker
```

然后打开 <http://127.0.0.1:8787/>。自动化验证：

```bash
npm test
```

预期结果：直接访问源站得到 `403`，带本地虚构请求头访问得到 `200`，通过 Worker 发起 `Range: bytes=0-1023` 得到 `206` 和 1024 字节。

## 文件说明

- `src/worker.js`：Cloudflare Worker 模块，固定路径、固定源站、精确 CORS 白名单及流式响应。
- `src/bili-reference.js`：从 `bili-parse` 输入流程改造的安全 BV/av/分 P 解析与官方嵌入地址生成。
- `mock-origin.mjs`：受控本地源站，验证虚构 Cookie/Referer，并实现字节范围请求。
- `public/`：ArtPlayer 前端及页面样式。
- `.dev.vars`：只用于本地的虚构凭据；已被 Git 忽略。
- `.dev.vars.example`：可以提交的示例值。

## 部署到 Cloudflare（仅限你拥有或获授权的媒体源）

本地的 `127.0.0.1:8791` 无法被线上 Worker 访问。上线前必须把 `DEMO_ORIGIN` 改为你控制的 HTTPS 媒体源，把 `ALLOWED_SITE_ORIGIN` 改为你的前端域名，并按源站实际要求调整固定媒体路径。

1. 登录 Cloudflare：

   ```bash
   npx wrangler login
   ```

2. 不要把源站凭据写进 `wrangler.jsonc`。使用加密 Secret：

   ```bash
   npx wrangler secret put DEMO_ORIGIN_COOKIE
   ```

3. 保持 Worker 端固定的源站白名单和媒体路径，不接受前端传入任意 URL、Cookie、Referer 或 Host。

4. 部署 Worker 与 `public/` 静态资源：

   ```bash
   npm run vendor
   npx wrangler deploy
   ```

5. 打开 Wrangler 输出的 `workers.dev` 地址，使用浏览器开发者工具确认视频请求返回 `206`、`Accept-Ranges: bytes`、正确的 `Content-Range`，且响应中没有 `Set-Cookie`。

如果前端和 Worker 分开部署，只将 `ALLOWED_SITE_ORIGIN` 设置为精确的生产域名；不要使用 `*` 配合凭据。生产环境还应加入身份验证、请求速率限制、日志脱敏和源站流量限制。
